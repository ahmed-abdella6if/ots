// Edge Function: myfatoorah-verify-payment
//
// Called by src/pages/OrderPaymentReturnPage.jsx after MyFatoorah redirects
// the customer back with a `paymentId` query param — for BOTH successful
// and failed/cancelled payments (V3's single IntegrationUrls.Redirection
// is used for every outcome; the outcome itself is only known by asking
// MyFatoorah, never by trusting which URL fired or any query string).
//
// STAGE 18 — MyFatoorah V3 integration.
//
// SECURITY (this is the actual "is this order paid" authority):
//   1. Never trusts the browser's query params as proof of payment.
//   2. Calls MyFatoorah's GET /v3/payments/{paymentId} (Get Payment
//      Details) itself, server-to-server, using the secret API key.
//   3. Cross-checks the result against the order in OUR database:
//        - CustomerReference must equal our internal order id
//        - InvoiceValue must equal order.total (to the cent)
//        - currency must be KWD
//        - InvoiceStatus must be "PAID"
//      Only if ALL of these hold does it mark payment_status = 'paid'.
//   4. Ownership: same rule as myfatoorah-create-payment — if the order
//      has a customer_id, the caller's JWT must match it; guest orders
//      have no owner to check.
//
// IDEMPOTENT: if the order is already payment_status = 'paid', this
// returns success immediately without calling MyFatoorah again — so
// "return from payment twice" / refreshing the return page never double
// -processes anything or errors out.

import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { adminClient, getCallerUserId } from '../_shared/supabaseAdmin.ts'
import { getPaymentDetails } from '../_shared/myfatoorah.ts'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { orderId, paymentId } = await req.json()
    if (!orderId || !paymentId) {
      return jsonResponse({ error: 'invalid_request', message: 'orderId and paymentId are required' }, 400)
    }

    const supabase = adminClient()
    const callerId = await getCallerUserId(req)

    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, customer_id, total, payment_status, order_status')
      .eq('id', orderId)
      .maybeSingle()

    if (orderError) {
      console.error('Failed to fetch order:', orderError.message)
      return jsonResponse({ error: 'server_error', message: 'تعذر التحقق من الدفع' }, 500)
    }

    if (!order) {
      return jsonResponse({ error: 'order_not_found', message: 'الطلب غير موجود' }, 404)
    }

    if (order.customer_id && order.customer_id !== callerId) {
      return jsonResponse(
        { error: 'unauthorized_order_access', message: 'غير مصرح لك بالوصول لهذا الطلب' },
        403
      )
    }

    // Already verified earlier (e.g. the customer refreshed this page, or
    // the async webhook — see myfatoorah-webhook — already confirmed it).
    if (order.payment_status === 'paid') {
      return jsonResponse({ paid: true, orderStatus: order.order_status })
    }

    let details
    try {
      details = await getPaymentDetails(paymentId)
    } catch (err) {
      console.error('MyFatoorah getPaymentDetails failed:', (err as Error).message)
      return jsonResponse(
        { error: 'verification_failed', message: 'تعذر التحقق من حالة الدفع، برجاء المحاولة مرة أخرى' },
        502
      )
    }

    // Record the payment reference regardless of outcome — useful for
    // Admin to see the last attempt even on a failed/cancelled payment.
    await supabase.from('orders').update({ stripe_payment_intent_id: paymentId }).eq('id', order.id)

    // DIAGNOSTIC (live testing): log the full raw MyFatoorah response once,
    // regardless of outcome. getPaymentDetails()'s field mapping
    // (invoiceValue/currency/customerReference) was assembled from
    // documentation, never confirmed against a real response — exactly
    // like the CustomerReference request-shape bug already found and
    // fixed. If a mismatch below is wrong, this line shows the actual
    // field names MyFatoorah returns so the mapping can be corrected
    // precisely instead of guessed again. Safe to remove once confirmed.
    console.log('MyFatoorah raw payment details:', JSON.stringify(details.raw))

    const referenceMatches = !details.customerReference || details.customerReference === order.id
    const amountMatches =
      Number.isFinite(details.invoiceValue) && Math.abs(details.invoiceValue - Number(order.total)) < 0.01
    const currencyMatches = !details.currency || details.currency.toUpperCase() === 'KWD'
    const isPaid = (details.invoiceStatus || '').toUpperCase() === 'PAID'

    if (!referenceMatches) {
      console.error('MyFatoorah CustomerReference mismatch for order', order.id, details.customerReference)
      return jsonResponse({ paid: false, reason: 'reference_mismatch', message: 'تعذر التحقق من الطلب' }, 409)
    }

    if (!amountMatches || !currencyMatches) {
      console.error(
        'MyFatoorah amount/currency mismatch for order',
        order.id,
        details.invoiceValue,
        details.currency
      )
      return jsonResponse(
        { paid: false, reason: 'amount_mismatch', message: 'قيمة الدفع لا تطابق قيمة الطلب' },
        409
      )
    }

    if (!isPaid) {
      return jsonResponse({
        paid: false,
        reason: 'not_paid',
        message: 'لم يتم إتمام الدفع، يمكنك المحاولة مرة أخرى',
      })
    }

    const { error: updateError } = await supabase
      .from('orders')
      .update({ payment_status: 'paid' })
      .eq('id', order.id)

    if (updateError) {
      console.error('Failed to mark order as paid:', updateError.message)
      return jsonResponse({ error: 'server_error', message: 'تم الدفع لكن تعذر تحديث حالة الطلب، سنقوم بمراجعته' }, 500)
    }

    return jsonResponse({ paid: true, orderStatus: order.order_status })
  } catch (err) {
    console.error('myfatoorah-verify-payment error:', (err as Error).message)
    return jsonResponse({ error: 'server_error', message: 'حدث خطأ غير متوقع' }, 500)
  }
})