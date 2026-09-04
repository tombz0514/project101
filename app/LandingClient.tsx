'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { v4 as uuidv4 } from 'uuid'

export default function LandingClient() {
  const router = useRouter()
  const [roomInput, setRoomInput] = useState('')
  const [error, setError] = useState('')

  const createRoom = () => {
    const id = uuidv4().slice(0, 8)
    router.push(`/room/${id}`)
  }

  const joinRoom = () => {
    const id = roomInput.trim()
    if (!id) {
      setError('Please enter a room code.')
      return
    }
    router.push(`/room/${id}`)
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      {/* Logo / brand */}
      <div className="mb-10 flex flex-col items-center gap-3">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-600 text-3xl shadow-lg shadow-violet-500/30">
          📹
        </div>
        <h1 className="text-3xl font-bold tracking-tight">VideoCall</h1>
        <p className="text-sm text-zinc-400">Peer-to-peer · No sign-up · Works on iOS &amp; Android</p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl bg-zinc-900 p-8 shadow-2xl ring-1 ring-white/10">
        {/* Create */}
        <button
          onClick={createRoom}
          className="mb-6 w-full rounded-xl bg-violet-600 py-3.5 text-sm font-semibold tracking-wide transition hover:bg-violet-500 active:scale-95"
        >
          Create a new room
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-700" />
          <span className="text-xs text-zinc-500">or join existing</span>
          <div className="h-px flex-1 bg-zinc-700" />
        </div>

        {/* Join */}
        <div className="flex flex-col gap-3">
          <input
            type="text"
            value={roomInput}
            onChange={(e) => { setRoomInput(e.target.value); setError('') }}
            onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
            placeholder="Enter room code"
            className="w-full rounded-xl bg-zinc-800 px-4 py-3.5 text-sm placeholder-zinc-500 outline-none ring-1 ring-white/10 transition focus:ring-violet-500"
          />
          {error && <p className="text-xs text-red-400">{error}</p>}
          <button
            onClick={joinRoom}
            className="w-full rounded-xl border border-zinc-700 py-3.5 text-sm font-semibold transition hover:bg-zinc-800 active:scale-95"
          >
            Join room
          </button>
        </div>
      </div>

      <p className="mt-8 max-w-xs text-center text-xs text-zinc-600">
        Calls are end-to-end encrypted via WebRTC. Room codes expire when all participants leave.
      </p>
    </main>
  )
}
