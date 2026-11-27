import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { FinanceModule } from '@/components/finance/FinanceModule'
import type {
  PaymentRequest, Vendor, CostCenter, ChartAccount,
} from '@/types/finance'

const LIST_SELECT = `*,
  requester:profiles!payment_requests_requester_id_fkey(id, name, role),
  approver:profiles!payment_requests_approved_by_fkey(id, name),
  payer:profiles!payment_requests_paid_by_fkey(id, name),
  vendor:vendors(id, name),
  project:projects(id, name),
  cost_center:cost_centers(id, code, name)`

export default async function FinancePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from('profiles').select('id, name, role').eq('id', user.id).single()
  const role = profile?.role ?? 'operations'

  const [
    { data: requests },
    { data: projects },
    { data: vendors },
    { data: costCenters },
    { data: accounts },
  ] = await Promise.all([
    supabase.from('payment_requests').select(LIST_SELECT).order('created_at', { ascending: false }),
    supabase.from('projects').select('id, name').eq('status', 'active').order('name'),
    supabase.from('vendors').select('*').order('name'),
    supabase.from('cost_centers').select('*').order('code'),
    supabase.from('chart_of_accounts').select('*').order('code'),
  ])

  return (
    <div>
      <Header
        title="Finance"
        description="Request, approve and settle payments — with a full audit trail and receipt enforcement"
      />
      <FinanceModule
        currentUser={{ id: user.id, name: profile?.name ?? 'You', role }}
        initialRequests={(requests as PaymentRequest[]) ?? []}
        projects={(projects as { id: string; name: string }[]) ?? []}
        vendors={(vendors as Vendor[]) ?? []}
        costCenters={(costCenters as CostCenter[]) ?? []}
        accounts={(accounts as ChartAccount[]) ?? []}
      />
    </div>
  )
}
