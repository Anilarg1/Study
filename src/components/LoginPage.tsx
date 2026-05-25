import { useState, useEffect, useRef } from 'react'
import useAuthStore    from '../store/useAuthStore'
import useStreakStore, { calcCurrentStreak } from '../store/useStreakStore'
import { supabase }   from '../lib/supabase'

// ── Interactive dot-grid canvas ────────────────────────────────────────────────
function useDotCanvas(canvasRef: React.RefObject<HTMLCanvasElement | null>): void {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const GAP    = 38
    const R_BASE = 1.1
    const R_MAX  = 2.5
    const REACH  = 170
    const ALPHA  = 0.045
    const ACC_R  = 170
    const ACC_G  = 165
    const ACC_B  = 255

    const center  = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    let target   = { ...center }
    let mouse    = { ...center }
    let warmPos  = { ...center }
    let coolPos  = { ...center }

    function resize() {
      canvas!.width  = window.innerWidth
      canvas!.height = window.innerHeight
    }
    resize()

    function onMove(e: MouseEvent) { target = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('resize', resize)

    let rafId: number
    function frame() {
      mouse.x   += (target.x - mouse.x)   * 0.12
      mouse.y   += (target.y - mouse.y)   * 0.12
      warmPos.x += (target.x - warmPos.x) * 0.08
      warmPos.y += (target.y - warmPos.y) * 0.08
      coolPos.x += (target.x - coolPos.x) * 0.04
      coolPos.y += (target.y - coolPos.y) * 0.04

      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      const cols = Math.ceil(canvas!.width  / GAP) + 1
      const rows = Math.ceil(canvas!.height / GAP) + 1

      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          const x = c * GAP
          const y = r * GAP

          const dM = Math.hypot(x - mouse.x,   y - mouse.y)
          const dW = Math.hypot(x - warmPos.x, y - warmPos.y)
          const dC = Math.hypot(x - coolPos.x, y - coolPos.y)

          const tM = Math.max(0, 1 - dM / REACH)
          const tW = Math.max(0, 1 - dW / REACH) * 0.65
          const tC = Math.max(0, 1 - dC / REACH) * 0.4
          const t  = Math.min(1, tM + tW * 0.4 + tC * 0.2)

          const pushX = dM < REACH && dM > 0 ? (x - mouse.x) / dM * t * 3 : 0
          const pushY = dM < REACH && dM > 0 ? (y - mouse.y) / dM * t * 3 : 0

          const alpha  = ALPHA + t * (0.55 - ALPHA)
          const radius = R_BASE + t * (R_MAX - R_BASE)

          ctx!.beginPath()
          ctx!.arc(x + pushX, y + pushY, radius, 0, Math.PI * 2)
          ctx!.fillStyle = t > 0
            ? `rgba(${ACC_R},${ACC_G},${ACC_B},${alpha.toFixed(3)})`
            : `rgba(180,185,200,${ALPHA})`
          ctx!.fill()
        }
      }

      rafId = requestAnimationFrame(frame)
    }
    frame()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('resize', resize)
    }
  }, [canvasRef])
}

// ── Google icon ────────────────────────────────────────────────────────────────
function GoogleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

// ── GitHub icon ────────────────────────────────────────────────────────────────
function GitHubIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

