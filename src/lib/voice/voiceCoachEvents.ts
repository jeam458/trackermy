export const GDH_VOICE_NAVIGATE_EVENT = 'gdh:voice_navigate' as const

export type GdhVoiceNavigateDetail = {
  path: string
  source: 'shortcut' | 'builtin'
}
