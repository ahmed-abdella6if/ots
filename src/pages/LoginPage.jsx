// Login page — uses the existing AuthContext (useAuth), no separate auth logic here.

import { useState } from 'react'
import { Navigate, Link, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'
import { useLanguage } from '../hooks/useLanguage'

export default function LoginPage() {
  const { user, isAdmin, loading, signInWithPassword } = useAuth()
  const { t, dir } = useLanguage()
  const location = useLocation()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // STAGE 30 — this page renders standalone (not nested in MainLayout), so
  // it previously hardcoded dir="rtl" itself; it now follows the active
  // language like every other page.
  const iconSideClass = dir === 'rtl' ? 'right-3' : 'left-3'
  const toggleSideClass = dir === 'rtl' ? 'left-3' : 'right-3'
  const inputPaddingClass = dir === 'rtl' ? 'pr-10 pl-3' : 'pl-10 pr-3'
  const passwordPaddingClass = dir === 'rtl' ? 'pr-10 pl-10' : 'pl-10 pr-10'

  // Still resolving the initial auth session — show a clean loading state,
  // don't flash the login form for users who are actually already logged in.
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

  // Already authenticated — redirect instead of showing the form again.
  if (user) {
    const redirectTo = isAdmin ? '/admin' : location.state?.from?.pathname || '/'
    return <Navigate to={redirectTo} replace />
  }

  function validate() {
    const errors = {}
    if (!email.trim()) errors.email = t('auth.emailRequired')
    if (!password) errors.password = t('auth.passwordRequired')
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')

    if (!validate()) return

    setSubmitting(true)
    try {
      // STAGE 28 FIX (v2) — navigate imperatively using the fresh
      // `isAdmin` value returned directly from signInWithPassword, not
      // by relying on this component re-rendering with updated context
      // state (see AuthContext.jsx for why that was still racy even
      // after awaiting the profile fetch inside signInWithPassword).
      const result = await signInWithPassword(email.trim(), password)
      const redirectTo = result.isAdmin ? '/admin' : location.state?.from?.pathname || '/'
      navigate(redirectTo, { replace: true })
    } catch (err) {
      console.error('Login failed:', err?.message)
      // Never show the raw Supabase error text to the user.
      setAuthError(t('auth.invalidCredentials'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div dir={dir} className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">{t('auth.login')}</h1>
          <p className="text-sm text-gray-500 mt-1">{t('auth.welcomeBack')}</p>
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
            {fieldErrors.email && (
              <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>
            )}
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
                autoComplete="current-password"
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

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-brand text-white rounded-xl py-2.5 text-sm font-medium transition-opacity hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>{t('auth.loggingIn')}</span>
              </>
            ) : (
              <span>{t('auth.login')}</span>
            )}
          </button>

          <p className="text-center text-sm text-gray-500">
            {t('auth.noAccount')}{' '}
            <Link to="/register" className="text-brand font-medium hover:opacity-80">
              {t('auth.register')}
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