// ── Spinner ────────────────────────────────────────────────────────────────────
function Spinner() {
  return <span className="login-spinner" aria-hidden />
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LoginPage() {
  const [mode,         setMode]         = useState<'signin' | 'signup'>('signin')
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPw,       setShowPw]       = useState(false)
  const [stayIn,       setStayIn]       = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [loading,      setLoading]      = useState(false)
  const [success,      setSuccess]      = useState(false)
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)

  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const warmRef    = useRef<HTMLDivElement>(null)
  const coolRef    = useRef<HTMLDivElement>(null)
  const glowRafRef = useRef<number | null>(null)

  const { signIn, signUp } = useAuthStore()
  const loginDates = useStreakStore(s => s.loginDates)
  const streak     = calcCurrentStreak(new Set(loginDates))

  // Dot-grid canvas
  useDotCanvas(canvasRef)

  // CSS glow spots that follow the cursor
  useEffect(() => {
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    let target = { ...center }
    let warm   = { ...center }
    let cool   = { ...center }

    function onMove(e: MouseEvent) { target = { x: e.clientX, y: e.clientY } }
    window.addEventListener('mousemove', onMove)

    function tick() {
      warm.x += (target.x - warm.x) * 0.08
      warm.y += (target.y - warm.y) * 0.08
      cool.x += (target.x - cool.x) * 0.04
      cool.y += (target.y - cool.y) * 0.04

      if (warmRef.current) {
        warmRef.current.style.transform = `translate(${warm.x - 320}px, ${warm.y - 320}px)`
      }
      if (coolRef.current) {
        coolRef.current.style.transform = `translate(${cool.x - 210}px, ${cool.y - 210}px)`
      }
      glowRafRef.current = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      window.removeEventListener('mousemove', onMove)
      if (glowRafRef.current !== null) cancelAnimationFrame(glowRafRef.current)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const err = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password)

    setLoading(false)
    if (err) {
      setError(err.message)
    } else if (mode === 'signup') {
      setSuccess(true)
    }
  }

  async function handleOAuth(provider: 'google' | 'github') {
    setError(null)
    setOauthLoading(provider)
    const { error: err } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    })
    if (err) {
      setError(err.message)
      setOauthLoading(null)
    }
  }

  function switchMode(m: 'signin' | 'signup') {
    setMode(m)
    setError(null)
  }

  // ── Email-confirmation success screen ──────────────────────────────────────
  if (success) {
    return (
      <div className="login-root">
        <canvas ref={canvasRef} className="login-canvas" />
        <div ref={warmRef} className="login-glow-warm" />
        <div ref={coolRef} className="login-glow-cool" />
        <div className="login-vignette" />
        <main className="login-card-wrap">
          <div className="login-card login-card--success">
            <div className="login-success-icon">✉</div>
            <h1 className="login-h1">Check your email</h1>
            <p className="login-subtext">
              We sent a confirmation link to <strong>{email}</strong>.
              Click it, then sign in below.
            </p>
            <button
              className="login-text-link"
              onClick={() => { setSuccess(false); setMode('signin') }}
            >
              ← Back to sign in
            </button>
          </div>
        </main>
      </div>
    )
  }

  // ── Main login page ────────────────────────────────────────────────────────
  return (
    <div className="login-root">

      <canvas ref={canvasRef} className="login-canvas" />
      <div ref={warmRef} className="login-glow-warm" />
      <div ref={coolRef} className="login-glow-cool" />
      <div className="login-vignette" />

      <header className="login-header">
        <div className="login-brand">
          <div className="brand-logo" style={{ width: 22, height: 22, fontSize: 11, flexShrink: 0 }}>N</div>
          <span className="login-brand-name">Notebook</span>
        </div>
        <div className="login-header-right">
          {mode === 'signin' ? (
            <>
              <span style={{ color: 'var(--text-dim)' }}>New here?</span>
              &nbsp;
              <button className="login-text-link" onClick={() => switchMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              <span style={{ color: 'var(--text-dim)' }}>Have an account?</span>
              &nbsp;
              <button className="login-text-link" onClick={() => switchMode('signin')}>
                Sign in
              </button>
            </>
          )}
        </div>
      </header>

      <main className="login-card-wrap">
        <div className="login-card">

          <div className="login-eyebrow">
            <span className="login-eyebrow-dot" />
            {mode === 'signin'
              ? 'Welcome back — pick up where you left off'
              : 'Start your study journey today'}
          </div>

          <h1 className="login-h1">
            {mode === 'signin' ? 'Sign in to Notebook' : 'Create your account'}
          </h1>

          <p className="login-subtext">
            {mode === 'signin'
              ? streak > 0
                ? <><strong>{streak}-day streak</strong> is waiting for you.</>
                : <>Focus, earn XP, and track your progress.</>
              : <>Free forever. No credit card required.</>
            }
          </p>

          <div className="login-sso-grid">
            <button
              className="login-sso-btn"
              onClick={() => handleOAuth('google')}
              disabled={!!oauthLoading || loading}
            >
              {oauthLoading === 'google' ? <Spinner /> : <GoogleIcon />}
              <span>Google</span>
            </button>
            <button
              className="login-sso-btn"
              onClick={() => handleOAuth('github')}
              disabled={!!oauthLoading || loading}
            >
              {oauthLoading === 'github' ? <Spinner /> : <GitHubIcon />}
              <span>GitHub</span>
            </button>
          </div>

          <div className="login-divider">
            <span>or with email</span>
          </div>

          <form onSubmit={handleSubmit} className="login-form" noValidate>

            <div className="login-field">
              <span className="login-field-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="login-input"
              />
            </div>

            <div className="login-field">
              <span className="login-field-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                type={showPw ? 'text' : 'password'}
                required
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="login-input"
              />
              <button
                type="button"
                className="login-eye-btn"
                onClick={() => setShowPw(v => !v)}
                tabIndex={-1}
                aria-label={showPw ? 'Hide password' : 'Show password'}
              >
                {showPw ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>

            {error && <p className="login-error">{error}</p>}

            <div className="login-options-row">
              <label className="login-checkbox-label">
                <input
                  type="checkbox"
                  checked={stayIn}
                  onChange={e => setStayIn(e.target.checked)}
                  className="login-checkbox"
                />
                Stay signed in
              </label>
              <span className="login-enc-badge">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                End-to-end encrypted
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !!oauthLoading}
              className="login-submit"
            >
              {loading ? (
                <Spinner />
              ) : (
                <>
                  {mode === 'signin' ? 'Sign in' : 'Create account'}
                  <span className="login-kbd-chip">↵</span>
                </>
              )}
            </button>
          </form>

          <p className="login-foot">
            {mode === 'signin' ? (
              <>New to Notebook?{' '}
                <button className="login-text-link" onClick={() => switchMode('signup')}>
                  Create an account →
                </button>
              </>
            ) : (
              <>Already have an account?{' '}
                <button className="login-text-link" onClick={() => switchMode('signin')}>
                  Sign in →
                </button>
              </>
            )}
          </p>

        </div>
      </main>

      <footer className="login-legal">
        <a className="login-legal-link" href="#">Terms</a>
        <span className="login-legal-sep">·</span>
        <a className="login-legal-link" href="#">Privacy</a>
        <span className="login-legal-sep">·</span>
        <a className="login-legal-link" href="#">Help</a>
        <span className="login-legal-sep">·</span>
        <span style={{ color: 'var(--text-faint)' }}>v 1.4.0</span>
      </footer>

    </div>
  )
}
