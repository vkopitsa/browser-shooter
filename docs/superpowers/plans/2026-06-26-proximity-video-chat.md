# Proximity Video Chat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add proximity-based video chat — players within `PROXIMITY_VOICE_RADIUS` see each other's camera in floating corner tiles when both have toggled their camera on.

**Architecture:** A new `VideoChat` class mirrors `VoiceChat` (same `VoicePeer`/`VoiceCall` interfaces, same `voiceMesh.reconcileMesh` logic, same `VoiceRosterEntry[]` roster input from the host). No new protocol messages — the existing `voiceRoster` push already delivers the proximity peer list. A new `VideoTiles` React component renders `<video>` elements in the bottom-right corner. A new `PeerJsVideoPeer` class (added to `VoiceTransport.ts`) tags outgoing video calls with PeerJS metadata `{ type: 'video' }` and filters incoming calls to only the video type — this prevents voice and video handlers from cross-answering each other's calls when both run on the same underlying PeerJS `Peer`.

**Tech Stack:** TypeScript, React, PeerJS (`VoicePeer`/`VoiceCall` interfaces from `VoiceTransport.ts`), Vitest, `@testing-library/react`

## Global Constraints

- Test runner: `npx vitest run` (or `npm test`)
- Run a single test file: `npx vitest run src/voice/VideoChat.test.ts`
- No new npm dependencies — PeerJS is already installed and all interfaces already exist
- Default keybind: `KeyV` (not in use anywhere in the current `DEFAULT_KEYMAP`)
- Proximity radius: reuse existing `PROXIMITY_VOICE_RADIUS = 7` in `NetHost.ts` — do not duplicate it
- Camera acquired lazily (first toggle only); track disabled/re-enabled on subsequent toggles — no re-prompt
- Video calls only form when the local camera is on; incoming calls are rejected if camera is off
- TypeScript strict mode — no `any`, no unused vars

---

### Task 1: Add `toggleVideo` keybind — Settings, Controls, KeybindsScreen

**Files:**
- Modify: `src/settings/Settings.ts`
- Modify: `src/player/Controls.ts`
- Modify: `src/ui/KeybindsScreen.tsx`

**Interfaces:**
- Produces: `Keymap.toggleVideo: string`, default `'KeyV'`; `Controls.onVideoToggle: (() => void) | null`

---

- [ ] **Step 1: Write a failing test for the new keymap entry**

Create `src/settings/__tests__/Settings.toggleVideo.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DEFAULT_KEYMAP } from '../Settings'

describe('DEFAULT_KEYMAP', () => {
  it('has toggleVideo bound to KeyV', () => {
    expect(DEFAULT_KEYMAP.toggleVideo).toBe('KeyV')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run src/settings/__tests__/Settings.toggleVideo.test.ts
```

Expected: FAIL — `DEFAULT_KEYMAP.toggleVideo` is `undefined`.

- [ ] **Step 3: Add `toggleVideo` to `Keymap` interface and `DEFAULT_KEYMAP`**

In `src/settings/Settings.ts`, add to the `Keymap` interface (after `pushToTalk`):

```ts
  pushToTalk: string
  toggleVideo: string   // ← add this line
  addBotCT: string
```

Add to `DEFAULT_KEYMAP` (after `pushToTalk`):

```ts
  pushToTalk: 'KeyK',
  toggleVideo: 'KeyV',   // ← add this line
  addBotCT: 'BracketLeft',
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run src/settings/__tests__/Settings.toggleVideo.test.ts
```

Expected: PASS

- [ ] **Step 5: Add `onVideoToggle` callback to Controls**

In `src/player/Controls.ts`, add after the `onTalkStop` field (around line 35):

```ts
  onTalkStop: (() => void) | null = null
  /** Fired on video toggle key down — toggles camera on/off. */
  onVideoToggle: (() => void) | null = null
```

In the `onKeyDown` method, add after the `pushToTalk` block (around line 87):

