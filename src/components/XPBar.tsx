import { useEffect, useRef, useState } from 'react'
import useXPStore from '../store/useXPStore'
import { xpToLevel, xpProgress, levelToXp, xpToNextLevel } from '../utils/xp'

interface XPBarProps {
  flash?: boolean
}

export default function XPBar({ flash }: XPBarProps) {
  const totalXP = useXPStore(s => s.totalXP)
  const level   = xpToLevel(totalXP)
  const pct     = Math.round(xpProgress(totalXP) * 100)
  const toNext  = xpToNextLevel(totalXP)

  const [displayXP,  setDisplayXP]  = useState(totalXP)
  const [displayPct, setDisplayPct] = useState(pct)
  const [showFlash,  setFlash]      = useState(false)
  const prevXP  = useRef(totalXP)
  const rafRef  = useRef<number | null>(null)

  useEffect(() => {
    if (totalXP === prevXP.current) return
    const from   = prevXP.current
    const to     = totalXP
    prevXP.current = totalXP

    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current)

    const start = performance.now()
    const DURATION = 800

    function frame(now: number) {
      const t      = Math.min((now - start) / DURATION, 1)
      const eased  = 1 - Math.pow(1 - t, 3)
      const curXP  = Math.round(from + (to - from) * eased)
      const curPct = Math.round(xpProgress(curXP) * 100)
      setDisplayXP(curXP)
      setDisplayPct(curPct)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(frame)
      } else {
        rafRef.current = null
      }
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current) }
  }, [totalXP])

  useEffect(() => {
    if (flash) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 800)
      return () => clearTimeout(t)
    }
  }, [flash])

  return (
    <div className="w-full select-none">
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-dim tracking-widest uppercase">Level</span>
        <span className={`text-lg font-semibold transition-colors duration-300 ${showFlash ? 'text-amber' : 'text-accent'}`}>
          {xpToLevel(displayXP)}
        </span>
      </div>

      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${showFlash ? 'bg-amber' : 'bg-accent'}`}
          style={{ width: `${displayPct}%` }}
        />
      </div>

      <div className="flex justify-between mt-1 text-[10px] text-dim">
        <span>{displayXP.toLocaleString()} XP total</span>
        <span>{toNext} XP to Lv {level + 1}</span>
      </div>

      <span style={{ display: 'none' }}>{levelToXp(level)}</span>
    </div>
  )
}
