export const DEFAULT_RECORDING_ACCENT = '#e37845'

export function hexToRgba(hex: string, alpha: number): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim())
  if (!m) return `rgba(148, 163, 184, ${alpha})`
  return `rgba(${parseInt(m[1], 16)}, ${parseInt(m[2], 16)}, ${parseInt(m[3], 16)}, ${alpha})`
}

export function normalizeRecordingAccent(
  hex: string | null | undefined,
  fallback: string,
): string {
  if (hex && /^#[0-9A-Fa-f]{6}$/.test(hex.trim())) return hex.trim()
  return fallback
}
