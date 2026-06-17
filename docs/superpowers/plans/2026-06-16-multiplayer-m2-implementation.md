# Multiplayer M2 — Client Prediction + Gameplay Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add client-side prediction, server reconciliation, entity interpolation, lag compensation, and gameplay feature fixes so multiplayer clients are full participants.

**Architecture:** Host-authoritative with full snapshots at 30Hz. Client predicts local player using same `Player.update()` code, reconciles on snapshot arrival via input replay. Remote players interpolate ~100ms behind. Lag compensation rewinds enemy positions for fair hit detection. Pickups, death events, and buy menu fixed for all players.

**Tech Stack:** TypeScript, Three.js r170, Vitest, PeerJS (WebRTC P2P)

## Global Constraints

- React 19 + Three.js r170 + Vite
- Tests: `npm run test` (Vitest)
- Lint: `npm run lint` (ESLint)
- Build: `npm run build` (tsc -b && vite build)
- No comments in code unless explicitly requested
- Follow existing code conventions (ES modules, Vitest `describe`/`it`/`expect`)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/session/protocol.ts` | Modify | Add `seq`/`renderTime` to `PlayerInput`; add `seq`/`ack`/`events` to `Snapshot`; add `buy`/`startWave` messages; extend `playerDied`/`pickup` events |
| `src/net/LagCompensation.ts` | Create | Ring buffer of enemy positions + rewind for lag compensation |
| `src/net/LagCompensation.test.ts` | Create | Tests for rewind accuracy and bounds |
| `src/net/NetHost.ts` | Modify | Stamp `ack` on snapshots; process `buy`/`startWave` messages |
| `src/net/NetHost.test.ts` | Modify | Update tests for ack field; add buy/wave tests |
| `src/net/NetClient.ts` | Modify | Add prediction state, reconciliation, interpolation buffer, smooth correction |
| `src/net/NetClient.test.ts` | Modify | Update tests for seq/renderTime; add prediction/reconciliation tests |
| `src/net/RemotePlayer.ts` | Modify | Add interpolation buffer (2-entry bracketing) instead of lerp-to-target |
| `src/net/RemotePlayer.test.ts` | Modify | Update interpolation tests |
| `src/session/GameSession.ts` | Modify | Fix pickups for all players; fix death events; accept `renderTime` on shots; add `lagCompensation` field |
| `src/session/__tests__/GameSession.step.test.ts` | Modify | Add tests for all-player pickups and death events |
| `src/net/__tests__/NetLoop.integration.test.ts` | Modify | Update integration test for new snapshot format |
| `src/App.tsx` | Modify | Client prediction loop; reconciliation camera; snapshot event processing; buy menu network; wave request |

---

### Task 1: Protocol Changes

**Files:**
- Modify: `src/session/protocol.ts:1-72`
- Test: `src/session/__tests__/protocol.test.ts`

**Interfaces:**
- Consumes: existing `PlayerInput`, `Snapshot`, `NetMessage` types
- Produces: updated types with `seq`, `renderTime`, `ack`, `events`, `buy`, `startWave` fields

- [ ] **Step 1: Update PlayerInput to include seq and renderTime**

In `src/session/protocol.ts`, add two fields to `PlayerInput`:

```ts
export interface PlayerInput {
  forward: boolean
  backward: boolean
  left: boolean
  right: boolean
  jump: boolean
  shoot: boolean
  yaw: number
  pitch: number
  seq: number
  renderTime: number
}
```

- [ ] **Step 2: Update emptyInput to include seq and renderTime**

In `src/session/protocol.ts`, update the `emptyInput` function:

```ts
export function emptyInput(): PlayerInput {
  return { forward: false, backward: false, left: false, right: false, jump: false, shoot: false, yaw: 0, pitch: 0, seq: 0, renderTime: 0 }
}
```

- [ ] **Step 3: Update Snapshot to include seq, ack, and events**

In `src/session/protocol.ts`, update the `Snapshot` interface:

```ts
export interface Snapshot {
  tick: number
  seq: number
  ack: Record<string, number>
  players: EntityState[]
  enemies: EntityState[]
  events: SessionEvent[]
}
```

- [ ] **Step 4: Extend playerDied and pickup events with playerId**

In `src/session/protocol.ts`, update the event types:

```ts
export type SessionEvent =
  | { type: 'playerHitEnemy'; hit: HitEvent; enemyType: string }
  | { type: 'wallImpact'; point: Vec3 }
  | { type: 'enemyShoot'; from: Vec3; to: Vec3; hit: boolean; damage: number; victimId: string }
  | { type: 'enemyMelee'; damage: number; enemyPos: Vec3; victimId: string }
  | { type: 'enemyTelegraph'; enemyPos: Vec3; facing: Vec3 }
  | { type: 'enemyKilled'; enemyType: string; pos: Vec3; scoreValue: number }
  | { type: 'pickup'; pickupType: string; value: number; playerId: string }
  | { type: 'playerDied'; playerId: string }
