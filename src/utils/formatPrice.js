// Currency/price formatting helper (Kuwaiti Dinar, Arabic-Kuwait store)
//
// STAGE 19: the store is Kuwait-based and prices are KWD everywhere.
// formatKWD() (added in Stage 18 for checkout/payment) is now the single
// formatter used across the entire site — homepage, category, product,
// cart, checkout, customer account, and admin. The EGP formatters that
// used to live in this file (formatPrice / formatPriceEGP) had no
// remaining call sites after the Stage 19 migration and were removed to
// avoid a stale/duplicate formatter being reused by mistake.

/**
 * Formats a numeric amount as a Kuwaiti Dinar price string, e.g. "12.500 د.ك"
 * (or "12.500 KD" when `language` is 'en'). KWD conventionally uses 3
 * decimal places (fils). `language` is optional and defaults to 'ar' so
 * every pre-existing call site (admin pages, which have no language
 * switcher) keeps showing the Arabic currency label unchanged.
 * @param {number|string|null|undefined} amount
 * @param {'ar'|'en'} [language='ar']
 * @returns {string}
 */
export function formatKWD(amount, language = 'ar') {
  const num = Number(amount)
  if (amount === null || amount === undefined || Number.isNaN(num)) return '—'

  const formatted = num.toLocaleString('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  })

  return `${formatted} ${language === 'en' ? 'KD' : 'د.ك'}`
}
