'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import type { Socket } from 'socket.io-client'

const FALLBACK_ICE: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

async function fetchIceServers(): Promise<RTCIceServer[]> {
  try {
    const res = await fetch('/api/turn')
    if (!res.ok) return FALLBACK_ICE
    const servers = await res.json() as RTCIceServer[]
    return servers.length > 0 ? servers : FALLBACK_ICE
  } catch {
    return FALLBACK_ICE
  }
}

interface UseWebRTCProps {
  roomId: string
  socket: Socket | null
}

export function useWebRTC({ roomId, socket }: UseWebRTCProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null)
  const remoteVideoRef = useRef<HTMLVideoElement>(null)
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null)
  const localStreamRef = useRef<MediaStream | null>(null)
  const pendingCandidates = useRef<RTCIceCandidateInit[]>([])
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE)

  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOff, setIsCameraOff] = useState(false)
  const [isConnected, setIsConnected] = useState(false)
  const [isRemoteConnected, setIsRemoteConnected] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [mediaError, setMediaError] = useState<string | null>(null)

  const getLocalStream = useCallback(async (facing: 'user' | 'environment') => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: { echoCancellation: true, noiseSuppression: true },
    })
    return stream
  }, [])

  const createPeerConnection = useCallback(
    (targetId: string): RTCPeerConnection => {
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close()
      }

      const pc = new RTCPeerConnection({ iceServers: iceServersRef.current })
      peerConnectionRef.current = pc

      localStreamRef.current?.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!)
      })

      pc.ontrack = (event) => {
        if (remoteVideoRef.current && event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0]
          setIsRemoteConnected(true)
        }
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socket) {
          socket.emit('ice-candidate', { to: targetId, candidate: event.candidate.toJSON() })
        }
      }

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'connected') setIsConnected(true)
        if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
          setIsConnected(false)
          setIsRemoteConnected(false)
        }
      }

      return pc
    },
    [socket],
  )

  useEffect(() => {
    if (!socket || !roomId) return
    let mounted = true

    const init = async () => {
      try {
        // fetch Metered TURN credentials before doing anything else
        const [stream, iceServers] = await Promise.all([
          getLocalStream('user'),
          fetchIceServers(),
        ])

        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }

        iceServersRef.current = iceServers
        localStreamRef.current = stream
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
        socket.emit('join-room', roomId)
      } catch {
        if (mounted) setMediaError('Camera/mic access denied. Please allow permissions and reload.')
      }
    }

    init()

    const handleRoomJoined = async ({ otherUsers }: { otherUsers: string[] }) => {
      if (otherUsers.length > 0) {
        const targetId = otherUsers[0]
        const pc = createPeerConnection(targetId)
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socket.emit('offer', { to: targetId, offer })
      }
    }

    const handleOffer = async ({ from, offer }: { from: string; offer: RTCSessionDescriptionInit }) => {
      const pc = createPeerConnection(from)
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      for (const c of pendingCandidates.current) {
        await pc.addIceCandidate(new RTCIceCandidate(c))
      }
      pendingCandidates.current = []
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      socket.emit('answer', { to: from, answer })
    }

    const handleAnswer = async ({ answer }: { answer: RTCSessionDescriptionInit }) => {
      if (peerConnectionRef.current) {
        await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(answer))
        for (const c of pendingCandidates.current) {
          await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(c))
        }
        pendingCandidates.current = []
      }
    }

    const handleIceCandidate = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
      const pc = peerConnectionRef.current
      if (pc && pc.remoteDescription) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate))
      } else {
        pendingCandidates.current.push(candidate)
      }
    }

    const handleUserLeft = () => {
      setIsRemoteConnected(false)
      setIsConnected(false)
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null
      peerConnectionRef.current?.close()
      peerConnectionRef.current = null
    }

    const handleRoomFull = () => {
      setMediaError('Room is full. Maximum 2 participants allowed.')
    }

    socket.on('room-joined', handleRoomJoined)
    socket.on('offer', handleOffer)
    socket.on('answer', handleAnswer)
    socket.on('ice-candidate', handleIceCandidate)
    socket.on('user-left', handleUserLeft)
    socket.on('room-full', handleRoomFull)

    return () => {
      mounted = false
      socket.off('room-joined', handleRoomJoined)
      socket.off('offer', handleOffer)
      socket.off('answer', handleAnswer)
      socket.off('ice-candidate', handleIceCandidate)
      socket.off('user-left', handleUserLeft)
      socket.off('room-full', handleRoomFull)
      localStreamRef.current?.getTracks().forEach((t) => t.stop())
      peerConnectionRef.current?.close()
      peerConnectionRef.current = null
    }
  }, [socket, roomId, createPeerConnection, getLocalStream])

  const toggleMute = useCallback(() => {
    const track = localStreamRef.current?.getAudioTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setIsMuted(!track.enabled)
    }
  }, [])

  const toggleCamera = useCallback(() => {
    const track = localStreamRef.current?.getVideoTracks()[0]
    if (track) {
      track.enabled = !track.enabled
      setIsCameraOff(!track.enabled)
    }
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
      const combined = new MediaStream([...(audio ? [audio] : []), newVideoTrack])
      localStreamRef.current = combined
    } catch {
      setFacingMode(facingMode)
    }
  }, [facingMode, getLocalStream])

  return {
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
  }
}
