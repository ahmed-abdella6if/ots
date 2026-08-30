// Edge Function: myfatoorah-create-payment
//
// Called by the frontend (src/services/paymentService.js) with only
// { orderId }. Never receives or trusts an amount from the browser — the
// order total is read straight from the database.
//
// STAGE 18 — MyFatoorah V3 integration.
//
// FLOW:
//   1. Identify the caller (if any) from their Supabase JWT.
//   2. Fetch the order using the service-role client (bypasses RLS, same
//      trusted-server pattern already documented in schema.sql for
//      "Stripe webhook" style updates — here it's the MyFatoorah
//      equivalent).
//   3. Refuse if the order doesn't exist, already belongs to a different
//      customer, or is already paid.
//   4. Create a MyFatoorah payment for the order's CURRENT total (from the
//      DB, in KWD) and store the returned InvoiceId.
//   5. Return only { paymentUrl } to the browser — nothing else, and
//      never the MyFatoorah API key.
//
// DUPLICATE-ORDER PROTECTION: this function only ever reads an existing
// order — it never calls anything that creates a new order row. Re-opening
// the payment page, refreshing, or clicking "pay" again all call this same
// function against the same orderId, which simply issues a fresh
// MyFatoorah invoice for that one order (MyFatoorah itself has no "resume
// old invoice" endpoint — creating a new invoice per attempt is expected
// and is how MyFatoorah's own retry model works). The stored reference
// columns are overwritten each time, so exactly one MyFatoorah reference
// is tracked as "current" per order at any moment.
//
// REUSED (NOT NEW) DB COLUMNS — see supabase/schema.sql:
//   orders.stripe_checkout_session_id  -> stores the MyFatoorah InvoiceId
//   orders.stripe_payment_intent_id    -> stores the MyFatoorah PaymentId
//                                          (set later, by myfatoorah-verify-payment)
// These are plain nullable text columns with no Stripe-specific
// constraints/logic anywhere else in the schema, so reusing them avoids an
// unnecessary migration. Their names are a pre-existing artifact of an
// earlier (never-implemented) Stripe stage — see the Stage 18 report for
// why a rename wasn't done here.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { adminClient, getCallerUserId } from '../_shared/supabaseAdmin.ts'
import { createPayment } from '../_shared/myfatoorah.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, redirectOrigin } = await req.json()
    if (!orderId || typeof orderId !== 'string') {
      return jsonResponse({ error: 'invalid_request', message: 'orderId is required' }, 400)
    }

    const supabase = adminClient()
    const callerId = await getCallerUserId(req)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(
        'id, order_number, customer_id, customer_name, customer_email, customer_phone, total, payment_status'
      )
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      console.error('Failed to fetch order:', orderError.message)
      return jsonResponse({ error: 'server_error', message: 'تعذر تجهيز الدفع' }, 500)
    }

    if (!order) {
      return jsonResponse({ error: 'order_not_found', message: 'الطلب غير موجود' }, 404)
    }

    // Ownership check — "Verify the order belongs to the current customer
    // when applicable". Guest orders (customer_id is null) have no owner
    // to check against, matching how guest checkout already works
    // elsewhere in this project (order creation itself allows
    // customer_id is null).
    if (order.customer_id && order.customer_id !== callerId) {
      return jsonResponse(
        { error: 'unauthorized_order_access', message: 'غير مصرح لك بالوصول لهذا الطلب' },
        403
      )
    }

    if (order.payment_status === 'paid') {
      return jsonResponse({ alreadyPaid: true })
    }

    // Best-effort redirection origin from the frontend (not secret — just
    // where to send the browser back to). Falls back to a configured
    // SITE_URL secret if the frontend didn't send one.
    const origin = redirectOrigin || Deno.env.get('SITE_URL')
    if (!origin) {
      return jsonResponse(
        { error: 'server_misconfigured', message: 'تعذر تجهيز رابط العودة للموقع' },
        500
      )
    }

    const redirectionUrl = `${origin.replace(/\/$/, '')}/order-payment/${order.id}/return`

    const digitsOnlyPhone = (order.customer_phone || '').replace(/\D/g, '') || undefined

    let payment
    try {
      payment = await createPayment({
        amount: Number(order.total),
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        customerMobile: digitsOnlyPhone,
        mobileCountryCode: '+965', // Kuwait
        customerReference: order.id,
        redirectionUrl,
      })
    } catch (err) {
      console.error('MyFatoorah createPayment failed:', (err as Error).message)
      return jsonResponse(
        { error: 'payment_creation_failed', message: 'تعذر إنشاء عملية الدفع، برجاء المحاولة مرة أخرى' },
        502
      )
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ stripe_checkout_session_id: payment.invoiceId })
      .eq('id', order.id)

    if (updateError) {
      // Non-fatal for the customer (the payment URL is still valid) —
      // but log it since it means retry-reuse bookkeeping is stale.
      console.error('Failed to store MyFatoorah invoice id:', updateError.message)
    }

    return jsonResponse({ paymentUrl: payment.paymentUrl })
  } catch (err) {
    console.error('myfatoorah-create-payment error:', (err as Error).message)
    return jsonResponse({ error: 'server_error', message: 'حدث خطأ غير متوقع' }, 500)
  }
})
