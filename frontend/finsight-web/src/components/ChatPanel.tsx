import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, X, Trash2, Send, Sparkles } from 'lucide-react'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useChatContext } from '../contexts/ChatContext'
import { cn } from '../lib/utils'

interface Message { role: 'user' | 'assistant'; content: string }
interface Props { hasHoldings: boolean }

const SUGGESTIONS = [
  'What is my biggest risk right now?',
  'How diversified is my portfolio?',
  'Which position has the best return?',
  'What should I consider rebalancing?',
]

export default function ChatPanel({ hasHoldings }: Props) {
  const { isMobile } = useBreakpoint()
  const { chatOpen: open, setChatOpen: setOpen } = useChatContext()

  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, loading])
  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 80) }, [open])
  useEffect(() => {
    if (isMobile) { document.body.style.overflow = open ? 'hidden' : '' }
    return () => { document.body.style.overflow = '' }
  }, [open, isMobile])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || loading) return
    const userMsg: Message = { role: 'user', content: trimmed }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInput('')
    setLoading(true)
    try {
      const { data } = await api.post('/chat/message', {
        message: trimmed,
        conversationHistory: messages.map(m => ({ role: m.role, content: m.content })),
      })
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages([...nextMessages, { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) { e.preventDefault(); send(input) }
  }

  return (
    <>
      {/* Backdrop (mobile) */}
      <AnimatePresence>
        {isMobile && open && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
          />
        )}
      </AnimatePresence>

      {/* Desktop trigger button */}
      <AnimatePresence>
        {!open && !isMobile && (
          <motion.button
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            title="Ask the AI Copilot"
            className="fixed bottom-7 right-7 w-14 h-14 rounded-full bg-indigo-600 text-white shadow-glow flex items-center justify-center z-[1000] hover:bg-indigo-500 transition-colors"
          >
            <MessageCircle size={22} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={isMobile ? { y: '100%' } : { opacity: 0, scale: 0.95, y: 20 }}
            animate={isMobile ? { y: 0 }      : { opacity: 1, scale: 1,    y: 0  }}
            exit={isMobile   ? { y: '100%' }  : { opacity: 0, scale: 0.95, y: 20 }}
            transition={isMobile ? { type: 'spring', damping: 30, stiffness: 300 } : { duration: 0.2 }}
            className={cn(
              'fixed z-[1001] flex flex-col overflow-hidden',
              'bg-[#0a0a1a] border border-white/[0.08]',
              isMobile
                ? 'inset-x-0 bottom-0 h-[78vh] rounded-t-3xl'
                : 'bottom-6 right-6 w-[420px] h-[540px] rounded-2xl shadow-lift'
            )}
          >
            {/* Drag handle (mobile) */}
            {isMobile && (
              <div className="flex justify-center pt-2.5 pb-1">
                <div className="w-10 h-1 rounded-full bg-white/10" />
              </div>
            )}

            {/* Header */}
            <div className="bg-indigo-600 px-4 py-3.5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/20 flex items-center justify-center">
                  <Sparkles size={13} className="text-white" />
                </div>
                <div>
                  <p className="text-white font-bold text-sm leading-none">FinSight Copilot</p>
                  <p className="text-white/70 text-xs mt-0.5">Ask anything about your portfolio</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button onClick={() => setMessages([])} title="Clear conversation"
                    className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center text-white/80 transition-colors">
                    <Trash2 size={13} />
                  </button>
                )}
                <button onClick={() => setOpen(false)} title="Close"
                  className="w-8 h-8 bg-white/15 hover:bg-white/25 rounded-lg flex items-center justify-center text-white transition-colors">
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 bg-[#050510]">
              {messages.length === 0 && (
                <div className="animate-fade-in">
                  <p className="text-slate-500 text-sm mb-3 leading-relaxed">
                    {hasHoldings
                      ? 'Your portfolio is loaded. Try one of these:'
                      : 'Connect a brokerage first, then ask me about your portfolio.'}
                  </p>
                  {hasHoldings && SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="w-full text-left glass-sm rounded-xl px-3 py-2.5 mb-1.5 text-slate-300 text-xs hover:bg-white/[0.06] transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {messages.map((msg, i) => (
                <div key={i} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                  {msg.role === 'assistant' && (
                    <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0 mr-2 mt-0.5">
                      <Sparkles size={11} className="text-indigo-400" />
                    </div>
                  )}
                  <div className={cn(
                    'max-w-[80%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed',
                    msg.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-br-sm'
                      : 'glass-sm text-slate-200 rounded-bl-sm'
                  )}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {loading && (
                <div className="flex items-start gap-2">
                  <div className="w-6 h-6 rounded-lg bg-indigo-500/20 flex items-center justify-center shrink-0">
                    <Sparkles size={11} className="text-indigo-400" />
                  </div>
                  <div className="glass-sm rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1.5 items-center">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse"
                          style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-white/[0.06] bg-[#0a0a1a] shrink-0">
              <div className="flex items-end gap-2 glass-sm rounded-xl px-3 py-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about your portfolio…"
                  rows={1}
                  disabled={loading}
                  className="flex-1 bg-transparent text-slate-200 placeholder:text-slate-600 text-sm resize-none focus:outline-none min-h-[22px] max-h-28"
                  style={{ lineHeight: '1.5' }}
                />
                <button
                  onClick={() => send(input)}
                  disabled={!input.trim() || loading}
                  className="w-8 h-8 rounded-lg bg-indigo-600 hover:bg-indigo-500 flex items-center justify-center text-white shrink-0 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Send size={14} />
                </button>
              </div>
              {!isMobile && (
                <p className="text-slate-700 text-xs text-center mt-1.5">Enter to send · Shift+Enter for new line</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