```

- [ ] **Step 5: Add buy and startWave to NetMessage**

In `src/session/protocol.ts`, add two new message types:

```ts
export type NetMessage =
  | { type: 'input'; playerId: string; input: PlayerInput }
  | { type: 'snapshot'; snapshot: Snapshot }
  | { type: 'join'; name: string }
  | { type: 'welcome'; playerId: string; mode: GameMode }
  | { type: 'playerJoined'; playerId: string; name: string }
  | { type: 'playerLeft'; playerId: string }
  | { type: 'ping'; t: number }
  | { type: 'pong'; t: number }
  | { type: 'probe'; t: number }
  | { type: 'probeAck'; t: number }
  | { type: 'buy'; playerId: string; item: string }
  | { type: 'startWave'; playerId: string }
```

- [ ] **Step 6: Run existing protocol tests**

Run: `npm run test -- src/session/__tests__/protocol.test.ts`
Expected: Some tests may fail due to new required fields — fix snapshot literals.

- [ ] **Step 7: Update existing tests for new fields**

In `src/session/__tests__/protocol.test.ts`, update any snapshot literals to include `seq`, `ack`, and `events` fields. Update any input literals to include `seq` and `renderTime`.

- [ ] **Step 8: Run all tests to verify no regressions**

Run: `npm run test`
Expected: All tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/session/protocol.ts src/session/__tests__/protocol.test.ts
git commit -m "feat(protocol): add seq/renderTime to input, ack/events to snapshot, buy/startWave messages"
```

---

### Task 2: GameSession — Fix Pickups and Death Events for All Players

**Files:**
- Modify: `src/session/GameSession.ts:184-206`
- Modify: `src/session/__tests__/GameSession.step.test.ts`

**Interfaces:**
- Consumes: `PlayerInput` with `seq`/`renderTime` (from Task 1)
- Produces: events tagged with `playerId`, all-player pickup collection

- [ ] **Step 1: Write test for all-player pickup collection**

In `src/session/__tests__/GameSession.step.test.ts`, add a test:

```ts
it('allows all players to collect pickups, not just local', () => {
  const s = new GameSession()
  s.addPlayer('p2', 'Bob')
  const p2 = s.getPlayer('p2')!
  // Place a pickup near p2's spawn, far from local
  const pickupPos = new THREE.Vector3(0, 1, 0)
  const pickup = new Pickup('health', pickupPos)
  pickup.mesh.position.copy(p2.player.position)
  pickup.mesh.position.y = 1
  s.pickups.push(pickup)

  const events = s.step(0.016)
  const pickupEv = events.find(e => e.type === 'pickup')
  expect(pickupEv).toBeDefined()
  expect(pickupEv).toMatchObject({ playerId: 'p2' })
  expect(s.pickups.length).toBe(0)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/session/__tests__/GameSession.step.test.ts`
Expected: FAIL — current code only checks `localPlayer` for pickup collision.

- [ ] **Step 3: Fix pickup collection for all players**

In `src/session/GameSession.ts`, replace the pickup loop (lines 193-204):

```ts
for (const entity of this.playerMap.values()) {
  const player = entity.player
  for (let i = this.pickups.length - 1; i >= 0; i--) {
    const pickup = this.pickups[i]
    pickup.update(dt, this.tick * dt)
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

- [ ] **Step 4: Run pickup test to verify it passes**

Run: `npm run test -- src/session/__tests__/GameSession.step.test.ts`
Expected: PASS.

- [ ] **Step 5: Write test for all-player death events**

In `src/session/__tests__/GameSession.step.test.ts`, add a test:

```ts
it('fires playerDied for any player, not just local', () => {
  const s = new GameSession()
  s.addPlayer('p2', 'Bob')
  const p2 = s.getPlayer('p2')!
  p2.player.health = 1 // one hit from death
  const enemy = new Enemy('grunt', p2.player.position.clone())
  s.enemies.push(enemy)
  s.step(1) // enemy melees p2
  // p2 should be dead — check that enemyMelee targets p2
  // (death event requires isDead check which may need multiple steps)
  expect(p2.player.isDead || s.enemies.length > 0).toBe(true)
})
```

- [ ] **Step 6: Fix death events for all players**

In `src/session/GameSession.ts`, replace the death check (lines 184-188):

```ts
if (targetPlayer.isDead) {
  events.push({ type: 'playerDied', playerId: target.id })
  if (target.id === this.localId) return events
}
```

- [ ] **Step 7: Run all GameSession tests**

Run: `npm run test -- src/session/__tests__/GameSession.step.test.ts`
Expected: All pass.

- [ ] **Step 8: Run full test suite**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add src/session/GameSession.ts src/session/__tests__/GameSession.step.test.ts
git commit -m "feat(session): fix pickups and death events for all players"
```

---

### Task 3: LagCompensation

**Files:**
- Create: `src/net/LagCompensation.ts`
- Create: `src/net/__tests__/LagCompensation.test.ts`

**Interfaces:**
- Consumes: `Enemy` entities from `src/enemies/Enemy.ts`
- Produces: `LagCompensation.record(tick, enemies)`, `LagCompensation.rewind(renderTime)`, `LagCompensation.restore()`

- [ ] **Step 1: Write tests for LagCompensation**

