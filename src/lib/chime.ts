import type { TimerMode } from '../types'

let ctx:      AudioContext | null = null
let gainNode: GainNode     | null = null

function getCtx(): AudioContext {
  if (!ctx) ctx = new (window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext!)()
  return ctx
}

function getGain(ac: AudioContext): GainNode {
  if (!gainNode) {
    gainNode = ac.createGain()
    gainNode.gain.value = 0.8   // default matches soundVolume:80 / 100
    gainNode.connect(ac.destination)
  }
  return gainNode
}

export function setChimeVolume(volume: number): void {
  const gain = Math.max(0, Math.min(1, volume / 100))
  if (gainNode) {
    gainNode.gain.value = gain
  } else if (ctx) {
    getGain(ctx).gain.value = gain
  }
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
  env.connect(getGain(ac))
  osc.start(startTime)
  osc.stop(startTime + duration)
}

function playWorkChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(523.25, t,        0.55)
  playNote(659.26, t + 0.13, 0.55)
  playNote(783.99, t + 0.26, 0.90, 0.28)
}

function playBreakChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(659.26, t,        0.50, 0.18)
  playNote(523.25, t + 0.16, 0.65, 0.14)
}

function playWarningChime(): void {
  const ac = getCtx()
  if (ac.state === 'suspended') ac.resume()
  const t = ac.currentTime
  playNote(440, t, 0.18, 0.08)   // soft single pulse at low gain
}

export function playChime(mode: TimerMode | 'warning'): void {
  try {
    if (mode === 'work')    playWorkChime()
    else if (mode === 'warning') playWarningChime()
    else                    playBreakChime()
  } catch {
    // AudioContext unavailable — ignore
  }
}
