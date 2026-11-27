// Shared helpers for the finance module (Phase 1).
import { createClient as createAdminClient, type SupabaseClient } from '@supabase/supabase-js'

export const PAYMENT_BUCKET = 'payment-documents'

/** Service-role client — bypasses RLS. Use ONLY in route handlers, never client-side. */
export function admin(): SupabaseClient {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Creates the private receipt bucket if it doesn't exist (the SQL also seeds it). */
export async function ensurePaymentBucket(a: SupabaseClient = admin()) {
  const { data: buckets } = await a.storage.listBuckets()
  if (!buckets?.some((b) => b.name === PAYMENT_BUCKET)) {
    await a.storage.createBucket(PAYMENT_BUCKET, { public: false, fileSizeLimit: 10_485_760 })
  }
  return a
}

/** Signed, short-lived download URL for a stored receipt path. */
export async function signedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  const { data } = await admin().storage.from(PAYMENT_BUCKET).createSignedUrl(path, expiresIn)
  return data?.signedUrl ?? null
}

export type Role = 'admin' | 'operations' | 'finance' | 'sales_marketing'
export const isFinanceStaff = (role?: string | null): boolean =>
  role === 'finance' || role === 'admin'

/** Which role may act on a request now, for a given action. */
export function canAct(action: string, approverRole: string | null, role?: string | null): boolean {
  if (!isFinanceStaff(role)) return false
  if (action === 'approve' || action === 'reject' || action === 'clarify') {
    // the routed tier, or an admin (GM) who can always act
    return role === 'admin' || role === approverRole
  }
  // pay / post are the bookkeeper's job (finance) — admin allowed as fallback
  return true
}

export const ALLOWED_DOC_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/jpg',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]
