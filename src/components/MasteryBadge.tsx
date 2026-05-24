/**
 * MasteryBadge — diamond-shaped flame badge for the 5 Flame mastery tiers.
 * Props:
 *   masteryIndex  0–4 (Ember / Kindled / Burning / Blazing / Inferno)
 *   size          pixel size (default 20)
 */

interface MasteryBadgeProps {
  masteryIndex: number
  size?:        number
}

export const MASTERY_NAMES = ['Ember', 'Kindled', 'Burning', 'Blazing', 'Inferno'] as const

// SVG flame path reused across tiers (viewBox 0 0 60 60, diamond outer shape)
function FlameShape({ fillColor, strokeColor, glowId, innerColor }: {
  fillColor:   string
  strokeColor: string
  glowId?:     string
  innerColor?: string
}) {
  return (
    <>
      <polygon
        points="30,4 56,30 30,56 4,30"
        fill="#0d1117"
        stroke={strokeColor}
        strokeWidth="1.5"
        filter={glowId ? `url(#${glowId})` : undefined}
      />
      <path
        d={`M 30,18 Q ${30+6},${24} ${30+4},${31} Q ${30+8},${26} ${30+5},${34} Q ${30+2},${40} 30,42
            Q ${30-2},${40} ${30-5},${34} Q ${30-8},${26} ${30-4},${31} Q ${30-6},${24} 30,18 Z`}
        fill={fillColor}
        fillOpacity="0.9"
      />
      {innerColor && (
        <path
          d={`M 30,23 Q ${30+3},${27} ${30+2},${31} Q ${30+3},${29} ${30+2},${33}
              Q ${30+1},${37} 30,38 Q ${30-1},${37} ${30-2},${33} Q ${30-3},${29} ${30-2},${31}
              Q ${30-3},${27} 30,23 Z`}
          fill={innerColor}
          fillOpacity="0.8"
        />
      )}
    </>
  )
}

const BADGE_CONFIGS = [
  // Ember — grey, minimal
  { strokeColor: '#57534e', fillColor: '#78716c', glowId: undefined, innerColor: undefined },
  // Kindled — orange
  { strokeColor: '#c2410c', fillColor: '#fdba74', glowId: 'kf',      innerColor: undefined },
  // Burning — gold with white inner
  { strokeColor: '#f59e0b', fillColor: '#fde68a', glowId: 'bf',      innerColor: '#ffffff' },
  // Blazing — bright gold, heptagon
  { strokeColor: '#d97706', fillColor: 'url(#blg)', glowId: 'blf',   innerColor: '#ffffff' },
  // Inferno — radiant, 12-pt burst
  { strokeColor: '#f59e0b', fillColor: 'url(#inf)', glowId: 'inf-f', innerColor: '#ffffff' },
]

export default function MasteryBadge({ masteryIndex, size = 20 }: MasteryBadgeProps) {
  const idx    = Math.max(0, Math.min(4, masteryIndex))
  const config = BADGE_CONFIGS[idx]

  return (
    <svg viewBox="0 0 60 60" width={size} height={size} style={{ overflow: 'visible', flexShrink: 0 }}>
      <defs>
        <filter id="kf"><feGaussianBlur stdDeviation="1.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="bf"><feGaussianBlur stdDeviation="2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="blf"><feGaussianBlur stdDeviation="2.5" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="inf-f"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <linearGradient id="blg" x1="20%" y1="5%" x2="80%" y2="95%"><stop offset="0%" stopColor="#ffffff"/><stop offset="40%" stopColor="#fde68a"/><stop offset="100%" stopColor="#b45309"/></linearGradient>
        <radialGradient id="inf" cx="50%" cy="30%" r="55%"><stop offset="0%" stopColor="#ffffff"/><stop offset="35%" stopColor="#fef08a"/><stop offset="100%" stopColor="#92400e"/></radialGradient>
      </defs>
      {idx === 4 ? (
        // Inferno: 12-pointed burst outer shape
        <>
          <polygon
            points="30,2 32,12 38,6 36,16 44,12 40,21 50,20 44,27 54,30 44,33 50,40 40,39 44,48 36,44 38,54 32,48 30,58 28,48 22,54 24,44 16,48 20,39 10,40 16,33 6,30 16,27 10,20 20,21 16,12 24,16 22,6 28,12"
            fill="url(#inf)"
            filter="url(#inf-f)"
          />
          <polygon points="30,10 50,30 30,50 10,30" fill="#0d1117" stroke="#fef08a" strokeWidth="1.2" filter="url(#inf-f)"/>
          <path d="M 30,18 Q 36,24 34,31 Q 39,26 36,33 Q 33,40 30,43 Q 27,40 24,33 Q 21,26 26,31 Q 24,24 30,18 Z" fill="url(#inf)"/>
          <path d="M 30,23 Q 33,27 32,31 Q 34,29 33,33 Q 31,37 30,38 Q 29,37 27,33 Q 26,29 28,31 Q 27,27 30,23 Z" fill="#ffffff" fillOpacity="0.95"/>
        </>
      ) : idx === 3 ? (
        // Blazing: heptagon
        <>
          <polygon points="30,4 50,14 57,35 47,54 13,54 3,35 10,14" fill="#0d1117" stroke="#d97706" strokeWidth="1.5" filter="url(#blf)"/>
          <path d="M 30,14 Q 37,21 35,29 Q 41,24 37,33 Q 33,40 30,44 Q 27,40 23,33 Q 19,24 25,29 Q 23,21 30,14 Z" fill="url(#blg)" filter="url(#blf)"/>
          <path d="M 30,22 Q 33,26 32,30 Q 35,28 33,33 Q 31,37 30,38 Q 29,37 27,33 Q 25,28 28,30 Q 27,26 30,22 Z" fill="#ffffff" fillOpacity="0.8"/>
        </>
      ) : (
        <FlameShape {...config} />
      )}
    </svg>
  )
}
