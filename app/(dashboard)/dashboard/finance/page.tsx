import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { FinanceModule } from '@/components/finance/FinanceModule'
import type { PaymentRequest, CostCenter, ChartOfAccount, Vendor } from '@/types/finance'

const SELECT = `*,
  requester:profiles!payment_requests_requester_id_fkey(id,name,role),
  approver:profiles!payment_requests_approved_by_fkey(id,name),
  project:projects(id,name),
  vendor:vendors(id,name)`

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('role, name').eq('id', user.id).single()
  const role = profile?.role ?? 'sales_marketing'

  // RLS scopes payment_requests automatically: staff see all, others see their own.
  const [{ data: requests }, { data: costCenters }, { data: accounts }, { data: vendors }, { data: projects }] =
    await Promise.all([
      supabase.from('payment_requests').select(SELECT).order('created_at', { ascending: false }),
      supabase.from('cost_centers').select('*').eq('active', true).order('code'),
      supabase.from('chart_of_accounts').select('*').eq('active', true).order('code'),
      supabase.from('vendors').select('*').eq('is_active', true).order('name'),
      supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
    ])

  return (
    <div>
      <Header title="Finance" description="Payment requests, approvals, and receipts" />
      <FinanceModule
        role={role}
        userId={user.id}
        userName={profile?.name ?? 'You'}
        initialRequests={(requests as PaymentRequest[]) ?? []}
        costCenters={(costCenters as CostCenter[]) ?? []}
        accounts={(accounts as ChartOfAccount[]) ?? []}
        vendors={(vendors as Vendor[]) ?? []}
        projects={(projects as { id: string; name: string }[]) ?? []}
      />
    </div>
  )
}
