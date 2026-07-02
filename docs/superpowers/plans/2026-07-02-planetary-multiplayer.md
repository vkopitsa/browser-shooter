# Planetary Multiplayer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the existing PeerJS multiplayer stack into planetary mode (players see/shoot each other, all match modes incl. FFA damage policy, proximity voice) and remove out-of-bounds damage.

**Architecture:** Host-authoritative P2P, reusing `NetHost`/`NetClient`/`MatchConfig`/`VoiceChat`/`RemotePlayerManager` from the arena game unchanged. `PlanetaryMode` gains an optional `net` prop; the host's `GameSession` (already attached to `NetHost` by `hostGame()`) is passed in instead of created locally; clients run snapshot/prediction like `App.tsx`'s `updateClient`. A `planetaryCenter?: [lng, lat]` field on `MatchConfig` marks a planetary match and carries the host-picked location to clients.

**Tech Stack:** React 19, Three.js (three@0.170), PeerJS 1.5, Vite 6, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-02-planetary-multiplayer-design.md`

## Global Constraints

- After every commit, push immediately (`git push`) — project CLAUDE.md policy.
- After any push to main, check CI: `gh run list --repo hermes98761234/browser-shooter --branch main --limit 2` then `gh run watch <run-id> --exit-status`. Fix failures before reporting done.
- Verify with `npm run build` (not just `tsc --noEmit` — it misses test-file type errors).
- Unit tests: `npx vitest run <path>` for targeted runs; `npm test` for the suite.
- Known pre-existing flaky Playwright e2e specs fail on main independent of changes — do not chase them.
- Solo planetary (no `net` prop) must keep working exactly as today throughout.
- FFA is NOT a new GameMode. It is the existing `damagePolicy: 'ffa'` (`MatchSetup.tsx` already has the "Free-for-all" button). Do not touch the `GameMode` union.
- Known accepted limitation: host collision only covers buildings near the host's map viewport; players far from the host may clip distant buildings. Do not try to fix this in v1.

---

### Task 1: Remove out-of-bounds boundary system

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`
- Delete: `src/planetary/RoundBoundary.ts`
- Delete: `src/planetary/__tests__/RoundBoundary.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `PlanetaryMode` with no boundary concept; later tasks edit the same file and must not reintroduce it.

- [ ] **Step 1: Remove boundary code from PlanetaryMode.tsx**

Five deletions, no replacements:

1. Delete the import (line 9):
```ts
import { RoundBoundary } from './RoundBoundary'
```
2. Delete the ref (line 67):
```ts
const boundaryRef = useRef<RoundBoundary>(new RoundBoundary())
```
3. Delete the state (line 83):
```ts
const [boundaryStatus, setBoundaryStatus] = useState<'safe' | 'warn' | 'out'>('safe')
```
4. Delete the game-loop check (lines 497–505, the `// 7. Round boundary check` block):
```ts
        // 7. Round boundary check
        const status = boundaryRef.current.check(lng, lat)
        setBoundaryStatus(status)
        if (status === 'out' && !session.player.isDead) {
          session.player.takeDamage(50 * dt)
          if (session.player.isDead) {
            session.handleDeath(session.localId)
          }
        }
```
5. Delete the HUD warning JSX (lines 818–827):
```tsx
      {!showPicker && boundaryStatus !== 'safe' && (
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          color: boundaryStatus === 'out' ? '#ff3300' : '#ffaa00',
          fontSize: 20, fontFamily: 'monospace', fontWeight: 'bold',
          textShadow: '0 0 8px rgba(0,0,0,0.8)', pointerEvents: 'none',
        }}>
          {boundaryStatus === 'out' ? '⚠ OUT OF BOUNDS — TAKING DAMAGE' : '⚠ LEAVING PLAY AREA'}
        </div>
      )}
```
6. In `handleTeleport` (line ~656), delete the line and its comment:
```ts
    // Anchor the boundary immediately so the game loop never sees [0,0] as center
    boundaryRef.current.update([[lng, lat]])
```

- [ ] **Step 2: Delete the boundary class and its test**

```bash
git rm src/planetary/RoundBoundary.ts src/planetary/__tests__/RoundBoundary.test.ts
```

- [ ] **Step 3: Verify no dangling references and build**

