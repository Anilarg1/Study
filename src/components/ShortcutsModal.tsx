// src/components/ShortcutsModal.tsx

interface Shortcut { key: string; label: string; section: string }

const SHORTCUTS: Shortcut[] = [
  { section: 'Navigation', key: 'Ctrl+K',    label: 'Command palette' },
  { section: 'Navigation', key: '[',          label: 'Toggle sidebar' },
  { section: 'Timer',      key: 'Space',      label: 'Start / pause' },
  { section: 'Timer',      key: 'S',          label: 'Skip phase' },
  { section: 'Timer',      key: '1 / 2 / 3',  label: 'Focus / Short break / Long break' },
  { section: 'Timer',      key: 'F',          label: 'Toggle focus mode' },
  { section: 'General',    key: '?',          label: 'Show shortcuts' },
  { section: 'General',    key: 'Esc',        label: 'Close / exit focus mode' },
]

interface ShortcutsModalProps {
  onClose: () => void
}

export default function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const sections = [...new Set(SHORTCUTS.map(s => s.section))]

  return (
    <div
      className="cp-overlay"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="cp-modal shortcuts-modal" role="dialog" aria-label="Keyboard shortcuts">
        <div className="cp-search-row" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', padding: '0 4px' }}>
            Keyboard shortcuts
          </span>
          <span className="kbd-badge" style={{ marginLeft: 'auto' }}>esc</span>
        </div>

        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {sections.map(section => (
            <div key={section}>
              <div style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-mute)', marginBottom: 8 }}>
                {section}
              </div>
              <dl style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {SHORTCUTS.filter(s => s.section === section).map(s => (
                  <div key={s.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <dt style={{ fontSize: 12, color: 'var(--text-dim)', margin: 0 }}>{s.label}</dt>
                    <dd style={{ margin: 0 }}>
                      <span className="kbd-badge">{s.key}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
