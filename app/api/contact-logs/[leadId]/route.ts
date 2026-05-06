import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/contact-logs/[leadId]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId } = await ctx.params

  const { data, error } = await supabase
    .from('contact_logs')
    .select('*')
    .eq('lead_id', leadId)
    .order('contacted_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/contact-logs/[leadId]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { leadId } = await ctx.params
  const {
    funnel_status,
    interaction_type,
    sequence_number,
    contacted_at,
    meeting_duration_minutes,
    sentiment,
    notes,
  } = await request.json()

  if (!funnel_status || !interaction_type) {
    return NextResponse.json({ error: 'funnel_status and interaction_type are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('contact_logs')
    .insert({
      lead_id: leadId,
      contacted_by: user.id,
      funnel_status,
      interaction_type,
      sequence_number: sequence_number ?? 0,
      contacted_at: contacted_at ?? new Date().toISOString(),
      meeting_duration_minutes: meeting_duration_minutes ?? null,
      sentiment: sentiment ?? null,
      notes: notes || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
