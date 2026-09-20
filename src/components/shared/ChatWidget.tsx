import { useEffect, useRef, useState } from 'react'
import { MessageCircle, X, Send, Sparkles } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface ChatMessage {
  id: string
  role: 'user' | 'bot'
  text: string
}

// Starter prompts shown before the user has typed anything — every one of
// these maps to a real intent in apps/api/src/utils/chatbot/intents.ts.
const SUGGESTIONS = [
  'How many loads dispatched today?',
  "What's our revenue this month?",
  'Who owes us money?',
  'Any materials low on stock?',
  'Which driver did the most trips this week?',
]

let idCounter = 0
function nextId(prefix: string) { idCounter += 1; return `${prefix}-${idCounter}` }

// Floating Q&A assistant, mounted once in AppLayout so it persists across
// route navigation. Answers come from CretOS's own data (see
// POST /chatbot/query) — no third-party AI involved, so it only recognizes
// a defined set of question types rather than open-ended conversation.
export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 10)
  }, [open])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setMessages(m => [...m, { id: nextId('u'), role: 'user', text: trimmed }])
    setInput('')
    setSending(true)
    try {
      const res = await api.post('/chatbot/query', { message: trimmed })
      const answer = res.data?.data?.answer ?? "Sorry, I couldn't work that out."
      setMessages(m => [...m, { id: nextId('b'), role: 'bot', text: answer }])
    } catch {
      setMessages(m => [...m, { id: nextId('b'), role: 'bot', text: 'Something went wrong reaching the server — try again in a moment.' }])
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-5 right-5 z-[90] flex h-12 w-12 items-center justify-center rounded-full bg-accent text-white shadow-lg transition-transform hover:scale-105"
        aria-label={open ? 'Close assistant' : 'Open assistant'}
      >
        {open ? <X size={20} /> : <MessageCircle size={20} />}
      </button>

      {open && (
        <div className="fixed bottom-20 right-5 z-[90] flex h-[32rem] w-96 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <Sparkles size={15} className="text-accent" />
            <div>
              <p className="text-sm font-semibold text-gray-900">CretOS Assistant</p>
              <p className="text-[11px] text-gray-400">Answers from your own plant data</p>
            </div>
          </div>

          <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {messages.length === 0 && (
              <div className="space-y-2">
                <p className="px-1 text-xs text-gray-400">Try asking:</p>
                {SUGGESTIONS.map(s => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-lg border border-gray-200 px-3 py-2 text-left text-xs text-gray-600 transition-colors hover:border-accent hover:text-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div
                  className={cn(
                    'max-w-[85%] whitespace-pre-line rounded-xl px-3 py-2 text-xs leading-relaxed',
                    m.role === 'user' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-800'
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {sending && (
              <div className="flex justify-start">
                <div className="rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-400">Thinking…</div>
              </div>
            )}
          </div>

          <form
            onSubmit={e => { e.preventDefault(); send(input) }}
            className="flex items-center gap-2 border-t border-gray-200 px-3 py-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your plant data..."
              className="flex-1 text-xs outline-none placeholder:text-gray-400"
            />
            <button type="submit" disabled={sending || !input.trim()} aria-label="Send message" className="text-accent disabled:text-gray-300">
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
