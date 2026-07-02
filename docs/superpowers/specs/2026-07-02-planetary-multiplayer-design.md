# Planetary Multiplayer — Design

**Date:** 2026-07-02
**Status:** Approved defaults (user AFK during clarification; recommended options chosen — see Decisions)

## Goal

Make planetary mode playable multiplayer: players see each other, shoot each other,
and talk over proximity voice. Support the existing team modes plus a new
free-for-all mode. Remove the out-of-bounds / leaving-play-area damage so players
can roam anywhere.

## Decisions (defaults chosen, user can override)

1. **Map location:** the host picks the location in MapPicker when creating the
   room; joiners skip the picker and load the host's location from the match config.
2. **Modes offered:** all existing modes (`coop`, `pvp`, `hybrid`) plus new `ffa`.
   Voice mode (`team` / `proximity`) stays the existing separate toggle.
3. **Boundary:** removed entirely — no damage, no safe/warn/out HUD status, no
   `RoundBoundary` at all.

## Approach

**Reuse the arena net stack wholesale.** Planetary becomes another map source for
the existing host-authoritative P2P architecture: PeerJS rooms + directory listing,
`NetHost`/`NetClient`, `GameSession` snapshots, `RemotePlayerManager` (already
syncing in the planetary loop), and `VoiceChat` with the existing
`voiceMode: 'proximity'` (7 m radius) support.

Rejected alternatives:
- *Separate planetary netcode* — pure duplication of `src/net/`.
- *Dedicated game server* — the app is a static site; P2P already ships.

## Changes

### 1. Free-for-all mode

- Add `'ffa'` to `GameMode` (`src/session/protocol.ts:6`) and a
  "Free-for-all" option in `MatchSetup.tsx`.
- FFA config: `damagePolicy: 'ffa'` — `canDamage()` already supports it
  (`src/session/MatchConfig.ts`). No AI waves; no team win condition
  (`fragLimit` counts individual kills or 0 = endless).
- Bots in FFA target everyone: `BotController.pickTargetPos` currently skips
  same-team entities (`src/bots/BotController.ts:160`); it must ignore the team
  check when the session's damage policy is `'ffa'`.
- Team pickers (lobby team select, `[`/`]` bot keys) remain functional but teams
  are cosmetic in FFA — damage and targeting ignore them.

### 2. Planetary location in MatchConfig

- Add `planetaryCenter?: [lng: number, lat: number]` to `MatchConfig`
  (`src/session/MatchConfig.ts`). Presence marks a planetary match.
- It flows host → client through the existing `welcome` message; no protocol
  changes beyond the config field.
- Directory listing (`HostDirectory.start`) already carries `mode`; include a
  planetary flag so the server browser can label planetary rooms.

### 3. Wire the net stack into PlanetaryMode

`PlanetaryMode` grows the same host/client wiring `App.tsx` has
(`hostGame` at App.tsx:454, `joinGame` at App.tsx:557):

- Props change from `{ onExit }` to also accept the networking role and shared
  objects (role, netHost/netClient, config) — mirroring how the arena game
  transitions from lobby to match. Solo planetary (no room) keeps working with
  no props, exactly as today.
- **Host:** planetary `GameSession` is attached to `NetHost`; the planetary game
  loop broadcasts snapshots each step (same call the arena loop makes). The
  hidden-tab keep-alive worker pattern applies unchanged.
- **Client:** `NetClient` receives config (with `planetaryCenter`), skips
  MapPicker, boots the engine at the host's location, sends inputs, applies
  snapshots.
- **Voice:** reuse `startVoice()` wiring from App.tsx:324 — roster/start/stop
  events connected to `VoiceChat`, and speakers wired to
  `RemotePlayerManager.setTalking` so talk indicators render above heads.
  `voiceMode: 'proximity'` works with zero planetary-specific code because
  `NetHost` filters the roster by 3D player distance.
- **Menu flow:** MainMenu → Planetary → MapPicker (host picks spot) → match
  setup (mode incl. FFA, voice mode, password) → create room → lobby → start.
  Joiners use the existing multiplayer browse/join-by-code flow; a planetary
  room routes them into PlanetaryMode instead of the arena.

**Known integration risk — collision coverage.** `PlanetaryCollision` rebuilds
the collision AABB set *near the local player* each frame. A host simulating
remote players far away needs collision near *every* living player, or remote
players fall through buildings. The host-side rebuild must iterate all player
positions. Perf note: planetary already runs an auto-degrade ladder; rebuild
radius/frequency per remote player should be conservative.

### 4. Remove out-of-bounds damage

- Delete the boundary check block (`src/planetary/PlanetaryMode.tsx:497–505`),
  `boundaryRef`, and the `boundaryStatus` HUD state/rendering.
- Delete `src/planetary/RoundBoundary.ts` and its tests.

## Testing

- Unit: FFA bot targeting (bot picks same-team target under `ffa` policy),
  MatchConfig with `planetaryCenter` survives the welcome round-trip, `'ffa'`
  mode accepted by `GameSession`.
- Manual smoke: `npm run peerserver` + two browser tabs — host creates planetary
  FFA room, client joins, both see each other, shots register, proximity voice
  roster updates when players approach within 7 m, walking 1 km+ from spawn
  causes no damage.
- `npm run build` before push (catches test-file type errors `tsc --noEmit` misses).
- Known pre-existing flaky Playwright specs on main are not regressions.

## Out of scope

- Video chat in planetary (exists in arena only).
- Location voting in lobby.
- Tuning the 7 m proximity radius (config knob exists at
  `src/net/NetHost.ts:10` if it feels too small on city scale).
