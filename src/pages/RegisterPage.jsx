// Registration page (Stage 28) — uses the existing AuthContext (useAuth),
// same as LoginPage.jsx. No separate/custom auth or password system here:
// this is Supabase Auth's own signUp(), which already fires
// handle_new_user() (see supabase/schema.sql) to auto-create the matching
// `profiles` row with the default role ('customer') — no admin
// impersonation path exists through this page.
//
// Collects Full Name and Phone in addition to Email/Password — both are
// passed as signUp()'s `extra` (-> raw_user_meta_data), which
// handle_new_user() already reads into profiles.full_name/profiles.phone
// (this wiring already existed; it just wasn't being fed anything from
// this page before). CheckoutPage.jsx already prefills fullName/phone
// from profile.full_name/profile.phone (see its own effect near the top),
// so a customer who fills these in at registration gets them
// automatically pre-filled at checkout with no further change needed
// there.
//
// Email confirmation: this page does NOT assume whether the project's
// Supabase Auth "Confirm email" setting is on or off — it branches on
// whatever signUp() actually returns. If `data.session` comes back
// populated, the customer is already authenticated (Supabase confirmed
// email is OFF, or it auto-confirmed) and we let AuthContext's normal
// session/redirect handling take over, same as after a normal login. If
// `data.session` is null (confirmation required), we show the "check your
// email" message and never treat them as logged in.

import { useState } from 'react'
import { Navigate, Link, useLocation } from 'react-router-dom'
import { Mail, Lock, User, Phone, Eye, EyeOff, Loader2, AlertCircle, MailCheck } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'
import { KUWAIT_PHONE_RE, cleanPhone } from '../utils/validators'

const MIN_PASSWORD_LENGTH = 6

