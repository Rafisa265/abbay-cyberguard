import en from './locales/en.js'
import om from './locales/om.js'
import am from './locales/am.js'

export const LANGS = { en: 'English', om: 'Afaan Oromoo', am: 'አማርኛ' }
const DICTS = { en, om, am }
export const REVIEWED = { en: true, om: true, am: true }  // temporary translation-draft banners disabled

export function makeT(lang, onMissing = () => {}) {
  return (key) => {
    const v = DICTS[lang]?.[key]
    if (v) return v
    onMissing(lang, key)
    return en[key] ?? key
  }
}
export function initialLang() {
  try { const s = localStorage.getItem('lang'); if (s in LANGS) return s } catch { /* storage unavailable */ }
  const nav = (typeof navigator !== 'undefined' && navigator.language || 'en').slice(0, 2).toLowerCase()
  return nav in LANGS ? nav : 'en'
}
export function saveLang(l) { try { localStorage.setItem('lang', l) } catch { /* ignore */ } }
