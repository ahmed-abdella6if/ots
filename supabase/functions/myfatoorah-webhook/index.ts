// Edge Function: myfatoorah-webhook
//
// Optional, additive to myfatoorah-verify-payment — NOT a replacement for
// it. Configure this URL in the MyFatoorah portal (Integration Settings ->
// Webhook Settings), event "Transaction Status Changed", so payment status
// stays correct even if the customer closes their browser right after
// paying and never lands back on /order-payment/:id/return.
//
// SECURITY:
//   - If a webhook secret key is configured (MYFATOORAH_WEBHOOK_SECRET_KEY,
//     set once you enable "Secure Key" for the webhook in the MyFatoorah
//     portal), the `MyFatoorah-Signature` header is checked with
//     HMAC-SHA256 over the event's Data fields, per MyFatoorah's Webhook
//     Signature docs (https://docs.myfatoorah.com/docs/webhook-signature).
//     NOTE: the exact canonical field ORDER for the
//     "TransactionsStatusChanged" event couldn't be confirmed against a
//     live payload from this environment (no network access to
//     MyFatoorah's docs/API here) — verify docs/webhook-signature and
//     adjust `signedFieldOrder` below before relying on this check alone.
//   - Regardless of whether the signature check passes, this handler NEVER
//     marks an order paid from the webhook body alone. It only uses the
//     webhook as a trigger to call the same authoritative
//     GET /v3/payments/{paymentId} lookup used in myfatoorah-verify-payment,
//     and applies the exact same amount/currency/reference checks before
//     touching payment_status. A forged or malformed webhook body can, at
//     worst, cause an extra harmless verification call.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabaseAdmin.ts'
import { getPaymentDetails } from '../_shared/myfatoorah.ts'

// Documented field order for the "TransactionsStatusChanged" event
// (EventCode 1) per MyFatoorah's webhook signature guidance. VERIFY this
// against a real webhook delivery before depending on it — see the module
// comment above.
const signedFieldOrder = [
  'InvoiceId',
  'InvoiceReference',
  'CustomerReference',
  'CreatedDate',
  'TransactionStatus',
]

async function isSignatureValid(data: Record<string, unknown>, secretKey: string, signatureHeader: string) {
  const canonical = signedFieldOrder.map((key) => `${key}=${data[key] ?? ''}`).join(',')

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secretKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const signatureBytes = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(canonical))
  const digest = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)))

  // Constant-time-ish comparison (base64 strings of equal expected length).
  if (digest.length !== signatureHeader.length) return false
  let mismatch = 0
  for (let i = 0; i < digest.length; i++) {
    mismatch |= digest.charCodeAt(i) ^ signatureHeader.charCodeAt(i)
  }
  return mismatch === 0
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const rawBody = await req.text()
    const payload = JSON.parse(rawBody)

    const secretKey = Deno.env.get('MYFATOORAH_WEBHOOK_SECRET_KEY')
    const signatureHeader = req.headers.get('MyFatoorah-Signature') || req.headers.get('myfatoorah-signature')

    if (secretKey) {
      const valid = signatureHeader ? await isSignatureValid(payload?.Data || {}, secretKey, signatureHeader) : false
      if (!valid) {
        console.error('myfatoorah-webhook: invalid or missing signature')
        return jsonResponse({ error: 'invalid_signature' }, 401)
      }
    } else {
      // No secret configured yet (webhook secure-key not enabled in the
      // MyFatoorah portal). Proceed anyway — the GetPaymentDetails
      // re-verification below is still the real authority, this is just
      // reduced defense-in-depth until a secret is set.
      console.warn('myfatoorah-webhook: MYFATOORAH_WEBHOOK_SECRET_KEY not set, skipping signature check')
    }

    const eventData = payload?.Data
    const paymentId: string | undefined = eventData?.PaymentId
    const customerReference: string | undefined = eventData?.CustomerReference

    if (!paymentId || !customerReference) {
      // Not an event shape we care about — acknowledge so MyFatoorah
      // doesn't keep retrying, but do nothing.
      return jsonResponse({ ok: true, ignored: true })
    }

    const supabase = adminClient()

    const { data: order } = await supabase
      .from('orders')
      .select('id, total, payment_status')
      .eq('id', customerReference)
      .maybeSingle()

    if (!order || order.payment_status === 'paid') {
      // Unknown order, or already confirmed (e.g. by the return-page
      // verification racing ahead of this webhook) — idempotent no-op.
      return jsonResponse({ ok: true })
    }

    const details = await getPaymentDetails(paymentId)

    const referenceMatches = !details.customerReference || details.customerReference === order.id
    const amountMatches =
      Number.isFinite(details.invoiceValue) && Math.abs(details.invoiceValue - Number(order.total)) < 0.01
    const currencyMatches = !details.currency || details.currency.toUpperCase() === 'KWD'
    const isPaid = (details.invoiceStatus || '').toUpperCase() === 'PAID'

    if (referenceMatches && amountMatches && currencyMatches && isPaid) {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid', stripe_payment_intent_id: paymentId })
        .eq('id', order.id)
    }

    return jsonResponse({ ok: true })
  } catch (err) {
    console.error('myfatoorah-webhook error:', (err as Error).message)
    // Still 200 so MyFatoorah doesn't hammer retries on a transient parse
    // issue on our side — this endpoint is purely additive to the
    // return-page verification, never the sole path to being marked paid.
    return jsonResponse({ ok: false })
  }
})
