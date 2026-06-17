# Multiplayer M2 — Client Prediction + Gameplay Fixes (Design Spec)

**Date:** 2026-06-16
**Status:** Approved for planning
**Scope:** Client-side prediction, server reconciliation, entity interpolation, lag compensation, and gameplay feature fixes for multiplayer clients.
**Depends on:** M1 (Transport + co-op, 2 players, dumb clients) — already merged.

---

## 1. Background

M1 shipped a working multiplayer pipe: host/join by room code, remote-player rendering, co-op vs bots. However, clients cannot meaningfully play because:

- No client-side prediction — all actions have 1-RTT input lag
- Pickups only check the host player (`GameSession.ts:193-204`)
- Death events only fire for the host (`GameSession.ts:184-188`)
- Buy menu targets the host's local player only (`App.tsx:686-699`)
- Wave spawning is host-only (`App.tsx:583-585`)

This spec adds the missing M2 features: client prediction + reconciliation for responsive local play, lag compensation for fair hit detection, and fixes all gameplay gaps so clients are full participants.

### Design decisions

- **Snapshot rate:** 30 ticks/sec (host simulates at fixed 1/30s, broadcasts every tick)
- **Prediction:** Client predicts local player only; remote players interpolate
- **Reconciliation:** Smooth correction over ~100ms (not hard snap)
- **Packet ordering:** Sequence numbers on both inputs and snapshots; stale packets discarded
- **Snapshot format:** Full state every tick (monolithic) — simple, robust, bandwidth negligible at <10 players

---

## 2. Goals & non-goals

### Goals

- Client-side prediction + server reconciliation so the local player feels responsive (~0ms perceived input lag)
- Entity interpolation for smooth remote player movement (~100ms render delay)
- Lag compensation for fair hit detection (rewind enemy positions to what the shooter saw)
- Pickups work for all players
- Death events fire for all players
- Buy menu works for clients (sends buy request to host)
- Wave spawning configurable (host-owned, client can request)

### Non-goals

- No host migration (deferred)
- No PvP (M3 scope)
- No delta compression (full snapshots sufficient for <10 players)
- No client-side prediction for remote players

---

## 3. Protocol Changes

### 3.1 Input message

```ts
interface PlayerInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  shoot: boolean
  yaw: number
  pitch: number
  seq: number        // monotonically increasing, client-assigned
  renderTime: number // performance.now() when input was captured
}
```

### 3.2 Snapshot message

```ts
interface Snapshot {
  tick: number
  seq: number                          // snapshot sequence (host-assigned)
  ack: Record<string, number>          // per-player: last input seq the host applied
  players: EntityState[]
  enemies: EntityState[]
  events: SessionEvent[]               // effect events travel with the snapshot
}
```

### 3.3 New net messages

```ts
// Buy request from client to host
{ type: 'buy'; playerId: string; item: string }

// Wave start request from client to host
{ type: 'startWave'; playerId: string }
```

### 3.4 Extended session events

```ts
// playerDied gains a playerId field
{ type: 'playerDied'; playerId: string }

// pickup gains a playerId field
{ type: 'pickup'; pickupType: string; value: number; playerId: string }
```

---

## 4. Client Prediction + Reconciliation

### 4.1 Prediction

`NetClient` maintains:
- `localSeq: number` — increments each input sent
- `pendingInputs: Map<number, PlayerInput>` — inputs sent but not yet acknowledged
- Local `Player` instance for the client's own entity (position/rotation from last snapshot)

Each frame:
1. Capture input, assign `seq = ++localSeq`, add to `pendingInputs`
2. Apply input to local `Player` using same `player.update(dt, input, ARENA_SIZE)` the host runs
3. Render camera from locally-predicted position

### 4.2 Reconciliation

When snapshot arrives with `ack[playerId] = N`:
1. Delete all `pendingInputs` with `seq <= N` (host has processed them)
2. Snap local `Player` to authoritative position from snapshot
3. Replay all remaining `pendingInputs` (seq > N) on top of authoritative state
4. Result is the predicted present

### 4.3 Smooth Correction

Instead of snapping instantly, interpolate toward reconciled position over ~100ms:

```ts
const error = reconciledPosition.clone().sub(currentRenderedPosition)
if (error.lengthSq() > 0.001) {
  cameraPosition.lerp(reconciledPosition, Math.min(1, dt / 0.1))
}
```

Yaw/pitch snap immediately (rotation mispredictions are rare and snapping is imperceptible).

### 4.4 Buffer Limits

Cap `pendingInputs` at 256 entries (~8 seconds at 30Hz). Drop oldest if exceeded.

---

## 5. Entity Interpolation

### 5.1 Interpolation Buffer

Each remote entity stores the last 2 snapshots with timestamps:

```ts
interface InterpolationBuffer {
  entries: Array<{ snapshot: EntityState; receivedAt: number }>
}
```

Discard entries older than 200ms.

### 5.2 Render Delay

Client renders at `now - 100ms` (fixed delay). This guarantees two bracketing snapshots always exist, trading 100ms for complete smoothness.

### 5.3 Interpolation Logic

Each frame, for each remote entity:
1. Compute `renderTime = performance.now() - INTERP_DELAY`
2. Find two snapshots bracketing `renderTime`
3. Linearly interpolate position, yaw, pitch
4. Render at interpolated transform

### 5.4 What Gets Interpolated

