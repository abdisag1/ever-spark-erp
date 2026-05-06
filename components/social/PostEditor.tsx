'use client'

import { useState, useEffect, useRef } from 'react'
import { format } from 'date-fns'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { ImageIcon, X, Upload, CalendarDays, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SocialPost } from '@/types'

interface PostEditorProps {
  open: boolean
  onClose: () => void
  onSaved: (post: SocialPost) => void
  post?: SocialPost
}

export function PostEditor({ open, onClose, onSaved, post }: PostEditorProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [imageCaption, setImageCaption] = useState('')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const MAX_CHARS = 3000

  useEffect(() => {
    if (open) {
      setTitle(post?.title ?? '')
      setContent(post?.content ?? '')
      setImageUrl(post?.image_url ?? '')
      setImageCaption(post?.image_caption ?? '')
      if (post?.scheduled_time) {
        const dt = new Date(post.scheduled_time)
        setScheduledDate(format(dt, 'yyyy-MM-dd'))
        setScheduledTime(format(dt, 'HH:mm'))
      } else {
        setScheduledDate('')
        setScheduledTime('')
      }
    }
  }, [open, post])

  async function handleImageUpload(file: File) {
    setUploading(true)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/social/upload', { method: 'POST', body: fd })
    if (res.ok) {
      const { url } = await res.json()
      setImageUrl(url)
      toast.success('Image uploaded')
    } else {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to upload image')
    }
    setUploading(false)
  }

  async function save() {
    if (!content.trim()) { toast.error('Post content is required'); return }
    setSaving(true)

    // Combine date + time into ISO string if both set
    let combinedSchedule: string | null = null
    if (scheduledDate) {
      const timeStr = scheduledTime || '09:00'
      combinedSchedule = new Date(`${scheduledDate}T${timeStr}`).toISOString()
    }

    const body = {
      title: title || null,
      content,
      image_url: imageUrl || null,
      image_caption: imageCaption || null,
      scheduled_time: combinedSchedule,
      status: combinedSchedule ? 'scheduled' : 'draft',
    }

    let res: Response
    if (post) {
      res = await fetch(`/api/social/${post.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      res = await fetch('/api/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    if (!res.ok) {
      const b = await res.json().catch(() => ({}))
      toast.error(b?.error ?? 'Failed to save post')
      setSaving(false)
      return
    }

    const saved: SocialPost = await res.json()
    onSaved(saved)
    onClose()
    setSaving(false)
    toast.success(
      combinedSchedule
        ? `Post scheduled for ${format(new Date(combinedSchedule), 'MMM d, yyyy · h:mm a')}`
        : post ? 'Post updated' : 'Post saved as draft'
    )
  }

  const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <Modal open={open} onClose={onClose} title={post ? 'Edit Post' : 'New Post'} size="lg">
      <div className="p-5 space-y-4">

        {/* Title */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Post Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Introducing our new Maxi Wata system"
            className={inputCls}
          />
        </div>

        {/* Content */}
        <div className="relative">
          <label className="block text-xs font-medium text-slate-600 mb-1">Post Content *</label>
          <textarea
            rows={7}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={MAX_CHARS}
            placeholder="What would you like to share on LinkedIn?"
            className={`${inputCls} resize-none`}
          />
          <span className={cn('absolute bottom-2 right-2 text-xs', content.length > MAX_CHARS * 0.9 ? 'text-red-500' : 'text-slate-400')}>
            {content.length}/{MAX_CHARS}
          </span>
        </div>

        {/* Image attachment */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2">Image Attachment</label>

          {imageUrl ? (
            <div className="relative rounded-xl overflow-hidden border border-slate-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt="Post image" className="w-full max-h-64 object-cover" />
              <button
                onClick={() => { setImageUrl(''); setImageCaption('') }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              {/* Caption input */}
              <div className="p-3 bg-slate-50 border-t border-slate-200">
                <input
                  value={imageCaption}
                  onChange={(e) => setImageCaption(e.target.value)}
                  placeholder="Add a caption for this image…"
                  className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>
            </div>
          ) : (
            <label className={cn(
              'flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-200 rounded-xl p-8 cursor-pointer transition-colors',
              uploading ? 'opacity-50 pointer-events-none' : 'hover:border-blue-300 hover:bg-blue-50/30'
            )}>
              {uploading ? (
                <Upload className="w-6 h-6 text-slate-400 animate-bounce" />
              ) : (
                <ImageIcon className="w-6 h-6 text-slate-300" />
              )}
              <p className="text-xs text-slate-400">{uploading ? 'Uploading…' : 'Click to attach an image (JPG, PNG, GIF — max 10 MB)'}</p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f) }}
              />
            </label>
          )}
        </div>

        {/* Schedule */}
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-2 flex items-center gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            Schedule Post <span className="text-slate-400 font-normal">(optional)</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <div className="relative">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={inputCls}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div className="relative">
              <input
                type="time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={cn(inputCls, !scheduledDate && 'opacity-40 pointer-events-none')}
                placeholder="09:00"
              />
              {!scheduledDate && (
                <p className="text-xs text-slate-400 mt-1">Set a date first</p>
              )}
            </div>
          </div>
          {scheduledDate && scheduledTime && (
            <p className="text-xs text-blue-600 mt-1.5 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              Will be scheduled for {format(new Date(`${scheduledDate}T${scheduledTime}`), 'MMMM d, yyyy \'at\' h:mm a')} · Added to Calendar
            </p>
          )}
          {scheduledDate && !scheduledTime && (
            <p className="text-xs text-slate-400 mt-1.5">Time defaults to 9:00 AM if left blank</p>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || uploading}>
            {saving ? 'Saving…' : scheduledDate ? 'Schedule Post' : post ? 'Save changes' : 'Save draft'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
