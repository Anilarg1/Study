/**
 * RankBadge — angular metallic SVG badge for each of the 10 Scholar rank tiers.
 * Props:
 *   tierIndex  0–9 (which named tier: Wanderer → Luminary)
 *   size       pixel size for width/height (default 40)
 *   subLevel   1|2|3 — controls pip dots shown below badge
 *   showPips   show sub-level pip dots (default true)
 */

interface RankBadgeProps {
  tierIndex: number
  size?:     number
  subLevel?: 1 | 2 | 3
  showPips?: boolean
}

function WandererBadge()  { return (
  <g>
    <polygon points="50,6 94,50 50,94 6,50" fill="#0d1117" stroke="#475569" strokeWidth="1.5"/>
    <polygon points="50,18 82,50 50,82 18,50" fill="#475569" fillOpacity="0.1"/>
    <line x1="50" y1="18" x2="50" y2="82" stroke="#475569" strokeWidth="1" strokeOpacity="0.5"/>
    <line x1="18" y1="50" x2="82" y2="50" stroke="#475569" strokeWidth="1" strokeOpacity="0.5"/>
    <polygon points="50,42 58,50 50,58 42,50" fill="#64748b"/>
    <polygon points="50,46 54,50 50,54 46,50" fill="#94a3b8"/>
  </g>
)}

function SeekerBadge() {
  return (
    <g>
      <defs>
        <filter id="sf-s"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>
      <polygon points="50,5 78,18 95,50 78,82 50,95 22,82 5,50 22,18" fill="#0d1117" stroke="#0369a1" strokeWidth="1.5" filter="url(#sf-s)"/>
      <polygon points="50,15 70,24 82,50 70,76 50,85 30,76 18,50 30,24" fill="#38bdf8" fillOpacity="0.08"/>
      <line x1="22" y1="18" x2="78" y2="82" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.3"/>
      <line x1="78" y1="18" x2="22" y2="82" stroke="#38bdf8" strokeWidth="0.8" strokeOpacity="0.3"/>
      <polyline points="36,56 50,36 64,56" fill="none" stroke="#7dd3fc" strokeWidth="2.5" strokeLinejoin="miter" filter="url(#sf-s)"/>
      <polyline points="36,65 50,45 64,65" fill="none" stroke="#38bdf8" strokeWidth="1.5" strokeLinejoin="miter" strokeOpacity="0.5"/>
    </g>
  )
}

function InitiateBadge() {
  return (
    <g>
      <defs>
        <filter id="if-i"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="ig-i" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#a5b4fc"/><stop offset="100%" stopColor="#3730a3"/></linearGradient>
      </defs>
      <polygon points="10,10 90,10 90,58 50,92 10,58" fill="#0d1117" stroke="#4f46e5" strokeWidth="1.5" filter="url(#if-i)"/>
      <polygon points="18,18 82,18 82,55 50,82 18,55" fill="url(#ig-i)" fillOpacity="0.1"/>
      <line x1="10" y1="22" x2="90" y2="22" stroke="#818cf8" strokeWidth="1" strokeOpacity="0.4"/>
      <polyline points="18,18 28,18 28,26" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.6"/>
      <polyline points="82,18 72,18 72,26" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeOpacity="0.6"/>
      <polygon points="50,32 66,62 34,62" fill="none" stroke="#a5b4fc" strokeWidth="2" filter="url(#if-i)"/>
      <line x1="50" y1="32" x2="50" y2="62" stroke="#818cf8" strokeWidth="1" strokeOpacity="0.5"/>
    </g>
  )
}

function ApprenticeBadge() {
  return (
    <g>
      <defs>
        <filter id="apf"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="apg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#c4b5fd"/><stop offset="100%" stopColor="#5b21b6"/></linearGradient>
      </defs>
      <polygon points="22,8 42,8 50,16 58,8 78,8 88,18 88,60 50,92 12,60 12,18" fill="#0d1117" stroke="#7c3aed" strokeWidth="1.5" filter="url(#apf)"/>
      <polygon points="26,16 44,16 50,22 56,16 74,16 80,24 80,58 50,82 20,58 20,24" fill="url(#apg)" fillOpacity="0.1"/>
      <line x1="12" y1="30" x2="88" y2="30" stroke="#a78bfa" strokeWidth="0.8" strokeOpacity="0.3"/>
      <line x1="50" y1="16" x2="50" y2="82" stroke="#a78bfa" strokeWidth="0.8" strokeOpacity="0.3"/>
      <polygon points="50,36 64,50 50,64 36,50" fill="none" stroke="#c4b5fd" strokeWidth="2" filter="url(#apf)"/>
      <polygon points="50,42 58,50 50,58 42,50" fill="#a78bfa" fillOpacity="0.7"/>
    </g>
  )
}

