import { createClient } from '@/lib/supabase/server'
import { publishPost } from '@/lib/linkedin'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { post_id } = await request.json()
  if (!post_id) return NextResponse.json({ error: 'post_id required' }, { status: 400 })

  const { data: post } = await supabase.from('social_posts').select('*').eq('id', post_id).single()
  if (!post) return NextResponse.json({ error: 'Post not found' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('linkedin_access_token, linkedin_profile_id')
    .eq('id', user.id)
    .single()

  if (!profile?.linkedin_access_token || !profile?.linkedin_profile_id) {
    return NextResponse.json({ error: 'LinkedIn not connected' }, { status: 400 })
  }

  try {
    const linkedinPostId = await publishPost(profile.linkedin_access_token, profile.linkedin_profile_id, post.content)

    await supabase
      .from('social_posts')
      .update({ status: 'published', linkedin_post_id: linkedinPostId, updated_at: new Date().toISOString() })
      .eq('id', post_id)

    return NextResponse.json({ success: true, linkedin_post_id: linkedinPostId })
  } catch (err) {
    await supabase.from('social_posts').update({ status: 'failed' }).eq('id', post_id)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
