// Admin — Store Settings: brand info, logo, contact info, social links,
// policies, default shipping cost, free-shipping rule (STAGE 21). Single
// form, single "حفظ التغييرات" action against the existing single-row
// store_settings table.
//
// Logo upload reuses the existing site-assets Storage bucket via
// storageService.js (uploadSiteAsset/deleteSiteAssetFile/
// getSiteAssetPathFromPublicUrl) — no new bucket, no duplicated upload logic.
// A newly picked logo is only staged locally (preview via object URL) and
// uploaded when the form is actually saved, matching the same deferred-
// upload pattern used in ProductForm.jsx. If the save succeeds and a logo
// was replaced or removed, the previous file is deleted from Storage so it
// doesn't become an orphan.

import { useEffect, useState } from 'react'
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  UploadCloud,
  X,
  ImageOff,
  Store,
  Phone,
  Share2,
  FileText,
  Truck,
} from 'lucide-react'
import { getStoreSettings, updateStoreSettings } from '../../services/settingsService'
import {
  uploadSiteAsset,
  deleteSiteAssetFile,
  getSiteAssetPathFromPublicUrl,
} from '../../services/storageService'

const MAX_LOGO_SIZE = 5 * 1024 * 1024 // 5MB
const ACCEPTED_LOGO_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function SectionCard({ icon: Icon, title, subtitle, children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
          <Icon size={17} className="text-brand" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900">{title}</h3>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}

function Field({ label, error, children }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

const inputClass = (hasError) =>
  `w-full rounded-xl border px-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
    hasError ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
  }`

export default function Settings() {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  // Form fields
  const [brandName, setBrandName] = useState('')
  const [aboutUs, setAboutUs] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [paymentPolicy, setPaymentPolicy] = useState('')
  const [paymentPolicyEn, setPaymentPolicyEn] = useState('')
  const [shippingPolicy, setShippingPolicy] = useState('')
  const [shippingPolicyEn, setShippingPolicyEn] = useState('')
  const [returnPolicy, setReturnPolicy] = useState('')
  const [returnPolicyEn, setReturnPolicyEn] = useState('')
  const [privacyPolicy, setPrivacyPolicy] = useState('')
  const [privacyPolicyEn, setPrivacyPolicyEn] = useState('')
  const [defaultShippingCost, setDefaultShippingCost] = useState('0')
  // STAGE 21 — free shipping rule
  const [freeShippingEnabled, setFreeShippingEnabled] = useState(false)
  const [freeShippingMinOrderAmount, setFreeShippingMinOrderAmount] = useState('0')

  // Logo state: currentLogoUrl reflects the last saved value; staged changes
  // (a new file, or a removal) are only applied to the DB on save.
  const [currentLogoUrl, setCurrentLogoUrl] = useState(null)
  const [stagedLogoFile, setStagedLogoFile] = useState(null)
  const [stagedLogoPreview, setStagedLogoPreview] = useState(null)
  const [logoRemoved, setLogoRemoved] = useState(false)
  const [logoError, setLogoError] = useState('')

  const [fieldErrors, setFieldErrors] = useState({})
  const [submitError, setSubmitError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let isMounted = true

    getStoreSettings()
      .then((settings) => {
        if (!isMounted || !settings) return
        setBrandName(settings.brandName || '')
        setAboutUs(settings.aboutUs || '')
        setContactEmail(settings.contactEmail || '')
        setContactPhone(settings.contactPhone || '')
        setWhatsappNumber(settings.whatsappNumber || '')
        setInstagramUrl(settings.socialLinks?.instagram || '')
        setFacebookUrl(settings.socialLinks?.facebook || '')
        setLinkedinUrl(settings.socialLinks?.linkedin || '')
        setPaymentPolicy(settings.paymentPolicy || '')
        setPaymentPolicyEn(settings.paymentPolicyEn || '')
        setShippingPolicy(settings.shippingPolicy || '')
        setShippingPolicyEn(settings.shippingPolicyEn || '')
        setReturnPolicy(settings.returnPolicy || '')
        setReturnPolicyEn(settings.returnPolicyEn || '')
        setPrivacyPolicy(settings.privacyPolicy || '')
        setPrivacyPolicyEn(settings.privacyPolicyEn || '')
        setDefaultShippingCost(
          settings.defaultShippingCost !== null && settings.defaultShippingCost !== undefined
            ? String(settings.defaultShippingCost)
            : '0'
        )
        setFreeShippingEnabled(Boolean(settings.freeShippingEnabled))
        setFreeShippingMinOrderAmount(
          settings.freeShippingMinOrderAmount !== null && settings.freeShippingMinOrderAmount !== undefined
            ? String(settings.freeShippingMinOrderAmount)
            : '0'
        )
        setCurrentLogoUrl(settings.logoUrl || null)
      })
      .catch((err) => {
        console.error('Failed to load store settings:', err.message)
        if (isMounted) setLoadError(true)
      })
      .finally(() => {
        if (isMounted) setLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!successMessage) return
    const timer = setTimeout(() => setSuccessMessage(''), 3500)
    return () => clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    return () => {
      if (stagedLogoPreview) URL.revokeObjectURL(stagedLogoPreview)
    }
  }, [stagedLogoPreview])

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!ACCEPTED_LOGO_TYPES.includes(file.type)) {
      setLogoError('نوع الملف غير مدعوم (JPG, PNG, WEBP فقط)')
      return
    }
    if (file.size > MAX_LOGO_SIZE) {
      setLogoError('حجم الملف اكبر من 5 ميجابايت')
      return
    }

    setLogoError('')
    if (stagedLogoPreview) URL.revokeObjectURL(stagedLogoPreview)
    setStagedLogoFile(file)
    setStagedLogoPreview(URL.createObjectURL(file))
    setLogoRemoved(false)
  }

  function handleRemoveLogo() {
    if (stagedLogoFile) {
      // Undo a not-yet-saved pick, back to whatever was already saved.
      URL.revokeObjectURL(stagedLogoPreview)
      setStagedLogoFile(null)
      setStagedLogoPreview(null)
      return
    }
    if (currentLogoUrl) {
      setLogoRemoved(true)
    }
  }

  function handleUndoRemoveLogo() {
    setLogoRemoved(false)
  }

  function isValidUrl(value) {
    if (!value.trim()) return true
    try {
      const url = new URL(value.trim())
      return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
      return false
    }
  }

  function validate() {
    const errors = {}

    if (!brandName.trim()) {
      errors.brandName = 'اسم البراند مطلوب'
    }

    if (contactEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      errors.contactEmail = 'البريد الالكتروني غير صحيح'
    }

    if (!isValidUrl(instagramUrl)) {
      errors.instagramUrl = 'الرابط غير صحيح'
    }
    if (!isValidUrl(facebookUrl)) {
      errors.facebookUrl = 'الرابط غير صحيح'
    }
    if (!isValidUrl(linkedinUrl)) {
      errors.linkedinUrl = 'الرابط غير صحيح'
    }

    if (
      defaultShippingCost.trim() &&
      (Number.isNaN(Number(defaultShippingCost)) || Number(defaultShippingCost) < 0)
    ) {
      errors.defaultShippingCost = 'تكلفة الشحن يجب ان تكون رقما صحيحا'
    }

    // STAGE 21 — validated regardless of whether the toggle is currently on,
    // so a value left in the field can't silently save as invalid data if
    // the admin re-enables the toggle later.
    if (
      freeShippingMinOrderAmount.trim() &&
      (Number.isNaN(Number(freeShippingMinOrderAmount)) || Number(freeShippingMinOrderAmount) < 0)
    ) {
      errors.freeShippingMinOrderAmount = 'الحد الادنى يجب ان يكون رقما صحيحا'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitError('')
    setSuccessMessage('')

    if (!validate()) return

    setSubmitting(true)

    let newLogoUrl = currentLogoUrl

    if (stagedLogoFile) {
      try {
        const { publicUrl } = await uploadSiteAsset('logo', stagedLogoFile)
        newLogoUrl = publicUrl
      } catch (err) {
        console.error('Failed to upload logo:', err.message)
        setSubmitError('تعذر رفع الشعار')
        setSubmitting(false)
        return
      }
    } else if (logoRemoved) {
      newLogoUrl = null
    }

    let saved
    try {
      saved = await updateStoreSettings({
        brandName,
        logoUrl: newLogoUrl,
        contactEmail,
        contactPhone,
        whatsappNumber,
        socialLinks: {
          instagram: instagramUrl.trim() || undefined,
          facebook: facebookUrl.trim() || undefined,
          linkedin: linkedinUrl.trim() || undefined,
        },
        paymentPolicy,
        paymentPolicyEn,
        shippingPolicy,
        shippingPolicyEn,
        returnPolicy,
        returnPolicyEn,
        privacyPolicy,
        privacyPolicyEn,
        aboutUs,
        defaultShippingCost: defaultShippingCost.trim() ? Number(defaultShippingCost) : 0,
        freeShippingEnabled,
        freeShippingMinOrderAmount: freeShippingMinOrderAmount.trim() ? Number(freeShippingMinOrderAmount) : 0,
      })
    } catch (err) {
      console.error('Failed to save settings:', err.message)
      setSubmitError('تعذر حفظ الاعدادات')
      setSubmitting(false)
      return
    }

    // Save succeeded — clean up the old logo file if it was replaced/removed.
    if ((stagedLogoFile || logoRemoved) && currentLogoUrl && currentLogoUrl !== newLogoUrl) {
      const oldPath = getSiteAssetPathFromPublicUrl(currentLogoUrl)
      deleteSiteAssetFile(oldPath).catch((err) => {
        console.error('Failed to delete previous logo file:', err.message)
      })
    }

    if (stagedLogoPreview) URL.revokeObjectURL(stagedLogoPreview)
    setStagedLogoFile(null)
    setStagedLogoPreview(null)
    setLogoRemoved(false)
    setCurrentLogoUrl(saved.logoUrl)
    setInstagramUrl(saved.socialLinks?.instagram || '')
    setFacebookUrl(saved.socialLinks?.facebook || '')
    setLinkedinUrl(saved.socialLinks?.linkedin || '')
    setFreeShippingEnabled(Boolean(saved.freeShippingEnabled))
    setFreeShippingMinOrderAmount(
      saved.freeShippingMinOrderAmount !== null && saved.freeShippingMinOrderAmount !== undefined
        ? String(saved.freeShippingMinOrderAmount)
        : '0'
    )

    setSuccessMessage('تم حفظ الاعدادات بنجاح')
    setSubmitting(false)
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-6 w-40 rounded bg-gray-100 animate-pulse" />
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-gray-100 animate-pulse" />
        ))}
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-red-500 py-10 text-center">تعذر تحميل الاعدادات</p>
      </div>
    )
  }

  const showLogo = stagedLogoPreview || (!logoRemoved && currentLogoUrl)

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-gray-900">اعدادات المتجر</h2>
        <p className="text-sm text-gray-500 mt-1">
          ادارة معلومات البراند وبيانات التواصل والسياسات
        </p>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {submitError && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
            <AlertCircle size={16} className="shrink-0" />
            <span>{submitError}</span>
          </div>
        )}

        {successMessage && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2.5">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {/* معلومات البراند */}
        <SectionCard icon={Store} title="معلومات البراند">
          <Field label="اسم البراند" error={fieldErrors.brandName}>
            <input
              type="text"
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className={inputClass(fieldErrors.brandName)}
              placeholder="اسم المتجر"
            />
          </Field>

          <Field label="من نحن">
            <textarea
              value={aboutUs}
              onChange={(e) => setAboutUs(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
              placeholder="نبذة مختصرة عن المتجر"
            />
          </Field>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">الشعار (Logo)</label>
            {logoError && <p className="text-xs text-red-500 mb-2">{logoError}</p>}

            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                {showLogo ? (
                  <img
                    src={stagedLogoPreview || currentLogoUrl}
                    alt="الشعار"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageOff size={22} className="text-gray-300" />
                )}
              </div>

              <div className="space-y-2">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleLogoChange}
                  disabled={submitting}
                  className="hidden"
                  id="logo-upload-input"
                />
                <label
                  htmlFor="logo-upload-input"
                  className={`inline-flex items-center gap-1.5 text-xs font-medium text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors ${
                    submitting ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                  }`}
                >
                  <UploadCloud size={13} />
                  <span>{showLogo ? 'استبدال الشعار' : 'رفع شعار'}</span>
                </label>

                {showLogo && (
                  <button
                    type="button"
                    onClick={handleRemoveLogo}
                    disabled={submitting}
                    className="flex items-center gap-1.5 text-xs font-medium text-red-500 hover:text-red-600 disabled:opacity-40 transition-colors"
                  >
                    <X size={13} />
                    <span>ازالة الشعار</span>
                  </button>
                )}

                {logoRemoved && !stagedLogoFile && (
                  <button
                    type="button"
                    onClick={handleUndoRemoveLogo}
                    disabled={submitting}
                    className="block text-xs font-medium text-gray-500 hover:text-gray-700"
                  >
                    التراجع عن الازالة
                  </button>
                )}

                <p className="text-xs text-gray-400">JPG, PNG, WEBP — حتى 5 ميجابايت</p>
              </div>
            </div>
          </div>
        </SectionCard>

        {/* بيانات التواصل */}
        <SectionCard icon={Phone} title="بيانات التواصل">
          <Field label="البريد الالكتروني" error={fieldErrors.contactEmail}>
            <input
              type="email"
              dir="ltr"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              className={inputClass(fieldErrors.contactEmail)}
              placeholder="example@store.com"
            />
          </Field>

          <Field label="رقم الهاتف">
            <input
              type="tel"
              dir="ltr"
              value={contactPhone}
              onChange={(e) => setContactPhone(e.target.value)}
              className={inputClass(false)}
              placeholder="+20 100 000 0000"
            />
          </Field>

          <Field label="رقم واتساب">
            <input
              type="tel"
              dir="ltr"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              className={inputClass(false)}
              placeholder="+20 100 000 0000"
            />
          </Field>
        </SectionCard>

        {/* روابط التواصل الاجتماعي */}
        <SectionCard icon={Share2} title="روابط التواصل الاجتماعي">
          <Field label="رابط انستغرام" error={fieldErrors.instagramUrl}>
            <input
              type="text"
              dir="ltr"
              value={instagramUrl}
              onChange={(e) => setInstagramUrl(e.target.value)}
              className={inputClass(fieldErrors.instagramUrl)}
              placeholder="https://instagram.com/yourstore"
            />
          </Field>

          <Field label="رابط فيسبوك" error={fieldErrors.facebookUrl}>
            <input
              type="text"
              dir="ltr"
              value={facebookUrl}
              onChange={(e) => setFacebookUrl(e.target.value)}
              className={inputClass(fieldErrors.facebookUrl)}
              placeholder="https://facebook.com/yourstore"
            />
          </Field>

          <Field label="رابط لينكدإن" error={fieldErrors.linkedinUrl}>
            <input
              type="text"
              dir="ltr"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className={inputClass(fieldErrors.linkedinUrl)}
              placeholder="https://linkedin.com/company/yourstore"
            />
          </Field>
        </SectionCard>

        {/* سياسات المتجر */}
        <SectionCard
          icon={FileText}
          title="سياسات المتجر"
          subtitle="النص الانجليزي اختياري — اذا تُرك فارغا يظهر النص العربي للعميل حتى في وضع اللغة الانجليزية"
        >
          <Field label="سياسة الدفع">
            <textarea
              value={paymentPolicy}
              onChange={(e) => setPaymentPolicy(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>
          <Field label="سياسة الدفع بالانجليزية (اختياري)">
            <textarea
              dir="ltr"
              value={paymentPolicyEn}
              onChange={(e) => setPaymentPolicyEn(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>

          <Field label="سياسة الشحن">
            <textarea
              value={shippingPolicy}
              onChange={(e) => setShippingPolicy(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>
          <Field label="سياسة الشحن بالانجليزية (اختياري)">
            <textarea
              dir="ltr"
              value={shippingPolicyEn}
              onChange={(e) => setShippingPolicyEn(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>

          <Field label="سياسة الاستبدال والاسترجاع">
            <textarea
              value={returnPolicy}
              onChange={(e) => setReturnPolicy(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>
          <Field label="سياسة الاستبدال والاسترجاع بالانجليزية (اختياري)">
            <textarea
              dir="ltr"
              value={returnPolicyEn}
              onChange={(e) => setReturnPolicyEn(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>

          <Field label="سياسة الخصوصية">
            <textarea
              value={privacyPolicy}
              onChange={(e) => setPrivacyPolicy(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>
          <Field label="سياسة الخصوصية بالانجليزية (اختياري)">
            <textarea
              dir="ltr"
              value={privacyPolicyEn}
              onChange={(e) => setPrivacyPolicyEn(e.target.value)}
              rows={4}
              className={inputClass(false) + ' resize-none'}
            />
          </Field>
        </SectionCard>

        {/* الشحن */}
        <SectionCard icon={Truck} title="الشحن">
          <Field label="تكلفة الشحن الافتراضية (د.ك)" error={fieldErrors.defaultShippingCost}>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={defaultShippingCost}
              onChange={(e) => setDefaultShippingCost(e.target.value)}
              className={inputClass(fieldErrors.defaultShippingCost)}
              placeholder="0"
            />
          </Field>

          {/* STAGE 21 — free shipping rule */}
          <div className="border-t border-gray-100 pt-4">
            <p className="text-sm font-medium text-gray-700 mb-3">الشحن المجاني</p>

            <label className="flex items-center gap-2.5 cursor-pointer mb-4">
              <input
                type="checkbox"
                checked={freeShippingEnabled}
                onChange={(e) => setFreeShippingEnabled(e.target.checked)}
                className="w-4 h-4 rounded accent-brand-gold"
              />
              <span className="text-sm text-gray-700">تفعيل الشحن المجاني</span>
            </label>

            {freeShippingEnabled && (
              <Field
                label="الحد الادنى للشحن المجاني (د.ك)"
                error={fieldErrors.freeShippingMinOrderAmount}
              >
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.01"
                  value={freeShippingMinOrderAmount}
                  onChange={(e) => setFreeShippingMinOrderAmount(e.target.value)}
                  className={inputClass(fieldErrors.freeShippingMinOrderAmount)}
                  placeholder="25.000"
                />
                <p className="text-xs text-gray-400 mt-1">
                  الطلبات التي يبلغ اجمالي منتجاتها (قبل الخصم) هذا الحد او اكثر تحصل على شحن مجاني
                </p>
              </Field>
            )}
          </div>
        </SectionCard>

        {/* Actions */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-brand text-white rounded-xl px-6 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>...جاري الحفظ</span>
              </>
            ) : (
              <span>حفظ التغييرات</span>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}