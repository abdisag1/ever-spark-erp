'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle2 } from 'lucide-react'

type Mode = 'login' | 'signup' | 'forgot'

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = createClient()

  const [mode,    setMode]    = useState<Mode>('login')
  const [loading, setLoading] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '' })

  function set(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email, password: form.password })
      if (error) toast.error(error.message)
      else { router.push('/dashboard'); router.refresh() }

    } else if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { name: form.name } },
      })
      if (error) toast.error(error.message)
      else { toast.success('Account created! Check your email to confirm.'); setMode('login') }

    } else {
      // Use our own Gmail-powered endpoint — bypasses Supabase's rate-limited SMTP
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email }),
      })
      if (!res.ok) {
        const b = await res.json().catch(() => ({}))
        toast.error(b?.error ?? 'Failed to send reset email')
      } else {
        setForgotSent(true)
      }
    }

    setLoading(false)
  }

  function switchMode(next: Mode) {
    setMode(next)
    setForgotSent(false)
    setForm({ name: '', email: '', password: '' })
  }

  const Logo = () => (
    <div className="flex items-center gap-3 mb-8">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#1b4332' }}>
        <svg width="30" height="18" viewBox="0 0 52 30" fill="none">
          <path d="M26 15C21 8 13 4 7 8C1 12 2 22 9 25C16 28 23 21 26 15C29 9 37 4 43 7C49 10 50 20 44 24C38 28 30 21 26 15Z"
            stroke="#1db89d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div>
        <p className="text-xs text-slate-400 leading-none font-medium">Ever Spark Tech</p>
        <p className="font-bold text-slate-900 leading-none mt-0.5">ERP System</p>
      </div>
    </div>
  )

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        <Logo />

        {/* ── Forgot password success state ── */}
        {mode === 'forgot' && forgotSent ? (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-2">Check your email</h2>
            <p className="text-sm text-slate-500 mb-6">
              We sent a password reset link to <strong>{form.email}</strong>.
              Click the link in the email to set a new password.
            </p>
            <button onClick={() => switchMode('login')} className="text-sm text-blue-600 font-medium hover:underline">
              Back to sign in
            </button>
          </div>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">
              {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create account' : 'Reset password'}
            </h1>
            <p className="text-slate-500 text-sm mb-6">
              {mode === 'login'  ? 'Sign in to your workspace' :
               mode === 'signup' ? 'Join the Ever Spark Tech team' :
               'Enter your email and we\'ll send a reset link'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full name</label>
                  <input type="text" required value={form.name} onChange={set('name')} placeholder="Jane Smith" className={inputCls} />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input type="email" required value={form.email} onChange={set('email')} placeholder="you@eversparktech.com" className={inputCls} />
              </div>

              {mode !== 'forgot' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-medium text-slate-700">Password</label>
                    {mode === 'login' && (
                      <button type="button" onClick={() => switchMode('forgot')} className="text-xs text-blue-600 hover:underline">
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <input type="password" required minLength={6} value={form.password} onChange={set('password')} placeholder="••••••••" className={inputCls} />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--color-primary, #1b4332)' }}
              >
                {loading ? 'Please wait…' :
                 mode === 'login'  ? 'Sign in' :
                 mode === 'signup' ? 'Create account' :
                 'Send reset link'}
              </button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm text-slate-500">
              {mode === 'forgot' ? (
                <button onClick={() => switchMode('login')} className="text-blue-600 font-medium hover:underline">
                  Back to sign in
                </button>
              ) : (
                <p>
                  {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
                  <button onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')} className="text-blue-600 font-medium hover:underline">
                    {mode === 'login' ? 'Sign up' : 'Sign in'}
                  </button>
                </p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
