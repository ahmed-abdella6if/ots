// Payment service (Stage 18 — MyFatoorah) — frontend-safe.
//
// This file NEVER talks to MyFatoorah directly and NEVER sees the
// MyFatoorah secret API key. It only calls the project's own Supabase Edge
// Functions (myfatoorah-create-payment, myfatoorah-verify-payment), which
// hold the secret server-side (see supabase/functions/_shared/myfatoorah.ts).
//
// Kept separate from orderService.js on purpose: orderService.js owns the
// order/order_items tables directly via the Supabase client + RLS;
// everything payment-related goes through the Edge Functions instead,
// since payment_status writes are performed server-side with the service
// role key (see the "Note" at the bottom of the orders RLS section in
// supabase/schema.sql).

import { supabase } from '../lib/supabaseClient'

// FIX (live testing): supabase-js's functions.invoke() sets `data: null`
// whenever the Edge Function returns a non-2xx status — the actual JSON
// body the function sent (our friendly Arabic message + error code) is
// only reachable via `error.context`, a raw Response object, and must be
// parsed separately. Reading `data?.message` (as this file used to do)
// always fails silently and falls back to the generic default text,
// hiding the real reason for every failure. This helper fixes that for
// both functions below.
async function readInvokeError(error, fallbackMessage) {
  let body = null
  try {
    body = await error?.context?.json()
  } catch {
    // Response body wasn't JSON (or already consumed) — fall through to
    // the generic message below rather than throwing here.
  }
  const message = body?.message || fallbackMessage
  const err = new Error(message)
  err.code = body?.error || 'invoke_failed'
  return err
}

/**
 * Creates (or re-creates, for a retry) a MyFatoorah payment for an
 * existing order and returns the URL to redirect the browser to.
 *
 * Never send an amount here — the Edge Function reads the order's current
 * total from the database itself; the frontend has no way to influence
 * what MyFatoorah charges.
 *
 * @param {string} orderId
 * @returns {Promise<{ paymentUrl?: string, alreadyPaid?: boolean }>}
 */
export async function createMyFatoorahPayment(orderId) {
  const { data, error } = await supabase.functions.invoke('myfatoorah-create-payment', {
    body: { orderId, redirectOrigin: window.location.origin },
  })

  if (error) {
    throw await readInvokeError(error, 'تعذر تجهيز الدفع، برجاء المحاولة مرة أخرى')
  }

  return data
}

/**
 * Server-side verifies a payment after the customer returns from
 * MyFatoorah's hosted page. Safe to call more than once for the same
 * paymentId — the Edge Function is idempotent (an already-paid order
 * short-circuits without re-contacting MyFatoorah).
 *
 * @param {string} orderId
 * @param {string} paymentId
 * @returns {Promise<{ paid: boolean, reason?: string, message?: string }>}
 */
export async function verifyMyFatoorahPayment(orderId, paymentId) {
  const { data, error } = await supabase.functions.invoke('myfatoorah-verify-payment', {
    body: { orderId, paymentId },
  })

  if (error) {
    throw await readInvokeError(error, 'تعذر التحقق من حالة الدفع')
  }

  return data
}