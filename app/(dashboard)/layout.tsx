import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/Sidebar'
import { ThemeProvider } from '@/components/ThemeProvider'
import { Toaster } from 'sonner'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  const userName = profile?.name ?? user.email ?? 'User'
  const userRole = profile?.role ?? 'sales_marketing'

  return (
    <ThemeProvider>
      <div className="flex h-screen overflow-hidden" style={{ background: 'var(--background)' }}>
        <Sidebar userName={userName} userRole={userRole} userId={user.id} />
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 max-w-7xl mx-auto">
            {children}
          </div>
        </main>
        <Toaster position="top-right" richColors />
      </div>
    </ThemeProvider>
  )
}
