'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { CheckCircle2, Lock } from 'lucide-react'

function ResetPasswordContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createClient()

  const [ready,    setReady]    = useState(false)
  const [invalid,  setInvalid]  = useState(false)
  const [success,  setSuccess]  = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [password, setPassword] = useState('')
  const [confirm,  setConfirm]  = useState('')

  useEffect(() => {
    // Our server-side callback flagged this link as expired
    if (searchParams.get('error') === 'expired') {
      setInvalid(true)
      return
    }

    async function init() {
      // ── 1. Hash-based (implicit flow) ──────────────────────────────────────
      // Supabase admin-generated OTP links often redirect as:
      //   /reset-password#access_token=XXX&refresh_token=YYY&type=recovery
      // The hash is client-side only — servers never see it.
      const hash = window.location.hash
      if (hash) {
        const p            = new URLSearchParams(hash.replace('#', ''))
        const accessToken  = p.get('access_token')
        const refreshToken = p.get('refresh_token') ?? ''
        const type         = p.get('type')

        if (accessToken && type === 'recovery') {
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
          if (!error) {
            window.history.replaceState({}, '', '/reset-password')
            setReady(true)
            return
          }
        }
      }

      // ── 2. Code-based (PKCE flow) ──────────────────────────────────────────
      // Some Supabase configurations redirect with ?code=xxx
      const code = searchParams.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (!error) {
          window.history.replaceState({}, '', '/reset-password')
          setReady(true)
          return
        }
      }

      // ── 3. Session already established (e.g. page refresh) ─────────────────
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setReady(true)
        return
      }

      // ── 4. Nothing worked ──────────────────────────────────────────────────
      setInvalid(true)
    }

    init()
  }, [searchParams])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match'); return }
    if (password.length < 6)  { toast.error('Password must be at least 6 characters'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      toast.error(error.message)
    } else {
      setSuccess(true)
      await supabase.auth.signOut()
      setTimeout(() => router.push('/login'), 3000)
    }
    setLoading(false)
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="w-full max-w-md">
      <div className="bg-white rounded-2xl shadow-xl p-6 sm:p-8">
        {/* Logo */}
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

        {/* Success */}
        {success && (
          <div className="text-center py-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-slate-900 mb-2">Password updated!</h2>
            <p className="text-sm text-slate-500">Redirecting you to sign in…</p>
          </div>
        )}

        {/* Invalid / expired */}
        {!success && invalid && (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-6 h-6 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Link expired</h2>
            <p className="text-sm text-slate-500 mb-6">
              This password reset link has expired or already been used. Please request a new one.
            </p>
            <button onClick={() => router.push('/login')} className="text-sm text-blue-600 font-medium hover:underline">
              Back to sign in
            </button>
          </div>
        )}

        {/* Loading / verifying */}
        {!success && !invalid && !ready && (
          <div className="text-center py-8">
            <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-sm text-slate-500">Verifying reset link…</p>
          </div>
        )}

        {/* Reset form */}
        {!success && !invalid && ready && (
          <>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Set new password</h1>
            <p className="text-slate-500 text-sm mb-6">Choose a strong password for your account.</p>

            <form onSubmit={handleReset} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New password</label>
                <input type="password" required minLength={6} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters" className={inputCls} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm password</label>
                <input type="password" required minLength={6} value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Same password again" className={inputCls} />
              </div>

              {password && confirm && password !== confirm && (
                <p className="text-xs text-red-500">Passwords do not match</p>
              )}

              <button
                type="submit"
                disabled={loading || (!!password && !!confirm && password !== confirm)}
                className="w-full disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors"
                style={{ background: 'var(--color-primary, #1b4332)' }}
              >
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
          <div className="w-8 h-8 border-2 border-slate-200 border-t-blue-600 rounded-full animate-spin mx-auto" />
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  )
}
