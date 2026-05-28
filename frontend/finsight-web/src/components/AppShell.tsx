import {
  LayoutDashboard,
  Receipt,
  Bell,
  MessageCircle,
  LogOut,
  UserCircle,
  Sparkles,
  Sun,
  Moon,
} from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ChatProvider, useChatContext } from '../contexts/ChatContext'
import { ThemeProvider, useTheme }       from '../contexts/ThemeContext'
import { useBreakpoint } from '../hooks/useBreakpoint'
import api from '../lib/api'
import {
  SIDEBAR_W, TOPBAR_H, BOTTOMNAV_H,
  colors, shadow, radius,
} from '../lib/tokens'

// ── Nav items definition ──────────────────────────────────────────────────────
const NAV_ITEMS = [
  { label: 'Dashboard',    icon: LayoutDashboard, path: '/'             },
  { label: 'Transactions', icon: Receipt,          path: '/transactions' },
  { label: 'Alerts',       icon: Bell,             path: '/alerts'      },
]

// ── Inner shell (has access to ChatContext + ThemeContext) ────────────────────
function ShellInner({ children }: { children: React.ReactNode }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { isMobile } = useBreakpoint()
  const { setChatOpen } = useChatContext()
  const { isDark, toggleTheme } = useTheme()

  function handleLogout() {
    api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('finsight_token')
    localStorage.removeItem('finsight_refresh_token')
    navigate('/login')
  }

  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: colors.pageBg }}>
        {/* ── Mobile top bar ──────────────────────────────────────────── */}
        <header style={{
          position:    'fixed',
          top:         0,
          left:        0,
          right:       0,
          height:      TOPBAR_H,
          background:  colors.sidebar,
          display:     'flex',
          alignItems:  'center',
          justifyContent: 'space-between',
          padding:     '0 18px',
          zIndex:      900,
          boxShadow:   shadow.md,
        }}>
          {/* Brand */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width:        28,
              height:       28,
              borderRadius: radius.sm,
              background:   colors.brand,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
            }}>
              <Sparkles size={14} color="#fff" />
            </div>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: 16, letterSpacing: '-0.3px' }}>
              FinSight
            </span>
          </div>

          {/* Right controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Dark mode toggle */}
            <button
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{
                background:   'none',
                border:       '1px solid #334155',
                borderRadius: radius.sm,
                padding:      '6px 9px',
                color:        colors.sidebarText,
                cursor:       'pointer',
                display:      'flex',
                alignItems:   'center',
                justifyContent: 'center',
                minHeight:    36,
              }}
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Logout */}
            <button
              onClick={handleLogout}
              title="Sign out"
              style={{
                background:   'none',
                border:       '1px solid #334155',
                borderRadius: radius.sm,
                padding:      '6px 12px',
                color:        colors.sidebarText,
                cursor:       'pointer',
                fontSize:     12,
                display:      'flex',
                alignItems:   'center',
                gap:          6,
                minHeight:    36,
              }}
            >
              <LogOut size={13} />
              Sign out
            </button>
          </div>
        </header>

        {/* ── Page content ────────────────────────────────────────────── */}
        <main style={{
          flex:          1,
          paddingTop:    TOPBAR_H,
          paddingBottom: BOTTOMNAV_H + 8,
          overflowX:     'hidden',
        }}>
          {children}
        </main>

        {/* ── Mobile bottom nav ───────────────────────────────────────── */}
        <MobileBottomNav
          onChat={() => setChatOpen(true)}
          activePath={location.pathname}
        />
      </div>
    )
  }

  // ── Desktop layout ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: colors.pageBg }}>
      {/* ── Sidebar ───────────────────────────────────────────────────── */}
      <aside style={{
        position:   'fixed',
        top:        0,
        left:       0,
        bottom:     0,
        width:      SIDEBAR_W,
        background: colors.sidebar,
        display:    'flex',
        flexDirection: 'column',
        zIndex:     800,
        borderRight: `1px solid ${colors.sidebarBorder}`,
      }}>
        {/* Brand logo */}
        <div style={{ padding: '24px 20px 16px', borderBottom: `1px solid ${colors.sidebarBorder}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width:        34,
              height:       34,
              borderRadius: radius.md,
              background:   colors.brand,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              flexShrink:   0,
              boxShadow:    `0 2px 8px ${colors.brand}50`,
            }}>
              <Sparkles size={16} color="#fff" />
            </div>
            <div>
              <p style={{ color: '#fff', fontWeight: 700, fontSize: 15, margin: 0, letterSpacing: '-0.3px' }}>
                FinSight
              </p>
              <p style={{ color: colors.sidebarText, fontSize: 10, margin: 0, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                AI Copilot
              </p>
            </div>
          </div>
        </div>

        {/* Nav items */}
        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <p style={{ color: colors.sidebarText, fontSize: 10, fontWeight: 600, letterSpacing: '0.8px', textTransform: 'uppercase', padding: '6px 10px', margin: '0 0 4px' }}>
            Menu
          </p>
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const active = path === location.pathname
            return (
              <button
                key={label}
                onClick={() => navigate(path)}
                className="nav-item"
                style={{
                  display:     'flex',
                  alignItems:  'center',
                  gap:         10,
                  padding:     '9px 10px',
                  borderRadius: radius.sm,
                  border:      'none',
                  cursor:      'pointer',
                  background:  active ? colors.sidebarActiveBg : 'transparent',
                  color:       active ? colors.sidebarTextActive : colors.sidebarText,
                  fontSize:    14,
                  fontWeight:  active ? 600 : 400,
                  width:       '100%',
                  textAlign:   'left',
                }}
              >
                <Icon size={16} />
                {label}
              </button>
            )
          })}
        </nav>

        {/* User / Dark toggle / Logout */}
        <div style={{ padding: '12px 10px 20px', borderTop: `1px solid ${colors.sidebarBorder}` }}>
          {/* User info */}
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         10,
            padding:     '8px 10px',
            borderRadius: radius.sm,
            marginBottom: 4,
          }}>
            <div style={{
              width:        30,
              height:       30,
              borderRadius: radius.full,
              background:   colors.sidebarHover,
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              flexShrink:   0,
            }}>
              <UserCircle size={18} color={colors.sidebarText} />
            </div>
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <p style={{ color: '#fff', fontSize: 13, fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                My Portfolio
              </p>
              <p style={{ color: colors.sidebarText, fontSize: 10, margin: 0 }}>
                Free plan
              </p>
            </div>
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={toggleTheme}
            className="nav-item"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         10,
              padding:     '9px 10px',
              borderRadius: radius.sm,
              border:      'none',
              cursor:      'pointer',
              background:  'transparent',
              color:       colors.sidebarText,
              fontSize:    14,
              width:       '100%',
              textAlign:   'left',
              marginBottom: 2,
            }}
          >
            {isDark ? <Sun size={16} /> : <Moon size={16} />}
            {isDark ? 'Light mode' : 'Dark mode'}
          </button>

          {/* Sign out */}
          <button
            onClick={handleLogout}
            className="nav-item"
            style={{
              display:     'flex',
              alignItems:  'center',
              gap:         10,
              padding:     '9px 10px',
              borderRadius: radius.sm,
              border:      'none',
              cursor:      'pointer',
              background:  'transparent',
              color:       colors.sidebarText,
              fontSize:    14,
              width:       '100%',
              textAlign:   'left',
            }}
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────── */}
      <main style={{
        marginLeft: SIDEBAR_W,
        flex:       1,
        minHeight:  '100vh',
        overflowX:  'hidden',
      }}>
        {children}
      </main>
    </div>
  )
}

// ── Mobile bottom nav bar ─────────────────────────────────────────────────────
function MobileBottomNav({ onChat, activePath }: { onChat: () => void; activePath: string }) {
  const navigate = useNavigate()

  const items = [
    { label: 'Dashboard',    icon: LayoutDashboard, path: '/',             action: () => navigate('/') },
    { label: 'Transactions', icon: Receipt,          path: '/transactions', action: () => navigate('/transactions') },
    { label: 'Copilot',      icon: MessageCircle,   path: null,            action: onChat },
  ]

  return (
    <nav style={{
      position:        'fixed',
      bottom:          0,
      left:            0,
      right:           0,
      height:          BOTTOMNAV_H,
      background:      colors.surface,
      borderTop:       `1px solid ${colors.border}`,
      display:         'flex',
      alignItems:      'stretch',
      zIndex:          900,
      boxShadow:       '0 -2px 12px rgba(0,0,0,0.06)',
      paddingBottom:   'env(safe-area-inset-bottom)',
    }}>
      {items.map(({ label, icon: Icon, path, action }) => {
        const active = path !== null && path === activePath
        return (
          <button
            key={label}
            onClick={action}
            style={{
              flex:           1,
              display:        'flex',
              flexDirection:  'column',
              alignItems:     'center',
              justifyContent: 'center',
              gap:            3,
              background:     'none',
              border:         'none',
              cursor:         'pointer',
              color:          active ? colors.brand : colors.textMuted,
              fontSize:       10,
              fontWeight:     active ? 600 : 400,
              minHeight:      44,
            }}
          >
            <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
            {label}
          </button>
        )
      })}
    </nav>
  )
}

// ── Public export: wraps children with ThemeProvider + ChatProvider ───────────
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ChatProvider>
        <ShellInner>{children}</ShellInner>
      </ChatProvider>
    </ThemeProvider>
  )
}
