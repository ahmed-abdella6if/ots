// Fire-and-forget trigger for the notify-new-order Edge Function.
//
// Called by the payment functions right AFTER an order flips to paid. It is
// deliberately isolated: any failure (function not deployed, push service
// down, timeout) is logged and swallowed so it can never affect the payment
// result the customer sees.

export async function notifyNewOrder(orderId: string): Promise<void> {
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const secret = Deno.env.get('NOTIFY_SECRET')
    if (!url || !secret) return

    const res = await fetch(`${url}/functions/v1/notify-new-order`, {
      method: 'POST',
      headers: { 'x-notify-secret': secret, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId }),
      signal: AbortSignal.timeout(6000),
    })
    if (!res.ok) console.error('notify-new-order responded', res.status)
  } catch (err) {
    console.error('notifyNewOrder failed:', (err as Error).message)
  }
}
