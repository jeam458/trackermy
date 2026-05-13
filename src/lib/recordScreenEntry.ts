/** Query en `/dashboard/routes/record` para saltar el modal inicial y aplicar el modo elegido (p. ej. desde el FAB del nav). */
export const RECORD_SCREEN_ENTRY_QUERY = 'entry' as const

export type RecordScreenEntryValue = 'free' | 'new' | 'existing'

export function recordScreenPathWithEntry(mode: RecordScreenEntryValue): string {
  const qs = new URLSearchParams({ [RECORD_SCREEN_ENTRY_QUERY]: mode })
  return `/dashboard/routes/record?${qs.toString()}`
}
