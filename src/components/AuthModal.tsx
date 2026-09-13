import { useState, type FormEvent, type ReactNode } from 'react'
import { forgotPassword, login, register, resendVerification } from '../api/auth'
import { apiErrorMessage } from '../api/client'
import type { AuthResponse } from '../types/auth'

type AuthModalProps = {
  onClose: () => void
  onSuccess: (response: AuthResponse) => void
}

function AuthIcon({ children, className = 'size-5' }: { children: ReactNode, className?: string }) {
  return <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{children}</svg>
}

function AuthModal({ onClose, onSuccess }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login')
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (mode === 'login') {
        onSuccess(await login({ email, password }))
      } else if (mode === 'register') {
        const response = await register({ name, email, password })
        setMessage(response.message)
        setMode('login')
        setPassword('')
      } else {
        const response = await forgotPassword(email)
        setMessage(response.message)
      }
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Cannot reach FolioNest right now. Please try again.'))
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
    setMessage('')
  }

  const resend = async () => {
    if (!email) { setError('Enter your email address first.'); return }
    setLoading(true)
    setError('')
    try { setMessage((await resendVerification(email)).message) }
    catch (reason) { setError(apiErrorMessage(reason, 'Cannot reach FolioNest right now. Please try again.')) }
    finally { setLoading(false) }
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#091523]/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between">
        <div>
          <div className="mb-5 flex items-center gap-2.5">
            <img src="/favicon.svg" alt="FolioNest" className="size-10 rounded-xl shadow-[0_7px_18px_rgba(23,60,44,.18)]" />
            <span className="text-lg font-bold tracking-[-.035em] text-[#0b3b66]">FolioNest</span>
          </div>
          <h2 id="auth-title" className="text-2xl font-semibold tracking-[-.035em]">{mode === 'login' ? 'Welcome back' : mode === 'register' ? 'Create your account' : 'Reset your password'}</h2>
          <p className="mt-2 text-sm text-[#77827b]">{mode === 'login' ? 'Sign in to manage your investments.' : mode === 'register' ? 'We’ll email a link to verify your address.' : 'We’ll email a secure link to set a new password.'}</p>
        </div>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-[#506980] hover:bg-[#f1f3f1]" aria-label="Close"><AuthIcon><path d="M6 6l12 12M18 6 6 18" /></AuthIcon></button>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === 'register' && <label className="block text-sm font-semibold">Name<input required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#c3d5e8] px-3.5 py-3 font-normal outline-none focus:border-[#3b7fbd] focus:ring-4 focus:ring-[#e8f0fb]" placeholder="Alex Yang" /></label>}
        <label className="block text-sm font-semibold">Email<input required type="email" maxLength={320} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[#c3d5e8] px-3.5 py-3 font-normal outline-none focus:border-[#3b7fbd] focus:ring-4 focus:ring-[#e8f0fb]" placeholder="you@example.com" /></label>
        {mode !== 'forgot' && <label className="block text-sm font-semibold">Password<input required minLength={mode === 'register' ? 8 : undefined} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-2 w-full rounded-xl border border-[#c3d5e8] px-3.5 py-3 font-normal outline-none focus:border-[#3b7fbd] focus:ring-4 focus:ring-[#e8f0fb]" placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} /></label>}
        {mode === 'login' && <div className="-mt-1 flex justify-end"><button type="button" onClick={() => { setMode('forgot'); setError(''); setMessage('') }} className="text-sm font-semibold text-[#0b5597] hover:underline">Forgot password?</button></div>}
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</div>}
        {message && <div role="status" className="rounded-xl border border-sky-200 bg-sky-50 px-3.5 py-3 text-sm text-[#0b5597]">{message}</div>}
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b3b66] py-3.5 text-sm font-bold text-white transition hover:bg-[#0b4f89] disabled:opacity-60">{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'register' ? 'Create account' : 'Email reset link'} {!loading && <AuthIcon className="size-4"><path d="M5 12h14M13 6l6 6-6 6" /></AuthIcon>}</button>
      </form>

      {mode === 'login' && error.includes('verify') && <p className="mt-4 text-center text-sm text-[#78827c]">Need another verification email? <button disabled={loading} onClick={resend} className="font-bold text-[#0b5597] hover:underline">Resend it</button></p>}
      <p className="mt-5 text-center text-sm text-[#78827c]">{mode === 'login' ? 'New to FolioNest?' : mode === 'register' ? 'Already have an account?' : 'Remembered your password?'} <button onClick={mode === 'forgot' ? () => { setMode('login'); setError(''); setMessage('') } : switchMode} className="font-bold text-[#0b5597] hover:underline">{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </div>
  </div>
}

export default AuthModal
