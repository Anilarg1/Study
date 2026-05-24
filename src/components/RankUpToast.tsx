import { useEffect, useState } from 'react'
import RankBadge from './RankBadge'
import type { RankInfo } from '../utils/progression'
import { playChime } from '../lib/chime'

export interface RankUpEvent {
  previous: RankInfo
  current:  RankInfo
  key:      number   // Date.now() — forces re-trigger on same rank (shouldn't happen but safe)
}

interface RankUpToastProps {
  event: RankUpEvent | null
}

export default function RankUpToast({ event }: RankUpToastProps) {
  const [visible, setVisible] = useState(false)
  const [current, setCurrent] = useState<RankUpEvent | null>(null)

  useEffect(() => {
    if (!event) return
    setCurrent(event)
    setVisible(true)

    // Play chime on full tier rank-up only
    if (event.current.tierIndex > event.previous.tierIndex) {
      playChime('work')
    }

    const t = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(t)
  }, [event?.key])

  if (!current) return null

  const isTierUp    = current.current.tierIndex > current.previous.tierIndex
  const toastHeight = isTierUp ? 64 : 48

  return (
    <div
      style={{
        position:   'fixed',
        bottom:     24,
        right:      24,
        zIndex:     9999,
        display:    'flex',
        alignItems: 'center',
        gap:        12,
        background: 'var(--surface-2)',
        border:     `1px solid ${current.current.color}44`,
        borderRadius: 10,
        padding:    isTierUp ? '12px 16px' : '8px 14px',
        height:     toastHeight,
        boxShadow:  `0 4px 24px ${current.current.color}22`,
        opacity:    visible ? 1 : 0,
        transform:  visible ? 'translateY(0)' : 'translateY(8px)',
        transition: 'opacity 300ms ease, transform 300ms ease',
        pointerEvents: 'none',
      }}
    >
      <div style={{
        transform:  visible ? 'scale(1)' : 'scale(0.8)',
        transition: 'transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
      }}>
        <RankBadge
          tierIndex={current.current.tierIndex}
          size={isTierUp ? 40 : 28}
          subLevel={current.current.subLevel}
          showPips={true}
        />
      </div>
      <div>
        <div style={{ fontSize: isTierUp ? 13 : 11, color: 'var(--text-mute)', marginBottom: 2 }}>
          {isTierUp ? 'New rank unlocked' : 'Rank up'}
        </div>
        <div style={{
          fontSize:   isTierUp ? 15 : 13,
          fontWeight: 600,
          color:      current.current.color,
        }}>
          {current.current.label}
        </div>
      </div>
    </div>
  )
}