```ts
    if (e.code === km.pushToTalk) {
      if (!this.talkHeld) { this.talkHeld = true; this.onTalkStart?.() }
    }
    if (e.code === km.toggleVideo) { this.onVideoToggle?.(); return }
```

- [ ] **Step 6: Add "Toggle Video" to KeybindsScreen COMMUNICATION group**

In `src/ui/KeybindsScreen.tsx`, in the `GROUPS` array, find the COMMUNICATION group and add the new action:

```ts
  {
    label: 'COMMUNICATION',
    actions: [
      { key: 'pushToTalk', label: 'Push to Talk' },
      { key: 'toggleVideo', label: 'Toggle Video' },  // ← add this line
    ],
  },
```

- [ ] **Step 7: Run the full test suite to check nothing regressed**

```bash
npm test
```

Expected: all existing tests pass (the KeybindsScreen test renders the COMMUNICATION group; adding a new action doesn't break it).

- [ ] **Step 8: Commit**

```bash
git add src/settings/Settings.ts src/settings/__tests__/Settings.toggleVideo.test.ts src/player/Controls.ts src/ui/KeybindsScreen.tsx
git commit -m "feat: add toggleVideo keybind (KeyV) to keymap, controls, and keybinds screen"
```

---

### Task 2: `CamProvider` + `PeerJsVideoPeer` + `VideoChat`

**Files:**
- Modify: `src/voice/VoiceTransport.ts` — add `CamProvider`, `BrowserCamProvider`, `PeerJsVideoPeer`; patch `PeerJsVoicePeer.onIncomingCall` to skip video calls
- Create: `src/voice/VideoChat.ts`
- Create: `src/voice/VideoChat.test.ts`

**Interfaces:**
- Consumes: `VoicePeer`, `VoiceCall` from `src/voice/VoiceTransport.ts`; `reconcileMesh` from `src/voice/voiceMesh.ts`; `VoiceRosterEntry` from `src/session/protocol`
- Produces:
  - `CamProvider` interface with `getStream(): Promise<MediaStream>`
  - `BrowserCamProvider` class implementing `CamProvider`
  - `PeerJsVideoPeer` class implementing `VoicePeer` — tags outgoing calls with `{ metadata: { type: 'video' } }`, filters incoming to video-only
  - `VideoChatDeps` interface
  - `VideoChat` class with: `setRoster(teammates: VoiceRosterEntry[]): void`, `toggleCamera(): Promise<void>`, `get localStream(): MediaStream | null`, `peerDisconnected(playerId: string): void`, `dispose(): void`

---

- [ ] **Step 1: Write the failing tests**

Create `src/voice/VideoChat.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { VideoChat } from './VideoChat'
import type { VoicePeer, VoiceCall, CamProvider } from './VoiceTransport'

function fakeCamStream(): MediaStream {
  const track = { enabled: false, stop: vi.fn() }
  return { getVideoTracks: () => [track] } as unknown as MediaStream
}

class FakeCall implements VoiceCall {
  answered = false
  closed = false
  private streamCb: ((s: MediaStream) => void) | null = null
  private closeCb: (() => void) | null = null
  constructor(public peerId: string) {}
  answer(): void { this.answered = true }
  onStream(cb: (s: MediaStream) => void): void { this.streamCb = cb }
  onClose(cb: () => void): void { this.closeCb = cb }
  close(): void { this.closed = true; this.closeCb?.() }
  emitStream(s: MediaStream): void { this.streamCb?.(s) }
}

class FakePeer implements VoicePeer {
  calls: FakeCall[] = []
  private incomingCbs = new Map<(call: VoiceCall) => void, (call: VoiceCall) => void>()
  constructor(public id: string) {}
  call(peerId: string): VoiceCall { const c = new FakeCall(peerId); this.calls.push(c); return c }
  onIncomingCall(cb: (call: VoiceCall) => void): void { this.incomingCbs.set(cb, cb) }
  offIncomingCall(cb: (call: VoiceCall) => void): void { this.incomingCbs.delete(cb) }
  fireIncoming(call: FakeCall): void { this.incomingCbs.forEach(cb => cb(call)) }
}

function setup(myId: string) {
  const peer = new FakePeer(myId)
  const stream = fakeCamStream()
  const cam: CamProvider = { getStream: vi.fn().mockResolvedValue(stream) }
  const onStreamsChanged = vi.fn()
  const chat = new VideoChat({ peer, cam, localPlayerId: myId, onStreamsChanged })
  return { peer, stream, cam, onStreamsChanged, chat }
}

describe('VideoChat', () => {
  it('acquires camera only on first toggle', async () => {
    const s = setup('me')
    expect(s.cam.getStream).not.toHaveBeenCalled()
    await s.chat.toggleCamera()
    expect(s.cam.getStream).toHaveBeenCalledTimes(1)
    await s.chat.toggleCamera() // off
    await s.chat.toggleCamera() // on again
    expect(s.cam.getStream).toHaveBeenCalledTimes(1) // still once
  })

  it('enables video track when toggled on, disables when toggled off', async () => {
    const s = setup('me')
    await s.chat.toggleCamera()
    expect(s.stream.getVideoTracks()[0].enabled).toBe(true)
    expect(s.chat.localStream).toBe(s.stream)
    await s.chat.toggleCamera()
    expect(s.stream.getVideoTracks()[0].enabled).toBe(false)
    expect(s.chat.localStream).toBeNull()
  })

  it('opens calls to roster teammates when camera is on (initiator has smaller id)', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    expect(s.peer.calls).toHaveLength(1)
    expect(s.peer.calls[0].peerId).toBe('bbb')
  })

  it('does not initiate call when own peer id is larger (other side initiates)', async () => {
    const s = setup('zzz')
    s.chat.setRoster([{ playerId: 'other', peerId: 'aaa', name: 'Other' }])
    await s.chat.toggleCamera()
    expect(s.peer.calls).toHaveLength(0)
  })

  it('closes all calls when camera is toggled off', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    const call = s.peer.calls[0]
    expect(call.closed).toBe(false)
    await s.chat.toggleCamera()
    expect(call.closed).toBe(true)
  })

  it('fires onStreamsChanged when remote stream arrives', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    const remoteStream = fakeCamStream()
    s.peer.calls[0].emitStream(remoteStream)
    expect(s.onStreamsChanged).toHaveBeenLastCalledWith(new Map([['bbb', remoteStream]]))
  })

  it('fires onStreamsChanged when a call closes', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    s.peer.calls[0].emitStream(fakeCamStream())
    s.peer.calls[0].close()
    expect(s.onStreamsChanged).toHaveBeenLastCalledWith(new Map())
  })

  it('rejects incoming calls when camera is off', async () => {
    const s = setup('bbb') // bbb > aaa so bbb answers, aaa calls
    s.chat.setRoster([{ playerId: 'caller', peerId: 'aaa', name: 'Caller' }])
    // camera is off — must reject
    const call = new FakeCall('aaa')
    s.peer.fireIncoming(call)
    expect(call.closed).toBe(true)
    expect(call.answered).toBe(false)
  })

  it('answers incoming calls when camera is on and caller is in roster', async () => {
    const s = setup('bbb')
    s.chat.setRoster([{ playerId: 'caller', peerId: 'aaa', name: 'Caller' }])
    await s.chat.toggleCamera()
    const call = new FakeCall('aaa')
    s.peer.fireIncoming(call)
    expect(call.answered).toBe(true)
    expect(call.closed).toBe(false)
  })

  it('rejects incoming calls from peers not in roster', async () => {
    const s = setup('bbb')
    s.chat.setRoster([]) // roster is empty
    await s.chat.toggleCamera()
    const call = new FakeCall('aaa')
    s.peer.fireIncoming(call)
    expect(call.closed).toBe(true)
  })

  it('closes call to disconnected peer', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'p2', peerId: 'bbb', name: 'P2' }])
    await s.chat.toggleCamera()
    const call = s.peer.calls[0]
    s.chat.peerDisconnected('p2')
    expect(call.closed).toBe(true)
  })

  it('dispose closes all calls and stops camera tracks', async () => {
    const s = setup('aaa')
    s.chat.setRoster([{ playerId: 'other', peerId: 'bbb', name: 'Other' }])
    await s.chat.toggleCamera()
    const call = s.peer.calls[0]
    s.chat.dispose()
    expect(call.closed).toBe(true)
    expect(s.stream.getVideoTracks()[0].stop).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
npx vitest run src/voice/VideoChat.test.ts
```

Expected: FAIL — `VideoChat` module not found.

- [ ] **Step 3: Patch `PeerJsVoicePeer` and add `CamProvider`, `BrowserCamProvider`, `PeerJsVideoPeer` to `VoiceTransport.ts`**

**3a — Patch `PeerJsVoicePeer.onIncomingCall`** to skip video-tagged calls (prevents voice handler from answering video calls). Find the `onIncomingCall` method in `PeerJsVoicePeer` and change the wrapper:

```ts
  onIncomingCall(cb: (call: VoiceCall) => void): void {
    const wrapper = (conn: MediaConnection) => {
      if (conn.metadata?.type === 'video') return  // video calls handled by PeerJsVideoPeer
      cb(new PeerJsVoiceCall(conn))
    }
    this.callbacks.set(cb, wrapper)
    this.peer.on('call', wrapper)
  }
```

**3b — Add `CamProvider`, `BrowserCamProvider`, and `PeerJsVideoPeer`** at the end of `src/voice/VoiceTransport.ts`:

```ts
/** Acquires the local camera stream (lazily, once). */
export interface CamProvider {
  getStream(): Promise<MediaStream>
}

export class BrowserCamProvider implements CamProvider {
  private stream: Promise<MediaStream> | null = null

  getStream(): Promise<MediaStream> {
    if (!this.stream) {
      this.stream = navigator.mediaDevices.getUserMedia({ video: true, audio: false }).catch((err) => {
        this.stream = null
        throw err
      })
    }
    return this.stream
  }
}

/** Like PeerJsVoicePeer but tags outgoing calls as video and only handles incoming video calls. */
export class PeerJsVideoPeer implements VoicePeer {
  private callbacks = new Map<(call: VoiceCall) => void, (conn: MediaConnection) => void>()
  constructor(private peer: Peer) {}
  get id(): string { return this.peer.id }
  call(peerId: string, stream: MediaStream): VoiceCall {
    return new PeerJsVoiceCall(this.peer.call(peerId, stream, { metadata: { type: 'video' } }))
  }
  onIncomingCall(cb: (call: VoiceCall) => void): void {
    const wrapper = (conn: MediaConnection) => {
      if (conn.metadata?.type !== 'video') return  // ignore voice calls
      cb(new PeerJsVoiceCall(conn))
    }
    this.callbacks.set(cb, wrapper)
    this.peer.on('call', wrapper)
  }
  offIncomingCall(cb: (call: VoiceCall) => void): void {
    const wrapper = this.callbacks.get(cb)
    if (wrapper) {
      this.peer.removeListener('call', wrapper)
      this.callbacks.delete(cb)
    }
  }
}
```

- [ ] **Step 4: Create `src/voice/VideoChat.ts`**

```ts
import { reconcileMesh } from './voiceMesh'
import type { VoicePeer, VoiceCall, CamProvider } from './VoiceTransport'
import type { VoiceRosterEntry } from '../session/protocol'

export interface VideoChatDeps {
  peer: VoicePeer
  cam: CamProvider
  localPlayerId: string
  onStreamsChanged: (streams: Map<string, MediaStream>) => void
}

export class VideoChat {
  private roster: VoiceRosterEntry[] = []
  private calls = new Map<string, VoiceCall>()
  private streams = new Map<string, MediaStream>()
  private camStream: MediaStream | null = null
  private cameraOn = false
  private activated = false
  private incomingCallHandler?: (call: VoiceCall) => void

  constructor(private deps: VideoChatDeps) {
    this.incomingCallHandler = (call) => this.handleIncoming(call)
    deps.peer.onIncomingCall(this.incomingCallHandler)
  }

  setRoster(teammates: VoiceRosterEntry[]): void {
    this.roster = teammates
    if (this.activated && this.cameraOn) this.reconcile()
  }

  async toggleCamera(): Promise<void> {
    if (!this.activated) {
      this.camStream = await this.deps.cam.getStream()
      this.camStream.getVideoTracks().forEach(t => { t.enabled = false })
      this.activated = true
    }
    this.cameraOn = !this.cameraOn
    this.camStream!.getVideoTracks().forEach(t => { t.enabled = this.cameraOn })
    if (this.cameraOn) {
      this.reconcile()
    } else {
      for (const peerId of [...this.calls.keys()]) this.closeCall(peerId)
    }
  }

  get localStream(): MediaStream | null {
    return this.cameraOn ? this.camStream : null
  }

  peerDisconnected(playerId: string): void {
    const entry = this.roster.find(r => r.playerId === playerId)
    if (entry) this.closeCall(entry.peerId)
  }

  dispose(): void {
    for (const peerId of [...this.calls.keys()]) this.closeCall(peerId)
    this.camStream?.getVideoTracks().forEach(t => t.stop())
    this.camStream = null
    if (this.incomingCallHandler) {
      this.deps.peer.offIncomingCall(this.incomingCallHandler)
    }
  }

  private reconcile(): void {
    if (!this.camStream || !this.cameraOn) return
    const teammatePeerIds = this.roster.map(r => r.peerId)
    const { toOpen, toClose } = reconcileMesh(this.deps.peer.id, [...this.calls.keys()], teammatePeerIds)
    for (const peerId of toClose) this.closeCall(peerId)
    for (const peerId of toOpen) this.openCall(peerId)
  }

  private openCall(peerId: string): void {
    if (this.calls.has(peerId) || !this.camStream) return
    this.wireCall(this.deps.peer.call(peerId, this.camStream))
  }

  private handleIncoming(call: VoiceCall): void {
    const isRosterMember = this.roster.some(r => r.peerId === call.peerId)
    if (!this.activated || !this.cameraOn || !this.camStream || !isRosterMember || this.calls.has(call.peerId)) {
      call.close()
      return
    }
    call.answer(this.camStream)
    this.wireCall(call)
  }

  private wireCall(call: VoiceCall): void {
    this.calls.set(call.peerId, call)
    call.onStream((stream) => {
      this.streams.set(call.peerId, stream)
      this.emit()
    })
    call.onClose(() => this.cleanupCall(call.peerId))
  }

  private closeCall(peerId: string): void {
    const call = this.calls.get(peerId)
    if (!call) return
    call.close()
    this.cleanupCall(peerId)
  }

  private cleanupCall(peerId: string): void {
    if (!this.calls.has(peerId)) return
    this.calls.delete(peerId)
    this.streams.delete(peerId)
    this.emit()
  }

  private emit(): void {
    this.deps.onStreamsChanged(new Map(this.streams))
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
npx vitest run src/voice/VideoChat.test.ts
```

Expected: all 11 tests PASS.

- [ ] **Step 6: Run full suite**

```bash
npm test
```

Expected: no regressions.

- [ ] **Step 7: Commit**

```bash
git add src/voice/VoiceTransport.ts src/voice/VideoChat.ts src/voice/VideoChat.test.ts
git commit -m "feat: add CamProvider and VideoChat for proximity video calls"
```

---

### Task 3: `VideoTiles` component

**Files:**
- Create: `src/ui/VideoTiles.tsx`
- Create: `src/ui/VideoTiles.test.tsx`

**Interfaces:**
- Produces: `<VideoTiles streams={Map<string, MediaStream>} selfStream={MediaStream | null} />`

---

- [ ] **Step 1: Write the failing tests**

Create `src/ui/VideoTiles.test.tsx`:

```tsx
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { VideoTiles } from './VideoTiles'

afterEach(cleanup)

// jsdom doesn't support srcObject; silence the assignment
Object.defineProperty(HTMLVideoElement.prototype, 'srcObject', {
  set: vi.fn(),
  get: vi.fn(() => null),
})

function fakeStream(): MediaStream {
  return {} as MediaStream
}

describe('VideoTiles', () => {
  it('renders nothing when no streams and no selfStream', () => {
    const { container } = render(<VideoTiles streams={new Map()} selfStream={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders one video for selfStream', () => {
    const { container } = render(<VideoTiles streams={new Map()} selfStream={fakeStream()} />)
    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(1)
    expect(videos[0].muted).toBe(true)
  })

  it('renders one video per remote stream', () => {
    const streams = new Map([['p1', fakeStream()], ['p2', fakeStream()]])
    const { container } = render(<VideoTiles streams={streams} selfStream={null} />)
    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(2)
  })

  it('renders self + remote streams together', () => {
    const streams = new Map([['p1', fakeStream()]])
    const { container } = render(<VideoTiles streams={streams} selfStream={fakeStream()} />)
    const videos = container.querySelectorAll('video')
    expect(videos).toHaveLength(2)
    expect(videos[0].muted).toBe(true) // self-preview is first and muted
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run src/ui/VideoTiles.test.tsx
```

Expected: FAIL — `VideoTiles` module not found.

- [ ] **Step 3: Create `src/ui/VideoTiles.tsx`**

```tsx
import React, { useEffect, useRef } from 'react'

function VideoTile({ stream, muted }: { stream: MediaStream; muted: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream
  }, [stream])
  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted={muted}
      style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 4, background: '#000' }}
    />
  )
}

interface VideoTilesProps {
  streams: Map<string, MediaStream>
  selfStream: MediaStream | null
}

export const VideoTiles: React.FC<VideoTilesProps> = ({ streams, selfStream }) => {
  if (streams.size === 0 && !selfStream) return null
  return (
    <div style={{
      position: 'fixed', bottom: 16, right: 16,
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 1000, pointerEvents: 'none',
    }}>
      {selfStream && <VideoTile stream={selfStream} muted />}
      {[...streams.entries()].map(([peerId, stream]) => (
        <VideoTile key={peerId} stream={stream} muted={false} />
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/ui/VideoTiles.test.tsx
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full suite**

```bash
npm test
```

Expected: no regressions.

- [ ] **Step 6: Commit**

```bash
git add src/ui/VideoTiles.tsx src/ui/VideoTiles.test.tsx
git commit -m "feat: add VideoTiles component for floating camera overlay"
```

---

### Task 4: Wire `VideoChat` into `App.tsx`

**Files:**
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `VideoChat`, `VideoChatDeps` from `src/voice/VideoChat.ts`; `BrowserCamProvider`, `CamProvider` from `src/voice/VoiceTransport.ts`; `VideoTiles` from `src/ui/VideoTiles.tsx`

---

- [ ] **Step 1: Add imports**

Find the existing voice imports near the top of `src/App.tsx` (around line 75):

```ts
import { VoiceChat } from './voice/VoiceChat'
```

Add alongside it:

```ts
import { VoiceChat } from './voice/VoiceChat'
import { VideoChat } from './voice/VideoChat'
import { VideoTiles } from './ui/VideoTiles'
```

Find the existing import from `./voice/VoiceTransport` (which imports `BrowserMicProvider` and `PeerJsVoicePeer`) and add `BrowserCamProvider` and `PeerJsVideoPeer` to it. For example, if it currently reads:

```ts
import { BrowserMicProvider, PeerJsVoicePeer } from './voice/VoiceTransport'
```

Change it to:

```ts
import { BrowserMicProvider, BrowserCamProvider, PeerJsVoicePeer, PeerJsVideoPeer } from './voice/VoiceTransport'
```

- [ ] **Step 2: Add state for video streams and notice**

Find the voice state declarations (around line 178):

```ts
  const [speakers, setSpeakers] = useState<Speaker[]>([])
  const [voiceNotice, setVoiceNotice] = useState<string | null>(null)
```

Add after them:

```ts
  const [videoStreams, setVideoStreams] = useState<Map<string, MediaStream>>(() => new Map())
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(null)
  const [videoNotice, setVideoNotice] = useState<string | null>(null)
```

- [ ] **Step 3: Add `videoChat` and `camProvider` to `gameDataRef`**

Find where `gameDataRef` is initialized (around line 248):

```ts
    voiceChat: null as VoiceChat | null,
    audioSink: new AudioSink(),
    micProvider: new BrowserMicProvider(),
```

Add after `voiceChat`:

```ts
    voiceChat: null as VoiceChat | null,
    videoChat: null as VideoChat | null,
    camProvider: new BrowserCamProvider(),
    audioSink: new AudioSink(),
    micProvider: new BrowserMicProvider(),
```

- [ ] **Step 4: Dispose videoChat in `resetNetworking`**

Find the voice dispose block in `resetNetworking` (around line 319):

```ts
    data.voiceChat?.dispose(); data.voiceChat = null
    data.audioSink.dispose(); data.audioSink = new AudioSink()
    data.micProvider = new BrowserMicProvider()
    setSpeakers([])
```

Add video disposal after it:

```ts
    data.voiceChat?.dispose(); data.voiceChat = null
    data.videoChat?.dispose(); data.videoChat = null
    data.camProvider = new BrowserCamProvider()
    data.audioSink.dispose(); data.audioSink = new AudioSink()
    data.micProvider = new BrowserMicProvider()
    setSpeakers([])
    setVideoStreams(new Map())
    setLocalVideoStream(null)
```

- [ ] **Step 5: Update `startVoice` to also create `VideoChat`**

Find `startVoice` (around line 326):

```ts
  const startVoice = useCallback((localPlayerId: string, peer: Peer) => {
    const data = gameDataRef.current
    data.voiceChat?.dispose()
    const chat = new VoiceChat({
      // ...
    })
    data.voiceChat = chat
    return chat
  }, [])
```

Modify it to also create and store VideoChat:

```ts
  const startVoice = useCallback((localPlayerId: string, peer: Peer) => {
    const data = gameDataRef.current
    data.voiceChat?.dispose()
    const chat = new VoiceChat({
      peer: new PeerJsVoicePeer(peer),
      mic: data.micProvider,
      localPlayerId,
      localName: settingsRef.current.playerName,
      sendStart: (id, name) => {
        if (data.role === 'host') data.netHost?.localVoiceStart()
        else data.netClient?.sendVoiceStart(id, name)
      },
      sendStop: (id) => {
        if (data.role === 'host') data.netHost?.localVoiceStop()
        else data.netClient?.sendVoiceStop(id)
      },
      onSpeakersChanged: (list) => {
        setSpeakers(list)
        const speakingIds = new Set(list.map(s => s.playerId))
        const rp = gameDataRef.current.remotePlayers
        for (const id of rp?.ids() ?? []) rp?.setTalking(id, speakingIds.has(id))
      },
      playStream: (peerId, stream) => data.audioSink.play(peerId, stream),
      stopStream: (peerId) => data.audioSink.stop(peerId),
    })
    data.voiceChat = chat

    data.videoChat?.dispose()
    const videoChat = new VideoChat({
      peer: new PeerJsVideoPeer(peer),   // PeerJsVideoPeer, not PeerJsVoicePeer — tags calls as video
      cam: data.camProvider,
      localPlayerId,
      onStreamsChanged: (streams) => setVideoStreams(new Map(streams)),
    })
    data.videoChat = videoChat

    return { voice: chat, video: videoChat }
  }, [])
```

- [ ] **Step 6: Update the two call sites of `startVoice`**

**Client call site** (around line 687):

Before:
```ts
        const chat = startVoice(client.playerId, peer)
        client.onVoiceRoster((r) => chat.setRoster(r))
        client.onVoiceStart((id, name) => chat.remoteStart(id, name))
        client.onVoiceStop((id) => chat.remoteStop(id))
```

After:
```ts
        const { voice: chat, video: videoChat } = startVoice(client.playerId, peer)
        client.onVoiceRoster((r) => { chat.setRoster(r); videoChat.setRoster(r) })
        client.onVoiceStart((id, name) => chat.remoteStart(id, name))
        client.onVoiceStop((id) => chat.remoteStop(id))
```

**Host call site** (around line 1541):

Before:
```ts
                const chat = startVoice(data.session.localId, hostPeer)
                data.netHost.onHostRoster((r) => chat.setRoster(r))
                data.netHost.onRemoteVoiceStart((id, name) => chat.remoteStart(id, name))
                data.netHost.onRemoteVoiceStop((id) => chat.remoteStop(id))
```

After:
```ts
                const { voice: chat, video: videoChat } = startVoice(data.session.localId, hostPeer)
                data.netHost.onHostRoster((r) => { chat.setRoster(r); videoChat.setRoster(r) })
                data.netHost.onRemoteVoiceStart((id, name) => chat.remoteStart(id, name))
                data.netHost.onRemoteVoiceStop((id) => chat.remoteStop(id))
```

- [ ] **Step 7: Add `onVideoToggle` to controls setup and player-disconnect handler**

Find where `controls.onTalkStart` and `controls.onTalkStop` are set (around line 839):

```ts
    data.controls.onTalkStart = () => {
      // ...
    }
    data.controls.onTalkStop = () => {
      gameDataRef.current.voiceChat?.stopTalking()
    }
```

Add `onVideoToggle` after `onTalkStop`:

```ts
    data.controls.onVideoToggle = () => {
      if (gameStateRef.current !== 'playing') return
      const vc = gameDataRef.current.videoChat
      if (!vc) return
      vc.toggleCamera().then(() => {
        setLocalVideoStream(vc.localStream)
      }).catch(() => {
        setVideoNotice('Camera unavailable — video disabled')
        setTimeout(() => setVideoNotice(null), 4000)
      })
    }
```

Find `voiceChat?.peerDisconnected(id)` (around line 728) and add video alongside:

Before:
```ts
      gameDataRef.current.voiceChat?.peerDisconnected(id)
```

After:
```ts
      gameDataRef.current.voiceChat?.peerDisconnected(id)
      gameDataRef.current.videoChat?.peerDisconnected(id)
```

- [ ] **Step 8: Render `VideoTiles` and video notice in JSX**

Find `<VoiceIndicator speakers={speakers} />` (around line 1649) and add `VideoTiles` after it:

```tsx
          <VoiceIndicator speakers={speakers} />
          <VideoTiles streams={videoStreams} selfStream={localVideoStream} />
```

Find the `voiceNotice` block (around line 1659) and add a `videoNotice` block after it:

```tsx
          {voiceNotice && (
            <div style={{ position: 'absolute', left: 16, bottom: 64, zIndex: 60,
              background: 'rgba(95,29,29,0.85)', color: '#fff', padding: '6px 12px',
              borderRadius: 6, fontFamily: 'monospace', fontSize: 13, pointerEvents: 'none' }}>
              {voiceNotice}
            </div>
          )}
          {videoNotice && (
            <div style={{ position: 'absolute', left: 16, bottom: 88, zIndex: 60,
              background: 'rgba(95,29,29,0.85)', color: '#fff', padding: '6px 12px',
              borderRadius: 6, fontFamily: 'monospace', fontSize: 13, pointerEvents: 'none' }}>
              {videoNotice}
            </div>
          )}
```

- [ ] **Step 9: Build to verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no type errors. Fix any that appear (usually import paths or type mismatches).

- [ ] **Step 10: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 11: Commit**

```bash
git add src/App.tsx
git commit -m "feat: wire VideoChat into App — proximity video chat on KeyV toggle"
```
