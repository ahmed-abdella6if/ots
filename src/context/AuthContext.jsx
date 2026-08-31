import { createContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

export const AuthContext = createContext(undefined)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return null
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, role, created_at')
      .eq('id', userId)
      .single()

    if (error) {
      console.error('Failed to fetch profile:', error.message)
      setProfile(null)
      return null
    }
    setProfile(data)
    return data
  }, [])

  useEffect(() => {
    let isMounted = true

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      setSession(session)
      if (session?.user?.id) {
        fetchProfile(session.user.id).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session)
        if (session?.user?.id) {
          fetchProfile(session.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [fetchProfile])

  const signInWithPassword = useCallback(async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // STAGE 30 FIX (v3) — v2's fix only guaranteed a fresh `isAdmin` value
    // for the *return value* of this function. It didn't guarantee the
    // context's own `session`/`user` state was updated yet — that still
    // depended entirely on the separate onAuthStateChange listener firing,
    // which can happen after LoginPage has already called navigate().
    // Result: ProtectedAdminRoute/ProtectedCustomerRoute can render with
    // `user` still null right after a successful login, bouncing back to
    // /login (or worse, compounding with whatever crashes on the way).
    // Setting session here, synchronously with this function's resolution,
    // means the caller's navigate() always lands on a route that already
    // sees the correct `user`. onAuthStateChange will still fire and call
    // setSession again with the same value — harmless, just redundant.
    setSession(data.session)
    // STAGE 28 FIX (v2) — the previous version of this fix (awaiting
    // fetchProfile before returning) was NOT actually sufficient: the
    // premature redirect wasn't caused by handleSubmit's own control
    // flow, it was caused by the separate onAuthStateChange listener
    // below firing setSession(session) as its own independent event —
    // often before this function even finishes — which re-renders
    // LoginPage with `user` already truthy while `profile` is still the
    // old (null) value, since that render is driven by React's own
    // scheduling, not by whether this async function has returned.
    // Waiting longer inside this function doesn't change when that other
    // state update happens.
    //
    // The actual fix: don't make the caller re-derive isAdmin from
    // reactive context state at all for this specific decision. Fetch the
    // profile here and RETURN it directly in this function's resolved
    // value, so the caller (LoginPage's handleSubmit) has a guaranteed
    // fresh, non-stale value it can act on immediately and imperatively —
    // no dependency on which of two independent renders happens first.
    let profileData = null
    if (data?.user?.id) {
      profileData = await fetchProfile(data.user.id)
    }
    return { ...data, profile: profileData, isAdmin: profileData?.role === 'admin' }
  }, [fetchProfile])

  const signUp = useCallback(async (email, password, extra = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: extra }, // e.g. { full_name, phone } -> raw_user_meta_data
    })
    if (error) throw error
    return data
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  const value = {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    signInWithPassword,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}