# Lobby Password Support

**Date:** 2026-06-25
**Status:** Approved

## Summary

Extend the existing password mechanism (currently only available on `free` join policy games) to work with `lobby` join policy games as well. No new components; the existing `PreJoinPrompt` gains a `showTeam` prop to suppress the team selector when it isn't relevant.

## Background

Password infrastructure is already complete for `free` join:

- `MatchSetup` renders a password input (gated behind `joinPolicy === 'free'`)
- `PreJoinPrompt` shows the password field when `protected === true`
- `directoryProtocol.ts` has `protected?: boolean` on `DirectoryEntry`
- `protocol.ts` carries `password?: string` on the `join` message and `joinRejected: 'badPassword'`
- `NetHost.passwordOk()` checks the password regardless of join policy

The only gaps are UI-side: the host can't set a password for lobby games, and joining clients are never prompted for one.

## Changes

### 1. `MatchSetup.tsx`

Remove the `joinPolicy === 'free'` guard around the password input. The field appears for both `lobby` and `free` policies. Blank value = open game. The existing `...(joinPolicy === 'free' && password ? { password } : {})` spread in `onConfirm` becomes `...(password ? { password } : {})`.

### 2. `PreJoinPrompt.tsx`

Add `showTeam?: boolean` prop (default `true`). When `false`, the team selector is not rendered and `onSubmit` is called with a fixed `'ct'` team (ignored by lobby callers — team selection happens inside the lobby UI). No other changes to the component or its existing callers.

### 3. `MultiplayerMenu.tsx` — server browser

Change the server-row join condition:

```
// before
if (server.joinPolicy === 'free') setJoining(server)
else p.onJoin(server.roomCode)

// after
if (server.joinPolicy === 'free' || server.protected) setJoining(server)
else p.onJoin(server.roomCode)
```

Pass `showTeam={server.joinPolicy === 'free'}` to `PreJoinPrompt` — free games show team+password, lobby games show password only.

For protected lobby servers, `PreJoinPrompt.onSubmit` calls `p.onJoin(roomCode, password)` — not `onJoinFree`. The `onJoinFree` callback remains exclusively for free-join servers (team + password). The fixed `'ct'` team default from `PreJoinPrompt` is discarded at the call site.

### 4. `MultiplayerMenu.tsx` — join-by-code

Add an optional password `<input>` field below the room-code input. Always visible, always optional. Change `onJoin` prop signature to `onJoin: (code: string, password?: string) => void` and pass the trimmed password value (or `undefined` if blank) when calling it.

### 5. Host-side directory entry

Verify that `protected: !!config.password` is included in the `DirectoryEntry` when `HostDirectory.start()` is called — this may already be set, but needs confirming during implementation. `NetHost.passwordOk()` requires no change; it already checks the password for any join policy.

## Data Flow

```
Host sets password in MatchSetup
  → MatchConfig.password stored
  → DirectoryEntry.protected = true (broadcast to browser)
  → NetHost holds the password

Client browses server list
  → sees 🔒 icon (already rendered)
  → clicks JOIN on a protected server
  → PreJoinPrompt appears
      - free policy: team selector + password (onJoinFree callback)
      - lobby policy: password only (onJoin(code, password) callback)
  → client sends { type: 'join', password }
  → NetHost.passwordOk() accepts or rejects

Client joins by code
  → types code + optional password in JOIN BY CODE card
  → same join flow as above
```

## Out of Scope

- Changing the password after a game is created
- Showing the password-protected indicator in the lobby UI
- Per-round or rotating passwords
