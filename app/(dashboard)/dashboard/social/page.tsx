import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { SocialModule } from '@/components/social/SocialModule'
import type { SocialPost } from '@/types'

export default async function SocialPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [{ data: posts }, { data: profile }] = await Promise.all([
    supabase.from('social_posts').select('*, author:profiles!social_posts_author_id_fkey(id, name)').order('created_at', { ascending: false }),
    supabase.from('profiles').select('linkedin_access_token, linkedin_profile_id').eq('id', user.id).single(),
  ])

  const isConnected = !!(profile?.linkedin_access_token && profile?.linkedin_profile_id)

  return (
    <div>
      <Header title="Social Media" description="Schedule and publish LinkedIn posts" />
      <SocialModule initialPosts={(posts as SocialPost[]) ?? []} isConnected={isConnected} />
    </div>
  )
}
