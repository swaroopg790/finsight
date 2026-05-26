import { useEffect, useRef, useState } from 'react'
import api from '../lib/api'
import { useBreakpoint } from '../hooks/useBreakpoint'

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
  const [open,     setOpen]     = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input,    setInput]    = useState('')
  const [loading,  setLoading]  = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

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
    // On mobile, Enter adds a newline (physical keyboard sends via button)
    if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
      e.preventDefault()
      send(input)
    }
  }

  // ── Panel dimensions — desktop overlay vs mobile bottom sheet ─────────────
  const panelStyle: React.CSSProperties = isMobile
    ? {
        position:     'fixed',
        bottom:       0,
        left:         0,
        right:        0,
        width:        '100%',
        height:       '72vh',
        borderRadius: '20px 20px 0 0',
        boxShadow:    '0 -4px 32px rgba(0,0,0,0.18)',
      }
    : {
        position:     'fixed',
        bottom:       24,
        right:        24,
        width:        400,
        height:       520,
        borderRadius: 16,
        boxShadow:    '0 8px 40px rgba(0,0,0,0.18)',
      }

  return (
    <>
      {/* ── Backdrop for mobile sheet ──────────────────────────────────────── */}
      {isMobile && open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 999,
          }}
        />
      )}

      {/* ── Floating trigger ──────────────────────────────────────────────── */}
      {!open && (
        isMobile ? (
          /* Mobile: full-width bar at the bottom */
          <button
            onClick={() => setOpen(true)}
            style={{
              position:     'fixed',
              bottom:       0,
              left:         0,
              right:        0,
              padding:      '14px 20px',
              background:   '#1a1a1a',
              color:        '#fff',
              border:       'none',
              fontSize:     14,
              fontWeight:   600,
              cursor:       'pointer',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              gap:          8,
              zIndex:       1000,
              // Safe area padding for iPhone home bar
              paddingBottom: 'max(14px, env(safe-area-inset-bottom))',
            }}
          >
            💬 Ask AI Copilot
          </button>
        ) : (
          /* Desktop: floating circle button */
          <button
            onClick={() => setOpen(true)}
            title="Ask the AI Copilot"
            style={{
              position:     'fixed',
              bottom:       28,
              right:        28,
              width:        56,
              height:       56,
              borderRadius: '50%',
              background:   '#1a1a1a',
              color:        '#fff',
              border:       'none',
              fontSize:     24,
              cursor:       'pointer',
              boxShadow:    '0 4px 16px rgba(0,0,0,0.25)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              zIndex:       1000,
              transition:   'transform 0.15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
          >
            💬
          </button>
        )
      )}

      {/* ── Chat panel ────────────────────────────────────────────────────── */}
      {open && (
        <div style={{
          ...panelStyle,
          background:  '#fff',
          display:     'flex',
          flexDirection: 'column',
          zIndex:      1000,
          overflow:    'hidden',
          border:      '1px solid #e5e5e5',
        }}>
          {/* Drag handle for mobile sheet */}
          {isMobile && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2, background: '#ddd' }} />
            </div>
          )}

          {/* Header */}
          <div style={{
            background:  '#1a1a1a',
            color:       '#fff',
            padding:     isMobile ? '12px 16px' : '14px 18px',
            display:     'flex',
            justifyContent: 'space-between',
            alignItems:  'center',
            flexShrink:  0,
          }}>
            <div>
              <p style={{ margin: 0, fontWeight: 700, fontSize: isMobile ? 15 : 14 }}>
                FinSight Copilot
              </p>
              <p style={{ margin: '2px 0 0', fontSize: 11, color: '#aaa' }}>
                Ask anything about your portfolio
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {messages.length > 0 && (
                <button
                  onClick={() => setMessages([])}
                  style={{
                    background: 'none', border: 'none', color: '#888',
                    cursor: 'pointer', fontSize: 12, padding: '4px 8px',
                    minHeight: 36,
                  }}
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'none', border: 'none', color: '#fff',
                  cursor: 'pointer', fontSize: 22, lineHeight: 1,
                  padding: '4px 8px', minHeight: 36,
                }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Message list */}
          <div style={{
            flex:          1,
            overflowY:     'auto',
            WebkitOverflowScrolling: 'touch' as never,
            padding:       isMobile ? '14px 14px 8px' : '16px 16px 8px',
            display:       'flex',
            flexDirection: 'column',
            gap:           12,
          }}>
            {messages.length === 0 && (
              <div>
                <p style={{ color: '#888', fontSize: 13, margin: '0 0 12px' }}>
                  {hasHoldings
                    ? 'Your portfolio is loaded. Ask me anything:'
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
                      background:   '#f5f5f5',
                      border:       '1px solid #eee',
                      borderRadius: 8,
                      padding:      '10px 12px',
                      marginBottom: 8,
                      fontSize:     isMobile ? 13 : 12,
                      color:        '#444',
                      cursor:       'pointer',
                      minHeight:    44,
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
                style={{ alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '85%' }}
              >
                <div style={{
                  background:   msg.role === 'user' ? '#1a1a1a' : '#f0f0f0',
                  color:        msg.role === 'user' ? '#fff'     : '#222',
                  borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px'
                    : '16px 16px 16px 4px',
                  padding:    '10px 14px',
                  fontSize:   isMobile ? 14 : 13,
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                  wordBreak:  'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ alignSelf: 'flex-start' }}>
                <div style={{
                  background:   '#f0f0f0',
                  borderRadius: '16px 16px 16px 4px',
                  padding:      '10px 16px',
                  fontSize:     20,
                  letterSpacing: 4,
                  color:        '#999',
                }}>
                  •••
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div style={{
            padding:    isMobile ? '10px 12px max(10px, env(safe-area-inset-bottom))' : '10px 12px',
            borderTop:  '1px solid #eee',
            display:    'flex',
            gap:        8,
            alignItems: 'flex-end',
            flexShrink: 0,
            background: '#fafafa',
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
                border:     '1px solid #ddd',
                borderRadius: 10,
                padding:    '10px 12px',
                fontSize:   16,            // 16px prevents iOS zoom-on-focus
                fontFamily: 'inherit',
                outline:    'none',
                lineHeight: 1.4,
                maxHeight:  96,
                overflowY:  'auto',
                background: loading ? '#f5f5f5' : '#fff',
              }}
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
                background:   !input.trim() || loading ? '#ccc' : '#1a1a1a',
                color:        '#fff',
                border:       'none',
                borderRadius: 10,
                padding:      '0 16px',
                fontSize:     13,
                cursor:       !input.trim() || loading ? 'not-allowed' : 'pointer',
                fontWeight:   600,
                flexShrink:   0,
                height:       44,          // touch target
                minWidth:     64,
              }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </>
  )
}
