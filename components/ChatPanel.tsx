'use client'

import { useEffect, useRef, useState } from 'react'
import { X, Send, Smile, Check, CheckCheck } from 'lucide-react'
import type { ChatMessage } from '@/hooks/useWebRTC'

interface Props {
  messages: ChatMessage[]
  isPeerJoined: boolean
  peerReadAt: number | null
  onSend: (text: string) => void
  onClose: () => void
}

const EMOJIS = [
  '😊','😂','🥰','😍','😘','😅','😆','😄',
  '😢','😭','😤','😠','😱','😨','🥺','😬',
  '👍','👎','❤️','🔥','💯','✅','🙏','💪',
  '🎉','🎊','👏','🤝','✌️','🤞','😴','🤔',
]

const SHORTCUTS: Record<string, string> = {
  ':)': '😊', ':-)': '😊',
  ':(': '😞', ':-(': '😞',
  ':D': '😄', ':-D': '😄',
  ';)': '😉', ';-)': '😉',
  '<3': '❤️',
  ':P': '😛', ':p': '😛',
  'xD': '😆', 'XD': '😆',
  ':*': '😘',
}

function applyShortcuts(text: string): string {
  return Object.entries(SHORTCUTS).reduce(
    (t, [k, v]) => t.replaceAll(k, v),
    text,
  )
}

export default function ChatPanel({ messages, isPeerJoined, peerReadAt, onSend, onClose }: Props) {
  const [draft, setDraft]         = useState('')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const submit = () => {
    const text = applyShortcuts(draft.trim())
    if (!text) return
    onSend(text)
    setDraft('')
    setEmojiOpen(false)
  }

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
  }

  const pickEmoji = (emoji: string) => {
    setDraft(d => d + emoji)
    inputRef.current?.focus()
  }

  return (
    <div className="flex w-[52%] shrink-0 flex-col overflow-hidden bg-zinc-900 border-l border-white/10 sm:absolute sm:inset-y-0 sm:right-0 sm:z-50 sm:w-80 sm:shadow-2xl">

      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 shrink-0">
        <span className="font-semibold text-white text-sm">Chat</span>
        <button onClick={onClose} aria-label="Close chat"
          className="flex h-8 w-8 items-center justify-center rounded-full text-zinc-400 transition hover:bg-zinc-800 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages — custom thin scrollbar */}
      <div className={[
        'flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2',
        '[&::-webkit-scrollbar]:w-1',
        '[&::-webkit-scrollbar-track]:bg-transparent',
        '[&::-webkit-scrollbar-thumb]:rounded-full',
        '[&::-webkit-scrollbar-thumb]:bg-zinc-600',
        'scrollbar-thin',
      ].join(' ')}>
        {!isPeerJoined && (
          <p className="mt-8 text-center text-xs text-zinc-500">No one else is here yet.</p>
        )}
        {isPeerJoined && messages.length === 0 && (
          <p className="mt-8 text-center text-xs text-zinc-500">Say hello! 👋</p>
        )}
        {messages.map((msg) => {
          const isRead = peerReadAt !== null && msg.time.getTime() <= peerReadAt
          return (
            <div key={msg.id} className={`flex flex-col ${msg.from === 'me' ? 'items-end' : 'items-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-1.5 text-sm leading-snug ${
                msg.from === 'me'
                  ? 'rounded-br-sm bg-violet-600 text-white'
                  : 'rounded-bl-sm bg-zinc-700 text-white'
              }`}>
                <p className="wrap-break-word">{msg.text}</p>
              </div>
              {/* Timestamp + read receipt */}
              <div className={`mt-0.5 flex items-center gap-1 ${msg.from === 'me' ? 'flex-row-reverse' : ''}`}>
                <span className="text-[10px] text-zinc-500">
                  {msg.time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {msg.from === 'me' && (
                  isRead
                    ? <CheckCheck className="h-3 w-3 text-violet-400" />
                    : <Check className="h-3 w-3 text-zinc-500" />
                )}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Emoji picker */}
      {emojiOpen && (
        <div className="border-t border-white/10 grid grid-cols-8 gap-0 px-2 py-2 shrink-0 bg-zinc-800/80">
          {EMOJIS.map(e => (
            <button key={e} onClick={() => pickEmoji(e)}
              className="flex h-8 w-full items-center justify-center rounded text-base transition hover:bg-zinc-700 active:scale-90">
              {e}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/10 px-3 py-2 shrink-0 safe-area-pb">
        <div className="flex items-center gap-1.5 rounded-2xl bg-zinc-800 px-3 py-2 ring-1 ring-white/10 focus-within:ring-violet-500">
          <button onClick={() => setEmojiOpen(o => !o)} aria-label="Emoji"
            className={`shrink-0 transition ${emojiOpen ? 'text-violet-400' : 'text-zinc-400 hover:text-white'}`}>
            <Smile className="h-4 w-4" />
          </button>
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKey}
            placeholder={isPeerJoined ? 'Message…' : 'Waiting for peer…'}
            disabled={!isPeerJoined}
            className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder-zinc-500 outline-none disabled:opacity-40"
          />
          <button onClick={submit} disabled={!draft.trim() || !isPeerJoined}
            aria-label="Send"
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-white transition hover:bg-violet-500 disabled:opacity-30">
            <Send className="h-3 w-3" />
          </button>
        </div>
        <p className="mt-1 text-center text-[10px] text-zinc-600">:) → 😊 &nbsp; &lt;3 → ❤️ &nbsp; :D → 😄</p>
      </div>
    </div>
  )
}