export default function RegisterPage() {
  const { user, isAdmin, loading, signUp } = useAuth()
  const { t, dir } = useLanguage()
  const location = useLocation()

  // Maps Supabase's technical signUp errors to a friendly translated
  // message. Never show the raw error text to the customer.
  function friendlySignUpError(err) {
    const msg = (err?.message || '').toLowerCase()
    if (msg.includes('already registered') || msg.includes('already exists') || err?.code === 'user_already_exists') {
      return t('auth.emailAlreadyRegistered')
    }
    if (msg.includes('password')) {
      return t('auth.weakPassword', { min: MIN_PASSWORD_LENGTH })
    }
    if (msg.includes('email') || msg.includes('invalid')) {
      return t('auth.emailInvalid')
    }
    return t('auth.signUpGenericError')
  }

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Shown after a successful signUp() that did NOT return an active
  // session — i.e. email confirmation is genuinely required. Once true,
  // the form is replaced entirely by the confirmation message below.
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false)

  // STAGE 30 — this page renders standalone (not nested in MainLayout), so
  // it previously hardcoded dir="rtl" itself; it now follows the active
  // language like every other page.
  const iconSideClass = dir === 'rtl' ? 'right-3' : 'left-3'
  const toggleSideClass = dir === 'rtl' ? 'left-3' : 'right-3'
  const inputPaddingClass = dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'
  const passwordPaddingClass = dir === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'

  // Still resolving the initial auth session.
  if (loading) {
    return (
      <div dir={dir} className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span>{t('auth.loading')}</span>
        </div>
      </div>
    )
  }

  // Already authenticated (e.g. confirmation was off and signUp logged
  // them in, or they simply already had a session) — redirect, same
  // logic as LoginPage.
  if (user && !awaitingConfirmation) {
    const redirectTo = isAdmin ? '/admin' : location.state?.from?.pathname || '/'
    return <Navigate to={redirectTo} replace />
  }

  function validate() {
    const errors = {}
    if (!fullName.trim()) {
      errors.fullName = t('auth.fullNameRequired')
    } else if (fullName.trim().length < 3) {
      errors.fullName = t('auth.fullNameTooShort')
    }
    const cleanedPhone = cleanPhone(phone)
    if (!cleanedPhone) {
      errors.phone = t('auth.phoneRequired')
    } else if (!KUWAIT_PHONE_RE.test(cleanedPhone)) {
      errors.phone = t('auth.phoneInvalid')
    }
    if (!email.trim()) {
      errors.email = t('auth.emailRequired')
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      errors.email = t('auth.emailInvalid')
    }
    if (!password) {
      errors.password = t('auth.passwordRequired')
    } else if (password.length < MIN_PASSWORD_LENGTH) {
      errors.password = t('auth.passwordTooShort', { min: MIN_PASSWORD_LENGTH })
    }
    if (!confirmPassword) {
      errors.confirmPassword = t('auth.confirmPasswordRequired')
    } else if (password && confirmPassword !== password) {
      errors.confirmPassword = t('auth.passwordsDoNotMatch')
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')

    if (!validate()) return

    setSubmitting(true)
    try {
      const data = await signUp(email.trim(), password, {
        full_name: fullName.trim(),
        phone: cleanPhone(phone),
      })
      if (data?.session) {
        // Confirmation is off (or auto-confirmed) — AuthContext already
        // has the session; the redirect above handles navigation on
        // re-render. Nothing else to do here.
      } else {
        setAwaitingConfirmation(true)
      }
    } catch (err) {
      console.error('Registration failed:', err?.message)
      setAuthError(friendlySignUpError(err))
    } finally {
      setSubmitting(false)
    }
  }

  if (awaitingConfirmation) {
    return (
      <div dir={dir} className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm text-center">
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8 space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-green-50 flex items-center justify-center">
              <MailCheck size={24} className="text-green-600" />
            </div>
            <h1 className="text-lg font-bold text-gray-900">{t('auth.accountCreated')}</h1>
            <p className="text-sm text-gray-500">
              {t('auth.confirmEmailHint')}
            </p>
            <Link
              to="/login"
              className="inline-block w-full bg-brand text-white rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
            >
              {t('auth.goToLogin')}
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div dir={dir} className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.register')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('auth.joinAndShop')}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white border border-gray-100 rounded-2xl shadow-sm p-6 space-y-4"
        >
          {authError && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
              <AlertCircle size={16} className="shrink-0" />
              <span>{authError}</span>
            </div>
          )}

          {/* Full name */}
          <div>
            <label htmlFor="fullName" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('auth.fullName')}
            </label>
            <div className="relative">
              <User size={18} className={`absolute ${iconSideClass} top-1/2 -translate-y-1/2 text-gray-400`} />
              <input
                id="fullName"
                type="text"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={`w-full rounded-xl border ${inputPaddingClass} py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.fullName ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
                placeholder={t('auth.fullName')}
              />
            </div>
            {fieldErrors.fullName && <p className="text-xs text-red-500 mt-1">{fieldErrors.fullName}</p>}
          </div>

          {/* Phone */}
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('auth.phone')}
            </label>
            <div className="relative">
              <Phone size={18} className={`absolute ${iconSideClass} top-1/2 -translate-y-1/2 text-gray-400`} />
              <input
                id="phone"
                type="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={`w-full rounded-xl border ${inputPaddingClass} py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.phone ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
                placeholder="5xxxxxxx"
              />
            </div>
            {fieldErrors.phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.phone}</p>}
          </div>

          {/* Email */}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('auth.email')}
            </label>
            <div className="relative">
              <Mail size={18} className={`absolute ${iconSideClass} top-1/2 -translate-y-1/2 text-gray-400`} />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl border ${inputPaddingClass} py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.email ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
                placeholder="example@email.com"
              />
            </div>
            {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
          </div>

          {/* Password */}
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('auth.password')}
            </label>
            <div className="relative">
              <Lock size={18} className={`absolute ${iconSideClass} top-1/2 -translate-y-1/2 text-gray-400`} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-xl border ${passwordPaddingClass} py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.password ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className={`absolute ${toggleSideClass} top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600`}
                aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            {fieldErrors.password && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.password}</p>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1.5">
              {t('auth.confirmPassword')}
            </label>
            <div className="relative">
              <Lock size={18} className={`absolute ${iconSideClass} top-1/2 -translate-y-1/2 text-gray-400`} />
              <input
                id="confirmPassword"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className={`w-full rounded-xl border ${inputPaddingClass} py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.confirmPassword ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
                placeholder="••••••••"
              />
            </div>
            {fieldErrors.confirmPassword && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.confirmPassword}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-brand text-white rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('auth.registering')}</span>
              </>
            ) : (
              <span>{t('auth.register')}</span>
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            {t('auth.haveAccount')}{' '}
            <Link to="/login" className="text-brand font-medium hover:opacity-80">
              {t('auth.login')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
