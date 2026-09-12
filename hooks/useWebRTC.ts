'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { PresenceChannel } from 'pusher-js'
import { getPusherClient } from '@/lib/pusher-client'

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/turn')
    if (!res.ok) return FALLBACK_ICE
    const servers = (await res.json()) as RTCIceServer[]
    return servers.length > 0 ? servers : FALLBACK_ICE
  } catch {
    return FALLBACK_ICE
  }
}

export interface ChatMessage {
  id: string
  text: string
  from: 'me' | 'them'
  time: Date
}

export type CallQuality = 'good' | 'fair' | 'poor' | 'unknown'

type StatsSnap = { bytes: number; lost: number; received: number; ts: number }

export function useWebRTC({ roomId }: { roomId: string }) {
  const localVideoRef      = useRef<HTMLVideoElement>(null)
  const remoteVideoRef     = useRef<HTMLVideoElement>(null)
  const peerConnectionRef  = useRef<RTCPeerConnection | null>(null)
  const localStreamRef     = useRef<MediaStream | null>(null)
  const pendingCandidates  = useRef<RTCIceCandidateInit[]>([])
  const iceServersRef      = useRef<RTCIceServer[]>(FALLBACK_ICE)
  const channelRef         = useRef<PresenceChannel | null>(null)
  const pendingOfferRef    = useRef(false)
  const chatOpenRef        = useRef(false)
  const prevStatsRef       = useRef<StatsSnap | null>(null)

  const [isMuted,           setIsMuted]           = useState(false)
  const [isCameraOff,       setIsCameraOff]       = useState(false)
  const [isConnected,       setIsConnected]       = useState(false)
  const [isRemoteConnected, setIsRemoteConnected] = useState(false)
  const [isPeerJoined,      setIsPeerJoined]      = useState(false)
  const [facingMode,        setFacingMode]        = useState<'user' | 'environment'>('user')
  const [mediaError,        setMediaError]        = useState<string | null>(null)
  const [messages,          setMessages]          = useState<ChatMessage[]>([])
  const [unreadCount,       setUnreadCount]       = useState(0)
  const [callQuality,       setCallQuality]       = useState<CallQuality>('unknown')
  const [peerReadAt,        setPeerReadAt]        = useState<number | null>(null)

  const getLocalStream = useCallback(async (facing: 'user' | 'environment') => {
    return navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    })
  }, [])

  const createPeerConnection = useCallback((channel: PresenceChannel): RTCPeerConnection => {
    peerConnectionRef.current?.close()
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
    peerConnectionRef.current = pc

    localStreamRef.current?.getTracks().forEach((track) => {
      pc.addTrack(track, localStreamRef.current!)
    })

    pc.ontrack = (event) => {
      const stream = event.streams[0] ?? new MediaStream([event.track])
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = stream
      setIsRemoteConnected(true)
      setIsPeerJoined(true)
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channel.trigger('client-ice', { candidate: event.candidate.toJSON() })
      }
    }

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'connected') setIsConnected(true)
      if (state === 'disconnected' || state === 'failed' || state === 'closed') {
        setIsConnected(false)
        setIsRemoteConnected(false)
        setCallQuality('unknown')
        prevStatsRef.current = null
      }
    }

    return pc
  }, [])

  const sendOffer = useCallback(async (channel: PresenceChannel) => {
    const pc = createPeerConnection(channel)
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    channel.trigger('client-offer', { offer })
  }, [createPeerConnection])

  // ── Call quality monitoring (polls every 3 s) ─────────────────
  useEffect(() => {
    if (!isConnected) return

    const interval = setInterval(async () => {
      const pc = peerConnectionRef.current
      if (!pc || pc.connectionState !== 'connected') return

      const stats = await pc.getStats()
      let totalBytes = 0, totalLost = 0, totalReceived = 0

      stats.forEach((report) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const r = report as any
        if (r.type === 'inbound-rtp' && r.kind === 'video') {
          totalBytes    += r.bytesReceived   ?? 0
          totalLost     += r.packetsLost     ?? 0
          totalReceived += r.packetsReceived ?? 0
        }
      })

      const now  = Date.now()
      const prev = prevStatsRef.current

      if (prev) {
        const dt    = (now - prev.ts) / 1000
        const kbps  = dt > 0 ? ((totalBytes - prev.bytes) * 8) / dt / 1000 : 0
        const dLost = totalLost - prev.lost
        const dRecv = totalReceived - prev.received
        const loss  = (dLost + dRecv) > 0 ? dLost / (dLost + dRecv) : 0

        setCallQuality(
          (loss > 0.1  || kbps < 80)  ? 'poor' :
          (loss > 0.03 || kbps < 300) ? 'fair' : 'good'
        )
      }

      prevStatsRef.current = { bytes: totalBytes, lost: totalLost, received: totalReceived, ts: now }
    }, 3000)

    return () => {
      clearInterval(interval)
      setCallQuality('unknown')
      prevStatsRef.current = null
    }
  }, [isConnected])

  // ── Adaptive bitrate + resolution when quality changes ────────
  useEffect(() => {
    if (!isConnected || callQuality === 'unknown') return

    const pc     = peerConnectionRef.current
    const sender = pc?.getSenders().find(s => s.track?.kind === 'video')
    if (sender) {
      const params = sender.getParameters()
      if (!params.encodings?.length) params.encodings = [{}]
      params.encodings[0].maxBitrate =
        callQuality === 'poor' ? 150_000 :
        callQuality === 'fair' ? 500_000 : 1_500_000
      sender.setParameters(params).catch(() => {})
    }

    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) {
      const c = callQuality === 'poor'
        ? { width: { max: 480 }, height: { max: 360 }, frameRate: { max: 15 } }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { max: 30 } }
      track.applyConstraints(c).catch(() => {})
    }
  }, [callQuality, isConnected])

  // ── Chat ──────────────────────────────────────────────────────
  const sendMessage = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed || !channelRef.current) return
    const id = crypto.randomUUID()
    channelRef.current.trigger('client-chat', { id, text: trimmed, sentAt: Date.now() })
    setMessages(prev => [...prev, { id, text: trimmed, from: 'me', time: new Date() }])
  }, [])

  const clearUnread = useCallback(() => {
    chatOpenRef.current = true
    setUnreadCount(0)
    channelRef.current?.trigger('client-read', { at: Date.now() })
  }, [])

  const onChatClose = useCallback(() => {
    chatOpenRef.current = false
  }, [])

  // ── Main effect ───────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    const pusher = getPusherClient()
    const channelName = `presence-room-${roomId}`
    const channel = pusher.subscribe(channelName) as PresenceChannel
    channelRef.current = channel

    const init = async () => {
      try {
        const [stream, iceServers] = await Promise.all([
          getLocalStream('user'),
          fetchIceServers(),
        ])
        if (!mounted) { stream.getTracks().forEach((t) => t.stop()); return }
        iceServersRef.current = iceServers
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        if (pendingOfferRef.current && channelRef.current) {
          pendingOfferRef.current = false
          await sendOffer(channelRef.current)
        }
      } catch {
        if (mounted) setMediaError('Camera or microphone access was denied. Please allow permissions and reload.')
      }
    }

    init()

    channel.bind('pusher:subscription_succeeded', async (members: { count: number }) => {
      if (members.count > 2) {
        setMediaError('This room already has 2 people in it.')
        pusher.unsubscribe(channelName)
        return
      }
      if (members.count === 2) {
        setIsPeerJoined(true)
        if (localStreamRef.current) await sendOffer(channel)
        else pendingOfferRef.current = true
      }
    })

    channel.bind('pusher:member_added', () => { setIsPeerJoined(true) })

    channel.bind('pusher:member_removed', () => {
      setIsPeerJoined(false)
      setIsRemoteConnected(false)
      setIsConnected(false)
      setCallQuality('unknown')
      prevStatsRef.current = null
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      peerConnectionRef.current?.close()
      peerConnectionRef.current = null
      pendingCandidates.current = []
    })

    channel.bind('client-offer', async ({ offer }: { offer: RTCSessionDescriptionInit }) => {
      setIsPeerJoined(true)
      const pc = createPeerConnection(channel)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      for (const c of pendingCandidates.current) await pc.addIceCandidate(new RTCIceCandidate(c))
      pendingCandidates.current = []
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      channel.trigger('client-answer', { answer })
    })

    channel.bind('client-answer', async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
        for (const c of pendingCandidates.current) await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c))
        pendingCandidates.current = []
      }
    })

    channel.bind('client-ice', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionRef.current
      if (pc && pc.remoteDescription) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch { /* stale */ }
      } else {
        pendingCandidates.current.push(candidate)
      }
    })

    channel.bind('client-chat', ({ id, text, sentAt }: { id?: string; text: string; sentAt: number }) => {
      setMessages(prev => [...prev, {
        id: id ?? crypto.randomUUID(),
        text,
        from: 'them',
        time: new Date(sentAt),
      }])
      if (!chatOpenRef.current) setUnreadCount(c => c + 1)
    })

    channel.bind('client-read', ({ at }: { at: number }) => {
      setPeerReadAt(at)
    })

    return () => {
      mounted = false
      pusher.unsubscribe(channelName)
      channelRef.current = null
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      peerConnectionRef.current?.close()
      peerConnectionRef.current = null
    }
  }, [roomId, createPeerConnection, getLocalStream, sendOffer])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) { track.enabled = !track.enabled; setIsMuted(!track.enabled) }
  }, [])

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) { track.enabled = !track.enabled; setIsCameraOff(!track.enabled) }
  }, [])

  const flipCamera = useCallback(async () => {
    const newFacing = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(newFacing)
    try {
      const newStream = await getLocalStream(newFacing)
      if (localVideoRef.current) localVideoRef.current.srcObject = newStream
      const newVideoTrack = newStream.getVideoTracks()[0]
      const sender = peerConnectionRef.current?.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newVideoTrack)
      localStreamRef.current?.getVideoTracks()[0].stop()
      const audio = localStreamRef.current?.getAudioTracks()[0]
      localStreamRef.current = new MediaStream([...(audio ? [audio] : []), newVideoTrack])
    } catch {
      setFacingMode(facingMode)
    }
  }, [facingMode, getLocalStream])

  return {
    localVideoRef, remoteVideoRef,
    isMuted, isCameraOff, isConnected, isRemoteConnected, isPeerJoined,
    mediaError,
    toggleMute, toggleCamera, flipCamera,
    messages, unreadCount, sendMessage, clearUnread, onChatClose,
    callQuality, peerReadAt,
  }
}
