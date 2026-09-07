// Form validation helpers (checkout fields, admin forms, etc.)

// STAGE 24 FIX — this was validating Egyptian mobile numbers
// (01[0125]xxxxxxxx, 11 digits) on a store that every prior stage brief
// explicitly states is Kuwait-based (KWD currency, MyFatoorah as the
// Kuwait-market gateway). A real Kuwaiti customer's phone number
// (8 digits, no leading 0, e.g. 5xxxxxxx / 6xxxxxxx / 9xxxxxxx) would
// have been rejected by checkout every single time — this was a genuine
// "customer cannot complete a real order" reliability bug, not a cosmetic
// one. Kuwait mobile numbers: 8 digits, first digit 5, 6, or 9. An
// optional +965/965 prefix is stripped before testing so a customer who
// includes their country code isn't punished for it.
// STAGE 28 — exported (was module-private) so RegisterPage.jsx can reuse
// the exact same Kuwait phone validation as checkout instead of
// duplicating the regex.
export const KUWAIT_PHONE_RE = /^[569][0-9]{7}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Strips spaces/dashes and an optional +965/965 prefix, same normalization
// validateCheckoutFields already applied inline — pulled out so
// RegisterPage.jsx can produce the identical cleaned value to store.
export function cleanPhone(phone) {
  return (phone || '').replace(/[\s-]/g, '').replace(/^(\+?965)/, '')
}

/**
 * Validates the Stage 15 checkout form fields against the columns that
 * actually exist on `orders` (customer_name, customer_phone, customer_email,
 * customer_address, customer_city, customer_governorate, order_notes).
 * customer_email is optional in the schema (nullable), so it's only
 * validated for format when the customer chooses to provide one.
 *
 * @param {{ fullName: string, phone: string, email?: string, address: string, city: string, governorate: string }} fields
 * @returns {Record<string, string>} a map of field -> Arabic error message (empty object = valid)
 */
export function validateCheckoutFields({ fullName, phone, email, address, city, governorate }) {
  const errors = {}

  if (!fullName || !fullName.trim()) {
    errors.fullName = 'الاسم الكامل مطلوب'
  } else if (fullName.trim().length < 3) {
    errors.fullName = 'الاسم الكامل قصير جدا'
  }

  const cleanedPhone = cleanPhone(phone)
  if (!cleanedPhone) {
    errors.phone = 'رقم الهاتف مطلوب'
  } else if (!KUWAIT_PHONE_RE.test(cleanedPhone)) {
    errors.phone = 'رقم الهاتف غير صحيح'
  }

  if (email && email.trim() && !EMAIL_RE.test(email.trim())) {
    errors.email = 'البريد الالكتروني غير صحيح'
  }

  if (!address || !address.trim()) {
    errors.address = 'العنوان مطلوب'
  }

  if (!city || !city.trim()) {
    errors.city = 'المنطقة مطلوبة'
  }

  if (!governorate || !governorate.trim()) {
    errors.governorate = 'المحافظة مطلوبة'
  }

  return errors
}