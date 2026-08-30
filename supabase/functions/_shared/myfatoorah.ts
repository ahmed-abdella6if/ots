// Shared MyFatoorah V3 API helper for Edge Functions.
//
// SECURITY: MYFATOORAH_API_KEY is read from the Supabase Edge Function
// secret store (`supabase secrets set MYFATOORAH_API_KEY=...`) — it is
// NEVER present in any VITE_ variable and never sent to the browser. Every
// function in this project that talks to MyFatoorah does so from here,
// server-side only.
//
// Uses the current MyFatoorah V3 API (https://docs.myfatoorah.com/) —
// NOT the old V2 endpoints (SendPayment/ExecutePayment/InitiatePayment).
//
// NOTE ON ACCURACY: the exact request/response field names below were
// assembled from MyFatoorah's published V3 documentation examples
// (Hosted Payment Page + Invoicing docs), since this environment has no
// network access to api.myfatoorah.com / apitest.myfatoorah.com to
// confirm against a live sandbox call. Before going live, trigger one
// real sandbox payment and diff the actual request/response against the
// shapes used here (see comments at each call site).

const IS_TEST = (Deno.env.get('MYFATOORAH_IS_TEST') ?? 'true') !== 'false'

const BASE_URL = IS_TEST ? 'https://apitest.myfatoorah.com' : 'https://api.myfatoorah.com'

function getApiKey(): string {
  const key = Deno.env.get('MYFATOORAH_API_KEY')
  if (!key) {
    throw new Error('MYFATOORAH_API_KEY is not configured on the server')
  }
  return key
}

async function myFatoorahRequest(path: string, method: 'GET' | 'POST', body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json().catch(() => null)

  if (!res.ok || !json || json.IsSuccess === false) {
    // FIX (live sandbox test): a generic top-level Message like "Invalid
    // data" was being shown alone, hiding the specific per-field
    // ValidationErrors MyFatoorah also returns alongside it — making real
    // failures undiagnosable from the logs. Both are now combined so the
    // actual invalid field shows up.
    const validationDetails = json?.ValidationErrors
      ?.map((e: any) => `${e.Name}: ${e.Error}`)
      .join(', ')
    const message =
      [json?.Message, validationDetails].filter(Boolean).join(' — ') ||
      `MyFatoorah request failed (${res.status})`
    throw new Error(message)
  }

  return json
}

/**
 * Creates a MyFatoorah payment (V3 `POST /v3/payments`), letting MyFatoorah
 * show every payment method enabled on the merchant account (no
 * PaymentMethod is sent — this is the documented "Invoicing"/Hosted
 * Payment Page shape that returns a PaymentURL to a page listing all
 * enabled methods, per the Stage 18 brief: "Do not hard-code payment
 * method IDs ... allow MyFatoorah to display the enabled payment methods").
 *
 * Currency is intentionally not forced in the request — a Kuwait
 * MyFatoorah merchant account's base currency is KWD, so an omitted
 * currency defaults to it. The caller (myfatoorah-verify-payment) is
 * responsible for checking the currency actually returned by MyFatoorah
 * at verification time rather than trusting this assumption blindly.
 */
export async function createPayment({
  amount,
  customerName,
  customerEmail,
  customerMobile,
  mobileCountryCode,
  customerReference,
  redirectionUrl,
}: {
  amount: number
  customerName: string
  customerEmail?: string | null
  customerMobile?: string | null
  mobileCountryCode?: string
  customerReference: string
  redirectionUrl: string
}) {
  const body: Record<string, unknown> = {
    Order: { Amount: amount },
    Customer: {
      // FIX (live sandbox test): `Name` here was never confirmed against a
      // real V3 example — every official MyFatoorah V3 sample found
      // (Hosted Payment Page, Invoicing, Direct Tokenization, Card
      // Verification) includes only Reference/Email/Mobile under Customer,
      // never a Name field. Removed as a likely contributor to the
      // "Invalid data" response; customerName is kept in the function
      // signature in case a confirmed correct place for it turns up.
      Reference: customerReference,
      ...(customerEmail ? { Email: customerEmail } : {}),
      ...(customerMobile
        ? { Mobile: { CountryCode: mobileCountryCode || '+965', Number: customerMobile } }
        : {}),
    },
    IntegrationUrls: { Redirection: redirectionUrl },
    Language: 'AR',
  }

  const json = await myFatoorahRequest('/v3/payments', 'POST', body)
  return {
    invoiceId: String(json.Data?.InvoiceId ?? ''),
    paymentUrl: json.Data?.PaymentURL as string,
  }
}

/**
 * Get Payment Details (V3 `GET /v3/payments/{paymentId}`) — the
 * authoritative, server-to-server source of truth for a payment's status.
 * Never trust the browser's return-URL query params alone; this is what
 * actually confirms a payment.
 *
 * FIX (confirmed against a real live sandbox response — see the
 * diagnostic log this was built from): this endpoint's real response
 * shape is nothing like the flat `InvoiceId`/`InvoiceStatus`/
 * `InvoiceValue` fields assumed before (those belong to a different,
 * older MyFatoorah endpoint). The actual shape is nested:
 *   { Invoice: { Id, Status, Reference, ExternalIdentifier,
 *                UserDefinedField, ... },
 *     Transaction: { Id, Status, PaymentId, ... },
 *     Customer: { Name, Mobile, Email },
 *     Amount: { BaseCurrency, ValueInBaseCurrency, ReceivableAmount, ... } }
 * `Amount.ValueInBaseCurrency` is the full customer-charged amount (what
 * must match order.total) — NOT `Amount.ReceivableAmount`, which is net
 * of MyFatoorah's own service charge/VAT and will legitimately be lower.
 * Neither `Invoice.ExternalIdentifier` nor `Invoice.UserDefinedField` came
 * back populated in the real response even though `Customer.Reference`
 * was sent at request time — MyFatoorah does not appear to echo it back
 * on this endpoint, so `customerReference` below may legitimately be
 * empty. The caller (myfatoorah-verify-payment) already treats an empty
 * customerReference as "skip this check" rather than a failure, so this
 * doesn't weaken anything that was actually working — it just means the
 * amount+order-id binding is the real security boundary here, not this
 * reference field.
 */
export async function getPaymentDetails(paymentId: string) {
  const json = await myFatoorahRequest(`/v3/payments/${encodeURIComponent(paymentId)}`, 'GET')
  const data = json.Data ?? {}

  return {
    invoiceId: String(data.Invoice?.Id ?? ''),
    invoiceStatus: data.Invoice?.Status as string | undefined, // 'PAID' | 'PENDING' | ...
    invoiceValue: Number(data.Amount?.ValueInBaseCurrency ?? NaN),
    currency: (data.Amount?.BaseCurrency || data.Amount?.DisplayCurrency) as string | undefined,
    customerReference: (data.Invoice?.ExternalIdentifier || data.Invoice?.UserDefinedField ||
      undefined) as string | undefined,
    raw: data,
  }
}