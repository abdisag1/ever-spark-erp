'use client'

import { useState, Suspense } from 'react'
import { format } from 'date-fns'
import { LinkedInConnectButton } from './LinkedInConnectButton'
import { PostEditor } from './PostEditor'
import { Badge, statusVariant } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Avatar } from '@/components/ui/avatar'
import { formatDateTime } from '@/lib/utils'
import { cn } from '@/lib/utils'
import { Plus, Send, Pencil, Trash2, CalendarDays, Clock, ImageIcon } from 'lucide-react'
import { toast } from 'sonner'
import type { SocialPost } from '@/types'

interface SocialModuleProps {
  initialPosts: SocialPost[]
  isConnected: boolean
}

const STATUS_PILL: Record<string, string> = {
  draft:     'bg-slate-100 text-slate-600',
  scheduled: 'bg-blue-50 text-blue-700',
  published: 'bg-green-100 text-green-700',
  failed:    'bg-red-100 text-red-700',
}

export function SocialModule({ initialPosts, isConnected }: SocialModuleProps) {
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<SocialPost | undefined>()
  const [publishing, setPublishing] = useState<string | null>(null)

  function handleSaved(post: SocialPost) {
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p.id === post.id)
      if (idx >= 0) return prev.map((p) => (p.id === post.id ? post : p))
      return [post, ...prev]
    })
  }

  async function handlePublish(post: SocialPost) {
    if (!isConnected) { toast.error('Connect LinkedIn first'); return }
    setPublishing(post.id)
    const res = await fetch('/api/social/linkedin/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ post_id: post.id }),
    })
    if (res.ok) {
      setPosts((prev) => prev.map((p) => (p.id === post.id ? { ...p, status: 'published' } : p)))
      toast.success('Published to LinkedIn!')
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Publish failed')
    }
    setPublishing(null)
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/social/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Failed to delete'); return }
    setPosts((prev) => prev.filter((p) => p.id !== id))
    toast.success('Post deleted')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Suspense fallback={null}>
          <LinkedInConnectButton isConnected={isConnected} />
        </Suspense>
        <Button onClick={() => { setEditingPost(undefined); setEditorOpen(true) }}>
          <Plus className="w-3.5 h-3.5" /> New Post
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-sm">No posts yet. Create your first LinkedIn post.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post) => (
            <Card key={post.id} className={cn(post.status === 'published' && 'border-green-200', post.status === 'scheduled' && 'border-blue-200')}>
              <CardContent className="pt-4 p-0">

                {/* Post image */}
                {post.image_url && (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={post.image_url}
                      alt={post.title ?? 'Post image'}
                      className="w-full max-h-72 object-cover rounded-t-xl"
                    />
                    {post.image_caption && (
                      <p className="px-4 py-2 text-xs text-slate-500 italic bg-slate-50 border-b border-slate-100">
                        {post.image_caption}
                      </p>
                    )}
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">

                      {/* Status + schedule row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className={cn('text-xs font-semibold px-2 py-0.5 rounded-full capitalize', STATUS_PILL[post.status] ?? STATUS_PILL.draft)}>
                          {post.status}
                        </span>
                        {post.image_url && !post.image_url.startsWith('blob') && (
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <ImageIcon className="w-3 h-3" /> Image attached
                          </span>
                        )}
                        {post.scheduled_time && (
                          <span className="flex items-center gap-1 text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                            <CalendarDays className="w-3 h-3" />
                            {format(new Date(post.scheduled_time), 'MMM d, yyyy')}
                            <Clock className="w-3 h-3 ml-0.5" />
                            {format(new Date(post.scheduled_time), 'h:mm a')}
                          </span>
                        )}
                      </div>

                      {/* Title */}
                      {post.title && (
                        <p className="text-sm font-semibold text-slate-900 mb-1">{post.title}</p>
                      )}

                      {/* Content */}
                      <p className="text-sm text-slate-700 whitespace-pre-wrap line-clamp-4">{post.content}</p>

                      {/* Author + created */}
                      {post.author && (
                        <div className="flex items-center gap-1.5 mt-2.5">
                          <Avatar name={post.author.name} size="sm" />
                          <span className="text-xs text-slate-400">{post.author.name}</span>
                          <span className="text-xs text-slate-300">·</span>
                          <span className="text-xs text-slate-400">{formatDateTime(post.created_at)}</span>
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      {(post.status === 'draft' || post.status === 'scheduled') && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePublish(post)}
                          disabled={publishing === post.id}
                          className="text-xs"
                        >
                          <Send className="w-3 h-3" />
                          {publishing === post.id ? 'Publishing…' : 'Publish now'}
                        </Button>
                      )}
                      {post.status !== 'published' && (
                        <button
                          onClick={() => { setEditingPost(post); setEditorOpen(true) }}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="p-1.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <PostEditor
        open={editorOpen}
        onClose={() => { setEditorOpen(false); setEditingPost(undefined) }}
        onSaved={handleSaved}
        post={editingPost}
      />
    </div>
  )
}
