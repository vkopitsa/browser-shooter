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