function ScholarBadge() {
  return (
    <g>
      <defs>
        <filter id="scf"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="scg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#e9d5ff"/><stop offset="100%" stopColor="#6b21a8"/></linearGradient>
      </defs>
      <polygon points="50,5 90,16 90,58 50,95 10,58 10,16" fill="#0d1117" stroke="#9333ea" strokeWidth="1.5" filter="url(#scf)"/>
      <polygon points="50,13 82,22 82,56 50,86 18,56 18,22" fill="url(#scg)" fillOpacity="0.1"/>
      <line x1="10" y1="30" x2="90" y2="30" stroke="#c084fc" strokeWidth="0.8" strokeOpacity="0.35"/>
      <line x1="10" y1="44" x2="90" y2="44" stroke="#c084fc" strokeWidth="0.8" strokeOpacity="0.2"/>
      <polygon points="50,24 55,36 68,36 58,44 62,57 50,50 38,57 42,44 32,36 45,36" fill="none" stroke="#e9d5ff" strokeWidth="1.8" filter="url(#scf)"/>
      <polygon points="50,31 53,39 61,39 55,43 57,51 50,47 43,51 45,43 39,39 47,39" fill="#c084fc" fillOpacity="0.6"/>
    </g>
  )
}

function AdeptBadge() {
  return (
    <g>
      <defs>
        <filter id="adf"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="adg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#f0abfc"/><stop offset="100%" stopColor="#86198f"/></linearGradient>
      </defs>
      <polygon points="50,5 82,22 92,50 82,78 50,95 18,78 8,50 18,22" fill="#0d1117" stroke="#d946ef" strokeWidth="1.5" filter="url(#adf)"/>
      <polygon points="50,14 74,27 82,50 74,73 50,86 26,73 18,50 26,27" fill="url(#adg)" fillOpacity="0.1"/>
      <line x1="18" y1="22" x2="82" y2="78" stroke="#e879f9" strokeWidth="0.8" strokeOpacity="0.25"/>
      <line x1="82" y1="22" x2="18" y2="78" stroke="#e879f9" strokeWidth="0.8" strokeOpacity="0.25"/>
      <line x1="8" y1="50" x2="92" y2="50" stroke="#e879f9" strokeWidth="0.8" strokeOpacity="0.25"/>
      <polygon points="50,26 62,44 50,56 38,44" fill="none" stroke="#f0abfc" strokeWidth="2" filter="url(#adf)"/>
      <polygon points="50,44 58,50 50,70 42,50" fill="none" stroke="#f0abfc" strokeWidth="2" filter="url(#adf)"/>
      <polygon points="50,38 56,46 50,52 44,46" fill="#e879f9" fillOpacity="0.8"/>
    </g>
  )
}

function SavantBadge() {
  return (
    <g>
      <defs>
        <filter id="svf"><feGaussianBlur stdDeviation="3.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="svg2" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#fbcfe8"/><stop offset="100%" stopColor="#9d174d"/></linearGradient>
      </defs>
      <polygon points="50,6 86,18 92,55 76,88 50,95 24,88 8,55 14,18" fill="#0d1117" stroke="#ec4899" strokeWidth="1.5" filter="url(#svf)"/>
      <polygon points="8,55 2,42 14,38 14,55" fill="#0d1117" stroke="#ec4899" strokeWidth="1" strokeOpacity="0.7"/>
      <polygon points="92,55 98,42 86,38 86,55" fill="#0d1117" stroke="#ec4899" strokeWidth="1" strokeOpacity="0.7"/>
      <polygon points="50,25 54,36 65,33 58,43 68,48 57,52 60,64 50,58 40,64 43,52 32,48 42,43 35,33 46,36" fill="none" stroke="#fbcfe8" strokeWidth="1.8" filter="url(#svf)"/>
      <polygon points="50,32 53,39 60,37 55,43 59,49 52,47 50,54 48,47 41,49 45,43 40,37 47,39" fill="#f472b6" fillOpacity="0.7"/>
    </g>
  )
}

function SageBadge() {
  return (
    <g>
      <defs>
        <filter id="sgf"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="sgg" x1="15%" y1="5%" x2="85%" y2="95%"><stop offset="0%" stopColor="#fed7aa"/><stop offset="100%" stopColor="#c2410c"/></linearGradient>
      </defs>
      <polygon points="50,4 57,38 92,26 64,50 92,74 57,62 50,96 43,62 8,74 36,50 8,26 43,38" fill="#0d1117" stroke="#f97316" strokeWidth="1.5" filter="url(#sgf)"/>
      <polygon points="50,16 55,40 76,33 60,50 76,67 55,60 50,84 45,60 24,67 40,50 24,33 45,40" fill="url(#sgg)" fillOpacity="0.1"/>
      <circle cx="50" cy="50" r="18" fill="none" stroke="#fb923c" strokeWidth="1.2" strokeOpacity="0.5"/>
      <polygon points="50,36 60,50 50,64 40,50" fill="none" stroke="#fed7aa" strokeWidth="2" filter="url(#sgf)"/>
      <polygon points="50,41 55,50 50,59 45,50" fill="#fb923c" fillOpacity="0.9"/>
    </g>
  )
}

