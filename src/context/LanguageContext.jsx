// STAGE 30 — Arabic / English language switching for the customer storefront.
//
// No translation library existed in this project (checked for react-i18next /
// i18next / any t() usage — none found), so this follows the stage brief's
// "simplest maintainable approach" instruction: a small context around the
// flat dictionary in i18n/translations.js.
//
// This only ever touches PRESENTATION:
//   - which string a key resolves to
//   - document.documentElement.dir / lang
//   - localStorage, under its OWN key (`store_language`) — never mixed with
//     cart_items:* (CartContext) or Supabase's own auth storage key.
// It does not touch pricing, totals, stock, or auth in any way.

import { createContext, useCallback, useEffect, useMemo, useState } from 'react'
import translations from '../i18n/translations'

export const LanguageContext = createContext(undefined)

const STORAGE_KEY = 'store_language'
const DEFAULT_LANGUAGE = 'ar' // the store's existing default — see main.jsx / MainLayout history (dir="rtl" hardcoded everywhere prior to this stage)
const SUPPORTED_LANGUAGES = ['ar', 'en']

function readStoredLanguage() {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return SUPPORTED_LANGUAGES.includes(stored) ? stored : DEFAULT_LANGUAGE
  } catch {
    return DEFAULT_LANGUAGE
  }
}

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(readStoredLanguage)

  const dir = language === 'ar' ? 'rtl' : 'ltr'

  // Keep <html dir="..." lang="..."> in sync so every element on the page —
  // not just the ones inside MainLayout — respects the current direction,
  // and so browser/assistive-tech behavior (text selection, form controls,
  // scrollbars) is correct too.
  useEffect(() => {
    document.documentElement.dir = dir
    document.documentElement.lang = language
  }, [dir, language])

  const setLanguage = useCallback((next) => {
    if (!SUPPORTED_LANGUAGES.includes(next)) return
    setLanguageState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage can fail (private browsing, quota) — the switch still
      // applies for the current session, it just won't persist a reload.
    }
  }, [])

  const toggleLanguage = useCallback(() => {
    setLanguage(language === 'ar' ? 'en' : 'ar')
  }, [language, setLanguage])

  /**
   * Looks up `key` in the translation dictionary and returns the string for
   * the current language. `vars` (optional) fills in `{placeholders}` in the
   * resolved string, e.g. t('home.onOrdersOverSuffix', { amount: '5 د.ك' }).
   * Falls back to the key itself if it's missing, so a missing translation
   * is visible/obvious in dev rather than silently blank.
   */
  const t = useCallback(
    (key, vars) => {
      const entry = translations[key]
      let str = entry ? (entry[language] ?? entry.ar ?? key) : key
      if (vars) {
        for (const [name, value] of Object.entries(vars)) {
          str = str.replace(`{${name}}`, value)
        }
      }
      return str
    },
    [language]
  )

  const value = useMemo(
    () => ({ language, dir, setLanguage, toggleLanguage, t }),
    [language, dir, setLanguage, toggleLanguage, t]
  )

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}
