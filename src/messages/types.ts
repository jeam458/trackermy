import type { es } from './es'
import type { WidenMessageStrings } from './widen'

export type AppLocale = 'es' | 'en'

/** Forma de todos los mensajes de UI (ES o EN), con hojas `string`. */
export type AppMessages = WidenMessageStrings<typeof es>
