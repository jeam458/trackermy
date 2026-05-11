import type { AppLocale } from './types'

export { es } from './es'
export { en } from './en'
export type { EsMessages } from './es'
export type { AppLocale, AppMessages } from './types'
export { getMessages } from './getMessages'
export { interpolate } from './interpolate'

/** Idioma por defecto de la app. */
export const defaultLocale: AppLocale = 'es'
