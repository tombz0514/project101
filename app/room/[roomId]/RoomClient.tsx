'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Socket } from 'socket.io-client'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { useWebRTC } from '@/hooks/useWebRTC'

interface Props {
  roomId: string
}

export default function RoomClient({ roomId }: Props) {
  const router = useRouter()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const s = getSocket()
    setSocket(s)
    return () => { disconnectSocket() }
  }, [])

  const {
    localVideoRef,
    remoteVideoRef,
    isMuted,
    isCameraOff,
    isConnected,
    isRemoteConnected,
    mediaError,
    toggleMute,
    toggleCamera,
    flipCamera,
  } = useWebRTC({ roomId, socket })

  const copyRoomCode = useCallback(async () => {
    await navigator.clipboard.writeText(roomId).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [roomId])

  const endCall = useCallback(() => {
    disconnectSocket()
    router.push('/')
  }, [router])

  if (mediaError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="text-4xl">🚫</div>
        <p className="max-w-xs text-sm text-zinc-300">{mediaError}</p>
        <button
          onClick={() => router.push('/')}
          className="rounded-xl bg-zinc-800 px-6 py-3 text-sm font-semibold transition hover:bg-zinc-700"
        >
          Go home
        </button>
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 flex-col bg-black">
      {/* Remote video — full screen */}
      <div className="relative flex-1 overflow-hidden bg-zinc-900">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="h-full w-full object-cover"
        />

        {/* Waiting overlay */}
        {!isRemoteConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-zinc-900">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800 text-4xl">
              👤
            </div>
            <p className="text-sm text-zinc-400">Waiting for someone to join…</p>
            <button
              onClick={copyRoomCode}
              className="flex items-center gap-2 rounded-xl bg-zinc-800 px-5 py-2.5 text-sm font-medium transition hover:bg-zinc-700 active:scale-95"
            >
              <span>{copied ? '✓ Copied!' : '🔗 Share room code'}</span>
              <code className="rounded bg-zinc-700 px-2 py-0.5 text-xs font-mono text-violet-400">
                {roomId}
              </code>
            </button>
          </div>
        )}

        {/* Connection badge */}
        {isRemoteConnected && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur-sm">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400'}`} />
            {isConnected ? 'Connected' : 'Connecting…'}
          </div>
        )}
      </div>

      {/* Local video — picture-in-picture */}
      <div className="absolute bottom-24 right-3 z-10 h-36 w-24 overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:h-44 sm:w-32">
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="h-full w-full object-cover"
        />
        {isCameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-2xl">
            📵
          </div>
        )}
      </div>

      {/* Controls bar */}
      <div className="relative z-10 flex items-center justify-center gap-4 bg-zinc-900/95 px-6 py-5 backdrop-blur-sm safe-area-pb">
        {/* Mute */}
        <ControlButton
          onClick={toggleMute}
          active={isMuted}
          label={isMuted ? 'Unmute' : 'Mute'}
          icon={isMuted ? '🔇' : '🎤'}
        />

        {/* Camera */}
        <ControlButton
          onClick={toggleCamera}
          active={isCameraOff}
          label={isCameraOff ? 'Start cam' : 'Stop cam'}
          icon={isCameraOff ? '📵' : '📷'}
        />

        {/* Flip camera */}
        <ControlButton
          onClick={flipCamera}
          label="Flip camera"
          icon="🔄"
        />

        {/* End call */}
        <button
          onClick={endCall}
          aria-label="End call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 text-xl shadow-lg transition hover:bg-red-500 active:scale-95"
        >
          📵
        </button>
      </div>
    </div>
  )
}

function ControlButton({
  onClick,
  active,
  label,
  icon,
}: {
  onClick: () => void
  active?: boolean
  label: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-14 w-14 flex-col items-center justify-center rounded-full text-xl shadow transition active:scale-95 ${
        active ? 'bg-red-900/80 ring-1 ring-red-500' : 'bg-zinc-700 hover:bg-zinc-600'
      }`}
    >
      {icon}
    </button>
  )
}
