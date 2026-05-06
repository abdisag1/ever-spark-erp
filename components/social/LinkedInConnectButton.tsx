'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Link2, CheckCircle2 } from 'lucide-react'

export function LinkedInConnectButton({ isConnected }: { isConnected: boolean }) {
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get('connected') === 'true') toast.success('LinkedIn connected!')
    if (searchParams.get('error')) toast.error('LinkedIn connection failed. Check your app credentials.')
  }, [searchParams])

  if (isConnected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
        <CheckCircle2 className="w-4 h-4 text-green-600" />
        <span className="text-sm text-green-700 font-medium">LinkedIn connected</span>
      </div>
    )
  }

  return (
    <Button
      onClick={() => { window.location.href = '/api/social/linkedin/auth' }}
      className="bg-[#0A66C2] hover:bg-[#004182]"
    >
      <Link2 className="w-4 h-4" />
      Connect LinkedIn
    </Button>
  )
}
