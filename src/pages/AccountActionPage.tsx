import { useEffect, useState, type FormEvent } from 'react'
import { resetPassword, verifyEmail } from '../api/auth'
import { apiErrorMessage } from '../api/client'

type AccountActionPageProps = { action: 'verify-email' | 'reset-password', onSignIn: () => void }

export default function AccountActionPage({ action, onSignIn }: AccountActionPageProps) {
  const token = new URLSearchParams(window.location.search).get('token') ?? ''
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>(action === 'verify-email' ? 'loading' : 'ready')
  const [message, setMessage] = useState('')
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (action !== 'verify-email') return
    if (!token) { setStatus('error'); setMessage('This verification link is incomplete.'); return }
    void verifyEmail(token).then(() => {
      setStatus('success')
      setMessage('Your email is verified. You can now sign in.')
    }).catch((reason) => {
      setStatus('error')
      setMessage(apiErrorMessage(reason, 'Unable to verify this email link.'))
    })
  }, [action, token])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!token) { setStatus('error'); setMessage('This password reset link is incomplete.'); return }
    setStatus('loading')
    try {
      await resetPassword(token, password)
      setStatus('success')
      setMessage('Your password has been updated. Please sign in with your new password.')
    } catch (reason) {
      setStatus('error')
      setMessage(apiErrorMessage(reason, 'Unable to reset your password.'))
    }
  }

  const title = action === 'verify-email' ? 'Verify your email' : 'Choose a new password'
  const description = action === 'verify-email' ? 'We are confirming your FolioNest account.' : 'Use at least 8 characters. This will sign out your other sessions.'

  return <main className="auth-shell">
    <section className="auth-card mx-auto max-w-lg">
      <img src="/favicon.svg" alt="FolioNest" className="mx-auto size-12 rounded-2xl shadow-[0_7px_18px_rgba(23,60,44,.18)]" />
      <p className="page-eyebrow mt-6">FolioNest account</p>
      <h1 className="page-title">{title}</h1>
      <p className="page-description">{description}</p>
      {action === 'reset-password' && status !== 'success' && <form onSubmit={submit} className="mx-auto mt-7 max-w-sm text-left">
        <label className="block text-sm font-semibold">New password
          <input required minLength={8} maxLength={72} autoComplete="new-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-xl border border-[#c3d5e8] px-3.5 font-normal outline-none focus:border-[#3b7fbd] focus:ring-4 focus:ring-[#e8f0fb]" placeholder="At least 8 characters" />
        </label>
        <button disabled={status === 'loading'} className="button-primary mt-5 w-full disabled:opacity-60">{status === 'loading' ? 'Updating…' : 'Update password'}</button>
      </form>}
      {action === 'verify-email' && status === 'loading' && <p className="mt-7 text-sm text-[#506a84]">Verifying your email…</p>}
      {message && <p role={status === 'error' ? 'alert' : 'status'} className={`mt-7 rounded-xl px-4 py-3 text-sm ${status === 'error' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{message}</p>}
      {(status === 'success' || status === 'error') && <button onClick={onSignIn} className="button-primary mt-6">Go to sign in</button>}
    </section>
  </main>
}
