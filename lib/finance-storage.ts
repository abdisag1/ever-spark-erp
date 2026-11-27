import { createClient as createAdmin, type SupabaseClient } from '@supabase/supabase-js'
import type { PaymentDocument } from '@/types/finance'

export const PAYMENT_BUCKET = 'payment-documents'
const SIGNED_URL_TTL = 60 * 60 // 1 hour

export function storageAdmin(): SupabaseClient {
  return createAdmin(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

/** Ensure the PRIVATE receipts bucket exists (mirrors the Leave upload pattern). */
export async function ensurePaymentBucket(admin: SupabaseClient): Promise<void> {
  const { data: buckets } = await admin.storage.listBuckets()
  if (!buckets?.some((b) => b.name === PAYMENT_BUCKET)) {
    await admin.storage.createBucket(PAYMENT_BUCKET, {
      public: false,
      fileSizeLimit: 10485760,
    })
  }
}

/** Attach a time-limited signed URL to each document (private bucket). */
export async function signDocuments(
  admin: SupabaseClient,
  docs: PaymentDocument[]
): Promise<PaymentDocument[]> {
  return Promise.all(
    docs.map(async (doc) => {
      const { data } = await admin.storage
        .from(PAYMENT_BUCKET)
        .createSignedUrl(doc.url, SIGNED_URL_TTL)
      return { ...doc, signed_url: data?.signedUrl }
    })
  )
}
