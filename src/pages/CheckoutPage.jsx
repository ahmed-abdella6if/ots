// Checkout page: customer information + order summary + discount code +
// order creation (Stage 15), extended in Stage 18 with a payment-method
// step (cash on delivery vs. MyFatoorah online payment).
//
// Everything money-related (unit prices, line totals, subtotal, discount,
// shipping, total) is (re-)computed from live database values via
// orderService.validateCartForCheckout / orderService.createOrder — never
// trusted from the cart's localStorage copy or from this page's own React
// state. See orderService.js for the full trust boundary and the two
// reported schema/RLS limitations (order_items.variant_id NOT NULL, and
// discounts.times_used not writable by customers).
//
// STAGE 18: order creation itself is UNCHANGED (still createOrder(), still
// decrements stock atomically per the Stage 17 fix). What's new is what
// happens AFTER the order exists: for online payment, the customer is sent
// to /order-payment/:orderId, which talks to the secure MyFatoorah Edge
// Functions (never to MyFatoorah directly, never with the API key in this
// bundle) to get a PaymentURL and redirect. See src/pages/OrderPaymentPage.jsx
// and src/services/paymentService.js.

import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ShoppingBag,
  Loader2,
  AlertCircle,
  Tag,
  X,
  CheckCircle2,
  Truck,
  CreditCard,
} from 'lucide-react'
import { useCart } from '../hooks/useCart'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { formatKWD } from '../utils/formatPrice'
import { validateCheckoutFields } from '../utils/validators'
import { validateCartForCheckout, createOrder, calculateShippingCost, FREE_SHIPPING_MIN_QUANTITY } from '../services/orderService'
import { validateDiscountCode } from '../services/discountService'
import { getStoreSettings } from '../services/settingsService'

// STAGE 24 FIX — this was the list of Egyptian governorates on a
// Kuwait-based store (see src/utils/validators.js for the matching phone
// fix). customer_governorate is a plain snapshot text column, not used in
// any shipping-cost calculation (verified — shipping is flat/threshold
// based, never governorate-based), so swapping this list is a pure data
// fix with no effect on pricing/shipping logic elsewhere.
const GOVERNORATES = [
  'العاصمة', 'حولي', 'الفروانية', 'مبارك الكبير', 'الاحمدي', 'الجهراء',
]

// STAGE 30 — converted from static Arabic-only objects to functions of `t`
// so each message follows the active language. Called with the `t` from
// useLanguage() at each call site inside the component.
function getUnavailableMessages(t) {
  return {
    product_unavailable: t('checkout.productUnavailableReason'),
    variant_unavailable: t('checkout.variantUnavailableReason'),
    insufficient_stock: t('checkout.insufficientStockReason'),
  }
}

function getDiscountErrorMessages(t) {
  return {
    not_found: t('checkout.discountNotFound'),
    not_started: t('checkout.discountNotStarted'),
    expired: t('checkout.discountExpired'),
    usage_limit_reached: t('checkout.discountUsageLimitReached'),
    min_order_amount: t('checkout.discountMinOrderNotMet'),
  }
}

function EmptyCartState() {
  const { t } = useLanguage()
  return (
    <div className="max-w-md mx-auto px-4 py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-brand-light flex items-center justify-center mx-auto text-brand-gold">
        <ShoppingBag size={28} />
      </div>
      <h1 className="text-xl font-bold text-gray-900 mt-6">{t('cart.empty')}</h1>
      <p className="text-sm text-gray-500 mt-2">
        {t('checkout.emptyCartHint')}
      </p>
      <Link
        to="/"
        className="inline-block mt-6 bg-brand text-white rounded-xl px-6 py-3 text-sm font-medium hover:opacity-90 transition-opacity"
      >
        {t('cart.browseProducts')}
      </Link>
    </div>
  )
}

function FieldLabel({ htmlFor, children }) {
  return (
    <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-700 mb-1.5">
      {children}
    </label>
  )
}

