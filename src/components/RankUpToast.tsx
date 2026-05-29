import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import RankBadge from './RankBadge'
import type { RankInfo } from '../utils/progression'
import { playChime } from '../lib/chime'

export interface RankUpEvent {
  previous: RankInfo
  current:  RankInfo
  key:      number
}

interface RankUpToastProps {
  event: RankUpEvent | null
}

// ── Full-screen modal (tier promotion only) ────────────────────────────────

function RankUpModal({ event, onClose }: { event: RankUpEvent; onClose: () => void }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    // Defer animation so the initial paint shows the pre-animation state
    const t = setTimeout(() => setReady(true), 30)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position:   'fixed',
        inset:      0,
        zIndex:     10000,
        display:    'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(4px)',
        opacity:    ready ? 1 : 0,
        transition: 'opacity 250ms ease',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width:          420,
          maxWidth:       'calc(100vw - 32px)',
          background:     'var(--surface-2)',
          border:         `1px solid ${event.current.color}55`,
          borderRadius:   20,
          padding:        '40px 32px 32px',
          textAlign:      'center',
          boxShadow:      `0 20px 60px ${event.current.color}22, 0 4px 24px rgba(0,0,0,0.4)`,
          transform:      ready ? 'scale(1)' : 'scale(0.88)',
          transition:     'transform 400ms cubic-bezier(0.34,1.56,0.64,1)',
        }}
      >
        {/* Label */}
        <div style={{
          fontSize:       10,
          fontWeight:     700,
          letterSpacing:  '0.12em',
          textTransform:  'uppercase',
          color:          event.current.color,
          marginBottom:   20,
        }}>
          Rank up
        </div>

        {/* Badge */}
        <div style={{
          display:        'flex',
          justifyContent: 'center',
          marginBottom:   20,
          transform:      ready ? 'scale(1)' : 'scale(0.5)',
          transition:     'transform 500ms cubic-bezier(0.34,1.56,0.64,1) 60ms',
        }}>
          <RankBadge
            tierIndex={event.current.tierIndex}
            size={96}
            subLevel={event.current.subLevel}
            showPips={true}
          />
        </div>

        {/* Rank name */}
        <div style={{
          fontSize:   28,
          fontWeight: 800,
          color:      event.current.color,
          marginBottom: 6,
          lineHeight:   1.1,
        }}>
          {event.current.label}
        </div>

        {/* Previous → new */}
        <div style={{
          fontSize:     12,
          color:        'var(--text-mute)',
          marginBottom: 28,
        }}>
          {event.previous.label} → {event.current.label}
        </div>

        {/* Dismiss */}
        <button
          onClick={onClose}
          style={{
            fontSize:     13,
            fontWeight:   600,
            color:        event.current.color,
            background:   `color-mix(in srgb, ${event.current.color} 14%, transparent)`,
            border:       `1px solid ${event.current.color}55`,
            borderRadius: 8,
            padding:      '8px 28px',
            cursor:       'pointer',
            fontFamily:   'inherit',
          }}
        >
          Continue
        </button>
      </div>
    </div>,
    document.body,
  )
}

// ── Small toast (sub-rank up only) ────────────────────────────────────────

function RankUpToastInner({ event, visible }: { event: RankUpEvent; visible: boolean }) {
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
        border:     `1px solid ${event.current.color}44`,
        borderRadius: 10,
        padding:    '8px 14px',
        boxShadow:  `0 4px 24px ${event.current.color}22`,
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
          tierIndex={event.current.tierIndex}
          size={28}
          subLevel={event.current.subLevel}
          showPips={true}
        />
      </div>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text-mute)', marginBottom: 2 }}>Rank up</div>
        <div style={{ fontSize: 13, fontWeight: 600, color: event.current.color }}>
          {event.current.label}
        </div>
      </div>
    </div>
  )
}

// ── Main export ──────────────────────────────────────────────────────────

export default function RankUpToast({ event }: RankUpToastProps) {
  const [visible,    setVisible]    = useState(false)
  const [current,    setCurrent]    = useState<RankUpEvent | null>(null)
  const [showModal,  setShowModal]  = useState(false)
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!event) return
    setCurrent(event)
    const isTierUp = event.current.tierIndex > event.previous.tierIndex

    if (isTierUp) {
      if (event.current.tierIndex > event.previous.tierIndex) {
        playChime('work')
      }
      setShowModal(true)
    } else {
      setVisible(true)
      if (dismissRef.current) clearTimeout(dismissRef.current)
      dismissRef.current = setTimeout(() => setVisible(false), 4000)
    }
  }, [event?.key])   // eslint-disable-line react-hooks/exhaustive-deps

  if (!current) return null

  const isTierUp = current.current.tierIndex > current.previous.tierIndex

  return (
    <>
      {isTierUp && showModal && (
        <RankUpModal event={current} onClose={() => setShowModal(false)} />
      )}
      {!isTierUp && (
        <RankUpToastInner event={current} visible={visible} />
      )}
    </>
  )
}
