/**
 * Genera iconos PWA 512×512 desde la marca guardDh (`public/brand/guarddh-logo.jpg`),
 * la misma imagen que usa `BrandLogoLoader` en `/brand/guarddh-logo.jpg`.
 *
 * Requiere sharp (dependencia transitiva). Ejecutar: node scripts/generate-pwa-icons.mjs
 */
import { existsSync } from 'fs'
import sharp from 'sharp'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const logoPath = join(publicDir, 'brand', 'guarddh-logo.jpg')

const W = 512
const bg = '#121820' // alineado con --gdh-canvas-2 / manifest theme

if (!existsSync(logoPath)) {
  console.error(`No se encuentra el logo: ${logoPath}`)
  process.exit(1)
}

/**
 * Logo centrado sobre fondo slate (letterboxing si hace falta).
 * @param {number} innerMax - lado máximo del logo en px (zona segura menor en maskable).
 */
async function composeIcon(innerMax) {
  const logoBuf = await sharp(logoPath)
    .resize(innerMax, innerMax, { fit: 'inside', withoutEnlargement: false })
    .toBuffer()

  return sharp({
    create: { width: W, height: W, channels: 4, background: bg },
  }).composite([{ input: logoBuf, gravity: 'center' }])
}

/** purpose=any: logo un poco más grande para lectura en launcher. */
const roundedImg = await composeIcon(450)
await roundedImg.png().toFile(join(publicDir, 'icon512_rounded.png'))

/** purpose=maskable: más margen (~80% zona útil) para recortes circulares / squircle del SO. */
const maskableImg = await composeIcon(400)
await maskableImg.png().toFile(join(publicDir, 'icon512_maskable.png'))

console.log('OK: public/icon512_rounded.png, public/icon512_maskable.png (desde brand/guarddh-logo.jpg)')
