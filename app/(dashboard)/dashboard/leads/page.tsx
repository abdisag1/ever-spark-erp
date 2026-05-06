import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from '@/components/leads/KanbanBoard'
import { Header } from '@/components/layout/Header'
import type { Lead, ContactLog } from '@/types'

export default async function LeadsPage() {
  const supabase = await createClient()

  const [{ data: leads }, { data: contactLogs }] = await Promise.all([
    supabase
      .from('leads')
      .select('*, assignee:profiles!leads_assigned_to_fkey(id, name, role)')
      .order('position', { ascending: true })
      .order('created_at', { ascending: false }),
    supabase
      .from('contact_logs')
      .select('*')
      .order('contacted_at', { ascending: true }),
  ])

  return (
    <div>
      <Header
        title="Sales Funnel"
        description="Track leads through your pipeline — drag to move, log contacts to track outreach"
      />
      <KanbanBoard
        initialLeads={(leads as Lead[]) ?? []}
        initialContactLogs={(contactLogs as ContactLog[]) ?? []}
      />
    </div>
  )
}
