import { useState } from 'react'
import clsx from 'clsx'
import useAuthStore from '../store/useAuthStore'

// ─── nav items ────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  {
    id: 'timer',
    label: 'Timer',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
      </svg>
    ),
  },
  {
    id: 'streak',
    label: 'Streak',
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
      </svg>
    ),
  },
  {
    id: 'stats',
    label: 'Stats',
    disabled: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/>
        <line x1="12" y1="20" x2="12" y2="4"/>
        <line x1="6"  y1="20" x2="6"  y2="14"/>
      </svg>
    ),
  },
  {
    id: 'timetable',
    label: 'Timetable',
    disabled: true,
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
        <line x1="16" y1="2" x2="16" y2="6"/>
        <line x1="8"  y1="2" x2="8"  y2="6"/>
        <line x1="3"  y1="10" x2="21" y2="10"/>
      </svg>
    ),
  },
]

// ─── icon: hamburger menu ─────────────────────────────────────────────────────

function MenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}

// ─── icon: sign out ───────────────────────────────────────────────────────────

function SignOutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
      <polyline points="16 17 21 12 16 7"/>
      <line x1="21" y1="12" x2="9" y2="12"/>
    </svg>
  )
}

// ─── component ────────────────────────────────────────────────────────────────

export default function Sidebar({ activePage, setActivePage }) {
  const [collapsed, setCollapsed] = useState(false)
  const { user, signOut } = useAuthStore()

  return (
    <aside
      className={clsx(
        'h-full flex flex-col border-r border-border bg-surface shrink-0',
        'transition-[width] duration-200 ease-in-out overflow-hidden',
        collapsed ? 'w-[52px]' : 'w-[200px]'
      )}
    >
      {/* ── top bar: logo + collapse toggle ───────────────────────────── */}
      <div className={clsx(
        'flex items-center h-11 px-3 border-b border-border shrink-0',
        collapsed ? 'justify-center' : 'justify-between'
      )}>
        {!collapsed && (
          <span className="text-[10px] font-semibold tracking-[0.28em] text-dim uppercase select-none whitespace-nowrap">
            Notebook
          </span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="p-1.5 rounded text-dim hover:text-soft hover:bg-card transition-colors shrink-0"
        >
          <MenuIcon />
        </button>
      </div>

      {/* ── nav items ─────────────────────────────────────────────────── */}
      <nav className="flex-1 py-2 px-1.5 flex flex-col gap-px overflow-y-auto">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            onClick={() => !item.disabled && setActivePage(item.id)}
            disabled={item.disabled}
            title={collapsed ? item.label : undefined}
            className={clsx(
              'flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left w-full',
              'transition-colors duration-100 whitespace-nowrap',
              item.disabled
                ? 'opacity-30 cursor-not-allowed text-dim'
                : activePage === item.id
                ? 'bg-accent/12 text-accent'
                : 'text-dim hover:text-soft hover:bg-card'
            )}
          >
            <span className="shrink-0 flex items-center">{item.icon}</span>

            {!collapsed && (
              <>
                <span className="text-[12px] tracking-wide flex-1">{item.label}</span>
                {item.disabled && (
                  <span className="text-[9px] tracking-widest text-muted uppercase">soon</span>
                )}
              </>
            )}
          </button>
        ))}
      </nav>

      {/* ── bottom: user + sign out ───────────────────────────────────── */}
      <div className="border-t border-border py-2 px-1.5 flex flex-col gap-px shrink-0">

        {/* email row — only when expanded */}
        {!collapsed && user?.email && (
          <div
            className="px-2 py-1.5 text-[11px] text-muted truncate leading-none"
            title={user.email}
          >
            {user.email}
          </div>
        )}

        {/* sign out */}
        <button
          onClick={signOut}
          title={collapsed ? 'Sign out' : undefined}
          className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-dim hover:text-soft hover:bg-card transition-colors w-full whitespace-nowrap"
        >
          <span className="shrink-0 flex items-center"><SignOutIcon /></span>
          {!collapsed && <span className="text-[12px] tracking-wide">Sign out</span>}
        </button>

      </div>
    </aside>
  )
}
