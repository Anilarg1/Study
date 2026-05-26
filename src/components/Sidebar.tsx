import { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import type { User } from '@supabase/supabase-js'
import useSubjectStore from '../store/useSubjectStore'
import useStreakStore, { calcCurrentStreak } from '../store/useStreakStore'
import useXPStore from '../store/useXPStore'
import useSubjectMasteryStore from '../store/useSubjectMasteryStore'
import { SUBJECT_COLORS } from '../lib/subjects'
import GoalsPanel from './GoalsPanel'
import RankBadge from './RankBadge'
import MasteryBadge from './MasteryBadge'
import StreakDots from './StreakDots'
import { getRankFromXP, getRankProgress, getXPToNextRank, getMasteryFromXP } from '../utils/progression'
import {
  IcTimer, IcStreak, IcToday, IcStats, IcTimetable, IcNotes,
  IcFlash, IcPlus, IcSignOut, IcChevron, IcGear as IcSettings,
} from './icons'

// ── component ─────────────────────────────────────────────────────────────

interface SidebarProps {
  user:          User
  initials:      string
  email:         string
  displayName:   string
  onSignOut:     () => void
  collapsed:     boolean
  onToggle:      () => void
  mobileOpen?:   boolean
  onMobileClose?: () => void
}

export default function Sidebar({
  user: _user, initials, email, displayName, onSignOut,
  collapsed, onToggle,
  mobileOpen = false, onMobileClose,
}: SidebarProps) {
  const navigate = useNavigate()
  const location = useLocation()

  function go(path: string) {
    navigate(path)
    onMobileClose?.()
  }

  const subjects      = useSubjectStore(s => s.subjects)
  const addSubject    = useSubjectStore(s => s.addSubject)
  const loginDates    = useStreakStore(s => s.loginDates)
  const currentStreak = useMemo(
    () => calcCurrentStreak(new Set(loginDates)),
    [loginDates],
  )

  const totalXP   = useXPStore(s => s.totalXP)
  const subjectXP = useSubjectMasteryStore(s => s.subjectXP)
  const rank      = getRankFromXP(totalXP)
  const rankPct   = Math.round(getRankProgress(totalXP) * 100)
  const xpToNext  = getXPToNextRank(totalXP)

  const [showAddPanel, setShowAddPanel] = useState(false)
  const [newName,      setNewName]      = useState('')
  const [newColor,     setNewColor]     = useState(SUBJECT_COLORS[0] ?? '#7c6af0')
  const [addError,     setAddError]     = useState<string | null>(null)
  const [submitting,   setSubmitting]   = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)

  // Auto-focus the name input whenever the panel opens
  useEffect(() => {
    if (showAddPanel) nameRef.current?.focus()
  }, [showAddPanel])

  useEffect(() => {
    if (collapsed) {
      setShowAddPanel(false)
      setNewName('')
      setNewColor(SUBJECT_COLORS[0] ?? '#7c6af0')
      setAddError(null)
      setSubmitting(false)
    }
  }, [collapsed])

  function toggleAddPanel() {
    setShowAddPanel(p => {
      if (p) {          // closing — reset form
        setNewName('')
        setNewColor(SUBJECT_COLORS[0] ?? '#7c6af0')
        setAddError(null)
      }
      return !p
    })
  }

  async function handleAddSubject() {
    if (!newName.trim() || submitting) return
    setSubmitting(true)
    setAddError(null)
    const subject = await addSubject(newName.trim(), newColor)
    setSubmitting(false)
    if (subject) {
      setShowAddPanel(false)
      setNewName('')
      setNewColor(SUBJECT_COLORS[0] ?? '#7c6af0')
    } else {
      setAddError('Could not save — check your connection.')
    }
  }

  async function handleAddKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter')  await handleAddSubject()
    if (e.key === 'Escape') toggleAddPanel()
  }

  return (
    <>
      {mobileOpen && (
        <div
          className="mobile-drawer-backdrop"
          onClick={onMobileClose}
          aria-hidden="true"
        />
      )}
      <nav className={`v2-nav${mobileOpen ? ' mobile-open' : ''}`}>

      {/* ── Collapse toggle ── */}
      <div className="nav-toggle">
        <button
          className="nav-toggle-btn"
          onClick={onToggle}
          title={collapsed ? 'Expand sidebar  [' : 'Collapse sidebar  ['}
        >
          <IcChevron right={collapsed} />
        </button>
      </div>

      {/* ── Practice section ── */}
      {!collapsed && (
        <div className="nav-section-hd">
          <span className="nav-section-label">Practice</span>
        </div>
      )}

      <button
        className={`nav-item${location.pathname === '/' ? ' active' : ''}`}
        title="Timer"
        onClick={() => go('/')}
      >
        <IcTimer />
        <span className="nav-label">Timer</span>
        <span className="ni-shortcut">G T</span>
      </button>
      <button className="nav-item" title={`Streak${currentStreak > 0 ? ` — ${currentStreak} days` : ''}`}>
        <IcStreak />
        <span className="nav-label">Streak</span>
        <span className="ni-count">{currentStreak > 0 ? currentStreak : '—'}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '2px 10px 10px' }}>
          <StreakDots />
        </div>
      )}
      <button className="nav-item" title="Today">
        <IcToday />
        <span className="nav-label">Today</span>
        <span className="ni-shortcut">G D</span>
      </button>
      <button
        className={`nav-item${location.pathname === '/stats' ? ' active' : ''}`}
        title="Stats"
        onClick={() => go('/stats')}
      >
        <IcStats />
        <span className="nav-label">Stats</span>
        <span className="ni-shortcut">G S</span>
      </button>
      <button className="nav-item muted" title="Timetable — coming soon">
        <IcTimetable />
        <span className="nav-label">Timetable</span>
        <span className="ni-count">SOON</span>
      </button>

      {/* ── Library section ── */}
      {!collapsed && (
        <div className="nav-section-hd">
          <span className="nav-section-label">Library</span>
          <button className="nav-section-ic" title="New note"><IcPlus /></button>
        </div>
      )}

      <button className="nav-item" title="Notes">
        <IcNotes />
        <span className="nav-label">Notes</span>
        <span className="ni-count">—</span>
      </button>
      <button className="nav-item" title="Flashcards">
        <IcFlash />
        <span className="nav-label">Flashcards</span>
        <span className="ni-count">—</span>
      </button>

      {/* ── Subjects section ── */}
      {!collapsed && (
        <div className="nav-section-hd">
          <span className="nav-section-label">Subjects</span>
          <button
            className="nav-section-ic"
            title={showAddPanel ? 'Cancel' : 'New subject'}
            onClick={toggleAddPanel}
          >
            <IcPlus />
          </button>
        </div>
      )}

      {showAddPanel && !collapsed && (
        <div style={{ padding: '6px 8px 8px', borderBottom: '1px solid var(--hairline)' }}>
          <input
            ref={nameRef}
            type="text"
            value={newName}
            onChange={e => { setNewName(e.target.value); setAddError(null) }}
            onKeyDown={handleAddKeyDown}
            placeholder="Subject name"
            maxLength={40}
            style={{
              width: '100%',
              background: 'var(--surface-3)',
              border: '1px solid var(--hairline-2)',
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 12,
              color: 'var(--text)',
              outline: 'none',
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
          <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
            {SUBJECT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: c,
                  border: newColor === c ? '2px solid var(--text)' : '2px solid transparent',
                  outline: newColor === c ? '2px solid var(--surface-3)' : 'none',
                  outlineOffset: 1,
                  padding: 0,
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              />
            ))}
          </div>
          {addError && (
            <span style={{ display: 'block', marginTop: 4, fontSize: 11, color: '#f87171' }}>
              {addError}
            </span>
          )}
        </div>
      )}

      {!collapsed && subjects.length === 0 && (
        <span style={{ fontSize: '11.5px', color: 'var(--text-faint)', padding: '4px 8px', display: 'block' }}>
          No subjects yet
        </span>
      )}

      {subjects.map(s => {
        const sXP     = subjectXP[s.id] ?? 0
        const mastery = sXP > 0 ? getMasteryFromXP(sXP) : null
        return (
          <button key={s.id} className="nav-item" title={s.name}>
            <span className="subj-dot" style={{ background: s.color }} />
            <span className="nav-label">{s.name}</span>
            {!collapsed && mastery && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto' }}>
                <MasteryBadge masteryIndex={mastery.index} size={14} />
                <span style={{ fontSize: 9, color: mastery.color, fontWeight: 600, letterSpacing: '0.5px' }}>
                  {mastery.name.toUpperCase()}
                </span>
              </span>
            )}
          </button>
        )
      })}

      {!collapsed && <GoalsPanel />}

      <div className="nav-spacer" />

      {/* ── Settings ── */}
      <button
        className={`nav-item${location.pathname === '/settings' ? ' active' : ''}`}
        onClick={() => go('/settings')}
        title="Settings"
      >
        <IcSettings />
        <span className="nav-label">Settings</span>
      </button>

      {/* ── Rank widget ── */}
      {!collapsed && (
        <div style={{
          padding: '8px 10px 10px',
          borderTop: '1px solid var(--hairline)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <RankBadge tierIndex={rank.tierIndex} size={32} subLevel={rank.subLevel} showPips={false} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: rank.color, lineHeight: 1.2 }}>
                {rank.label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-faint)', marginTop: 1 }}>
                {xpToNext > 0 ? `${xpToNext.toLocaleString()} XP to next rank` : 'Max rank'}
              </div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ marginTop: 6, height: 2, background: 'var(--surface-3)', borderRadius: 1 }}>
            <div style={{
              height: '100%',
              width: `${rankPct}%`,
              background: rank.color,
              borderRadius: 1,
              transition: 'width 600ms ease',
            }} />
          </div>
        </div>
      )}

      {/* ── User row ── */}
      <div className="nav-user">
        <div className="avatar">{initials}</div>
        <div className="nav-user-info">
          <span style={{ fontSize: '12.5px', color: 'var(--text)', fontWeight: 500 }}>
            {displayName}
          </span>
          <span style={{ fontSize: '10.5px', color: 'var(--text-mute)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {email}
          </span>
        </div>
        <button className="nav-signout" onClick={() => { onSignOut(); onMobileClose?.() }} title="Sign out">
          <IcSignOut />
        </button>
      </div>

      </nav>
    </>
  )
}
