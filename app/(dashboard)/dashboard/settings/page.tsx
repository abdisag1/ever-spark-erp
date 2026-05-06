import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { SettingsPanel } from '@/components/settings/SettingsPanel'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role, status, notify_task_assigned, notify_task_due')
    .eq('id', user.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  return (
    <div>
      <Header title="Settings" description="Manage your profile, preferences, and team" />
      <SettingsPanel
        profile={{ ...profile, email: user.email ?? '' } as never}
        isAdmin={isAdmin}
      />
    </div>
  )
}
