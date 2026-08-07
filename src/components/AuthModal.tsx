import { useState, type FormEvent, type ReactNode } from 'react'
import { login, register } from '../api/auth'
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
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = mode === 'login' ? await login({ email, password }) : await register({ name, email, password })
      onSuccess(response)
    } catch (reason) {
      setError(apiErrorMessage(reason, 'Cannot reach Stockly API. Make sure it is running on port 8080.'))
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login')
    setError('')
  }

  return <div className="fixed inset-0 z-50 grid place-items-center bg-[#0a1711]/45 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) onClose() }}>
    <div role="dialog" aria-modal="true" aria-labelledby="auth-title" className="w-full max-w-md rounded-[24px] bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-start justify-between">
        <div>
          <span className="mb-5 grid size-10 place-items-center rounded-xl bg-[#173c2c] text-white"><AuthIcon><path d="m3 17 6-6 4 4 8-9" /><path d="M15 6h6v6" /></AuthIcon></span>
          <h2 id="auth-title" className="text-2xl font-semibold tracking-[-.035em]">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="mt-2 text-sm text-[#77827b]">{mode === 'login' ? 'Sign in to manage your investments.' : 'Start building a smarter watchlist.'}</p>
        </div>
        <button onClick={onClose} className="grid size-9 place-items-center rounded-xl text-[#6f7a73] hover:bg-[#f1f3f1]" aria-label="Close"><AuthIcon><path d="M6 6l12 12M18 6 6 18" /></AuthIcon></button>
      </div>

      <form onSubmit={submit} className="mt-7 space-y-4">
        {mode === 'register' && <label className="block text-sm font-semibold">Name<input required maxLength={100} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce2dd] px-3.5 py-3 font-normal outline-none focus:border-[#6d927d] focus:ring-4 focus:ring-[#e7eee9]" placeholder="Alex Yang" /></label>}
        <label className="block text-sm font-semibold">Email<input required type="email" maxLength={320} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-[#dce2dd] px-3.5 py-3 font-normal outline-none focus:border-[#6d927d] focus:ring-4 focus:ring-[#e7eee9]" placeholder="you@example.com" /></label>
        <label className="block text-sm font-semibold">Password<input required minLength={mode === 'register' ? 8 : undefined} maxLength={72} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} type="password" className="mt-2 w-full rounded-xl border border-[#dce2dd] px-3.5 py-3 font-normal outline-none focus:border-[#6d927d] focus:ring-4 focus:ring-[#e7eee9]" placeholder={mode === 'register' ? 'At least 8 characters' : 'Your password'} /></label>
        {error && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">{error}</div>}
        <button disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#173c2c] py-3.5 text-sm font-bold text-white transition hover:bg-[#205139] disabled:opacity-60">{loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'} {!loading && <AuthIcon className="size-4"><path d="M5 12h14M13 6l6 6-6 6" /></AuthIcon>}</button>
      </form>

      <p className="mt-5 text-center text-sm text-[#78827c]">{mode === 'login' ? 'New to Stockly?' : 'Already have an account?'} <button onClick={switchMode} className="font-bold text-[#24563f] hover:underline">{mode === 'login' ? 'Create an account' : 'Sign in'}</button></p>
    </div>
  </div>
}

export default AuthModal
