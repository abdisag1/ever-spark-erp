import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { ConversionAnalytics } from '@/types'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('leads')
    .select('funnel_status')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts = { lead: 0, appointment: 0, presentation: 0, sale: 0 }
  data.forEach((l) => { counts[l.funnel_status as keyof typeof counts]++ })

  const safe = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100))

  const analytics: ConversionAnalytics = {
    total_leads: counts.lead,
    total_appointments: counts.appointment,
    total_presentations: counts.presentation,
    total_sales: counts.sale,
    lead_to_appointment: safe(counts.appointment, counts.lead),
    appointment_to_presentation: safe(counts.presentation, counts.appointment),
    presentation_to_sale: safe(counts.sale, counts.presentation),
  }

  return NextResponse.json(analytics)
}