Run: `grep -rn "RoundBoundary\|boundaryStatus\|boundaryRef" src/` — expected: no matches.
Run: `npm run build` — expected: success.
Run: `npx vitest run src/planetary` — expected: all pass (RoundBoundary.test.ts no longer exists).

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "feat(planetary): remove out-of-bounds damage and play-area boundary"
git push
```

---

### Task 2: Bots target everyone under FFA damage policy

**Files:**
- Modify: `src/bots/BotController.ts`
- Modify: `src/session/GameSession.ts:540-551` (bot-driving block in `step`)
- Test: `src/bots/__tests__/BotController.ffa.test.ts` (create; if `src/bots/__tests__/` doesn't exist, create the directory — check for an existing BotController test first and add to it instead if present)

**Interfaces:**
- Consumes: `PlayerEntity` (`{ id, name, team, player: Player, weapons: WeaponManager, isBot? }` from `src/session/GameSession.ts:42`), `BotController.computeInput(self, others, world, dt, hostiles?)`.
- Produces: `BotController.computeInput(self, others, world, dt, hostiles?, ffa = false)` — new trailing optional boolean; when true, `pickTargetPos` ignores team.

- [ ] **Step 1: Write the failing test**

```ts
// src/bots/__tests__/BotController.ffa.test.ts
import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { BotController } from '../BotController'
import { Player } from '../../player/Player'
import { WeaponManager } from '../../weapons/WeaponManager'
import type { PlayerEntity } from '../../session/GameSession'

function makeEntity(id: string, team: 'ct' | 't', x: number): PlayerEntity {
  const player = new Player()
  player.position.set(x, 2, 0)
  return { id, name: id, team, player, weapons: new WeaponManager() }
}

