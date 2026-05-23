import { useState } from 'react'
import useAuthStore from '../store/useAuthStore'
import clsx from 'clsx'

export default function AuthForm() {
  const [mode,     setMode]     = useState<'signin' | 'signup'>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [error,    setError]    = useState<string | null>(null)
  const [loading,  setLoading]  = useState(false)
  const [success,  setSuccess]  = useState(false)

  const { signIn, signUp } = useAuthStore()

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

  if (success) {
    return (
      <div className="text-center flex flex-col gap-5">
        <p className="text-soft text-sm leading-relaxed">
          Check your email for a confirmation link<br/>
          then sign in below.
        </p>
        <button
          onClick={() => { setSuccess(false); setMode('signin') }}
          className="text-accent text-xs hover:underline"
        >
          Back to sign in
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full max-w-xs">

      {/* mode tabs */}
      <div className="flex gap-1 bg-card rounded-lg p-1">
        {([['signin', 'Sign In'], ['signup', 'Sign Up']] as const).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => { setMode(m); setError(null) }}
            className={clsx(
              'flex-1 text-[11px] tracking-wide py-1.5 rounded-md transition-all duration-200',
              mode === m
                ? 'bg-surface text-bright shadow-sm'
                : 'text-dim hover:text-soft'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* inputs */}
      <div className="flex flex-col gap-4">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className={clsx(
            'bg-transparent border-b border-border text-sm text-soft',
            'placeholder:text-muted focus:outline-none focus:border-accent',
            'transition-colors py-1.5'
          )}
        />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className={clsx(
            'bg-transparent border-b border-border text-sm text-soft',
            'placeholder:text-muted focus:outline-none focus:border-accent',
            'transition-colors py-1.5'
          )}
        />
      </div>

      {/* error */}
      {error && (
        <p className="text-red text-xs leading-snug">{error}</p>
      )}

      {/* submit */}
      <button
        type="submit"
        disabled={loading}
        className={clsx(
          'h-10 rounded-full text-sm font-medium transition-all duration-200',
          'bg-accent text-white hover:bg-accent-dim active:scale-95',
          loading && 'opacity-50 cursor-not-allowed'
        )}
      >
        {loading ? '…' : mode === 'signin' ? 'Sign In' : 'Create Account'}
      </button>

    </form>
  )
}