| Entity | Interpolated fields | Notes |
|--------|-------------------|-------|
| Remote players | position, yaw, pitch | Weapon model + nameplate follow |
| Enemies (client) | position, rotationY | Health bar, death from snapshot state |
| Pickups (client) | static, no interpolation | Spawn/despawn based on snapshot |

### 5.5 Host Behavior

Host renders directly from session state (zero-latency). No interpolation on host.

---

## 6. Lag Compensation

### 6.1 Ring Buffer

`LagCompensation.ts` stores enemy positions per tick (~1 second, ~30 entries):

```ts
class LagCompensation {
  private history: Array<{ tick: number; enemies: Map<string, THREE.Vector3> }> = []
  private maxAge = 1000

  record(tick: number, enemies: Enemy[]): void { ... }
  rewind(renderTime: number): Map<string, THREE.Vector3> | null { ... }
}
```

### 6.2 Rewind on Shot

When host processes a shot with `renderTime`:
1. Compute lag: `hostTime - renderTime`
2. Find historical snapshot closest to `renderTime`
3. Temporarily reposition enemies to rewound positions
4. Run existing raycast + hit detection
5. Restore enemies to current positions
6. Apply damage in the present

### 6.3 Bounds

- History capped at 1 second. Older renderTime falls back to current positions.
- Rewind affects only raycast geometry, not game logic.

---

## 7. Gameplay Feature Fixes

### 7.1 Pickups — All Players

Replace local-player-only check with iteration over all players:

```ts
for (const entity of this.playerMap.values()) {
  const player = entity.player
  for (let i = this.pickups.length - 1; i >= 0; i--) {
    const pickup = this.pickups[i]
    if (pickup.checkCollision(player.position)) {
      if (pickup.type === 'health') player.heal(pickup.value)
      else entity.weapons.addAmmo(entity.weapons.current.type, pickup.value)
      events.push({ type: 'pickup', pickupType: pickup.type, value: pickup.value, playerId: entity.id })
      this.pickups.splice(i, 1)
      break
    }
  }
}
```

### 7.2 Death Events — All Players

Fire `playerDied` for any player, tagged with their ID:

```ts
if (targetPlayer.isDead) {
  events.push({ type: 'playerDied', playerId: target.id })
  if (target.id === this.localId) return events
}
```

### 7.3 Buy Menu — Networked

Client sends `{ type: 'buy'; playerId; item }` to host. Host validates and applies via `applyItem(entity, item)`.

### 7.4 Wave Spawning — Co-op

Host-owned waves (by design). Client can send `{ type: 'startWave'; playerId }` to request. Host decides whether to spawn.

### 7.5 Snapshot Events Delivery

Session events bundled in snapshot's `events` array. Client processes them same as host — audio, particles, HUD — keyed on client's own `playerId` for personal effects.

---

## 8. Data Flow

```
Client:  keyboard/mouse → Controls → PlayerInput{seq, renderTime}
         → NetClient.send(input) over PeerTransport (unreliable)
         → predict locally: applyInput + Player.update()

Host:    receive inputs → GameSession.applyInput(playerId, input)
         → every fixed tick: GameSession.step(1/30)
         → record LagCompensation history
         → broadcast snapshot{tick, seq, ack, entities, events}

Client:  on snapshot → reconcile local player (snap + replay unacked)
                     → push remote/bot states into interpolation buffers
                     → replay effect events (audio/particles)
         render: local player from prediction; remotes interpolated ~100ms behind
```

---

## 9. Files Changed

| File | Change |
|------|--------|
| `src/session/protocol.ts` | Add `seq`/`renderTime` to `PlayerInput`; add `seq`/`ack`/`events` to `Snapshot`; add `buy`/`startWave` net messages; extend `playerDied`/`pickup` events |
| `src/net/NetClient.ts` | Add prediction state, reconciliation, interpolation buffer, smooth correction |
| `src/net/NetHost.ts` | Process `buy`/`startWave` messages; stamp `ack` on snapshots |
| `src/net/LagCompensation.ts` | New — ring buffer + rewind for hit detection |
| `src/session/GameSession.ts` | Fix pickups for all players; fix death events for all players; add `lagCompensation` field; accept `renderTime` on shot resolution |
| `src/App.tsx` | Client prediction loop; reconciliation camera; snapshot event processing; buy menu network calls; wave request |

---

## 10. Testing Strategy

**Unit (Vitest):**
- `NetHost` + `NetClient` over `LoopbackTransport`: client inputs produce same result as host
- Reconciliation convergence: given inputs + delayed snapshots, reconciled state matches authority
- Interpolation: buffer returns correctly blended transforms for given render-time
- Lag-comp rewind: shot at render-time T hits target at position-at-T, not present position
- Pickups: all players collect, not just local
- Death events: fire for any player, not just local

**E2E (Playwright):**
- Two browser contexts: host + client both move and see each other respond
- Client picks up health/ammo
- Client dies → game-over feedback
- Client buys weapon → host applies

**Regression:** existing single-player tests stay green.

---

## 11. Definition of Done

- Local player feels responsive (prediction + reconciliation) — no perceptible input lag
- Remote players move smoothly (interpolation)
- Hits register fairly (lag compensation)
- Clients can pick up items, die with feedback, buy weapons
- All new unit/E2E tests pass; existing tests green; no single-player regression
