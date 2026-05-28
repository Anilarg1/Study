import { describe, it, expect, beforeEach, vi } from 'vitest'

// vi.hoisted runs before any imports are processed — this ensures localStorage
// exists when zustand's persist middleware calls createJSONStorage(() => localStorage)
const _lsData = vi.hoisted(() => {
  const store: Record<string, string> = {}
  const ls = {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v },
    removeItem: (k: string) => { delete store[k] },
    clear:      () => { Object.keys(store).forEach(k => delete store[k]) },
  }
  // @ts-expect-error – global may not be typed
  globalThis.localStorage = ls
  return store
})

import useSettingsStore from '../store/useSettingsStore'

describe('useSettingsStore — new fields', () => {
  beforeEach(() => useSettingsStore.setState({
    focusMode: false, soundVolume: 80,
  }))

  it('defaults focusMode to false', () => {
    const s = useSettingsStore.getState()
    expect(s.focusMode).toBe(false)
  })

  it('defaults soundVolume to 80', () => {
    const s = useSettingsStore.getState()
    expect(s.soundVolume).toBe(80)
  })

  it('toggle flips focusMode', () => {
    useSettingsStore.getState().toggle('focusMode')
    expect(useSettingsStore.getState().focusMode).toBe(true)
  })
})
