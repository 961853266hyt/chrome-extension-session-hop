import React from 'react'
import { createRoot } from 'react-dom/client'
import Options from './Options'
import { I18nProvider } from '@/lib/i18n'
import '@/styles/globals.css'

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider>
      <Options />
    </I18nProvider>
  </React.StrictMode>,
)
