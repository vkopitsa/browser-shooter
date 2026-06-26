# Proximity Voice Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `'proximity'` voice mode where players hear anyone within 7 game units regardless of team, plus a 3D talking indicator sprite above speaking players' heads.

**Architecture:** `NetHost` branches on `config.voiceMode`; proximity mode filters the voice roster by distance instead of team and refreshes it every 200 ms on tick. A `THREE.Sprite` (green circle canvas texture) on each `RemotePlayer` is toggled by `onSpeakersChanged` via `RemotePlayerManager.setTalking()`. `MatchSetup` exposes a Team / Proximity toggle that writes `voiceMode` into `MatchConfig`.

**Tech Stack:** TypeScript, Three.js (`THREE.Sprite`, `THREE.CanvasTexture`), Vitest, React

## Global Constraints

- No new npm packages.
- `voiceMode` defaults to `'team'` (undefined = team) — existing behaviour unchanged.
- Proximity radius = 7 game units, fixed constant `PROXIMITY_VOICE_RADIUS = 7` in `NetHost.ts`.
- Roster throttle = 200 ms (0.2 s) in proximity mode only.
- Tests use Vitest (`vitest run`). Run `npm test` from repo root.
- Lint: `npm run lint` must pass after each task.

---

### Task 1: Add `voiceMode` to `MatchConfig`

**Files:**
- Modify: `src/session/MatchConfig.ts`

**Interfaces:**
- Produces: `MatchConfig.voiceMode?: 'team' | 'proximity'` — consumed by Tasks 2 and 5.

- [ ] **Step 1: Add the field**

In `src/session/MatchConfig.ts`, add one line to `MatchConfig`:

```ts
export interface MatchConfig {
  mode: GameMode
  damagePolicy: DamagePolicy
  fragLimit: number
  roundsToWin?: number
  buyPhaseDuration?: number
  roundDuration?: number
  joinPolicy?: JoinPolicy
  password?: string
  zoneId?: string
  randomSeed?: number
  customZone?: ZoneDef
  voiceMode?: 'team' | 'proximity'   // add this line
}
```

`defaultMatchConfig()` and `defaultCompetitiveConfig()` need no changes — `undefined` is treated as `'team'`.

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass (no changes to logic).

- [ ] **Step 4: Commit**

```bash
git add src/session/MatchConfig.ts
git commit -m "feat(voice): add voiceMode to MatchConfig"
```

---

### Task 2: NetHost proximity logic + tests

**Files:**
- Modify: `src/net/NetHost.ts`
- Modify: `src/net/NetHost.voice.test.ts`

**Interfaces:**
- Consumes: `MatchConfig.voiceMode` from Task 1.
- Produces: `NetHost` that scopes voice roster/relay by distance in proximity mode and refreshes on tick.

- [ ] **Step 1: Write failing tests for proximity mode**

Open `src/net/NetHost.voice.test.ts`. Keep the entire existing `describe('NetHost voice', ...)` block unchanged. Add a second describe block at the bottom:

```ts
// Helper: two clients on opposite teams, host on 'ct'.
// Positions: host at (0,0,0), p1 at (3,0,0) = within 7, p2 at (15,0,0) = outside 7.
function proximitySetup() {
  const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
  const host = new NetHost(session, { ...session.config, voiceMode: 'proximity' })
  host.setHostVoice(session.localId, 'peerHost')
  const c1 = fakeTransport()
  const c2 = fakeTransport()
  host.addClient('p1', 'Ann', c1.t, 't', 'peer1')   // opposite team, close
  host.addClient('p2', 'Bob', c2.t, 't', 'peer2')   // opposite team, far

  // Set authoritative positions
  session.getPlayer(session.localId)!.player.position.set(0, 0, 0)
  session.getPlayer('p1')!.player.position.set(3, 0, 0)   // distance 3 < 7
  session.getPlayer('p2')!.player.position.set(15, 0, 0)  // distance 15 > 7
  return { session, host, c1, c2 }
}

describe('NetHost proximity voice mode', () => {
  it('includes nearby cross-team players in roster', () => {
    const { host, c1 } = proximitySetup()
    c1.sent.length = 0
    host.refreshVoiceRoster()
    const r = c1.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    // p1 (t) is at dist 3 from host (ct) — should appear in host's roster
    // Note: we check c1 (p1's transport) — p1 should see the host as nearby
    expect(r.teammates.map(e => e.peerId)).toContain('peerHost')
  })

  it('excludes out-of-range players from roster', () => {
    const { host, c2 } = proximitySetup()
    c2.sent.length = 0
    host.refreshVoiceRoster()
    const r = c2.sent.find(m => m.type === 'voiceRoster') as Extract<NetMessage, { type: 'voiceRoster' }>
    // p2 is at dist 15 > 7 — should have empty roster
    expect(r.teammates).toEqual([])
  })

  it('relays voiceStart to nearby cross-team players', () => {
    const { host, c1, c2 } = proximitySetup()
    c1.sent.length = 0; c2.sent.length = 0
    // host starts talking — p1 (dist 3) should receive, p2 (dist 15) should not
    host.localVoiceStart()
    expect(c1.sent.find(m => m.type === 'voiceStart')).toBeDefined()
    expect(c2.sent.find(m => m.type === 'voiceStart')).toBeUndefined()
  })

  it('does not relay to same-team players outside range', () => {
    const session = new GameSession({ mode: 'pvp', damagePolicy: 'team', fragLimit: 0 })
    const host = new NetHost(session, { ...session.config, voiceMode: 'proximity' })
    host.setHostVoice(session.localId, 'peerHost')
    const c1 = fakeTransport()
    host.addClient('p1', 'Ann', c1.t, 'ct', 'peer1')  // same team as host, but far
    session.getPlayer(session.localId)!.player.position.set(0, 0, 0)
    session.getPlayer('p1')!.player.position.set(20, 0, 0)
    c1.sent.length = 0
    host.localVoiceStart()
    expect(c1.sent.find(m => m.type === 'voiceStart')).toBeUndefined()
  })

  it('refreshVoiceRoster fires after 200 ms accumulation in tick', () => {
    const { host, c1 } = proximitySetup()
    c1.sent.length = 0
    host.tick(0.1)   // 100 ms — no refresh yet
    const before = c1.sent.filter(m => m.type === 'voiceRoster').length
    host.tick(0.11)  // 110 ms more = 210 ms total — triggers refresh
    const after = c1.sent.filter(m => m.type === 'voiceRoster').length
    expect(after).toBeGreaterThan(before)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "proximity voice"
```

Expected: all 5 new proximity tests FAIL (NetHost has no proximity logic yet).

- [ ] **Step 3: Implement proximity logic in NetHost**

Open `src/net/NetHost.ts`.

**3a.** Add constant after the imports (top of file, before the class):

```ts
const PROXIMITY_VOICE_RADIUS = 7
```

**3b.** Add a private field to the class (alongside `private snapSeq = 0`):

```ts
private voiceRosterAccum = 0
```

**3c.** Replace `voiceParticipants()` entirely:

```ts
private voiceParticipants(): { playerId: string; peerId: string; name: string; team: Team; x: number; y: number; z: number }[] {
  const out: { playerId: string; peerId: string; name: string; team: Team; x: number; y: number; z: number }[] = []
  if (this.hostVoice) {
    const p = this.session.getPlayer(this.hostVoice.playerId)
    if (p) {
      const pos = p.player.position
      out.push({ playerId: this.hostVoice.playerId, peerId: this.hostVoice.peerId, name: p.name, team: p.team, x: pos.x, y: pos.y, z: pos.z })
    }
  }
  for (const link of this.links) {
    const p = this.session.getPlayer(link.playerId)
    if (p && link.voicePeerId) {
      const pos = p.player.position
      out.push({ playerId: link.playerId, peerId: link.voicePeerId, name: p.name, team: p.team, x: pos.x, y: pos.y, z: pos.z })
    }
  }
  return out
}
```

**3d.** Replace `voiceTeammatesFor()` entirely:

```ts
private voiceTeammatesFor(playerId: string): VoiceRosterEntry[] {
  const all = this.voiceParticipants()
  const me = all.find(p => p.playerId === playerId)
  if (!me) return []
  const passes = this.config.voiceMode === 'proximity'
    ? (p: typeof me) => {
        const dx = p.x - me.x, dy = p.y - me.y, dz = p.z - me.z
        return Math.sqrt(dx * dx + dy * dy + dz * dz) <= PROXIMITY_VOICE_RADIUS
      }
    : (p: typeof me) => p.team === me.team
  return all
    .filter(p => p.playerId !== playerId && passes(p))
    .map(p => ({ playerId: p.playerId, peerId: p.peerId, name: p.name }))
}
```