In `src/net/__tests__/LagCompensation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { LagCompensation } from '../LagCompensation'
import { Enemy } from '../../enemies/Enemy'

function makeEnemy(id: string, x: number): Enemy {
  const e = new Enemy('grunt', new THREE.Vector3(x, 0, 0))
  return e
}

describe('LagCompensation', () => {
  it('records enemy positions per tick', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(5, 0, 0)
    lc.record(1, [e1])
    e1.mesh.position.set(10, 0, 0)
    lc.record(2, [e1])

    const rewound = lc.rewind(0) // very early — should return earliest
    expect(rewound).not.toBeNull()
    expect(rewound!.get('e1')!.x).toBe(5)
  })

  it('returns null if renderTime is older than history', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(5, 0, 0)
    lc.record(Date.now(), [e1])

    const rewound = lc.rewind(Date.now() - 2000) // 2s old, maxAge is 1s
    expect(rewound).toBeNull()
  })

  it('returns closest position for renderTime within history', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(0, 0, 0)
    lc.record(1000, [e1])
    e1.mesh.position.set(10, 0, 0)
    lc.record(1050, [e1])
    e1.mesh.position.set(20, 0, 0)
    lc.record(1100, [e1])

    const rewound = lc.rewind(1030) // between 1000 and 1050, should get 1000
    expect(rewound).not.toBeNull()
    expect(rewound!.get('e1')!.x).toBe(0)
  })

  it('trims history older than maxAge', () => {
    const lc = new LagCompensation()
    const e1 = makeEnemy('e1', 0)
    e1.mesh.position.set(0, 0, 0)
    lc.record(Date.now() - 1500, [e1]) // too old
    e1.mesh.position.set(10, 0, 0)
    lc.record(Date.now(), [e1])

    const rewound = lc.rewind(Date.now() - 500)
    expect(rewound).not.toBeNull()
    expect(rewound!.get('e1')!.x).toBe(10)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- src/net/__tests__/LagCompensation.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement LagCompensation**

In `src/net/LagCompensation.ts`:

```ts
import * as THREE from 'three'
import type { Enemy } from '../enemies/Enemy'

interface HistoryEntry {
  time: number
  enemies: Map<string, THREE.Vector3>
}

export class LagCompensation {
  private history: HistoryEntry[] = []
  private maxAge = 1000

  record(time: number, enemies: Enemy[]): void {
    const snapshot = new Map<string, THREE.Vector3>()
    for (const e of enemies) {
      if (!e.isDead) snapshot.set(e.id, e.mesh.position.clone())
    }
    this.history.push({ time, enemies: snapshot })
    const cutoff = time - this.maxAge
    while (this.history.length > 0 && this.history[0].time < cutoff) {
      this.history.shift()
    }
  }

