'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Modal } from '@/components/ui/modal'
import { Input, Select, Textarea } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import type { Lead, FunnelStatus } from '@/types'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  organization: z.string().optional(),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().optional(),
  source: z.string().optional(),
  funnel_status: z.enum(['lead', 'appointment', 'presentation', 'sale']),
  notes: z.string().optional(),
})

type FormData = z.infer<typeof schema>

interface LeadFormProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: FormData) => Promise<void>
  initialStatus?: FunnelStatus
  lead?: Lead
}

export function LeadForm({ open, onClose, onSubmit, initialStatus = 'lead', lead }: LeadFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: lead
      ? {
          name: lead.name,
          organization: lead.organization ?? '',
          email: lead.email ?? '',
          phone: lead.phone ?? '',
          source: lead.source ?? '',
          funnel_status: lead.funnel_status,
          notes: lead.notes ?? '',
        }
      : { funnel_status: initialStatus },
  })

  useEffect(() => {
    if (open) {
      reset(
        lead
          ? {
              name: lead.name,
              organization: lead.organization ?? '',
              email: lead.email ?? '',
              phone: lead.phone ?? '',
              source: lead.source ?? '',
              funnel_status: lead.funnel_status,
              notes: lead.notes ?? '',
            }
          : { funnel_status: initialStatus }
      )
    }
  }, [open, lead])

  async function submit(data: FormData) {
    await onSubmit(data)
    reset()
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={lead ? 'Edit Lead' : 'Add Lead'}>
      <form onSubmit={handleSubmit(submit)} className="p-5 space-y-4">
        <Input label="Full name *" placeholder="Jane Smith" error={errors.name?.message} {...register('name')} />
        <Input label="Organization" placeholder="Acme Corp" {...register('organization')} />
        <div className="grid grid-cols-2 gap-3">
          <Input label="Email" type="email" placeholder="jane@acme.com" error={errors.email?.message} {...register('email')} />
          <Input label="Phone" type="tel" placeholder="+1 555 0100" {...register('phone')} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Source" placeholder="Website, Referral…" {...register('source')} />
          <Select label="Stage" {...register('funnel_status')}>
            <option value="lead">Lead</option>
            <option value="appointment">Appointment</option>
            <option value="presentation">Presentation</option>
            <option value="sale">Sale</option>
          </Select>
        </div>
        <Textarea label="Notes" rows={3} placeholder="Additional details…" {...register('notes')} />

        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : lead ? 'Save changes' : 'Add lead'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
