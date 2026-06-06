import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LayoutDashboard, Receipt, Bell, Calculator, Wallet,
  MessageCircle, LogOut, UserCircle, Sparkles, Newspaper,
  Target, TrendingUp, X, Menu, ChevronRight,
} from 'lucide-react'
import { ChatProvider, useChatContext } from '../contexts/ChatContext'
import { ThemeProvider }                from '../contexts/ThemeContext'
import { useBreakpoint }                from '../hooks/useBreakpoint'
import { cn }                           from '../lib/utils'
import api                              from '../lib/api'

// ── Nav definition ────────────────────────────────────────────────────────────
const NAV = [
  { label: 'Dashboard',        icon: LayoutDashboard, path: '/'             },
  { label: 'Net Worth',        icon: TrendingUp,      path: '/networth'     },
  { label: 'Transactions',     icon: Receipt,         path: '/transactions' },
  { label: 'Budget',           icon: Wallet,          path: '/budget'       },
  { label: 'Goals',            icon: Target,          path: '/goals'        },
  { label: 'Portfolio News',   icon: Newspaper,       path: '/news'         },
  { label: 'Tax Intelligence', icon: Calculator,      path: '/tax'          },
  { label: 'Alerts',           icon: Bell,            path: '/alerts'       },
]

const MOBILE_NAV = [
  { label: 'Home',     icon: LayoutDashboard, path: '/'        },
  { label: 'Worth',    icon: TrendingUp,      path: '/networth'},
  { label: 'News',     icon: Newspaper,       path: '/news'    },
  { label: 'Goals',    icon: Target,          path: '/goals'   },
]

