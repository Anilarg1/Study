import { useLocation, useNavigate } from 'react-router-dom'
import { IcTimer, IcStats, IcNotes } from './icons'

// ── types ─────────────────────────────────────────────────────────────────

interface BottomTabBarProps {
  onNewSession: () => void
  onMoreOpen:   () => void
}

// ── tab button ────────────────────────────────────────────────────────────

function TabBtn({
  icon, label, active, onClick,
}: {
  icon:    React.ReactNode
  label:   string
  active:  boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={`btb-btn${active ? ' active' : ''}`}
      onClick={onClick}
    >
      {icon}
      <span className="btb-label">{label}</span>
    </button>
  )
}

// ── component ─────────────────────────────────────────────────────────────

export default function BottomTabBar({ onNewSession, onMoreOpen }: BottomTabBarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const path     = location.pathname

  return (
    <nav className="bottom-tab-bar">

      <TabBtn
        icon={<IcTimer size={20} className="" />}
        label="Timer"
        active={path === '/'}
        onClick={() => navigate('/')}
      />

      <TabBtn
        icon={<IcStats size={20} className="" />}
        label="Stats"
        active={path === '/stats'}
        onClick={() => navigate('/stats')}
      />

      {/* ── FAB ── */}
      <button
        type="button"
        className="btb-fab"
        onClick={onNewSession}
        aria-label="New session"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14"/>
        </svg>
      </button>

      <TabBtn
        icon={<IcNotes size={20} className="" />}
        label="Notes"
        active={path === '/notes'}
        onClick={() => navigate('/notes')}
      />

      {/* ── More (opens sidebar drawer) ── */}
      <button
        type="button"
        className={`btb-btn${['/settings', '/flashcards', '/timetable', '/past-papers'].includes(path) ? ' active' : ''}`}
        onClick={onMoreOpen}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
          <path d="M3 6h18M3 12h18M3 18h12"/>
        </svg>
        <span className="btb-label">More</span>
      </button>

    </nav>
  )
}