function MasterBadge() {
  return (
    <g>
      <defs>
        <filter id="mf"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="mg" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0%" stopColor="#fde68a"/><stop offset="50%" stopColor="#f59e0b"/><stop offset="100%" stopColor="#78350f"/></linearGradient>
      </defs>
      <polygon points="18,42 18,14 30,28 38,10 50,26 62,10 70,28 82,14 82,42 88,55 50,92 12,55" fill="#0d1117" stroke="#d97706" strokeWidth="1.5" filter="url(#mf)"/>
      <polygon points="24,42 24,22 32,33 40,18 50,30 60,18 68,33 76,22 76,42 80,52 50,82 20,52" fill="url(#mg)" fillOpacity="0.1"/>
      <line x1="18" y1="42" x2="82" y2="42" stroke="#fbbf24" strokeWidth="1.2" strokeOpacity="0.5"/>
      <polygon points="38,10 41,18 35,18" fill="#fde68a" fillOpacity="0.8"/>
      <polygon points="50,6 53,16 47,16" fill="#fef3c7" fillOpacity="0.9"/>
      <polygon points="62,10 65,18 59,18" fill="#fde68a" fillOpacity="0.8"/>
      <polygon points="50,48 56,60 50,70 44,60" fill="none" stroke="#fde68a" strokeWidth="2" filter="url(#mf)"/>
      <polygon points="50,52 54,59 50,65 46,59" fill="#f59e0b" fillOpacity="0.9"/>
    </g>
  )
}

function LuminaryBadge() {
  return (
    <g>
      <defs>
        <filter id="lf"><feGaussianBlur stdDeviation="5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="lfs"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <radialGradient id="lg" cx="50%" cy="35%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="30%" stopColor="#fef08a"/><stop offset="100%" stopColor="#78350f"/></radialGradient>
      </defs>
      <polygon points="50,2 52,20 60,6 56,22 68,12 58,25 74,18 60,28 78,26 62,32 80,36 62,38 80,46 61,44 76,56 58,50 70,64 54,54 62,72 50,58 58,76 50,64 38,76 42,64 30,72 38,54 22,64 34,50 16,56 28,44 10,46 28,38 10,36 28,32 22,26 38,28 26,18 40,25 32,12 42,22 44,6 48,20" fill="url(#lg)" filter="url(#lf)" fillOpacity="0.9"/>
      <polygon points="50,8 88,50 50,92 12,50" fill="#0d1117" stroke="#fef08a" strokeWidth="1.5" filter="url(#lfs)"/>
      <polygon points="50,18 80,50 50,82 20,50" fill="url(#lg)" fillOpacity="0.08"/>
      <polygon points="50,28 72,50 50,72 28,50" fill="none" stroke="#fef08a" strokeWidth="0.8" strokeOpacity="0.4"/>
      <line x1="12" y1="50" x2="88" y2="50" stroke="#fef08a" strokeWidth="0.8" strokeOpacity="0.3"/>
      <line x1="50" y1="8" x2="50" y2="92" stroke="#fef08a" strokeWidth="0.8" strokeOpacity="0.3"/>
      <polygon points="50,36 53,45 62,45 55,51 58,60 50,55 42,60 45,51 38,45 47,45" fill="none" stroke="#ffffff" strokeWidth="1.5" filter="url(#lfs)"/>
      <polygon points="50,39 52,46 59,46 53,50 55,57 50,53 45,57 47,50 41,46 48,46" fill="#fef9c3" fillOpacity="0.95"/>
    </g>
  )
}

const BADGE_COMPONENTS = [
  WandererBadge, SeekerBadge, InitiateBadge, ApprenticeBadge, ScholarBadge,
  AdeptBadge,    SavantBadge, SageBadge,     MasterBadge,     LuminaryBadge,
]

export default function RankBadge({ tierIndex, size = 40, subLevel = 1, showPips = true }: RankBadgeProps) {
  const clamped      = Math.max(0, Math.min(9, tierIndex))
  const BadgeContent = BADGE_COMPONENTS[clamped]

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
      <svg viewBox="0 0 100 100" width={size} height={size} style={{ overflow: 'visible' }}>
        <BadgeContent />
      </svg>
      {showPips && (
        <div style={{ display: 'flex', gap: 3 }}>
          {[1, 2, 3].map(pip => (
            <div
              key={pip}
              style={{
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: pip <= subLevel ? 'var(--text)' : 'var(--surface-3)',
              }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