describe('BotController FFA targeting', () => {
  it('ignores teammates without ffa flag (existing behavior)', () => {
    const bot = makeEntity('bot-1', 'ct', 0)
    const mate = makeEntity('mate', 'ct', 30)
    const input = new BotController('bot-1').computeInput(bot, [bot, mate], null, 0.016)
    // No valid target: bot stands still
    expect(input.forward || input.backward || input.left || input.right).toBe(false)
  })

  it('targets a same-team player when ffa is true', () => {
    const bot = makeEntity('bot-1', 'ct', 0)
    const mate = makeEntity('mate', 'ct', 30)
    const input = new BotController('bot-1').computeInput(bot, [bot, mate], null, 0.016, undefined, true)
    // Target at distance 30 > STANDOFF(8): bot moves toward it
    expect(input.forward || input.backward || input.left || input.right).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify the new case fails**

Run: `npx vitest run src/bots/__tests__/BotController.ffa.test.ts`
Expected: first test PASS, second test FAIL (bot has no target, no movement).

- [ ] **Step 3: Implement**

In `src/bots/BotController.ts`, thread the flag through. `computeInput` signature (line 36) becomes:

```ts
  computeInput(
    self: PlayerEntity, others: PlayerEntity[], world: CollisionWorld | null, dt: number,
    hostiles?: THREE.Vector3[], ffa = false,
  ): PlayerInput {
```

Pass it to `pickTargetPos` (line 47):
```ts
    const targetPos = this.pickTargetPos(self, others, hostiles, ffa)
```

`pickTargetPos` (line 145) becomes:
```ts
  private pickTargetPos(
    self: PlayerEntity, others: PlayerEntity[], hostiles?: THREE.Vector3[], ffa = false,
  ): THREE.Vector3 | null {
```
and the team check (line 160) becomes:
```ts
      if (o.id === self.id || o.player.isDead || (!ffa && o.team === self.team)) continue
```

In `src/session/GameSession.ts` (line 550), pass the policy:
```ts
        this.applyInput(id, controller.computeInput(self, all, this.collisionWorld, dt, hostiles, this.config.damagePolicy === 'ffa'))
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run src/bots src/session`
Expected: PASS (including pre-existing session/bot tests).

- [ ] **Step 5: Commit and push**

```bash
git add src/bots/BotController.ts src/session/GameSession.ts src/bots/__tests__/BotController.ffa.test.ts
git commit -m "feat(bots): target all players under ffa damage policy"
git push
```

---

### Task 3: `planetaryCenter` on MatchConfig + planetary option in MatchSetup

**Files:**
- Modify: `src/session/MatchConfig.ts`
- Modify: `src/ui/MatchSetup.tsx`
- Test: `src/ui/__tests__/MatchSetup.test.tsx` (add a case; follow the file's existing render/click patterns)

**Interfaces:**
- Consumes: `MatchConfig` (src/session/MatchConfig.ts:8), `MatchSetup` props (`onConfirm(c: MatchConfig)`).
- Produces:
  - `MatchConfig.planetaryCenter?: [number, number]` — `[lng, lat]`; presence marks a planetary match. Flows host→client inside the existing `welcome` message (no protocol change).
  - `MatchSetup` emits `zoneId: 'planetary'` as a UI-only marker when the planetary card is selected. Task 6's App code swaps it: `{ ...c, zoneId: 'arid', planetaryCenter }` after the host picks a location. `'planetary'` must never reach `getZone()`.

- [ ] **Step 1: Add the config field**

In `src/session/MatchConfig.ts`, add to the `MatchConfig` interface after `voiceMode` (line 20):
```ts
  /** [lng, lat] drop-in point for a planetary (real-world map) match; presence marks the match as planetary. */
  planetaryCenter?: [number, number]
```

- [ ] **Step 2: Write the failing UI test**

Read `src/ui/__tests__/MatchSetup.test.tsx` first and mirror its setup (render helpers, how it clicks buttons and asserts `onConfirm` payloads). Add:

```tsx
it('emits zoneId planetary when the planetary card is selected', () => {
  const onConfirm = vi.fn()
  render(<MatchSetup onConfirm={onConfirm} onBack={() => {}} onCreateMap={() => {}} onEditMap={() => {}} />)
  fireEvent.click(screen.getByText(/Planetary/i))
  fireEvent.click(screen.getByText('Create Room'))
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ zoneId: 'planetary' }))
})
```
(Adjust `render`/`fireEvent` imports to match the existing test file's conventions exactly.)

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/ui/__tests__/MatchSetup.test.tsx`
Expected: new case FAILS (no Planetary button).

- [ ] **Step 4: Add the planetary card to the ZONE section**

In `src/ui/MatchSetup.tsx`, inside the ZONE section's flex div (after the `{ZONES.map(...)}` block, line ~147), add one more card:

```tsx
            {(() => {
              const active = zoneId === 'planetary'
              return (
                <button onClick={() => { setZoneId('planetary'); setCustomZone(undefined) }} style={{
                  cursor: 'pointer', fontFamily: 'monospace', textAlign: 'left',
                  padding: '8px 12px', width: 170, boxSizing: 'border-box',
                  background: active ? '#ff6600' : '#1d1d2a', color: active ? '#000' : '#fff',
                  border: active ? '1px solid #ff6600' : '1px solid #3a3a55',
                }}>
                  <div style={{ fontSize: 14, fontWeight: 'bold' }}>🌍 Planetary</div>
                  <div style={{ fontSize: 11, opacity: active ? 0.75 : 0.6, marginTop: 3, lineHeight: 1.3 }}>Real-world map — you pick the drop point next</div>
                </button>
              )
            })()}
```

No `buildConfig()` change needed — it already spreads `zoneId`.

- [ ] **Step 5: Run tests**

Run: `npx vitest run src/ui/__tests__/MatchSetup.test.tsx` — expected: PASS.

- [ ] **Step 6: Commit and push**

```bash
git add src/session/MatchConfig.ts src/ui/MatchSetup.tsx src/ui/__tests__/MatchSetup.test.tsx
git commit -m "feat(net): planetaryCenter match-config field and Planetary zone card"
git push
```

---

### Task 4: PlanetaryMode `net` prop + host wiring

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Interfaces:**
- Consumes: `NetHost` (`broadcastSnapshot(snapshot, events)`, `pingClients()` — src/net/NetHost.ts), `NetClient` (Task 5 uses it; the prop lands now), `GameSession`, `MatchConfig.planetaryCenter`, `RemotePlayerManager`.
- Produces (Tasks 5–6 rely on these exact names):
```ts
export interface PlanetaryNet {
  role: 'host' | 'client'
  config: MatchConfig
  netHost: NetHost | null      // set when role === 'host'
  netClient: NetClient | null  // set when role === 'client'
  session: GameSession | null  // host: the NetHost-attached session from App; client: null
  onRemotePlayers?: (rp: RemotePlayerManager | null) => void
}
interface PlanetaryModeProps { onExit: () => void; net?: PlanetaryNet }
```

- [ ] **Step 1: Add imports and props**

```ts
import type { NetHost } from '../net/NetHost'
import type { NetClient } from '../net/NetClient'
import type { MatchConfig } from '../session/MatchConfig'
```
(`defaultCompetitiveConfig` import already exists.) Replace the props interface (line 48) with the `PlanetaryNet` + `PlanetaryModeProps` shown above (export `PlanetaryNet`), and the signature:
```ts
export function PlanetaryMode({ onExit, net }: PlanetaryModeProps) {
```

- [ ] **Step 2: Initial center/picker from net config**

Replace lines 81–82:
```ts
  const [showPicker, setShowPicker] = useState(!net)
  const [startCenter, setStartCenter] = useState<[number, number] | null>(net?.config.planetaryCenter ?? null)
```
(For a net match the picker never shows; the engine boots straight at the shared center.)

- [ ] **Step 3: Use the provided session on host**

Replace lines 169–170:
```ts
      const config = net?.config ?? defaultCompetitiveConfig()
      const session = net?.session ?? new GameSession(config)
```
The rest of the session setup block (collisionWorld, bombsites, map spawns, roundManager guard) stays as-is — it now configures the NetHost-attached session when hosting. Note the `if (session.roundManager)` guard already handles non-competitive configs (roundManager is null).

Directly after `sessionRef.current = session` (line 241), notify App and re-enable auto waves for AI modes:
```ts
      net?.onRemotePlayers?.(remotePlayersRef.current)
      // hostGame() disables auto waves for the arena lobby; planetary has no
      // manual wave button, so co-op/hybrid AI must auto-spawn here.
      if (net?.role === 'host' && (config.mode === 'coop' || config.mode === 'hybrid')) {
        session.waveManager.auto = true
      }
```

- [ ] **Step 4: Host broadcast in the game loop**

After the remote-players sync block (lines 435–438, which already computes `const snap = session.getSnapshot()`), add:

```ts
        // Host: broadcast the authoritative snapshot to all clients.
        if (net?.role === 'host' && net.netHost) {
          net.netHost.broadcastSnapshot(snap, events)
          pingAccumRef.current += dt
          if (pingAccumRef.current >= 1) { pingAccumRef.current = 0; net.netHost.pingClients() }
        }
```
with a new ref near the other refs (line ~104):
```ts
  const pingAccumRef = useRef(0)
```

- [ ] **Step 5: Render AI enemies (co-op/hybrid) in the planetary scene**

Session enemies have their own meshes but nothing adds them to this scene. In the loop, right after the grenade/smoke mesh sync (lines 419–431), add:
```ts
        // AI wave enemies (co-op/hybrid): session owns the meshes; mirror into the scene.
        for (const e of session.enemies) {
          if (!e.mesh.parent) engine.scene.add(e.mesh)
        }
```
and capture `const enemiesBefore = [...session.enemies]` next to `grenadesBefore` (line 297), removing stale meshes after `session.step`:
```ts
        for (const e of enemiesBefore) {
          if (!session.enemies.includes(e)) { engine.scene.remove(e.mesh); e.dispose() }
        }
```

- [ ] **Step 6: Net-game UI guards**

- Hide the re-teleport button in net games (mid-match map divergence): wrap the `[M] Map` button (line ~869) in `{!net && (...)}`.
- Cleanup: in the effect's return (line ~577), before nulling `remotePlayersRef`, add `net?.onRemotePlayers?.(null)`.
- The `onExit` button is unchanged — App decides what exit means (Task 6).

- [ ] **Step 7: Build and verify solo still works**

Run: `npm run build` — expected: success.
Run: `npx vitest run src/planetary` — expected: pass.
Solo regression check: `net` is undefined → `showPicker` starts true, session created locally, no broadcast — identical to today (verify by reading the diff, no runtime needed here; the final task does a live smoke).

- [ ] **Step 8: Commit and push**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): net prop with host session attach and snapshot broadcast"
git push
```

---

### Task 5: PlanetaryMode client path (prediction + snapshot rendering)

**Files:**
- Modify: `src/planetary/PlanetaryMode.tsx`

**Interfaces:**
- Consumes: `NetClient` — `sendInput(input)`, `predictLocal(dt)`, `getLocalPosition()`, `getLocalRotation()`, `latestSnapshot`, `collisionWorld`, `arenaSize`, `onEvent(cb)`, `playerId`, `transport.send(msg)` (src/net/NetClient.ts). `PlanetaryNet` from Task 4.
- Produces: PlanetaryMode fully playable as a network client; no new exports.

Follow App.tsx's `updateClient` (src/App.tsx:1205-1316) as the reference pattern throughout.

- [ ] **Step 1: Event queue from NetClient**

Client session events arrive via callback, not from `session.step`. Add a ref (near line 104):
```ts
  const clientEventsRef = useRef<import('../session/protocol').SessionEvent[]>([])
```
In `engine.onReady`, after `sessionRef.current = session`, register once:
```ts
      if (net?.role === 'client' && net.netClient) {
        net.netClient.onEvent((ev) => clientEventsRef.current.push(ev))
      }
```
(This intentionally replaces the arena handler App registered in `joinGame` — planetary owns effects while mounted; `leaveMultiplayer` tears everything down on exit.)

- [ ] **Step 2: Branch the loop**

The loop keeps steps 1–2 (input + look merge) shared. Then branch. Locate the block from `session.applyInput(session.localId, input)` (line 294) through `session.step(dt)` / camera update (line 303) and restructure:

```ts
        const isClient = net?.role === 'client' && !!net.netClient
        let events: import('../session/protocol').SessionEvent[]
        let snap: Snapshot
        const grenadesBefore = new Set(session.activeGrenades)
        const smokeCloudsBefore = new Set(session.smokeClouds)
        const enemiesBefore = [...session.enemies]

        if (isClient) {
          const client = net!.netClient!
          const meSnap = client.latestSnapshot?.players.find(pl => pl.id === client.playerId)
          const dead = meSnap?.isDead ?? false
          client.sendInput({
            ...input,
            forward: dead ? false : input.forward,
            backward: dead ? false : input.backward,
            left: dead ? false : input.left,
            right: dead ? false : input.right,
            jump: dead ? false : input.jump,
            shoot: dead ? false : input.shoot,
          })
          client.collisionWorld = collisionRef.current?.collisionWorld ?? null
          client.arenaSize = 5000
          client.predictLocal(dt)
          // Local gun feel: host is authoritative for hits; the client owns sound/kick/ammo.
          const wm = session.weaponManager
          wm.update(dt)
          if (!dead && input.shoot && wm.current.shoot()) {
            viewmodel.fire()
            audioRef.current?.playWeaponShoot(weaponVisual(wm.current.type), client.getLocalPosition())
          }
          events = clientEventsRef.current
          clientEventsRef.current = []
          snap = client.latestSnapshot ?? { tick: 0, seq: 0, ack: {}, players: [], enemies: [], grenades: [], events: [], scores: { players: [], ctScore: 0, tScore: 0, matchOver: false } as never }
          setIsDead(dead)
          setRespawnIn(meSnap?.respawnIn ?? null)
        } else {
          session.applyInput(session.localId, input)
          events = session.step(dt)
          snap = session.getSnapshot()
        }
```
Notes:
- Extend the existing protocol type import (line 22) to `import type { EntityState, GrenadeState, SessionEvent, Snapshot } from '../session/protocol'` and drop the inline `import('../session/protocol')` qualifiers accordingly.
- `input` already carries `yaw`/`pitch` from GeoControls (set at lines 290–291); `sendInput` stamps `seq`/`renderTime` itself.
- The old `const snap = session.getSnapshot()` at line 434 is removed — `snap` now comes from the branch above; the host-broadcast block from Task 4 keeps using it.
- The empty-snapshot fallback only exists for the frames before the first snapshot arrives; if the exact `MatchScores` shape fights the cast, guard the snapshot-consuming blocks with `if (client.latestSnapshot)` instead — pick whichever compiles cleanly.

- [ ] **Step 3: Camera + HUD from client state**

In the client branch path, the camera comes from prediction. Replace the unconditional camera update (lines 301–303) with:
```ts
        const p = isClient ? net!.netClient!.getLocalPosition() : session.player.position
        const viewYaw = isClient ? gc.yaw : session.player.rotation.y
        const viewPitch = isClient ? gc.pitch : session.player.rotation.x
        engine.setViewFromPlayer(p, viewYaw, viewPitch)
```
(`p` is already the name the rest of the loop uses for map recentering/audio — keep it.)

HUD (lines 508–515): health from snapshot when client:
```ts
        const myHealth = isClient
          ? (net!.netClient!.latestSnapshot?.players.find(pl => pl.id === net!.netClient!.playerId)?.health ?? 100)
          : session.player.health
```
and use `myHealth` for `health:`; keep the rest (ammo/weapon/money read the local session — correct for gun feel on both roles).

- [ ] **Step 4: Event switch name lookups work for clients**

The event switch (lines 335–345, `playerKilledPlayer`) resolves names via `session.getPlayer` — empty on clients. Replace those two lines with:
```ts
              const nameOf = (id: string) => isClient
                ? (net!.netClient!.latestSnapshot?.players.find(pl => pl.id === id)?.name ?? id)
                : (session.getPlayer(id)?.name ?? 'Unknown')
              const a = nameOf(ev.attackerId)
              const v = nameOf(ev.victimId)
```
Also every `=== session.localId` comparison inside the switch and HUD blocks must use the network id when client. Add once before the switch:
```ts
        const localPid = isClient ? net!.netClient!.playerId! : session.localId
```
and replace `session.localId` with `localPid` inside the event switch cases (`playerKilledPlayer`, `playerDied`, `playerRespawned`, `playerShot`, `playerHitPlayer`, `enemyShoot`, `grenadeDetonated`) and in the RemotePlayerManager construction (next step). Do NOT replace it in host-only lines (e.g. `session.handleDeath`, respawnQueue reads inside the non-client `playerDied` case — guard those with `!isClient` where they mutate the session):
```ts
            case 'playerDied':
              if (ev.playerId === localPid) {
                setIsDead(true)
                if (!isClient) setRespawnIn(session.respawnQueue.isPending(session.localId) ? session.respawnQueue.remaining(session.localId) : null)
              }
              scoreboardDirty = true
              break
```

- [ ] **Step 5: Remote players keyed by network id**

Line 226 constructs the manager with `session.localId`; clients would render themselves. Replace:
```ts
      remotePlayersRef.current = new RemotePlayerManager(engine.scene, net?.netClient?.playerId ?? session.localId)
```
(`playerId` is set before `start` fires — the client joins the lobby long before PlanetaryMode mounts.)

- [ ] **Step 6: Client-side grenades, enemies, buy, plant/defuse**

- Grenade throw (`throwSelectedGrenade`, line 623): when client, send instead of simulating:
```ts
      if (net?.role === 'client' && net.netClient) {
        net.netClient.transport.send({ type: 'throwGrenade', playerId: net.netClient.playerId!, grenadeType: thrown, mode })
      } else if (!session.throwGrenade(session.localId, thrown, mode)) return false
```
(keep the local `gm.remove`/inventory updates in both paths).
- Buy (BuyMenu `onBuy`, line 724): at the top of the handler add:
```ts
            if (net?.role === 'client' && net.netClient) {
              net.netClient.transport.send({ type: 'buy', playerId: net.netClient.playerId!, item: itemId })
            }
```
then let the existing local-apply logic run unchanged (local session mirrors the purchase for viewmodel/ammo; host applies authoritatively — same split as App.tsx).
- Plant/defuse keys (lines 596–603): when client, send `{ type: 'plantBomb', playerId }` / `{ type: 'defuseBomb', playerId, hasKit: false }` via `net.netClient.transport.send` instead of calling `session.tryPlant/tryDefuse`.
- Snapshot grenades + enemies (client render): after the remote-players sync in the loop add:
```ts
        if (isClient) {
          renderClientGrenades(snap.grenades)
          renderClientEnemies(snap.enemies)
        }
```
with two helpers inside `engine.onReady` scope (mirror App.tsx:1318-1360, simplified):
```ts
      const clientEnemyMeshes = new Map<string, THREE.Mesh>()
      function renderClientEnemies(enemies: import('../session/protocol').EntityState[]) {
        const seen = new Set<string>()
        for (const e of enemies) {
          seen.add(e.id)
          let mesh = clientEnemyMeshes.get(e.id)
          if (!mesh) {
            mesh = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.8, 0.8), new THREE.MeshStandardMaterial({ color: 0xcc3333 }))
            clientEnemyMeshes.set(e.id, mesh)
            engine.scene.add(mesh)
          }
          mesh.position.set(e.position.x, e.position.y + 0.9, e.position.z)
          mesh.rotation.y = e.rotationY
          mesh.visible = !e.isDead
        }
        for (const [id, mesh] of clientEnemyMeshes) {
          if (!seen.has(id)) {
            engine.scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose()
            clientEnemyMeshes.delete(id)
          }
        }
      }
      const clientGrenadeMeshes = new Map<string, THREE.Mesh>()
      function renderClientGrenades(grenades: import('../session/protocol').GrenadeState[]) {
        const seen = new Set<string>()
        for (const g of grenades) {
          seen.add(g.id)
          let mesh = clientGrenadeMeshes.get(g.id)
          if (!mesh) {
            mesh = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshStandardMaterial({ color: 0x2a3a2a }))
            clientGrenadeMeshes.set(g.id, mesh)
            engine.scene.add(mesh)
          }
          mesh.position.set(g.position.x, g.position.y, g.position.z)
        }
        for (const [id, mesh] of clientGrenadeMeshes) {
          if (!seen.has(id)) {
            engine.scene.remove(mesh); mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose()
            clientGrenadeMeshes.delete(id)
          }
        }
      }
```
- Skip host-only loop work when client: wrap the grenade/smoke mesh sync from the local session (lines 420–431), the enemy mesh mirror from Task 4, and the roundState timer update (lines 441–447) in `if (!isClient) { ... }`. Also skip the local-session shooting feedback block (lines 528–536: `weapon.fireTimer` detection) when `isClient` — the client branch already did gun feel; keep `firedThisFrame` defined (`let firedThisFrame = false` before, set only in the two role paths) since bloom uses it. For bloom's inputs when client, use prediction-safe values:
```ts
        const velRef = isClient ? net!.netClient!.getLocalPosition() : session.player.position // position for audio below
        const moving = isClient
          ? (input.forward || input.backward || input.left || input.right)
          : Math.hypot(session.player.velocity.x, session.player.velocity.z) > 1.5
        const airborne = isClient ? input.jump : !session.player.isGrounded
```
and feed `moving`/`airborne` into the `stepBloom` call (line 557).
- Bot buttons (`+CT Bot`, line 851) and `[`/`]` keys mutate the session — host-authoritative; hide/disable when `isClient` (wrap the button row in `{!(net?.role === 'client') && (...)}`, and in `gameControls.onAddBot`/`onRemoveBot` early-return when client).
- Scoreboard snapshot (openScoreboard, line 115 and scoreboardDirty block, line 450): both read `session.getSnapshot()` — when client, the source is `net.netClient.latestSnapshot?.players` instead (shape-identical `EntityState`). Because `openScoreboard` lives outside the loop, add near line 61 `const netRef = useRef(net); netRef.current = net`, and in `openScoreboard`:
```ts
    const clientSnap = netRef.current?.netClient?.latestSnapshot
    const source = clientSnap ? clientSnap.players : (sessionRef.current ? sessionRef.current.getSnapshot().players : [])
    setScoreboardPlayers(source.map(p => ({ ...p, kind: 'player' as const, type: 'player' })))
```
and in the loop's `scoreboardDirty` block use `snap.players` (already role-correct after Step 2).

- [ ] **Step 7: Build + tests**

Run: `npm run build` — expected: success.
Run: `npx vitest run src/planetary src/net src/session` — expected: pass.

- [ ] **Step 8: Commit and push**

```bash
git add src/planetary/PlanetaryMode.tsx
git commit -m "feat(planetary): client prediction, snapshot rendering, and net-routed actions"
git push
```

---

### Task 6: App.tsx routing — host flow, client flow, voice, keep-alive, directory label

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `PlanetaryNet` (Task 4), `MapPicker` (`{ playerPositions: [], onTeleport(lng, lat), onClose }` — src/planetary/MapPicker.tsx), `hostGame(config)` (App.tsx:454), `client.onStart` (App.tsx:702), keep-alive worker (App.tsx:1456-1473), `startVoice` (App.tsx:324).
- Produces: end-to-end flows — host: MatchSetup(planetary card) → MapPicker → lobby → START → PlanetaryMode(host). Client: browse/join → lobby → start → PlanetaryMode(client).

- [ ] **Step 1: Host location pick between MatchSetup and hostGame**

Add imports (`MapPicker` from `./planetary/MapPicker`) and state near the other mp-menu state:
```ts
  const [planetaryDraft, setPlanetaryDraft] = useState<MatchConfig | null>(null)
```
Change MatchSetup `onConfirm` (line 1602):
```tsx
          onConfirm={(c) => {
            setShowMatchSetup(false)
            if (c.zoneId === 'planetary') { setPlanetaryDraft(c); return }
            void hostGame(c).catch(() => setJoinError('Could not start hosting.'))
          }}
```
Below the MatchSetup block, render the picker:
```tsx
      {gameState === 'mpmenu' && planetaryDraft && (
        <MapPicker
          playerPositions={[]}
          onTeleport={(lng, lat) => {
            const cfg: MatchConfig = { ...planetaryDraft, zoneId: 'arid', planetaryCenter: [lng, lat] }
            setPlanetaryDraft(null)
            void hostGame(cfg).catch(() => setJoinError('Could not start hosting.'))
          }}
          onClose={() => { setPlanetaryDraft(null); setShowMatchSetup(true) }}
        />
      )}
```
(`zoneId: 'arid'` keeps every `getZone()` call on a real zone; `planetaryCenter` is the planetary marker from here on.)

- [ ] **Step 2: Route match start to planetary**

Host — in MultiplayerMenu `onStart` (line 1557), after the voice-wiring block, replace the single `startNetGame('host')` call with a branch (keep everything else identical):
```tsx
            onStart={() => {
              const data = gameDataRef.current
              data.hostDirectory?.setStatus('in-progress')
              data.netHost?.startMatch()
              const hostPeer = data.peerHost?.peer
              if (data.netHost && hostPeer && roomCode) {
                const { voice: chat, video: videoChat } = startVoice(data.session.localId, hostPeer)
                data.netHost.onHostRoster((r) => { chat.setRoster(r); videoChat.setRoster(r) })
                data.netHost.onRemoteVoiceStart((id, name) => chat.remoteStart(id, name))
                data.netHost.onRemoteVoiceStop((id) => chat.remoteStop(id))
                data.netHost.setHostVoice(data.session.localId, roomCode)
              }
              if (data.matchConfig.planetaryCenter) updateGameState('planetary')
              else startNetGame('host')
            }}
```
Client — `client.onStart` (line 702):
```ts
    client.onStart(() => {
      if (gameDataRef.current.netClient?.config?.planetaryCenter) updateGameState('planetary')
      else startNetGame('client')
    })
```

- [ ] **Step 3: Pass net props to PlanetaryMode**

Replace lines 1629–1631:
```tsx
      {gameState === 'planetary' && (
        <PlanetaryMode
          onExit={() => {
            if (gameDataRef.current.role !== 'single') leaveMultiplayer()
            updateGameState('menu')
          }}
          net={gameDataRef.current.role === 'single' ? undefined : {
            role: gameDataRef.current.role as 'host' | 'client',
            config: gameDataRef.current.role === 'client'
              ? (gameDataRef.current.netClient?.config ?? gameDataRef.current.matchConfig)
              : gameDataRef.current.matchConfig,
            netHost: gameDataRef.current.netHost,
            netClient: gameDataRef.current.netClient,
            session: gameDataRef.current.role === 'host' ? gameDataRef.current.session : null,
            onRemotePlayers: (rp) => { gameDataRef.current.remotePlayers = rp },
          }}
        />
      )}
```
Import `PlanetaryNet` type if needed for the literal. `onRemotePlayers` keeps `startVoice`'s existing `onSpeakersChanged` (line 344) pointing at planetary's manager — talk indicators above heads work with zero further wiring. Verify `leaveMultiplayer` exists (it's the mpmenu `onBack` handler, line 1571) — reuse it; if it's named differently, use that name.

- [ ] **Step 4: Keep-alive worker covers planetary hosts**

In `keepAliveWorker.onmessage` (line 1464), replace the game-state gate:
```ts
    keepAliveWorker.onmessage = () => {
      if (document.visibilityState !== 'hidden') return
      if (data.role !== 'host' || !data.netHost) return
      const state = gameStateRef.current
      if (state !== 'playing' && state !== 'planetary') return
      const session = data.session
      // Arena captures fresh local input; planetary input lives in GeoControls
      // (unreachable here), so step with last-applied inputs — fine while hidden.
      if (state === 'playing') session.applyInput(session.localId, captureLocalInput())
      const events = session.step(1 / HIDDEN_TICK_HZ)
      data.netHost.broadcastSnapshot(session.getSnapshot(), events)
    }
```

- [ ] **Step 5: Directory label**

In `hostGame` (line 549–554), label planetary rooms so the server browser shows it:
```ts
    await hostDirectory.start({
      roomCode: code, hostName: settingsRef.current.playerName, players: 1, maxPlayers: 8,
      status: 'lobby',
      // ponytail: string-tag planetary into mode rather than extending DirectoryEntry
      mode: config.planetaryCenter ? `planetary-${config.mode}` : config.mode,
      joinPolicy: config.joinPolicy ?? 'lobby',
      protected: !!config.password,
    }).catch(() => {})
```

- [ ] **Step 6: Build + full unit tests**

Run: `npm run build` — expected: success.
Run: `npm test` (or `npx vitest run`) — expected: pass (ignore known-flaky Playwright e2e; those run separately).

- [ ] **Step 7: Commit and push**

```bash
git add src/App.tsx
git commit -m "feat(app): planetary multiplayer routing, voice hookup, keep-alive, directory label"
git push
```

---

### Task 7: End-to-end smoke + CI

**Files:**
- None (verification only; fix-forward anything found).

- [ ] **Step 1: Two-tab smoke test**

```bash
npm run peerserver &   # local PeerJS broker on :9000 (only if VITE_PEER_* is configured to use it; otherwise the public broker is used)
npm run dev &          # vite on :5173
```
Drive with a headless browser or manually (the planetary memory notes a headless drive-script recipe and `window.__eng` handle if needed). Checklist:
1. Tab A: Multiplayer → Create Room → select 🌍 Planetary card + mode `Team PvP` + damage policy `Free-for-all` + voice `Proximity` → Create Room → MapPicker appears → pick a city → lobby shows room code.
2. Tab B: Multiplayer → join by code → lobby roster shows both.
3. Tab A: START MATCH → both tabs land in planetary at the same location (Tab B must NOT see MapPicker).
4. Tab A and B see each other's player models; walking in A moves the model in B.
5. Shooting registers: A shoots B → B's health drops, kill feed on both.
6. Walk 1 km from spawn → no damage, no boundary warning.
7. Voice roster: with proximity voice, `voiceRoster` messages flow when within 7 m (verify via console/network logs or talk indicator).
8. Solo planetary regression: main menu → Planetary → MapPicker shows → solo play with bots works.

- [ ] **Step 2: Full verification**

Run: `npm run build && npx vitest run` — expected: both green.

- [ ] **Step 3: Push and watch CI**

```bash
git push
gh run list --repo hermes98761234/browser-shooter --branch main --limit 2
gh run watch <run-id> --exit-status
```
Expected: CI green. If not, fix and push before reporting done.
