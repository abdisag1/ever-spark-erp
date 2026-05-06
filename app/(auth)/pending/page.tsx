'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Clock, LogOut } from 'lucide-react'

export default function PendingPage() {
  const router = useRouter()
  const supabase = createClient()

  // Notify admins that a new user is waiting (fire once on mount)
  useEffect(() => {
    fetch('/api/notify-new-signup', { method: 'POST' }).catch(() => {})
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ background: '#1b4332' }}>
            <svg width="30" height="18" viewBox="0 0 52 30" fill="none">
              <path d="M26 15C21 8 13 4 7 8C1 12 2 22 9 25C16 28 23 21 26 15C29 9 37 4 43 7C49 10 50 20 44 24C38 28 30 21 26 15Z"
                stroke="#1db89d" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="text-left">
            <p className="text-xs text-slate-400 leading-none font-medium">Ever Spark Tech</p>
            <p className="font-bold text-slate-900 text-sm leading-none mt-0.5">ERP System</p>
          </div>
        </div>

        <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-5">
          <Clock className="w-8 h-8 text-amber-600" />
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-2">
          Awaiting approval
        </h1>
        <p className="text-slate-500 text-sm mb-6 leading-relaxed">
          Your account has been created and is pending approval by an administrator.
          You will be able to access the system once your account is activated and a role is assigned.
        </p>

        <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700 mb-8">
          Please contact your system administrator if you need immediate access.
        </div>

        <button
          onClick={signOut}
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </div>
  )
}
