'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Mic, MicOff,
  Video, VideoOff,
  FlipHorizontal2,
  PhoneOff,
  User,
  Link2,
  Check,
  Wifi, WifiOff,
  ArrowLeftRight,
} from 'lucide-react'
import { destroyPusherClient } from '@/lib/pusher-client'
import { useWebRTC } from '@/hooks/useWebRTC'

interface Props { roomId: string }

// ── Shared classes ───────────────────────────────────────────────
const MAIN_CLS = 'absolute inset-0'
const PIP_CLS  =
  'absolute z-40 h-40 w-28 touch-none cursor-grab overflow-hidden rounded-2xl ' +
  'border border-white/10 shadow-2xl active:cursor-grabbing sm:h-48 sm:w-36'
const PIP_DEFAULT = 'bottom-24 left-3'

export default function RoomClient({ roomId }: Props) {
  const router = useRouter()
  const [copied, setCopied]   = useState(false)
  const [roomUrl]             = useState(() => `${window.location.origin}/room/${roomId}`)
  const [swapped, setSwapped] = useState(false)
  const [pipPos, setPipPos]   = useState<{ left: number; top: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const drag = useRef<{ sx: number; sy: number; sl: number; st: number } | null>(null)
  const moved = useRef(false)

  useEffect(() => () => { destroyPusherClient() }, [])

  const {
    localVideoRef, remoteVideoRef,
    isMuted, isCameraOff,
    isConnected, isRemoteConnected, isPeerJoined,
    mediaError,
    toggleMute, toggleCamera, flipCamera,
  } = useWebRTC({ roomId })

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(roomUrl).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [roomUrl])

  const endCall = useCallback(() => { destroyPusherClient(); router.push('/') }, [router])

  // ── Drag ─────────────────────────────────────────────────────
  const onDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    moved.current = false
    const el = e.currentTarget
    const c  = containerRef.current
    if (!c) return
    const er = el.getBoundingClientRect()
    const cr = c.getBoundingClientRect()
    drag.current = { sx: e.clientX, sy: e.clientY, sl: er.left - cr.left, st: er.top - cr.top }
    el.setPointerCapture(e.pointerId)
  }, [])

  const onDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return
    const dx = e.clientX - drag.current.sx
    const dy = e.clientY - drag.current.sy
    if (Math.abs(dx) > 5 || Math.abs(dy) > 5) moved.current = true
    const el = e.currentTarget
    const c  = containerRef.current
    if (!c) return
    const pad = 8
    setPipPos({
      left: Math.max(pad, Math.min(c.offsetWidth  - el.offsetWidth  - pad, drag.current.sl + dx)),
      top:  Math.max(pad, Math.min(c.offsetHeight - el.offsetHeight - pad, drag.current.st + dy)),
    })
  }, [])

  const onDragEnd  = useCallback(() => { drag.current = null }, [])

  const onPipTap   = useCallback(() => {
    if (moved.current) return
    setSwapped(s => !s)
    setPipPos(null)       // reset to default corner on swap
  }, [])

  // ── Error screen ─────────────────────────────────────────────
  if (mediaError) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-900/40 ring-1 ring-red-500/40">
          <VideoOff className="h-7 w-7 text-red-400" />
        </div>
        <p className="max-w-xs text-sm text-zinc-300">{mediaError}</p>
        <button onClick={() => router.push('/')} className="rounded-xl bg-zinc-800 px-6 py-3 text-sm font-semibold transition hover:bg-zinc-700">
          Go home
        </button>
      </div>
    )
  }

  // Which container is currently the PiP?
  const localIsPip  = !swapped
  const remoteIsPip =  swapped

  return (
    <div className="relative flex flex-1 flex-col bg-black">
      <div ref={containerRef} className="relative flex-1 overflow-hidden bg-zinc-950">

        {/* ── Remote video container ── */}
        <div
          style={remoteIsPip && pipPos ? { left: pipPos.left, top: pipPos.top } : undefined}
          className={`${remoteIsPip ? `${PIP_CLS} ${pipPos ? '' : PIP_DEFAULT}` : MAIN_CLS}`}
          onPointerDown={remoteIsPip ? onDragStart : undefined}
          onPointerMove={remoteIsPip ? onDragMove  : undefined}
          onPointerUp  ={remoteIsPip ? onDragEnd   : undefined}
          onClick      ={remoteIsPip ? onPipTap    : undefined}
        >
          <video
            ref={remoteVideoRef}
            autoPlay playsInline
            className={`h-full w-full ${remoteIsPip ? 'object-cover' : 'object-contain'}`}
          />
          {remoteIsPip && (
            <div className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[10px] text-white/60 backdrop-blur-sm rounded-b-2xl">
              tap to swap
            </div>
          )}
        </div>

        {/* ── Local video container (always mirrored) ── */}
        <div
          style={localIsPip && pipPos ? { left: pipPos.left, top: pipPos.top } : undefined}
          className={`${localIsPip ? `${PIP_CLS} ${pipPos ? '' : PIP_DEFAULT}` : MAIN_CLS}`}
          onPointerDown={localIsPip ? onDragStart : undefined}
          onPointerMove={localIsPip ? onDragMove  : undefined}
          onPointerUp  ={localIsPip ? onDragEnd   : undefined}
          onClick      ={localIsPip ? onPipTap    : undefined}
        >
          <video
            ref={localVideoRef}
            autoPlay playsInline muted
            className={`h-full w-full scale-x-[-1] ${localIsPip ? 'object-cover' : 'object-contain'}`}
          />
          {/* You label (PiP only) */}
          {localIsPip && (
            <div className="absolute inset-x-0 bottom-0 bg-black/50 py-0.5 text-center text-[10px] text-white/60 backdrop-blur-sm rounded-b-2xl">
              You · tap to swap
            </div>
          )}
          {/* Camera off overlay */}
          {isCameraOff && (
            <div className={`absolute inset-0 flex items-center justify-center bg-zinc-800 ${localIsPip ? 'rounded-2xl' : ''}`}>
              <VideoOff className={localIsPip ? 'h-6 w-6 text-zinc-500' : 'h-10 w-10 text-zinc-500'} />
            </div>
          )}
        </div>

        {/* ── Waiting overlay (z-30, local PiP floats above at z-40) ── */}
        {!isPeerJoined && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-5 bg-zinc-900 px-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-800 ring-1 ring-white/10">
              <User className="h-9 w-9 text-zinc-400" />
            </div>
            <div className="flex flex-col items-center gap-1 text-center">
              <p className="font-semibold text-white">Waiting for someone to join…</p>
              <p className="text-sm text-zinc-400">Share the link below with your partner</p>
            </div>
            <div className="w-full max-w-sm rounded-2xl bg-zinc-800 p-4 ring-1 ring-white/10">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">
                <Link2 className="h-3 w-3" /> Room link
              </div>
              <p className="mb-3 break-all text-xs text-violet-300">{roomUrl}</p>
              <button
                onClick={copyLink}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 py-2.5 text-sm font-semibold transition hover:bg-violet-500 active:scale-95"
              >
                {copied ? <><Check className="h-4 w-4" /> Copied!</> : <><Link2 className="h-4 w-4" /> Copy link</>}
              </button>
            </div>
          </div>
        )}

        {/* Connecting spinner */}
        {isPeerJoined && !isRemoteConnected && (
          <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-zinc-900/80">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-zinc-600 border-t-violet-400" />
            <p className="text-sm text-zinc-300">Connecting…</p>
          </div>
        )}

        {/* Connection badge */}
        {isRemoteConnected && (
          <div className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs backdrop-blur-sm">
            {isConnected
              ? <Wifi className="h-3 w-3 text-green-400" />
              : <WifiOff className="h-3 w-3 animate-pulse text-yellow-400" />}
            <span className="text-white/80">{isConnected ? 'Connected' : 'Reconnecting…'}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="relative z-10 flex items-center justify-center gap-4 bg-zinc-900/95 px-6 py-5 backdrop-blur-sm safe-area-pb">
        <ControlButton onClick={toggleMute}   active={isMuted}     label={isMuted    ? 'Unmute'       : 'Mute'}         icon={isMuted    ? <MicOff className="h-5 w-5" />   : <Mic className="h-5 w-5" />} />
        <ControlButton onClick={toggleCamera} active={isCameraOff} label={isCameraOff? 'Start camera' : 'Stop camera'} icon={isCameraOff? <VideoOff className="h-5 w-5" /> : <Video className="h-5 w-5" />} />
        <ControlButton onClick={() => { setSwapped(s => !s); setPipPos(null) }} label="Swap view" icon={<ArrowLeftRight className="h-5 w-5" />} />
        <ControlButton onClick={flipCamera} label="Flip camera" icon={<FlipHorizontal2 className="h-5 w-5" />} />
        <button onClick={endCall} aria-label="End call"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-red-600 shadow-lg transition hover:bg-red-500 active:scale-95">
          <PhoneOff className="h-6 w-6 text-white" />
        </button>
      </div>
    </div>
  )
}

function ControlButton({ onClick, active, label, icon }: { onClick: () => void; active?: boolean; label: string; icon: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-label={label} title={label}
      className={`flex h-14 w-14 items-center justify-center rounded-full shadow transition active:scale-95 ${
        active ? 'bg-red-900/80 text-red-300 ring-1 ring-red-500' : 'bg-zinc-700 text-white hover:bg-zinc-600'
      }`}>
      {icon}
    </button>
  )
}
