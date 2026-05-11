/**
 * Sustituye `{clave}` en una plantilla por valores de `vars`.
 * Útil para mantener copy en un solo archivo sin concatenar en cada pantalla.
 */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key]
    return v === undefined || v === null ? `{${key}}` : String(v)
  })
}
