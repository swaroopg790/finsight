import { useEffect, useRef } from 'react'
import { MessageCircle, X, Trash2, Send, Sparkles } from 'lucide-react'
import { useState } from 'react'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'
import { useChatContext } from '../contexts/ChatContext'
import { colors, radius, shadow } from '../lib/tokens'

interface Message {
  role:    'user' | 'assistant'
  content: string
}

interface Props {
  hasHoldings: boolean
}

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
  const bottomRef  = useRef<HTMLDivElement>(null)
  const inputRef   = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 80)
  }, [open])

  // Prevent body scroll when mobile sheet is open
  useEffect(() => {
    if (isMobile) {
      document.body.style.overflow = open ? 'hidden' : ''
    }
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
        conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
      })
      setMessages([...nextMessages, { role: 'assistant', content: data.reply }])
    } catch {
      setMessages([
        ...nextMessages,
        { role: 'assistant', content: '⚠️ Something went wrong. Please try again.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault()
      send(input)
    }
  }

  // ── Panel dimensions ──────────────────────────────────────────────────────
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        width:        '100%',
        height:       '78vh',
        borderRadius: `${radius.xl}px ${radius.xl}px 0 0`,
        boxShadow:    shadow.xl,
      }
    : {
        position:     'fixed',
        bottom:       24,
        right:        24,
        width:        420,
        height:       540,
        borderRadius: radius.lg,
        boxShadow:    shadow.xl,
      }

  return (
    <>
      {/* ── Backdrop (mobile) ────────────────────────────────────────────── */}
      {isMobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position:   'fixed',
            inset:      0,
            background: 'rgba(15,23,42,0.45)',
            zIndex:     1000,
            backdropFilter: 'blur(2px)',
          }}
        />
      )}

      {/* ── Desktop floating trigger button ──────────────────────────────── */}
      {!open && !isMobile && (
        <button
          onClick={() => setOpen(true)}
          title="Ask the AI Copilot"
          style={{
            position:       'fixed',
            bottom:         28,
            right:          28,
            width:          54,
            height:         54,
            borderRadius:   radius.full,
            background:     colors.brand,
            color:          '#fff',
            border:         'none',
            cursor:         'pointer',
            boxShadow:      `0 4px 20px ${colors.brand}60`,
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            zIndex:         1000,
            transition:     'transform 0.15s, box-shadow 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform  = 'scale(1.08)'
            e.currentTarget.style.boxShadow  = `0 6px 24px ${colors.brand}80`
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform  = 'scale(1)'
            e.currentTarget.style.boxShadow  = `0 4px 20px ${colors.brand}60`
          }}
        >
          <MessageCircle size={22} />
        </button>
      )}

      {/* ── Chat panel ───────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          ...panelStyle,
          background:     colors.surface,
          display:        'flex',
          flexDirection:  'column',
          zIndex:         1001,
          overflow:       'hidden',
          border:         `1px solid ${colors.border}`,
        }}>
          {/* Drag handle (mobile) */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e2e8f0' }} />
            </div>
          )}

          {/* Header */}
          <div style={{
            background:     colors.brand,
            padding:        isMobile ? '12px 16px' : '14px 18px',
            display:        'flex',
            justifyContent: 'space-between',
            alignItems:     'center',
            flexShrink:     0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width:          28,
                height:         28,
                borderRadius:   radius.sm,
                background:     'rgba(255,255,255,0.2)',
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
              }}>
                <Sparkles size={14} color="#fff" />
              </div>
              <div>
                <p style={{ margin: 0, fontWeight: 700, fontSize: isMobile ? 15 : 14, color: '#fff' }}>
                  FinSight Copilot
                </p>
                <p style={{ margin: '1px 0 0', fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>
                  Ask anything about your portfolio
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  title="Clear conversation"
                  style={{
                    background: 'rgba(255,255,255,0.15)',
                    border:     'none',
                    borderRadius: radius.sm,
                    color:      'rgba(255,255,255,0.85)',
                    cursor:     'pointer',
                    display:    'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width:      32,
                    height:     32,
                  }}
                >
                  <Trash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                title="Close"
                style={{
                  background: 'rgba(255,255,255,0.15)',
                  border:     'none',
                  borderRadius: radius.sm,
                  color:      '#fff',
                  cursor:     'pointer',
                  display:    'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width:      32,
                  height:     32,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Message list */}
          <div style={{
            flex:          1,
            overflowY:     'auto',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            WebkitOverflowScrolling: 'touch' as never,
            padding:       isMobile ? '14px 14px 8px' : '16px 16px 8px',
            display:       'flex',
            flexDirection: 'column',
            gap:           10,
            background:    '#fafbfc',
          }}>
            {messages.length === 0 && (
              <div className="fade-in">
                <p style={{ color: colors.textMuted, fontSize: 13, margin: '0 0 12px', lineHeight: 1.5 }}>
                  {hasHoldings
                    ? 'Your portfolio is loaded. Try one of these:'
                    : 'Connect a brokerage first, then ask me about your portfolio.'}
                </p>
                {hasHoldings && SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{
                      display:      'block',
                      width:        '100%',
                      textAlign:    'left',
                      background:   colors.surface,
                      border:       `1px solid ${colors.border}`,
                      borderRadius: radius.md,
                      padding:      '10px 12px',
                      marginBottom: 7,
                      fontSize:     isMobile ? 13 : 12,
                      color:        colors.textSecondary,
                      cursor:       'pointer',
                      minHeight:    44,
                      transition:   'border-color 0.15s, background 0.15s',
                      lineHeight:   1.4,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = colors.brand
                      e.currentTarget.style.background  = colors.brandBg
                      e.currentTarget.style.color       = colors.brand
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = colors.border
                      e.currentTarget.style.background  = colors.surface
                      e.currentTarget.style.color       = colors.textSecondary
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className="fade-in"
                style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '86%' }}
              >
                <div style={{
                  background:   msg.role === 'user' ? colors.brand : colors.surface,
                  color:        msg.role === 'user' ? '#fff'        : colors.text,
                  borderRadius: msg.role === 'user'
                    ? `${radius.lg}px ${radius.lg}px ${radius.xs}px ${radius.lg}px`
                    : `${radius.lg}px ${radius.lg}px ${radius.lg}px ${radius.xs}px`,
                  border:     msg.role === 'assistant' ? `1px solid ${colors.border}` : 'none',
                  padding:    '10px 14px',
                  fontSize:   isMobile ? 14 : 13,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                  boxShadow:  msg.role === 'user' ? `0 2px 8px ${colors.brand}30` : shadow.xs,
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{
                  background:    colors.surface,
                  border:        `1px solid ${colors.border}`,
                  borderRadius:  `${radius.lg}px ${radius.lg}px ${radius.lg}px ${radius.xs}px`,
                  padding:       '10px 18px',
                  display:       'flex',
                  gap:           4,
                  alignItems:    'center',
                }}>
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      style={{
                        width:       7,
                        height:      7,
                        borderRadius: radius.full,
                        background:  colors.brand,
                        display:     'inline-block',
                        opacity:     0.6,
                        animation:   `pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding:    isMobile
              ? `10px 12px max(12px, env(safe-area-inset-bottom))`
              : '10px 12px',
            borderTop:  `1px solid ${colors.border}`,
            display:    'flex',
            gap:        8,
            alignItems: 'flex-end',
            flexShrink: 0,
            background: colors.surface,
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isMobile ? 'Ask about your portfolio…' : 'Ask about your portfolio… (Enter to send)'}
              disabled={loading}
              rows={1}
              style={{
                flex:       1,
                resize:     'none',
                border:     `1.5px solid ${colors.border}`,
                borderRadius: radius.md,
                padding:    '10px 12px',
                fontSize:   16,
                fontFamily: 'inherit',
                outline:    'none',
                lineHeight: 1.4,
                maxHeight:  96,
                overflowY:  'auto',
                background: loading ? '#f8fafc' : colors.surface,
                color:      colors.text,
                transition: 'border-color 0.15s',
              }}
              onFocus={(e)  => { e.currentTarget.style.borderColor = colors.brand }}
              onBlur={(e)   => { e.currentTarget.style.borderColor = colors.border }}
              onInput={(e) => {
                const el = e.currentTarget
                el.style.height = 'auto'
                el.style.height = Math.min(el.scrollHeight, 96) + 'px'
              }}
            />
            <button
              onClick={() => send(input)}
              disabled={!input.trim() || loading}
              style={{
                background:     !input.trim() || loading ? '#e2e8f0' : colors.brand,
                color:          !input.trim() || loading ? colors.textMuted : '#fff',
                border:         'none',
                borderRadius:   radius.md,
                display:        'flex',
                alignItems:     'center',
                justifyContent: 'center',
                cursor:         !input.trim() || loading ? 'not-allowed' : 'pointer',
                flexShrink:     0,
                width:          44,
                height:         44,
                transition:     'background 0.15s',
                boxShadow:      !input.trim() || loading ? 'none' : `0 2px 8px ${colors.brand}40`,
              }}
              title="Send"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
