import { es } from './es'
import { en } from './en'
import type { AppLocale, AppMessages } from './types'

export function getMessages(locale: AppLocale): AppMessages {
  return locale === 'en' ? en : es
}
