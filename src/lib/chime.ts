/**
 * chime.ts — synthesises timer-completion sounds via Web Audio API.
 * No external files or dependencies needed.
 */

import type { TimerMode } from '../types'

let ctx: AudioContext | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)()
  return ctx
}

function playNote(freq: number, startTime: number, duration: number, gainPeak = 0.25): void {
  const ac  = getCtx()
  const osc = ac.createOscillator()
  const env = ac.createGain()

  osc.type = 'sine'
  osc.frequency.setValueAtTime(freq, startTime)

  env.gain.setValueAtTime(0, startTime)
  env.gain.linearRampToValueAtTime(gainPeak, startTime + 0.015)
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + duration)

  osc.connect(env)
  env.connect(ac.destination)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

/** Bright ascending 3-note chime — played when a work session completes. */
function playWorkChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(523.25, t,        0.55)         // C5
  playNote(659.26, t + 0.13, 0.55)         // E5
  playNote(783.99, t + 0.26, 0.90, 0.28)  // G5
}

/** Softer descending 2-note tone — played when a break session completes. */
function playBreakChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(659.26, t,        0.50, 0.18)  // E5
  playNote(523.25, t + 0.16, 0.65, 0.14) // C5
}

/**
 * Play the chime appropriate for the given mode.
 * Silently swallows errors (headless / AudioContext blocked, etc.).
 */
export function playChime(mode: TimerMode): void {
  try {
    if (mode === 'work') playWorkChime()
    else                 playBreakChime()
  } catch {
    // AudioContext unavailable — ignore
  }
}