function TextInput({ id, error, ...props }) {
  return (
    <>
      <input
        id={id}
        {...props}
        className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
          error ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
        }`}
      />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </>
  )
}

export default function CheckoutPage() {
  const { items: cartItems, clearCart } = useCart()
  const { user, profile } = useAuth()
  const { t, dir } = useLanguage()
  const navigate = useNavigate()

  const [validatedItems, setValidatedItems] = useState(null) // null = still loading
  const [loadError, setLoadError] = useState('')
  // STAGE 21: holds the full store_settings shipping fields (default cost +
  // free-shipping rule), not just a single number, so calculateShippingCost()
  // can apply the same rule here as in createOrder().
  const [shippingSettings, setShippingSettings] = useState(null)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [notes, setNotes] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const [discountInput, setDiscountInput] = useState('')
  const [discount, setDiscount] = useState(null) // { id, code, discountAmount }
  const [discountChecking, setDiscountChecking] = useState(false)
  const [discountError, setDiscountError] = useState('')

  // STAGE 18 — payment method. 'online' (MyFatoorah) is the default; 'cod'
  // keeps the exact Stage 15 behavior (order created with payment_status
  // 'pending', no gateway involved, admin marks it paid on delivery via
  // the existing Admin OrderDetail payment-status control).
  const [paymentMethod, setPaymentMethod] = useState('online')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Prefill from the logged-in customer's profile where safely available.
  // Guest checkout stays fully supported (fields simply start empty).
  useEffect(() => {
    if (profile?.full_name) setFullName((v) => v || profile.full_name)
    if (profile?.phone) setPhone((v) => v || profile.phone)
    if (user?.email) setEmail((v) => v || user.email)
  }, [profile, user])

  // Display-only: shows the customer an accurate shipping cost and total
  // before they submit. STAGE 20/21 — the amount actually charged/persisted
  // is never taken from this state; createOrder() re-reads store_settings
  // itself at order-creation time (via the same calculateShippingCost()
  // used below) so this value can't be tampered with via devtools to
  // manipulate the real order total. See orderService.js.
  useEffect(() => {
    let isMounted = true
    getStoreSettings()
      .then((settings) => {
        if (isMounted && settings) setShippingSettings(settings)
      })
      .catch((err) => console.error('Failed to load shipping settings:', err.message))
    return () => {
      isMounted = false
    }
  }, [])

  // Re-validate cart lines against the database whenever the cart changes.
  useEffect(() => {
    let isMounted = true

    if (cartItems.length === 0) {
      setValidatedItems([])
      return
    }

    setLoadError('')
    validateCartForCheckout(cartItems)
      .then((result) => {
        if (isMounted) setValidatedItems(result)
      })
      .catch((err) => {
        console.error('Failed to validate cart:', err.message)
        if (isMounted) setLoadError(t('checkout.cartLoadError'))
      })

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartItems])

  const okItems = useMemo(() => (validatedItems || []).filter((i) => i.ok), [validatedItems])
  const badItems = useMemo(() => (validatedItems || []).filter((i) => !i.ok), [validatedItems])
  const hasVariantlessItem = useMemo(() => okItems.some((i) => !i.variantId), [okItems])

  const subtotal = useMemo(
    () => Math.round(okItems.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100,
    [okItems]
  )
  const discountAmount = discount ? Math.min(discount.discountAmount, subtotal) : 0

  // STAGE 28 — total quantity from the same trusted, validated `okItems`
  // subtotal is computed from (never raw cartItems / client state).
  const totalQuantity = useMemo(
    () => okItems.reduce((sum, i) => sum + (Number(i.quantity) || 0), 0),
    [okItems]
  )

  // STAGE 21 — same shared function createOrder() uses, evaluated against
  // the pre-discount `subtotal` (never the post-discount amount — see the
  // Stage 21 report for why free-shipping eligibility must not be reduced
  // by a discount). STAGE 28 — now also takes totalQuantity for the
  // 12-piece free-shipping rule; see calculateShippingCost() itself for
  // how the two rules combine.
  const shippingCost = useMemo(
    () => calculateShippingCost(subtotal, shippingSettings, totalQuantity),
    [subtotal, shippingSettings, totalQuantity]
  )
  const total = Math.max(0, Math.round((subtotal - discountAmount + shippingCost) * 100) / 100)

  // STAGE 28 — pieces remaining until the 12-piece free-shipping rule
  // kicks in. Takes priority over the older amount-based nudge below (only
  // one nudge is ever shown at once, per this stage's "don't make checkout
  // noisy" instruction) since this store's primary shipping rule is now
  // quantity-based.
  const piecesToFreeShipping = useMemo(() => {
    if (shippingCost === 0) return null // already free (either rule)
    const remaining = FREE_SHIPPING_MIN_QUANTITY - totalQuantity
    return remaining > 0 ? remaining : null
  }, [shippingCost, totalQuantity])

  // Small, optional nudge — only shown when it can be computed safely
  // (free shipping is on, a threshold is configured, and the cart isn't
  // there yet). Never shown once qualified, never shown when free shipping
  // is off.
  const amountToFreeShipping = useMemo(() => {
    if (piecesToFreeShipping != null) return null // quantity nudge takes priority
    if (!shippingSettings?.freeShippingEnabled) return null
    const threshold = Number(shippingSettings.freeShippingMinOrderAmount) || 0
    if (threshold <= 0) return null // threshold 0 means already free — nothing to nudge toward
    const remaining = Math.round((threshold - subtotal) * 100) / 100
    return remaining > 0 ? remaining : null
  }, [shippingSettings, subtotal, piecesToFreeShipping])

  const isLoadingSummary = validatedItems === null
  const canSubmit =
    !submitting &&
    !isLoadingSummary &&
    cartItems.length > 0 &&
    badItems.length === 0 &&
    !hasVariantlessItem &&
    okItems.length > 0

  async function handleApplyDiscount(e) {
    e.preventDefault()
    if (!discountInput.trim() || discountChecking) return

    setDiscountError('')
    setDiscountChecking(true)
    try {
      const result = await validateDiscountCode(discountInput, subtotal)
      if (!result.valid) {
        setDiscount(null)
        setDiscountError(getDiscountErrorMessages(t)[result.reason] || t('checkout.discountInvalid'))
      } else {
        setDiscount({ id: result.discount.id, code: result.discount.code, discountAmount: result.discountAmount })
      }
    } catch (err) {
      console.error('Discount validation failed:', err.message)
      setDiscountError(t('checkout.discountVerifyError'))
    } finally {
      setDiscountChecking(false)
    }
  }

  function handleRemoveDiscount() {
    setDiscount(null)
    setDiscountInput('')
    setDiscountError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (submitting) return // guards against double-submit / duplicate orders

    setSubmitError('')

    const errors = validateCheckoutFields({ fullName, phone, email, address, city, governorate })
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    if (!canSubmit) return

    setSubmitting(true)
    try {
      // Final re-check right before creating the order — cart contents,
      // stock, and the discount could all have changed while the customer
      // was filling in the form.
      const freshItems = await validateCartForCheckout(cartItems)
      const freshBad = freshItems.filter((i) => !i.ok)
      setValidatedItems(freshItems)

      if (freshBad.length > 0) {
        setSubmitError(t('checkout.cartChangedError'))
        return
      }

      const freshOk = freshItems.filter((i) => i.ok)
      if (freshOk.length === 0) {
        setSubmitError(t('checkout.noValidItemsError'))
        return
      }
      if (freshOk.some((i) => !i.variantId)) {
        setSubmitError(t('checkout.itemNotReadyError'))
        return
      }

      const freshSubtotal = Math.round(freshOk.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100

      let freshDiscount = null
      if (discount) {
        const discountResult = await validateDiscountCode(discount.code, freshSubtotal)
        if (!discountResult.valid) {
          setDiscount(null)
          setDiscountError(getDiscountErrorMessages(t)[discountResult.reason] || t('checkout.discountInvalid'))
          setSubmitError(t('checkout.discountNoLongerValid'))
          return
        }
        freshDiscount = {
          id: discountResult.discount.id,
          code: discountResult.discount.code,
          discountAmount: discountResult.discountAmount,
        }
      }

      // shippingCost is intentionally NOT passed here — createOrder() reads
      // the current shipping cost from store_settings itself (STAGE 20),
      // the same trust boundary already used for items/discount above.
      const order = await createOrder({
        customer: { fullName, phone, email, address, city, governorate, notes },
        customerId: user?.id || null,
        items: freshOk,
        discount: freshDiscount,
      })

      // Cart is only ever cleared after order creation has actually
      // succeeded (existing Stage 15 rule, unchanged) — true for both
      // payment methods, since the order (and its reserved stock) already
      // exists at this point either way.
      clearCart()

      if (paymentMethod === 'online') {
        // Hand off to the dedicated payment page rather than redirecting to
        // MyFatoorah inline here — that page is also the retry entry point
        // from MyOrderDetailPage, so this keeps a single implementation.
        navigate(`/order-payment/${order.id}`)
      } else {
        navigate(`/order-success/${order.id}`, { state: { order } })
      }
    } catch (err) {
      console.error('Order creation failed:', err?.message || err)
      if (err?.code === 'INSUFFICIENT_STOCK') {
        // Stock is now reserved atomically at order-creation time (Stage 17
        // fix) — this means someone else took the remaining stock between
        // our last check and now. Re-validate so the summary reflects
        // reality instead of just letting the customer retry blindly.
        setSubmitError(t('checkout.stockRanOut'))
        validateCartForCheckout(cartItems)
          .then((result) => setValidatedItems(result))
          .catch(() => {})
      } else if (err?.code === 'DISCOUNT_UNAVAILABLE') {
        // STAGE 25 — redeem_discount_for_order() failed its atomic re-check
        // (someone else just used the last redemption, or it expired/was
        // deactivated in the moment between our earlier validation and
        // order creation). The order and its reserved stock were already
        // rolled back server-side; here we just clear the now-invalid
        // discount so the customer can retry without it silently being
        // re-applied, matching the friendly-Arabic-message requirement.
        setDiscount(null)
        setDiscountInput('')
        setSubmitError(t('checkout.discountNoLongerAvailable'))
      } else {
        setSubmitError(t('checkout.createOrderError'))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (cartItems.length === 0) {
    return <EmptyCartState />
  }

  return (
    <form onSubmit={handleSubmit} noValidate dir={dir} className="max-w-5xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">{t('checkout.title')}</h1>

      <div className="grid lg:grid-cols-3 gap-8 items-start">
        {/* Customer info */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-4">
            <h2 className="text-base font-bold text-gray-900">{t('checkout.shippingInfo')}</h2>

            <div>
              <FieldLabel htmlFor="fullName">{t('checkout.fullName')}</FieldLabel>
              <TextInput
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                error={fieldErrors.fullName}
                placeholder={t('checkout.fullName')}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="phone">{t('checkout.phone')}</FieldLabel>
                <TextInput
                  id="phone"
                  dir="ltr"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  error={fieldErrors.phone}
                  placeholder="5xxxxxxx"
                />
              </div>
              <div>
                <FieldLabel htmlFor="email">{t('checkout.emailOptional')}</FieldLabel>
                <TextInput
                  id="email"
                  dir="ltr"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={fieldErrors.email}
                  placeholder="example@email.com"
                />
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="address">{t('checkout.address')}</FieldLabel>
              <TextInput
                id="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                error={fieldErrors.address}
                placeholder={t('checkout.addressPlaceholder')}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <FieldLabel htmlFor="city">{t('checkout.city')}</FieldLabel>
                <TextInput
                  id="city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  error={fieldErrors.city}
                  placeholder={t('checkout.city')}
                />
              </div>
              <div>
                <FieldLabel htmlFor="governorate">{t('checkout.governorate')}</FieldLabel>
                <select
                  id="governorate"
                  value={governorate}
                  onChange={(e) => setGovernorate(e.target.value)}
                  className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 bg-white ${
                    fieldErrors.governorate ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                  }`}
                >
                  <option value="">{t('checkout.chooseGovernorate')}</option>
                  {GOVERNORATES.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                {fieldErrors.governorate && (
                  <p className="text-xs text-red-500 mt-1">{fieldErrors.governorate}</p>
                )}
              </div>
            </div>

            <div>
              <FieldLabel htmlFor="notes">{t('checkout.notesOptional')}</FieldLabel>
              <textarea
                id="notes"
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('checkout.notesPlaceholder')}
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold resize-none"
              />
            </div>
          </div>
        </div>

        {/* Order summary */}
        <div className="bg-white border border-gray-100 rounded-2xl p-5 space-y-5 lg:sticky lg:top-6">
          <h2 className="text-base font-bold text-gray-900">{t('checkout.orderSummary')}</h2>

          {loadError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {isLoadingSummary ? (
            <div className="space-y-3">
              {[0, 1].map((i) => (
                <div key={i} className="flex gap-3">
                  <div className="w-14 h-16 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-3/4 rounded bg-gray-100 animate-pulse" />
                    <div className="h-3 w-1/2 rounded bg-gray-100 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pl-1 -mr-1">
              {okItems.map((item) => (
                <div key={item.key} className="flex gap-3">
                  <div className="w-14 h-16 rounded-lg overflow-hidden bg-gray-50 shrink-0">
                    {item.imageUrl && (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                    {(item.colorName || item.sizeName) && (
                      <p className="text-xs text-gray-500">
                        {[item.colorName, item.sizeName].filter(Boolean).join(' / ')}
                      </p>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-gray-500">
                        {item.quantity} × {formatKWD(item.unitPrice)}
                      </span>
                      <span className="text-sm font-bold text-gray-900">{formatKWD(item.lineTotal)}</span>
                    </div>
                  </div>
                </div>
              ))}

              {badItems.map((item) => (
                <div
                  key={item.key}
                  className="flex items-start gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5"
                >
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>
                    {item.name} — {getUnavailableMessages(t)[item.reason] || t('checkout.itemUnavailable')}
                    {item.reason === 'insufficient_stock' && item.availableStock != null && (
                      <> (المتاح: {item.availableStock})</>
                    )}
                  </span>
                </div>
              ))}

              {!hasVariantlessItem ? null : (
                <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                  <span>{t('checkout.itemNotReadyHint')}</span>
                </div>
              )}
            </div>
          )}

          {/* Discount code */}
          <div className="border-t border-gray-100 pt-4">
            {discount ? (
              <div className="flex items-center justify-between bg-brand-light rounded-xl px-3 py-2.5">
                <div className="flex items-center gap-2 text-sm text-gray-900">
                  <CheckCircle2 size={16} className="text-brand-gold shrink-0" />
                  <span className="font-medium">{discount.code}</span>
                  <span className="text-xs text-gray-500">{t('checkout.discountApplied')}</span>
                </div>
                <button
                  type="button"
                  onClick={handleRemoveDiscount}
                  className="text-gray-400 hover:text-red-500 transition-colors"
                  aria-label={t('checkout.removeDiscountCode')}
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Tag size={16} className={`absolute ${dir === 'rtl' ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-gray-400`} />
                    <input
                      type="text"
                      value={discountInput}
                      onChange={(e) => setDiscountInput(e.target.value)}
                      placeholder={t('checkout.discountCode')}
                      className={`w-full rounded-xl border border-gray-200 ${dir === 'rtl' ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 focus:border-brand-gold`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleApplyDiscount}
                    disabled={discountChecking || !discountInput.trim()}
                    className="shrink-0 bg-brand text-white rounded-xl px-4 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {discountChecking ? <Loader2 size={16} className="animate-spin" /> : t('checkout.apply')}
                  </button>
                </div>
                {discountError && <p className="text-xs text-red-500 mt-1.5">{discountError}</p>}
              </div>
            )}
          </div>

          {/* STAGE 18 — payment method */}
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <h3 className="text-sm font-bold text-gray-900 mb-1">{t('checkout.paymentMethod')}</h3>

            <label
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                paymentMethod === 'online' ? 'border-brand-gold bg-brand-light/40' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="online"
                checked={paymentMethod === 'online'}
                onChange={() => setPaymentMethod('online')}
                className="accent-brand-gold"
              />
              <CreditCard size={18} className="text-gray-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{t('checkout.onlinePayment')}</p>
                <p className="text-xs text-gray-500">KNET، فيزا/ماستركارد وطرق أخرى عبر MyFatoorah</p>
              </div>
            </label>

            <label
              className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors ${
                paymentMethod === 'cod' ? 'border-brand-gold bg-brand-light/40' : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="cod"
                checked={paymentMethod === 'cod'}
                onChange={() => setPaymentMethod('cod')}
                className="accent-brand-gold"
              />
              <Truck size={18} className="text-gray-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium text-gray-900">{t('checkout.cashOnDelivery')}</p>
              </div>
            </label>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-100 pt-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-gray-600">
              <span>{t('checkout.subtotal')}</span>
              <span className="text-gray-900">{formatKWD(subtotal)}</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex items-center justify-between text-brand-gold">
                <span>{t('checkout.discount')}</span>
                <span>- {formatKWD(discountAmount)}</span>
              </div>
            )}
            <div className="flex items-center justify-between text-gray-600">
              <span>{t('checkout.shipping')}</span>
              <span className="text-gray-900">{shippingCost > 0 ? formatKWD(shippingCost) : t('checkout.freeShipping')}</span>
            </div>
            {piecesToFreeShipping != null && (
              <p className="text-xs text-gray-400 -mt-1">
                {t('checkout.moreItemsForFreeShipping', {
                  count: piecesToFreeShipping,
                  unit: piecesToFreeShipping === 1 ? t('checkout.extraPieceSingular') : t('checkout.extraPiecePlural'),
                })}
              </p>
            )}
            {amountToFreeShipping != null && (
              <p className="text-xs text-gray-400 -mt-1">
                {t('checkout.moreAmountForFreeShipping', { amount: formatKWD(amountToFreeShipping) })}
              </p>
            )}
            <div className="flex items-center justify-between text-base font-bold text-gray-900 pt-2 border-t border-gray-100">
              <span>{t('checkout.total')}</span>
              <span>{formatKWD(total)}</span>
            </div>
          </div>

          {submitError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{submitError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full flex items-center justify-center gap-2 bg-brand text-white rounded-xl py-3 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('checkout.creatingOrder')}</span>
              </>
            ) : (
              <span>{paymentMethod === 'online' ? t('checkout.continueToPayment') : t('checkout.placeOrder')}</span>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}