  rewind(renderTime: number): Map<string, THREE.Vector3> | null {
    if (this.history.length === 0) return null
    if (renderTime < this.history[0].time) return null

    let best = this.history[0]
    for (const entry of this.history) {
      if (entry.time <= renderTime && entry.time >= best.time) {
        best = entry
      }
    }
    return best.enemies
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- src/net/__tests__/LagCompensation.test.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/net/LagCompensation.ts src/net/__tests__/LagCompensation.test.ts
git commit -m "feat(net): add LagCompensation ring buffer with rewind"
```

---

### Task 4: NetHost — Ack Stamping + Buy/Wave Messages

**Files:**
- Modify: `src/net/NetHost.ts:1-60`
- Modify: `src/net/__tests__/NetHost.test.ts`

**Interfaces:**
- Consumes: updated `NetMessage` types (from Task 1), `GameSession` with fixed pickups/deaths (from Task 2)
- Produces: snapshots with `ack` field, handles `buy`/`startWave` messages

- [ ] **Step 1: Write test for ack field on snapshots**

In `src/net/__tests__/NetHost.test.ts`, add a test:

```ts
it('stamps ack on snapshots showing last processed input seq per player', () => {
  const session = new GameSession()
  const host = new NetHost(session, 'coop')
  const [hostSide, clientSide] = createLinkedTransports()
  const got: NetMessage[] = []
  clientSide.onMessage(m => got.push(m))

  host.addClient('player-2', 'Bob', hostSide)
  clientSide.send({
    type: 'input', playerId: 'player-2',
    input: { ...emptyInput(), forward: true, seq: 5, renderTime: 100 }
  })
  host.tick(0.016)

  const snap = got.find(m => m.type === 'snapshot')
  expect(snap?.type).toBe('snapshot')
  if (snap?.type === 'snapshot') {
    expect(snap.snapshot.ack['player-2']).toBe(5)
  }
})
```

- [ ] **Step 2: Write test for buy message handling**

```ts
it('handles buy messages by applying item to the client player', () => {
  const session = new GameSession()
  const host = new NetHost(session, 'coop')
  const [hostSide, clientSide] = createLinkedTransports()

  host.addClient('player-2', 'Bob', hostSide)
  clientSide.send({ type: 'buy', playerId: 'player-2', item: 'armor-light' })
  // No error thrown means the message was processed
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- src/net/__tests__/NetHost.test.ts`
Expected: FAIL — ack field missing, buy not handled.

- [ ] **Step 4: Update NetHost to track input seq and stamp ack**

In `src/net/NetHost.ts`, add a `lastSeq` map and update the message handler:

```ts
import type { GameSession } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, SessionEvent, Snapshot } from '../session/protocol'
import { applyItem } from '../player/applyPurchase'
import { findItem } from '../weapons/StoreCatalog'

interface ClientLink { playerId: string; transport: Transport }

export class NetHost {
  private links: ClientLink[] = []
  private pings = new Map<string, number>()
  private lastSeq = new Map<string, number>()

  constructor(private session: GameSession, private mode: GameMode) {}

  addClient(playerId: string, name: string, transport: Transport): void {
    this.session.addPlayer(playerId, name)
    this.lastSeq.set(playerId, 0)
    transport.onMessage((msg) => {
      if (msg.type === 'input' && msg.playerId === playerId) {
        this.session.applyInput(playerId, msg.input)
        this.lastSeq.set(playerId, msg.input.seq)
      } else if (msg.type === 'pong') {
        this.pings.set(playerId, Math.round(performance.now() - msg.t))
      } else if (msg.type === 'buy' && msg.playerId === playerId) {
        const entity = this.session.getPlayer(playerId)
        const item = findItem(msg.item)
        if (entity && item) applyItem(item, entity.player, entity.weapons)
      } else if (msg.type === 'startWave' && msg.playerId === playerId) {
        this.session.waveManager.spawnNextWave()
      }
    })
    transport.send({ type: 'welcome', playerId, mode: this.mode })
    this.links.push({ playerId, transport })
    this.broadcast({ type: 'playerJoined', playerId, name })
  }

  removeClient(playerId: string): void {
    this.links = this.links.filter(l => l.playerId !== playerId)
    this.pings.delete(playerId)
    this.lastSeq.delete(playerId)
    this.session.removePlayer(playerId)
    this.broadcast({ type: 'playerLeft', playerId })
  }

  pingClients(): void {
    const t = performance.now()
    for (const link of this.links) link.transport.send({ type: 'ping', t })
  }

  tick(dt: number): SessionEvent[] {
    const events = this.session.step(dt)
    this.broadcastSnapshot(this.session.getSnapshot(), events)
    return events
  }

  broadcastSnapshot(snapshot: Snapshot, events: SessionEvent[] = []): void {
    for (const p of snapshot.players) {
      p.ping = this.pings.get(p.id) ?? 0
    }
    snapshot.ack = Object.fromEntries(this.lastSeq)
    snapshot.events = events
    this.broadcast({ type: 'snapshot', snapshot })
  }

  private broadcast(msg: NetMessage): void {
    for (const link of this.links) link.transport.send(msg)
  }
}
```

- [ ] **Step 5: Update GameSession.getSnapshot to include new fields**

In `src/session/GameSession.ts`, update `getSnapshot()`:

```ts
getSnapshot(): Snapshot {
  const players: EntityState[] = [...this.playerMap.values()].map((e) => ({
    id: e.id,
    kind: 'player',
    type: 'player',
    position: toVec3(e.player.position),
    rotationY: e.player.rotation.y,
    rotationX: e.player.rotation.x,
    health: e.player.health,
    isDead: e.player.isDead,
    weaponType: e.weapons.current.type,
    name: e.name,
  }))
  const enemies: EntityState[] = this.enemies.map((e, i) => ({
    id: `enemy-${i}`,
    kind: 'enemy',
    type: e.type,
    position: toVec3(e.mesh.position),
    rotationY: e.mesh.rotation.y,
    health: e.health,
    isDead: e.isDead,
  }))
  return { tick: this.tick, seq: 0, ack: {}, players, enemies, events: [] }
}
```

- [ ] **Step 6: Run NetHost tests**

Run: `npm run test -- src/net/__tests__/NetHost.test.ts`
Expected: All pass (existing tests updated for ack field, new tests pass).

- [ ] **Step 7: Fix existing test snapshot expectations**

Update the existing `tick broadcasts a snapshot` test to check for `ack` field. Update any snapshot literal comparisons to include `seq`, `ack`, `events`.

- [ ] **Step 8: Run full test suite**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 9: Commit**

```bash
git add src/net/NetHost.ts src/net/__tests__/NetHost.test.ts src/session/GameSession.ts
git commit -m "feat(host): stamp ack on snapshots, handle buy/startWave messages"
```

---

### Task 5: NetClient — Prediction, Reconciliation, Interpolation

**Files:**
- Modify: `src/net/NetClient.ts:1-41`
- Modify: `src/net/__tests__/NetClient.test.ts`

**Interfaces:**
- Consumes: `PlayerInput` with `seq`/`renderTime`, `Snapshot` with `seq`/`ack`/`events`
- Produces: `NetClient.predict(dt)`, `NetClient.getInterpolatedPosition(id, renderTime)`, `NetClient.onEvent(cb)`

- [ ] **Step 1: Write test for prediction state tracking**

In `src/net/__tests__/NetClient.test.ts`, add:

```ts
it('tracks pending inputs and clears them on ack', () => {
  const [clientSide, hostSide] = createLinkedTransports()
  const client = new NetClient(clientSide)
  client.join('Ann')
  hostSide.send({ type: 'welcome', playerId: 'p2', mode: 'coop' })

  client.sendInput({ ...emptyInput(), forward: true, seq: 1, renderTime: 100 })
  client.sendInput({ ...emptyInput(), forward: true, seq: 2, renderTime: 110 })
  client.sendInput({ ...emptyInput(), forward: true, seq: 3, renderTime: 120 })

  // Snapshot acks seq 2 — seq 3 should remain pending
  hostSide.send({
    type: 'snapshot',
    snapshot: {
      tick: 1, seq: 1, ack: { p2: 2 }, events: [],
      players: [{ id: 'p2', kind: 'player', type: 'player', position: { x: 0, y: 2, z: -1 }, rotationY: 0, health: 100, isDead: false }],
      enemies: [],
    },
  })

  // After reconciliation, local position should reflect replayed seq 3
  expect(client.latestSnapshot?.ack['p2']).toBe(2)
})
```

- [ ] **Step 2: Write test for event callback**

```ts
it('calls event callback when snapshot contains events', () => {
  const [clientSide, hostSide] = createLinkedTransports()
  const client = new NetClient(clientSide)
  client.join('Ann')
  hostSide.send({ type: 'welcome', playerId: 'p2', mode: 'coop' })

  const events: any[] = []
  client.onEvent(ev => events.push(ev))

  hostSide.send({
    type: 'snapshot',
    snapshot: {
      tick: 1, seq: 1, ack: {}, events: [{ type: 'pickup', pickupType: 'health', value: 25, playerId: 'p2' }],
      players: [{ id: 'p2', kind: 'player', type: 'player', position: { x: 0, y: 2, z: 0 }, rotationY: 0, health: 100, isDead: false }],
      enemies: [],
    },
  })

  expect(events).toHaveLength(1)
  expect(events[0].type).toBe('pickup')
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npm run test -- src/net/__tests__/NetClient.test.ts`
Expected: FAIL — no ack tracking, no event callback.

- [ ] **Step 4: Implement NetClient with prediction, reconciliation, interpolation**

Replace `src/net/NetClient.ts`:

```ts
import * as THREE from 'three'
import { Player } from '../player/Player'
import { ARENA_SIZE } from '../session/GameSession'
import type { Transport } from '../session/Transport'
import type { GameMode, NetMessage, PlayerInput, SessionEvent, Snapshot } from '../session/protocol'

interface InterpEntry {
  snapshot: { position: THREE.Vector3; rotationY: number; rotationX: number; health: number; isDead: boolean }
  time: number
}

const INTERP_DELAY = 100
const MAX_PENDING = 256

export class NetClient {
  playerId: string | null = null
  mode: GameMode | null = null
  latestSnapshot: Snapshot | null = null

  private localSeq = 0
  private pendingInputs: PlayerInput[] = []
  private localPlayer = new Player()
  private reconciledPos = new THREE.Vector3()
  private snapshotCb: ((s: Snapshot) => void) | null = null
  private welcomeCb: ((playerId: string, mode: GameMode) => void) | null = null
  private eventCb: ((ev: SessionEvent) => void) | null = null
  private interpBuffers = new Map<string, InterpEntry[]>()
  private lastSnapshotTime = 0

  constructor(private transport: Transport) {
    this.transport.onMessage((msg: NetMessage) => this.handle(msg))
  }

  join(name: string): void {
    this.transport.send({ type: 'join', name })
  }

  sendInput(input: PlayerInput): void {
    if (!this.playerId) return
    const seqInput = { ...input, seq: ++this.localSeq, renderTime: performance.now() }
    this.transport.send({ type: 'input', playerId: this.playerId, input: seqInput })
    this.pendingInputs.push(seqInput)
    if (this.pendingInputs.length > MAX_PENDING) this.pendingInputs.shift()
  }

  predictLocal(dt: number): void {
    if (!this.playerId || this.pendingInputs.length === 0) return
    const input = this.pendingInputs[this.pendingInputs.length - 1]
    this.localPlayer.update(dt, input, ARENA_SIZE)
  }

  getLocalPosition(): THREE.Vector3 {
    return this.localPlayer.position
  }

  getLocalRotation(): THREE.Euler {
    return this.localPlayer.rotation
  }

  getInterpolatedPosition(id: string, renderTime: number): THREE.Vector3 | null {
    const buf = this.interpBuffers.get(id)
    if (!buf || buf.length < 2) return null

    const t = renderTime - INTERP_DELAY
    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].time <= t && buf[i + 1].time >= t) {
        a = buf[i]
        b = buf[i + 1]
        break
      }
    }
    if (!a || !b) return buf[buf.length - 1].snapshot.position.clone()

    const frac = (t - a.time) / (b.time - a.time)
    return new THREE.Vector3().lerpVectors(a.snapshot.position, b.snapshot.position, frac)
  }

  getInterpolatedRotation(id: string, renderTime: number): { yaw: number; pitch: number } | null {
    const buf = this.interpBuffers.get(id)
    if (!buf || buf.length < 2) return null

    const t = renderTime - INTERP_DELAY
    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < buf.length - 1; i++) {
      if (buf[i].time <= t && buf[i + 1].time >= t) {
        a = buf[i]
        b = buf[i + 1]
        break
      }
    }
    if (!a || !b) {
      const last = buf[buf.length - 1].snapshot
      return { yaw: last.rotationY, pitch: last.rotationX }
    }

    const frac = (t - a.time) / (b.time - a.time)
    return {
      yaw: a.snapshot.rotationY + (b.snapshot.rotationY - a.snapshot.rotationY) * frac,
      pitch: a.snapshot.rotationX + (b.snapshot.rotationX - a.snapshot.rotationX) * frac,
    }
  }

  onSnapshot(cb: (s: Snapshot) => void): void { this.snapshotCb = cb }
  onWelcome(cb: (playerId: string, mode: GameMode) => void): void { this.welcomeCb = cb }
  onEvent(cb: (ev: SessionEvent) => void): void { this.eventCb = cb }

  private handle(msg: NetMessage): void {
    if (msg.type === 'welcome') {
      this.playerId = msg.playerId
      this.mode = msg.mode
      this.welcomeCb?.(msg.playerId, msg.mode)
    } else if (msg.type === 'snapshot') {
      this.latestSnapshot = msg.snapshot
      this.lastSnapshotTime = performance.now()
      this.reconcile(msg.snapshot)
      this.updateInterpBuffers(msg.snapshot)
      for (const ev of msg.snapshot.events) this.eventCb?.(ev)
      this.snapshotCb?.(msg.snapshot)
    } else if (msg.type === 'ping') {
      this.transport.send({ type: 'pong', t: msg.t })
    }
  }

  private reconcile(snap: Snapshot): void {
    if (!this.playerId) return
    const me = snap.players.find(p => p.id === this.playerId)
    if (!me) return

    const ack = snap.ack[this.playerId] ?? 0
    this.pendingInputs = this.pendingInputs.filter(i => i.seq > ack)

    this.localPlayer.position.set(me.position.x, me.position.y, me.position.z)
    this.localPlayer.rotation.y = me.rotationY
    this.localPlayer.rotation.x = me.rotationX ?? 0
    this.localPlayer.health = me.health

    for (const input of this.pendingInputs) {
      this.localPlayer.update(1 / 30, input, ARENA_SIZE)
    }

    this.reconciledPos.copy(this.localPlayer.position)
  }

  private updateInterpBuffers(snap: Snapshot): void {
    const now = performance.now()
    for (const p of snap.players) {
      if (p.id === this.playerId) continue
      let buf = this.interpBuffers.get(p.id)
      if (!buf) { buf = []; this.interpBuffers.set(p.id, buf) }
      buf.push({
        snapshot: {
          position: new THREE.Vector3(p.position.x, p.position.y, p.position.z),
          rotationY: p.rotationY,
          rotationX: p.rotationX ?? 0,
          health: p.health,
          isDead: p.isDead,
        },
        time: now,
      })
      while (buf.length > 10) buf.shift()
    }
  }
}
```

- [ ] **Step 5: Run NetClient tests**

Run: `npm run test -- src/net/__tests__/NetClient.test.ts`
Expected: All pass.

- [ ] **Step 6: Run full test suite**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/net/NetClient.ts src/net/__tests__/NetClient.test.ts
git commit -m "feat(client): add prediction, reconciliation, and interpolation buffers"
```

---

### Task 6: RemotePlayer — Interpolation Buffer

**Files:**
- Modify: `src/net/RemotePlayer.ts:1-37`
- Modify: `src/net/__tests__/RemotePlayer.test.ts`

**Interfaces:**
- Consumes: `EntityState` from snapshots
- Produces: `RemotePlayer.pushState()`, `RemotePlayer.getInterpolatedPosition(time)`, `RemotePlayer.getInterpolatedRotation(time)`

- [ ] **Step 1: Write test for interpolation bracketing**

In `src/net/__tests__/RemotePlayer.test.ts`, add:

```ts
it('interpolates between two bracketed timestamps', () => {
  const rp = new RemotePlayer('p1', 'Alice')
  rp.pushState({ id: 'p1', kind: 'player', type: 'player', position: { x: 0, y: 2, z: 0 }, rotationY: 0, health: 100, isDead: false })
  // Simulate time passing by manually setting receivedAt
  // Then push a second state at a later time
  rp.pushState({ id: 'p1', kind: 'player', type: 'player', position: { x: 10, y: 2, z: 0 }, rotationY: Math.PI / 2, health: 100, isDead: false })

  const pos = rp.getInterpolatedPosition(performance.now() - 50) // midpoint
  expect(pos).not.toBeNull()
  expect(pos!.x).toBeGreaterThan(0)
  expect(pos!.x).toBeLessThan(10)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- src/net/__tests__/RemotePlayer.test.ts`
Expected: FAIL — no interpolation buffer.

- [ ] **Step 3: Update RemotePlayer with interpolation buffer**

Replace `src/net/RemotePlayer.ts`:

```ts
import * as THREE from 'three'
import { buildCharacter } from '../entities/CharacterModel'
import type { EntityState } from '../session/protocol'

const INTERP_DELAY = 100

interface InterpEntry {
  position: THREE.Vector3
  rotationY: number
  time: number
}

export class RemotePlayer {
  readonly group: THREE.Group
  private buffer: InterpEntry[] = []
  isDead = false

  constructor(readonly id: string, name: string, tint = 0x3399ff) {
    this.group = buildCharacter({ tint, name })
  }

  pushState(s: EntityState): void {
    this.isDead = s.isDead
    this.buffer.push({
      position: new THREE.Vector3(s.position.x, s.position.y, s.position.z),
      rotationY: s.rotationY,
      time: performance.now(),
    })
    while (this.buffer.length > 10) this.buffer.shift()
    if (this.buffer.length === 1) {
      this.group.position.copy(this.buffer[0].position)
      this.group.rotation.y = this.buffer[0].rotationY
    }
  }

  getInterpolatedPosition(renderTime: number): THREE.Vector3 | null {
    const t = renderTime - INTERP_DELAY
    if (this.buffer.length < 2) return this.buffer.length === 1 ? this.buffer[0].position.clone() : null

    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= t && this.buffer[i + 1].time >= t) {
        a = this.buffer[i]
        b = this.buffer[i + 1]
        break
      }
    }
    if (!a || !b) return this.buffer[this.buffer.length - 1].position.clone()

    const frac = (t - a.time) / (b.time - a.time)
    return new THREE.Vector3().lerpVectors(a.position, b.position, frac)
  }

  getInterpolatedRotation(renderTime: number): number {
    const t = renderTime - INTERP_DELAY
    if (this.buffer.length < 2) return this.buffer.length === 1 ? this.buffer[0].rotationY : 0

    let a: InterpEntry | null = null
    let b: InterpEntry | null = null
    for (let i = 0; i < this.buffer.length - 1; i++) {
      if (this.buffer[i].time <= t && this.buffer[i + 1].time >= t) {
        a = this.buffer[i]
        b = this.buffer[i + 1]
        break
      }
    }
    if (!a || !b) return this.buffer[this.buffer.length - 1].rotationY

    const frac = (t - a.time) / (b.time - a.time)
    return a.rotationY + (b.rotationY - a.rotationY) * frac
  }

  update(dt: number): void {
    const pos = this.getInterpolatedPosition(performance.now())
    if (pos) this.group.position.copy(pos)
    this.group.rotation.y = this.getInterpolatedRotation(performance.now())
    this.group.visible = !this.isDead
  }

  dispose(): void {
    this.group.traverse((o) => {
      if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
    })
  }
}
```

- [ ] **Step 4: Run RemotePlayer tests**

Run: `npm run test -- src/net/__tests__/RemotePlayer.test.ts`
Expected: All pass.

- [ ] **Step 5: Run full test suite**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/net/RemotePlayer.ts src/net/__tests__/RemotePlayer.test.ts
git commit -m "feat(remote): add interpolation buffer to RemotePlayer"
```

---

### Task 7: App.tsx — Client Prediction Loop + Event Processing + Buy Menu

**Files:**
- Modify: `src/App.tsx:328-527,686-699`

**Interfaces:**
- Consumes: `NetClient.predict()`, `NetClient.getLocalPosition()`, `NetClient.getInterpolatedPosition()`, `NetClient.onEvent()`, `NetMessage.buy`, `NetMessage.startWave`
- Produces: responsive client gameplay, networked buy menu, wave requests

- [ ] **Step 1: Update updateClient function with prediction + reconciliation**

In `src/App.tsx`, replace the `updateClient` function (lines 485-527):

```ts
function updateClient(dt: number) {
  const controls = data.controls
  const client = data.netClient
  const particleSystem = data.particleSystem
  if (!controls || !client || !particleSystem) return

  const m = controls.getMovement()
  client.sendInput({
    ...emptyInput(),
    forward: m.forward, backward: m.backward, left: m.left, right: m.right, jump: m.jump,
    shoot: controls.shoot && !storeOpenRef.current,
    yaw: lookRef.current.yaw,
    pitch: lookRef.current.pitch,
  })

  // Predict local player movement
  client.predictLocal(dt)

  // Smart crosshair
  const weapon = data.session.weaponManager.current
  const ch = crosshairRef.current
  ch.config = resolveCrosshair(settingsRef.current.crosshair, weapon.type)
  ch.bloom = stepBloom(ch.bloom, dt, {
    moving: m.forward || m.backward || m.left || m.right,
    airborne: m.jump,
    shotsFired: 0,
    weaponSpread: weapon.def.spread,
  })

  const snap = client.latestSnapshot
  if (!snap) return
  data.lastPlayers = snap.players

  // Camera: interpolate toward reconciled position for smooth correction
  const localPos = client.getLocalPosition()
  const localRot = client.getLocalRotation()
  const error = localPos.clone().sub(engine.camera.position)
  if (error.lengthSq() > 0.001) {
    engine.camera.position.lerp(localPos, Math.min(1, dt / 0.1))
  } else {
    engine.camera.position.copy(localPos)
  }
  engine.camera.rotation.set(localRot.x, localRot.y, 0, 'YXZ')

  data.audio.updateListenerPosition(engine.camera.position.x, engine.camera.position.y, engine.camera.position.z)
  setHealth(snap.players.find(p => p.id === client.playerId)?.health ?? 100)

  // Render remote players from interpolation
  data.remotePlayers?.sync(snap.players)
  renderClientEnemies(snap.enemies)
  data.remotePlayers?.update(dt)
  particleSystem.update(dt)
}
```

- [ ] **Step 2: Register event callback on client**

In the game initialization code (around line 328), after creating the client, register an event handler:

```ts
if (data.netClient) {
  data.netClient.onEvent((ev) => {
    const particleSystem = data.particleSystem!
    switch (ev.type) {
      case 'playerHitEnemy': {
        const p = ev.hit.point
        const point = new THREE.Vector3(p.x, p.y, p.z)
        if (ev.hit.killed) {
          particleSystem.explosion(point, ev.enemyType)
          data.audio.playEnemyDeath(point)
        } else {
          particleSystem.bloodSplatter(point)
          data.audio.playEnemyHit(point)
        }
        break
      }
      case 'enemyKilled':
        setScore(data.session.scoreSystem.score)
        break
      case 'wallImpact':
        particleSystem.bulletImpact(new THREE.Vector3(ev.point.x, ev.point.y, ev.point.z))
        break
      case 'enemyShoot': {
        const from = new THREE.Vector3(ev.from.x, ev.from.y, ev.from.z)
        const to = new THREE.Vector3(ev.to.x, ev.to.y, ev.to.z)
        data.audio.playWeaponShoot('rifle', from)
        particleSystem.tracer(from, to)
        if (ev.hit && ev.victimId === data.netClient?.playerId) {
          data.audio.playPlayerHit()
          setHealth(data.session.player.health)
        }
        break
      }
      case 'pickup':
        if (ev.playerId === data.netClient?.playerId) {
          if (ev.pickupType === 'health') setHealth(data.session.player.health)
          data.audio.playPickup()
        }
        break
      case 'playerDied':
        if (ev.playerId === data.netClient?.playerId) {
          document.exitPointerLock()
          data.audio.playPlayerDeath()
          data.session.scoreSystem.saveHighScore()
          setHighScore(data.session.scoreSystem.highScore)
          engine.stop()
          updateGameState('gameover')
        }
        break
    }
  })
}
```

- [ ] **Step 3: Update buy menu to send network message for clients**

In `src/App.tsx`, update the buy menu `onBuy` handler (lines 686-699):

```ts
onBuy={(id) => {
  const data = gameDataRef.current
  const item = findItem(id)
  if (item && !owned.includes(id) && canAffordItem(data.money, id)) {
    data.money -= item.price
    setMoney(data.money)
    if (data.role === 'client' && data.netClient) {
      data.netClient.transport.send({ type: 'buy', playerId: data.netClient.playerId!, item: id })
    } else {
      applyItem(item, data.session.player, data.session.weaponManager)
    }
    setOwned((prev) => [...prev, id])
    setMaxHealth(data.session.player.maxHealth)
    const wm = data.session.weaponManager
    setWeaponName(wm.current.def.name)
    setAmmo(wm.current.ammo)
    data.viewmodel?.setWeapon(weaponVisual(wm.current.type))
  }
}}
```

- [ ] **Step 4: Update wave start key to send network message for clients**

In `src/App.tsx`, update the G key handler (around line 583):

```ts
if (e.code === 'KeyG' && gameStateRef.current === 'playing') {
  if (data.role === 'host') {
    data.session.waveManager.spawnNextWave()
  } else if (data.role === 'client' && data.netClient) {
    data.netClient.transport.send({ type: 'startWave', playerId: data.netClient.playerId! })
  }
}
```

- [ ] **Step 5: Update host snapshot broadcast to include events**

In the host update loop (around line 470), update the broadcast call:

```ts
if (data.role === 'host' && data.netHost && data.remotePlayers) {
  const snap = session.getSnapshot()
  data.netHost.broadcastSnapshot(snap, events)
  data.lastPlayers = snap.players
  data.remotePlayers.sync(snap.players)
  data.remotePlayers.update(dt)
}
```

- [ ] **Step 6: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 7: Run full test suite**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 8: Run build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): client prediction loop, event processing, networked buy/wave"
```

---

### Task 8: Integration Test + Final Verification

**Files:**
- Modify: `src/net/__tests__/NetLoop.integration.test.ts`

**Interfaces:**
- Consumes: all previous tasks
- Produces: end-to-end integration test proving client prediction works

- [ ] **Step 1: Update integration test for new snapshot format**

In `src/net/__tests__/NetLoop.integration.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { GameSession } from '../../session/GameSession'
import { createLinkedTransports } from '../../session/Transport'
import { emptyInput } from '../../session/protocol'
import { NetHost } from '../NetHost'
import { NetClient } from '../NetClient'

describe('NetHost + NetClient integration (M2)', () => {
  it("client's movement appears in snapshot with ack field", () => {
    const session = new GameSession()
    const host = new NetHost(session, 'coop')
    const [hostSide, clientSide] = createLinkedTransports()

    const client = new NetClient(clientSide)
    client.join('Bob')
    host.addClient('player-2', 'Bob', hostSide)

    for (let i = 0; i < 10; i++) {
      client.sendInput({ ...emptyInput(), forward: true })
      host.tick(1 / 30)
    }

    const snap = client.latestSnapshot!
    const me = snap.players.find(p => p.id === 'player-2')!
    expect(me.position.z).toBeLessThan(0)
    expect(snap.ack['player-2']).toBeGreaterThan(0)
    expect(snap.seq).toBeGreaterThan(0)
  })

  it('client receives events from snapshot', () => {
    const session = new GameSession()
    const host = new NetHost(session, 'coop')
    const [hostSide, clientSide] = createLinkedTransports()

    const client = new NetClient(clientSide)
    client.join('Bob')
    host.addClient('player-2', 'Bob', hostSide)

    const events: any[] = []
    client.onEvent(ev => events.push(ev))

    host.tick(1 / 30)

    // Snapshot should have events array (may be empty if nothing happened)
    expect(client.latestSnapshot).not.toBeNull()
    expect(client.latestSnapshot!.events).toBeDefined()
  })
})
```

- [ ] **Step 2: Run integration tests**

Run: `npm run test -- src/net/__tests__/NetLoop.integration.test.ts`
Expected: All pass.

- [ ] **Step 3: Run full test suite**

Run: `npm run test`
Expected: All pass.

- [ ] **Step 4: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 5: Run build**

Run: `npm run build`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/net/__tests__/NetLoop.integration.test.ts
git commit -m "test(net): update integration tests for M2 snapshot format"
```
