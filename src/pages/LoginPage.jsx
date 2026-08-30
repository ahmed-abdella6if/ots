// Login page — uses the existing AuthContext (useAuth), no separate auth logic here.

import { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '../hooks/useAuth'

// Maps Supabase's technical auth errors to a friendly Arabic message.
// We never show the raw error text to the user.
function friendlyAuthError() {
  return 'البريد الالكتروني او كلمة المرور غير صحيحة'
}

export default function LoginPage() {
  const { user, isAdmin, loading, signInWithPassword } = useAuth()
  const location = useLocation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [authError, setAuthError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Still resolving the initial auth session — show a clean loading state,
  // don't flash the login form for users who are actually already logged in.
  if (loading) {
    return (
      <div dir="rtl" className="min-h-[70vh] flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span>...جاري التحميل</span>
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
    if (!email.trim()) errors.email = 'البريد الالكتروني مطلوب'
    if (!password) errors.password = 'كلمة المرور مطلوبة'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')

    if (!validate()) return

    setSubmitting(true)
    try {
      await signInWithPassword(email.trim(), password)
      // AuthContext session/profile state updates via onAuthStateChange;
      // the redirect above (user + isAdmin) handles navigation on re-render.
    } catch (err) {
      console.error('Login failed:', err?.message)
      setAuthError(friendlyAuthError())
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div dir="rtl" className="min-h-[80vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">تسجيل الدخول</h1>
          <p className="text-sm text-gray-500 mt-1">مرحبا بعودتك</p>
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
              البريد الالكتروني
            </label>
            <div className="relative">
              <Mail size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={`w-full rounded-xl border pr-10 pl-3 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
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
              كلمة المرور
            </label>
            <div className="relative">
              <Lock size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={`w-full rounded-xl border pr-10 pl-10 py-2.5 text-sm outline-none transition-colors focus:ring-2 focus:ring-brand-gold/40 ${
                  fieldErrors.password ? 'border-red-300' : 'border-gray-200 focus:border-brand-gold'
                }`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'اخفاء كلمة المرور' : 'اظهار كلمة المرور'}
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
                <span>...جاري تسجيل الدخول</span>
              </>
            ) : (
              <span>تسجيل الدخول</span>
            )}
          </button>
        </form>
      </div>
    </div>
  )
}
