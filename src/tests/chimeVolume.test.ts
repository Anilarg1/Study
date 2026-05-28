import { describe, it, expect } from 'vitest'

function volumeToGain(volume: number): number {
  return Math.max(0, Math.min(1, volume / 100))
}

describe('volumeToGain', () => {
  it('converts 0 to 0', ()   => expect(volumeToGain(0)).toBe(0))
  it('converts 100 to 1', () => expect(volumeToGain(100)).toBe(1))
  it('converts 80 to 0.8', ()=> expect(volumeToGain(80)).toBeCloseTo(0.8))
  it('clamps below 0', ()    => expect(volumeToGain(-10)).toBe(0))
  it('clamps above 100', ()  => expect(volumeToGain(150)).toBe(1))
})
