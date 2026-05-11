/**
 * Presets de música libre de regalías (atribución requerida según cada licencia).
 * URLs directas a MP3; el preview las mezcla en cliente; FFmpeg futuro puede muxear.
 *
 * Incompetech (Kevin MacLeod) — uso típico con crédito en la app / descripción del reel.
 */
export type ReelMusicPreset = {
  id: string
  label: string
  url: string
  attribution: string
}

export const REEL_MUSIC_PRESETS: ReelMusicPreset[] = [
  {
    id: 'monkeys',
    label: 'Monkeys Spinning Monkeys (Kevin MacLeod)',
    url: 'https://incompetech.com/music/royalty-free/mp3/royaltyfree/Monkeys%20Spinning%20Monkeys.mp3',
    attribution: 'Música: «Monkeys Spinning Monkeys» de Kevin MacLeod (incompetech.com), licencia Creative Commons BY 4.0.',
  },
  {
    id: 'upbeat',
    label: 'Upbeat Forever (Kevin MacLeod)',
    url: 'https://incompetech.com/music/royalty-free/mp3/royaltyfree/Upbeat%20Forever.mp3',
    attribution: 'Música: «Upbeat Forever» de Kevin MacLeod (incompetech.com), licencia Creative Commons BY 4.0.',
  },
  {
    id: 'wallpaper',
    label: 'Wallpaper (Kevin MacLeod)',
    url: 'https://incompetech.com/music/royalty-free/mp3/royaltyfree/Wallpaper.mp3',
    attribution: 'Música: «Wallpaper» de Kevin MacLeod (incompetech.com), licencia Creative Commons BY 4.0.',
  },
]
