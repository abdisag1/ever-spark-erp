'use client'

import { useEffect, useState } from 'react'
import { Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardHeader, CardContent, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export function TelegramConnect() {
  const [linked, setLinked] = useState<boolean | null>(null)
  const [code, setCode] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/telegram/link-code')
      .then((r) => (r.ok ? r.json() : { linked: false }))
      .then((d) => setLinked(!!d.linked))
      .catch(() => setLinked(false))
  }, [])

  async function generate() {
    setLoading(true)
    const res = await fetch('/api/telegram/link-code', { method: 'POST' })
    if (res.ok) {
      const d = await res.json()
      setCode(d.code)
    } else {
      toast.error('Could not generate a code')
    }
    setLoading(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send className="w-4 h-4" /> Connect Telegram</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {linked === null ? (
          <p className="text-sm text-slate-400">Checking…</p>
        ) : linked ? (
          <p className="text-sm text-green-700 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" /> Your Telegram is linked. Send <code className="font-mono">/pay</code> to the bot to raise a request.
          </p>
        ) : (
          <>
            <p className="text-sm text-slate-600">
              Link Telegram to request payments and approve them from your phone.
            </p>
            {code ? (
              <div className="space-y-1">
                <p className="text-sm text-slate-600">Open the Ever Spark Finance bot and send:</p>
                <p className="font-mono text-base bg-slate-100 rounded-lg px-3 py-2 inline-block">/link {code}</p>
                <p className="text-xs text-slate-400">This code expires in 15 minutes.</p>
              </div>
            ) : (
              <Button onClick={generate} disabled={loading}>{loading ? 'Generating…' : 'Generate link code'}</Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
