// Edge Function: notify-new-order
//
// Sends a Web Push "new order" notification to every admin device that
// enabled order alerts (rows in admin_push_subscriptions). Called ONLY by
// myfatoorah-verify-payment and myfatoorah-webhook, at the moment an order's
// payment is first confirmed as paid — never for orders that were created
// but not paid.
//
// SECURITY: deployed with --no-verify-jwt (see supabase/config.toml) and
// instead requires the shared secret NOTIFY_SECRET in the x-notify-secret
// header, which only the two payment Edge Functions know. Nobody else can
// trigger notifications. (A JWT check alone isn't enough: any customer's
// anon/session JWT would pass it.)
//
// Secrets: NOTIFY_SECRET and VAPID_PRIVATE_KEY (both required). VAPID_PUBLIC_KEY is optional — it
// defaults to the public key compiled into the storefront
// (src/admin/utils/orderAlerts.js). SITE_URL (already set for MyFatoorah)
// is used as the VAPID subject.

import webpush from 'npm:web-push@3.6.7'
import { corsHeaders, jsonResponse } from '../_shared/cors.ts'
import { adminClient } from '../_shared/supabaseAdmin.ts'

const DEFAULT_VAPID_PUBLIC_KEY =
  'BMNTwNbH_9GsSA7nPHfyW8-bpanVcn_FU7-zbTuoYdORCkj1fAFFYD7yXzdBLYOSVoyE5kw32w4mARvS-cF4rVA'

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const expected = Deno.env.get('NOTIFY_SECRET')
    if (!expected || req.headers.get('x-notify-secret') !== expected) {
      return jsonResponse({ error: 'unauthorized' }, 401)
    }

    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY')
    if (!privateKey) {
      console.error('VAPID_PRIVATE_KEY is not set — order notifications are disabled')
      return jsonResponse({ ok: false, reason: 'not_configured' })
    }

    const { orderId } = await req.json()
    if (!orderId) return jsonResponse({ error: 'invalid_request' }, 400)

    const supabase = adminClient()

    const { data: order } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total')
      .eq('id', orderId)
      .maybeSingle()
    if (!order) return jsonResponse({ error: 'order_not_found' }, 404)

    const { data: subs } = await supabase
      .from('admin_push_subscriptions')
      .select('id, endpoint, p256dh, auth')
    if (!subs || subs.length === 0) return jsonResponse({ ok: true, sent: 0 })

    webpush.setVapidDetails(
      Deno.env.get('SITE_URL') || 'https://ots-flame.vercel.app',
      Deno.env.get('VAPID_PUBLIC_KEY') || DEFAULT_VAPID_PUBLIC_KEY,
      privateKey
    )

    const payload = JSON.stringify({
      title: 'طلب جديد 🛒',
      body: `${order.order_number} • ${Number(order.total).toFixed(3)} د.ك • ${order.customer_name}`,
      url: `/admin/orders/${order.id}`,
      tag: `order-${order.id}`,
      orderId: order.id,
    })

    let sent = 0
    const gone: string[] = []

    await Promise.all(
      subs.map(async (s: { id: string; endpoint: string; p256dh: string; auth: string }) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload,
            { TTL: 3600, urgency: 'high' }
          )
          sent++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          // 404/410 = the device unsubscribed or the subscription expired.
          if (status === 404 || status === 410) gone.push(s.id)
          else console.error('Push send failed:', status, (err as Error).message)
        }
      })
    )

    if (gone.length > 0) {
      await supabase.from('admin_push_subscriptions').delete().in('id', gone)
    }

    return jsonResponse({ ok: true, sent, removed: gone.length })
  } catch (err) {
    console.error('notify-new-order error:', (err as Error).message)
    return jsonResponse({ ok: false }, 500)
  }
})