**3e.** Replace `relayVoice()` entirely:

```ts
private relayVoice(msg: Extract<NetMessage, { type: 'voiceStart' | 'voiceStop' }>, speakerId: string): void {
  const all = this.voiceParticipants()
  const speaker = all.find(p => p.playerId === speakerId)
  if (!speaker) return
  const inRange = (p: typeof speaker) => {
    const dx = p.x - speaker.x, dy = p.y - speaker.y, dz = p.z - speaker.z
    return Math.sqrt(dx * dx + dy * dy + dz * dz) <= PROXIMITY_VOICE_RADIUS
  }
  const shouldRelay = this.config.voiceMode === 'proximity'
    ? (p: typeof speaker) => inRange(p)
    : (p: typeof speaker) => p.team === speaker.team
  for (const p of all) {
    if (p.playerId === speakerId || !shouldRelay(p)) continue
    if (this.hostVoice && p.playerId === this.hostVoice.playerId) {
      if (msg.type === 'voiceStart') this.remoteVoiceStartCb?.(speakerId, msg.name)
      else this.remoteVoiceStopCb?.(speakerId)
    } else {
      this.links.find(l => l.playerId === p.playerId)?.transport.send(msg)
    }
  }
}
```

**3f.** Replace `tick()` entirely:

```ts
tick(dt: number): SessionEvent[] {
  const events = this.session.step(dt)
  if (this.config.voiceMode === 'proximity') {
    this.voiceRosterAccum += dt
    if (this.voiceRosterAccum >= 0.2) {
      this.voiceRosterAccum = 0
      this.refreshVoiceRoster()
    }
  }
  this.broadcastSnapshot(this.session.getSnapshot(), events)
  return events
}
```

- [ ] **Step 4: Run all tests**

```bash
npm test 2>&1 | tail -20
```

Expected: all tests pass, including the 5 new proximity tests.

- [ ] **Step 5: Lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/net/NetHost.ts src/net/NetHost.voice.test.ts
git commit -m "feat(voice): proximity mode in NetHost — distance-based roster and relay"
```

---

### Task 3: Talking indicator — sprite + RemotePlayer + RemotePlayerManager

**Files:**
- Modify: `src/entities/CharacterModel.ts`
- Modify: `src/net/RemotePlayer.ts`
- Modify: `src/net/RemotePlayerManager.ts`

**Interfaces:**
- Produces:
  - `buildTalkingSprite(): THREE.Sprite` (exported from `CharacterModel.ts`)
  - `RemotePlayer.setTalking(on: boolean): void`
  - `RemotePlayerManager.setTalking(playerId: string, on: boolean): void`
  - `RemotePlayerManager.ids(): string[]` (already exists, listed for clarity)

- [ ] **Step 1: Write failing test**

Create `src/net/__tests__/RemotePlayer.talking.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'

// jsdom doesn't implement canvas getContext; stub it so buildTalkingSprite() works.
beforeEach(() => {
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag === 'canvas') {
      return {
        width: 0, height: 0,
        getContext: () => ({ beginPath: vi.fn(), arc: vi.fn(), fill: vi.fn(), fillStyle: '' }),
      } as unknown as HTMLCanvasElement
    }
    return document.createElement(tag)
  })
  // Stub CanvasTexture so Three.js doesn't fail without a real WebGL context.
  vi.spyOn(THREE, 'CanvasTexture').mockImplementation(() => ({} as THREE.CanvasTexture))
})

describe('RemotePlayer.setTalking', () => {
  it('toggles talkingSprite visibility', async () => {
    const { RemotePlayer } = await import('../RemotePlayer')
    const rp = new RemotePlayer('id1', 'Alice')
    expect(rp.isTalking()).toBe(false)
    rp.setTalking(true)
    expect(rp.isTalking()).toBe(true)
    rp.setTalking(false)
    expect(rp.isTalking()).toBe(false)
  })
})

