/**
 * Genera un PNG pequeño (cuadrado, recorte central) para usar como icono en mapas.
 * En APK estático no hay API route: el recorte IA tipo “Nano Banana” / remove.bg
 * puede añadirse en un backend aparte; aquí el recorte es local y liviano.
 */
/** Tamaño del archivo de perfil / vista previa (más grande). */
export const MAP_ICON_PROFILE_SIZE = 96
/** Icono mínimo para Leaflet / mapas. */
export const MAP_ICON_MAP_SIZE = 48

const DEFAULT_SIZE = MAP_ICON_PROFILE_SIZE

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('No se pudo cargar la imagen'))
    }
    img.src = url
  })
}

export async function createSquareMapIconPng(file: File, size = DEFAULT_SIZE): Promise<Blob> {
  const img = await loadImageFromFile(file)
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas no disponible')

  const sw = Math.min(img.naturalWidth, img.naturalHeight)
  const sx = (img.naturalWidth - sw) / 2
  const sy = (img.naturalHeight - sw) / 2
  ctx.drawImage(img, sx, sy, sw, sw, 0, 0, size, size)

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b)
        else reject(new Error('toBlob falló'))
      },
      'image/png',
      0.92
    )
  })
}
