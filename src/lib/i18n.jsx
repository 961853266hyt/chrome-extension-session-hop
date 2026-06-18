import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  DEFAULT_LANGUAGE,
  LANGUAGES,
  LANGUAGE_STORAGE_KEY,
  messages,
} from './messages'

const I18nContext = createContext(null)

function getByPath(source, path) {
  return path.split('.').reduce((value, key) => value?.[key], source)
}

function interpolate(template, params) {
  if (!params) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => String(params[key] ?? ''))
}

function normalizeLanguage(language) {
  if (!language) return null
  const normalized = language.replace('_', '-')
  if (normalized.toLowerCase().startsWith('zh')) return 'zh-CN'
  if (normalized.toLowerCase().startsWith('en')) return 'en'
  return null
}

function detectLanguage() {
  const chromeLanguage = normalizeLanguage(globalThis.chrome?.i18n?.getUILanguage?.())
  if (chromeLanguage) return chromeLanguage
  return normalizeLanguage(navigator.language) ?? DEFAULT_LANGUAGE
}

async function readStoredLanguage() {
  try {
    if (globalThis.chrome?.storage?.local?.get) {
      const data = await globalThis.chrome.storage.local.get(LANGUAGE_STORAGE_KEY)
      const language = normalizeLanguage(data?.[LANGUAGE_STORAGE_KEY])
      if (language) return language
    }
  } catch {
    const localValue = normalizeLanguage(localStorage.getItem(LANGUAGE_STORAGE_KEY))
    if (localValue) return localValue
  }
  return detectLanguage()
}

async function persistLanguage(language) {
  try {
    if (globalThis.chrome?.storage?.local?.set) {
      await globalThis.chrome.storage.local.set({ [LANGUAGE_STORAGE_KEY]: language })
      return
    }
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  } catch {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, language)
  }
}

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE)

  useEffect(() => {
    let alive = true
    readStoredLanguage().then((storedLanguage) => {
      if (alive) setLanguageState(storedLanguage)
    })
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback(async (nextLanguage) => {
    const normalized = normalizeLanguage(nextLanguage)
    if (!normalized || !LANGUAGES.includes(normalized)) return
    setLanguageState(normalized)
    await persistLanguage(normalized)
  }, [])

  const t = useCallback(
    (key, params) => {
      const template =
        getByPath(messages[language], key) ??
        getByPath(messages[DEFAULT_LANGUAGE], key) ??
        key
      return interpolate(template, params)
    },
    [language],
  )

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const value = useContext(I18nContext)
  if (!value) throw new Error('useI18n must be used within I18nProvider')
  return value
}