describe('RemotePlayerManager.setTalking', () => {
  it('forwards to the RemotePlayer if it exists', async () => {
    const { RemotePlayer } = await import('../RemotePlayer')
    const { RemotePlayerManager } = await import('../RemotePlayerManager')
    const scene = new THREE.Scene()
    const mgr = new RemotePlayerManager(scene, 'local')
    // Manually add a player
    const rp = new RemotePlayer('p1', 'Bob')
    scene.add(rp.group)
    // Access private map via any cast to inject the player
    ;(mgr as unknown as { players: Map<string, typeof rp> }).players.set('p1', rp)
    mgr.setTalking('p1', true)
    expect(rp.isTalking()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- src/net/__tests__/RemotePlayer.talking.test.ts 2>&1 | tail -10
```

Expected: FAIL — `setTalking` and `isTalking` do not exist.

- [ ] **Step 3: Add `buildTalkingSprite` to CharacterModel**

In `src/entities/CharacterModel.ts`, add this export after `getNameTag`:

```ts
/** Green circle sprite shown above a player's head while they are talking. */
export function buildTalkingSprite(): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 32; canvas.height = 32
  const ctx = canvas.getContext('2d')!
  ctx.beginPath()
  ctx.arc(16, 16, 14, 0, Math.PI * 2)
  ctx.fillStyle = '#22ff44'
  ctx.fill()
  const tex = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(0.25, 0.25, 1)
  sprite.position.set(0, 2.65, 0)
  sprite.visible = false
  return sprite
}
```

- [ ] **Step 4: Update RemotePlayer**

In `src/net/RemotePlayer.ts`:

**4a.** Add import at top (CharacterModel already imported — just add `buildTalkingSprite`):

```ts
import { animateCharacter, buildCharacter, getNameTag, buildTalkingSprite } from '../entities/CharacterModel'
```

**4b.** Add a private field after `private nameTag`:

```ts
private talkingSprite: THREE.Sprite
```

**4c.** At the end of the constructor (after `this.group.add(this.thirdPersonWeapon.group)`):

```ts
this.talkingSprite = buildTalkingSprite()
this.group.add(this.talkingSprite)
```

**4d.** Add two public methods before `private applyTeamColor`:

```ts
setTalking(on: boolean): void { this.talkingSprite.visible = on }
isTalking(): boolean { return this.talkingSprite.visible }
```

**4e.** In `dispose()`, add sprite teardown before the `traverse` call:

```ts
dispose(): void {
  this.setArmor(false)
  this.setHelmet(false)
  this.thirdPersonWeapon.dispose()
  ;(this.talkingSprite.material as THREE.SpriteMaterial).map?.dispose()
  ;(this.talkingSprite.material as THREE.SpriteMaterial).dispose()
  this.group.traverse((o) => {
    if (o instanceof THREE.Mesh) { o.geometry.dispose(); (o.material as THREE.Material).dispose() }
  })
}
```

- [ ] **Step 5: Update RemotePlayerManager**

In `src/net/RemotePlayerManager.ts`, add a public method after `clear()`:

```ts
setTalking(playerId: string, on: boolean): void {
  this.players.get(playerId)?.setTalking(on)
}
```

- [ ] **Step 6: Run tests**

```bash
npm test 2>&1 | tail -15
```

Expected: all tests pass including the new talking tests.

- [ ] **Step 7: Lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add src/entities/CharacterModel.ts src/net/RemotePlayer.ts src/net/RemotePlayerManager.ts src/net/__tests__/RemotePlayer.talking.test.ts
git commit -m "feat(voice): talking indicator sprite on RemotePlayer"
```

---

### Task 4: Wire talking indicator into App.tsx

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `RemotePlayerManager.setTalking(playerId, on)` from Task 3.
- Consumes: `RemotePlayerManager.ids()` (existing).

No new tests — wiring is covered by the integration flow. The `onSpeakersChanged` callback is the single source of truth: it fires whenever the active-speaker set changes (explicit stop, TTL prune, or disconnect), so syncing talking state there handles all cases.

- [ ] **Step 1: Update `onSpeakersChanged` in `startVoice`**

In `src/App.tsx`, find `startVoice` (around line 326). Replace the `onSpeakersChanged` line:

```ts
// Before:
onSpeakersChanged: (list) => setSpeakers(list),

// After:
onSpeakersChanged: (list) => {
  setSpeakers(list)
  const speakingIds = new Set(list.map(s => s.playerId))
  const rp = gameDataRef.current.remotePlayers
  for (const id of rp?.ids() ?? []) rp?.setTalking(id, speakingIds.has(id))
},
```

- [ ] **Step 2: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 3: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(voice): sync talking indicator from onSpeakersChanged"
```

---

### Task 5: MatchSetup UI — Voice mode toggle

**Files:**
- Modify: `src/ui/MatchSetup.tsx`

**Interfaces:**
- Consumes: `MatchConfig.voiceMode` from Task 1.
- Produces: `voiceMode` written into the config returned by `buildConfig()`.

- [ ] **Step 1: Add state and update `buildConfig`**

In `src/ui/MatchSetup.tsx`:

**1a.** Add import for the type (already imported — `MatchConfig` is there; add the union type literal if needed via the existing import):

No new import needed; the value is just `'team' | 'proximity'` string literals.

**1b.** Add state alongside the other `useState` declarations (around line 44):

```ts
const [voiceMode, setVoiceMode] = useState<'team' | 'proximity'>('team')
```

**1c.** In `buildConfig()`, add `voiceMode` to the returned object:

```ts
function buildConfig(): MatchConfig {
  const base = mode === 'competitive'
    ? { ...defaultCompetitiveConfig(), damagePolicy: policy }
    : { mode, damagePolicy: policy, fragLimit: frag }
  return {
    ...base,
    joinPolicy,
    voiceMode,
    zoneId,
    ...(password ? { password } : {}),
    ...(zoneId === 'custom' && customZone ? { customZone } : {}),
  }
}
```

- [ ] **Step 2: Add the toggle UI**

In the JSX return, add a new `<div>` block after the ZONE section (find the closing `</div>` of the ZONE block and insert after it). Follow the same pattern as the existing MODE/JOIN buttons:

```tsx
<div><div style={{ opacity: 0.6, marginBottom: 6 }}>VOICE</div>
  <div style={{ display: 'flex', gap: 8 }}>
    <button style={btn(voiceMode === 'team')} onClick={() => setVoiceMode('team')}>Team</button>
    <button style={btn(voiceMode === 'proximity')} onClick={() => setVoiceMode('proximity')}>Proximity</button>
  </div>
</div>
```

The `btn` helper is already defined in `MatchSetup.tsx` — it returns a style object with active/inactive colours. Use it as-is.

- [ ] **Step 3: Build check**

```bash
npm run build 2>&1 | tail -5
```

Expected: no TypeScript errors.

- [ ] **Step 4: Run tests**

```bash
npm test 2>&1 | tail -10
```

Expected: all tests pass.

- [ ] **Step 5: Lint**

```bash
npm run lint 2>&1 | tail -10
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/MatchSetup.tsx
git commit -m "feat(voice): add Team/Proximity voice toggle in MatchSetup"
```

---

## Self-Review

**Spec coverage:**
- `voiceMode?: 'team' | 'proximity'` in MatchConfig ✅ Task 1
- `PROXIMITY_VOICE_RADIUS = 7` constant ✅ Task 2
- `voiceTeammatesFor` branches on `voiceMode` ✅ Task 2
- `relayVoice` branches on `voiceMode` ✅ Task 2
- 200 ms tick throttle (proximity only) ✅ Task 2
- Talking sprite `buildTalkingSprite()` canvas green circle ✅ Task 3
- `RemotePlayer.setTalking(on)` ✅ Task 3
- `RemotePlayerManager.setTalking(playerId, on)` ✅ Task 3
- App wiring via `onSpeakersChanged` ✅ Task 4
- MatchSetup UI toggle ✅ Task 5
- Local player: existing HUD `VoiceIndicator` unchanged ✅ (no task needed)

**Placeholder scan:** None found.

**Type consistency:**
- `buildTalkingSprite(): THREE.Sprite` used in Task 3 (CharacterModel → RemotePlayer) ✅
- `RemotePlayerManager.setTalking(playerId: string, on: boolean)` matches call in Task 4 ✅
- `RemotePlayerManager.ids(): string[]` (existing) used in Task 4 ✅
- `MatchConfig.voiceMode?: 'team' | 'proximity'` used in Tasks 2 and 5 ✅
