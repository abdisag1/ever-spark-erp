import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/task-comments/[taskId]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await ctx.params

  const { data, error } = await supabase
    .from('task_comments')
    .select('*, author:profiles!task_comments_author_id_fkey(id, name)')
    .eq('task_id', taskId)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest, ctx: RouteContext<'/api/task-comments/[taskId]'>) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await ctx.params
  const { content } = await request.json()
  if (!content) return NextResponse.json({ error: 'Content required' }, { status: 400 })

  const { data, error } = await supabase
    .from('task_comments')
    .insert({ task_id: taskId, author_id: user.id, content })
    .select('*, author:profiles!task_comments_author_id_fkey(id, name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