// ── Sidebar Logo ──────────────────────────────────────────────────────────────
function Logo({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-5 border-b border-white/[0.06]">
      <div className="flex-shrink-0 w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shadow-glow-sm">
        <Sparkles size={15} className="text-white" />
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: 'auto' }}
            exit={{ opacity: 0, width: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="text-white font-bold text-sm tracking-tight leading-none">FinSight</p>
            <p className="text-indigo-400/60 text-2xs tracking-widest uppercase mt-0.5">AI Copilot</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Desktop Sidebar ───────────────────────────────────────────────────────────
function Sidebar({ onChat }: { onChat: () => void }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [collapsed, setCollapsed] = useState(false)

  function handleLogout() {
    api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('finsight_token')
    localStorage.removeItem('finsight_refresh_token')
    navigate('/login')
  }

  return (
    <motion.aside
      animate={{ width: collapsed ? 64 : 232 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="fixed top-0 left-0 bottom-0 z-50 flex flex-col
                 bg-[#080818]/80 backdrop-blur-xl
                 border-r border-white/[0.06]"
    >
      {/* Toggle */}
      <button
        onClick={() => setCollapsed(c => !c)}
        className="absolute -right-3 top-6 w-6 h-6 rounded-full
                   bg-[#0f0f24] border border-white/[0.12]
                   flex items-center justify-center
                   text-slate-400 hover:text-slate-200
                   transition-colors duration-150 z-10"
      >
        <ChevronRight size={12} className={cn('transition-transform', collapsed ? '' : 'rotate-180')} />
      </button>

      <Logo collapsed={collapsed} />

      {/* Nav items */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto overflow-x-hidden">
        {!collapsed && (
          <p className="label-xs px-3 py-2 mt-1 mb-1">Menu</p>
        )}
        {NAV.map(({ label, icon: Icon, path }) => {
          const active = location.pathname === path
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              title={collapsed ? label : undefined}
              className={cn('nav-link w-full', active && 'active', collapsed && 'justify-center px-2')}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{label}</span>}
            </button>
          )
        })}
      </nav>

      {/* Bottom section */}
      <div className="px-2 py-3 border-t border-white/[0.06] flex flex-col gap-0.5">
        {/* Copilot */}
        <button
          onClick={onChat}
          title={collapsed ? 'AI Copilot' : undefined}
          className={cn('nav-link w-full text-indigo-400/80 hover:text-indigo-300', collapsed && 'justify-center px-2')}
        >
          <MessageCircle size={16} className="flex-shrink-0" />
          {!collapsed && <span>AI Copilot</span>}
        </button>

        {/* User */}
        {!collapsed && (
          <div className="flex items-center gap-2.5 px-3 py-2.5 mt-1">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 flex items-center justify-center flex-shrink-0">
              <UserCircle size={16} className="text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-xs font-medium truncate">My Portfolio</p>
              <p className="text-slate-600 text-2xs">Free plan</p>
            </div>
          </div>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={collapsed ? 'Sign out' : undefined}
          className={cn('nav-link w-full hover:text-red-400', collapsed && 'justify-center px-2')}
        >
          <LogOut size={15} className="flex-shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </motion.aside>
  )
}

// ── Mobile top bar ────────────────────────────────────────────────────────────
function MobileTopBar({ onMenuOpen }: { onMenuOpen: () => void }) {
  return (
    <header className="fixed top-0 inset-x-0 z-50 h-14
                       flex items-center justify-between px-4
                       bg-[#050510]/80 backdrop-blur-xl
                       border-b border-white/[0.06]">
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-xl bg-indigo-600 flex items-center justify-center shadow-glow-sm">
          <Sparkles size={13} className="text-white" />
        </div>
        <span className="text-white font-bold text-sm tracking-tight">FinSight</span>
      </div>
      <button onClick={onMenuOpen} className="text-slate-400 hover:text-slate-200 transition-colors p-1">
        <Menu size={20} />
      </button>
    </header>
  )
}

// ── Mobile drawer ─────────────────────────────────────────────────────────────
function MobileDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  function handleLogout() {
    api.post('/auth/logout').catch(() => {})
    localStorage.removeItem('finsight_token')
    localStorage.removeItem('finsight_refresh_token')
    navigate('/login')
    onClose()
  }

  function go(path: string) { navigate(path); onClose() }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-y-0 right-0 w-72 z-50
                       bg-[#080818] border-l border-white/[0.08]
                       flex flex-col"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <span className="text-white font-bold text-sm">Navigation</span>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-200 transition-colors">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 px-3 py-4 flex flex-col gap-0.5 overflow-y-auto">
              {NAV.map(({ label, icon: Icon, path }) => {
                const active = location.pathname === path
                return (
                  <button key={path} onClick={() => go(path)}
                    className={cn('nav-link w-full', active && 'active')}>
                    <Icon size={16} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </nav>
            <div className="px-3 py-4 border-t border-white/[0.06]">
              <button onClick={handleLogout} className="nav-link w-full hover:text-red-400">
                <LogOut size={15} />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ── Mobile bottom nav ─────────────────────────────────────────────────────────
function MobileBottomNav({ onChat }: { onChat: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  return (
    <nav className="fixed bottom-0 inset-x-0 z-50
                    flex items-stretch
                    bg-[#080818]/90 backdrop-blur-xl
                    border-t border-white/[0.06]
                    pb-safe">
      {MOBILE_NAV.map(({ label, icon: Icon, path }) => {
        const active = location.pathname === path
        return (
          <button key={path} onClick={() => navigate(path)}
            className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px]
                       relative transition-colors duration-150"
          >
            {active && (
              <motion.div
                layoutId="mobile-nav-pill"
                className="absolute inset-x-2 inset-y-1.5 rounded-xl bg-indigo-500/15"
              />
            )}
            <Icon size={19} strokeWidth={active ? 2.5 : 1.8}
              className={cn('relative z-10 transition-colors', active ? 'text-indigo-400' : 'text-slate-500')} />
            <span className={cn('text-2xs font-medium relative z-10 transition-colors',
              active ? 'text-indigo-400' : 'text-slate-600')}>
              {label}
            </span>
          </button>
        )
      })}
      {/* Copilot */}
      <button onClick={onChat}
        className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 min-h-[56px]
                   transition-colors duration-150">
        <MessageCircle size={19} strokeWidth={1.8} className="text-slate-500" />
        <span className="text-2xs font-medium text-slate-600">Copilot</span>
      </button>
    </nav>
  )
}

// ── Shell inner ───────────────────────────────────────────────────────────────
function ShellInner({ children }: { children: React.ReactNode }) {
  const { isMobile } = useBreakpoint()
  const { setChatOpen } = useChatContext()
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (isMobile) {
    return (
      <div className="min-h-screen bg-[#050510]">
        <MobileTopBar onMenuOpen={() => setDrawerOpen(true)} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
        <main className="pt-14 pb-[72px] overflow-x-hidden">
          {children}
        </main>
        <MobileBottomNav onChat={() => setChatOpen(true)} />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050510] flex">
      <Sidebar onChat={() => setChatOpen(true)} />
      <main className="flex-1 min-h-screen overflow-x-hidden" style={{ marginLeft: 232 }}>
        {children}
      </main>
    </div>
  )
}

// ── Public export ─────────────────────────────────────────────────────────────
export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ChatProvider>
        <ShellInner>{children}</ShellInner>
      </ChatProvider>
    </ThemeProvider>
  )
}
