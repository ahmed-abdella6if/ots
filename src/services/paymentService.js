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
    const message = data?.message || 'تعذر تجهيز الدفع، برجاء المحاولة مرة أخرى'
    const err = new Error(message)
    err.code = data?.error || 'payment_creation_failed'
    throw err
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
    const message = data?.message || 'تعذر التحقق من حالة الدفع'
    const err = new Error(message)
    err.code = data?.error || 'verification_failed'
    throw err
  }

  return data
}
