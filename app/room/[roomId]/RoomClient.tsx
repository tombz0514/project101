'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { destroyPusherClient } from '@/lib/pusher-client'
import { useWebRTC } from '@/hooks/useWebRTC'

interface Props {
  roomId: string
}

export default function RoomClient({ roomId }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)
  const [roomUrl, setRoomUrl] = useState('')

  useEffect(() => {
    setRoomUrl(`${window.location.origin}/room/${roomId}`)
    return () => { destroyPusherClient() }
  }, [roomId])

  const {
    localVideoRef,
    remoteVideoRef,
    isMuted,
    isCameraOff,
    isConnected,
    isRemoteConnected,
    isPeerJoined,
    mediaError,
    toggleMute,
    toggleCamera,
    flipCamera,
  } = useWebRTC({ roomId })

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(roomUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [roomUrl])

  const endCall = useCallback(() => {
    destroyPusherClient()
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

        {/* Waiting — nobody joined yet */}
        {!isPeerJoined && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-zinc-900 px-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800 text-4xl">
              👤
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="font-semibold text-white">Waiting for someone to join…</p>
              <p className="text-sm text-zinc-400">Share the link below with your partner</p>
            </div>
            <div className="w-full max-w-sm rounded-2xl bg-zinc-800 p-4 ring-1 ring-white/10">
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">Room link</p>
              <p className="mb-3 break-all text-xs text-violet-300">{roomUrl}</p>
              <button
                onClick={copyLink}
                className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold transition hover:bg-violet-500 active:scale-95"
              >
                {copied ? '✓ Copied!' : '📋 Copy link'}
              </button>
            </div>
          </div>
        )}

        {/* Joined but video not yet flowing */}
        {isPeerJoined && !isRemoteConnected && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-900/80">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-600 border-t-violet-400" />
            <p className="text-sm text-zinc-300">Connecting…</p>
          </div>
        )}

        {/* Live badge */}
        {isRemoteConnected && (
          <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur-sm">
            <span className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-yellow-400 animate-pulse'}`} />
            {isConnected ? 'Connected' : 'Reconnecting…'}
          </div>
        )}
      </div>

      {/* Local video pip */}
      <div className="absolute bottom-24 right-3 z-10 h-36 w-24 overflow-hidden rounded-2xl border border-white/10 shadow-2xl sm:h-44 sm:w-32">
        <video ref={localVideoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
        {isCameraOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-800 text-2xl">📵</div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 flex items-center justify-center gap-4 bg-zinc-900/95 px-6 py-5 backdrop-blur-sm safe-area-pb">
        <ControlButton onClick={toggleMute} active={isMuted} label={isMuted ? 'Unmute' : 'Mute'} icon={isMuted ? '🔇' : '🎤'} />
        <ControlButton onClick={toggleCamera} active={isCameraOff} label={isCameraOff ? 'Start cam' : 'Stop cam'} icon={isCameraOff ? '📵' : '📷'} />
        <ControlButton onClick={flipCamera} label="Flip camera" icon="🔄" />
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

function ControlButton({ onClick, active, label, icon }: { onClick: () => void; active?: boolean; label: string; icon: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full text-xl shadow transition active:scale-95 ${
        active ? 'bg-red-900/80 ring-1 ring-red-500' : 'bg-zinc-700 hover:bg-zinc-600'
      }`}
    >
      {icon}
    </button>
  )
}
