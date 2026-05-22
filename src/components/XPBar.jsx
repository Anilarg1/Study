import { useEffect, useRef, useState } from 'react'
import useXPStore from '../store/useXPStore'
import { xpToLevel, xpProgress, levelToXp, xpToNextLevel } from '../utils/xp'

export default function XPBar({ flash }) {
  const totalXP = useXPStore(s => s.totalXP)
  const level   = xpToLevel(totalXP)
  const pct     = Math.round(xpProgress(totalXP) * 100)
  const toNext  = xpToNextLevel(totalXP)

  // Animate bar width
  const [width, setWidth]       = useState(pct)
  const [showFlash, setFlash]   = useState(false)
  const prevPct = useRef(pct)

  useEffect(() => {
    if (pct !== prevPct.current) {
      prevPct.current = pct
      // small tick so CSS transition fires
      requestAnimationFrame(() => setWidth(pct))
    }
  }, [pct])

  useEffect(() => {
    if (flash) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 800)
      return () => clearTimeout(t)
    }
  }, [flash])

  return (
    <div className="w-full select-none">
      {/* Header row */}
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-dim tracking-widest uppercase">Level</span>
        <span
          className={`text-lg font-semibold transition-colors duration-300 ${
            showFlash ? 'text-amber' : 'text-accent'
          }`}
        >
          {level}
        </span>
      </div>

      {/* Bar track */}
      <div className="relative h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out ${
            showFlash ? 'bg-amber' : 'bg-accent'
          }`}
          style={{ width: `${width}%` }}
        />
      </div>

      {/* Footer row */}
      <div className="flex justify-between mt-1 text-[10px] text-dim">
        <span>{totalXP.toLocaleString()} XP total</span>
        <span>{toNext} XP to Lv {level + 1}</span>
      </div>
    </div>
  )
}
