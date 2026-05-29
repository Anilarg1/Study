import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props  { children: ReactNode }
interface State  { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          minHeight: '100dvh',
          background: 'var(--bg, #0e0e10)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 24,
        }}>
          <span style={{ fontSize: 28 }}>⚠️</span>
          <p style={{ fontSize: 14, color: 'var(--text, #e4e4e7)', fontWeight: 500, margin: 0 }}>
            Something went wrong
          </p>
          <p style={{ fontSize: 12, color: 'var(--text-mute, #71717a)', margin: 0, maxWidth: 360, textAlign: 'center' }}>
            {this.state.error.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 8,
              padding: '6px 16px',
              background: 'var(--accent, #8b85ff)',
              border: 'none',
              borderRadius: 6,
              color: '#fff',
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Reload app
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
