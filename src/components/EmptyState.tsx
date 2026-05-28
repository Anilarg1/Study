// src/components/EmptyState.tsx
interface EmptyStateProps {
  icon:      React.ReactNode
  title:     string
  subtitle?: string
}

export default function EmptyState({ icon, title, subtitle }: EmptyStateProps) {
  return (
    <div style={{
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      gap:            8,
      padding:        '28px 16px',
      color:          'var(--text-mute)',
    }}>
      <div style={{ fontSize: 28, opacity: 0.45 }}>{icon}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-dim)' }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 11, color: 'var(--text-mute)', textAlign: 'center', maxWidth: 220 }}>
          {subtitle}
        </div>
      )}
    </div>
  )
}
