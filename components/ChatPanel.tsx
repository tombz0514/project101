'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send } from 'lucide-react'
import type { ChatMessage } from '@/hooks/useWebRTC'

interface Props {
  messages: ChatMessage[]
  isPeerJoined: boolean
  onSend: (text: string) => void
  onClose: () => void
}

export default function ChatPanel({ messages, isPeerJoined, onSend, onClose }: Props) {
  const [draft, setDraft] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    onSend(text)
    setDraft('')
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  return (
    <div className="absolute inset-y-0 left-0 z-50 flex w-72 flex-col bg-zinc-900 border-r border-white/10 shadow-2xl sm:w-80">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="font-semibold text-white">Chat</span>
        <button onClick={onClose} aria-label="Close chat"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
        {!isPeerJoined && (
          <p className="mt-10 text-center text-sm text-zinc-500">No one else is here yet.</p>
        )}
        {isPeerJoined && messages.length === 0 && (
          <p className="mt-10 text-center text-sm text-zinc-500">Say hello!</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.from === 'me' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm leading-snug ${
              msg.from === 'me'
                ? 'rounded-br-sm bg-violet-600 text-white'
                : 'rounded-bl-sm bg-zinc-700 text-white'
            }`}>
              <p>{msg.text}</p>
              <p className={`mt-0.5 text-[10px] ${msg.from === 'me' ? 'text-violet-300' : 'text-zinc-400'}`}>
                {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-white/10 px-3 py-3 safe-area-pb">
        <div className="flex items-center gap-2 rounded-2xl bg-zinc-800 px-3 py-2 ring-1 ring-white/10 focus-within:ring-violet-500">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={isPeerJoined ? 'Type a message…' : 'Waiting for peer…'}
            disabled={!isPeerJoined}
            className="flex-1 bg-transparent text-sm text-white placeholder-zinc-500 outline-none disabled:opacity-40"
          />
          <button onClick={submit} disabled={!draft.trim() || !isPeerJoined}
            aria-label="Send message"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-30">
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
