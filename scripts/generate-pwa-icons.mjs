// Run once locally to generate the PWA icon set in public/icons/.
//   node scripts/generate-pwa-icons.mjs
// Uses sharp (already pulled in transitively by Next.js) to rasterize the
// inline SVG below at every size the manifest references.

import sharp from 'sharp'
import fs from 'node:fs/promises'
import path from 'node:path'

const SVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <!-- Crimson rose background -->
  <rect width="512" height="512" fill="#C41E3A"/>
  <!-- Subtle inner ring for depth -->
  <circle cx="256" cy="248" r="200" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="2"/>
  <!-- Horseshoe (opening down) -->
  <g fill="#FFFFFF">
    <path fill-rule="evenodd"
          d="M 100 160 Q 100 100 180 100 L 332 100 Q 412 100 412 160 L 412 320 Q 412 412 256 412 Q 100 412 100 320 Z
             M 170 175 Q 170 145 200 145 L 312 145 Q 342 145 342 175 L 342 308 Q 342 348 256 348 Q 170 348 170 308 Z"/>
    <!-- Nail dots — three per side -->
    <circle cx="135" cy="220" r="9"/>
    <circle cx="135" cy="270" r="9"/>
    <circle cx="135" cy="320" r="9"/>
    <circle cx="377" cy="220" r="9"/>
    <circle cx="377" cy="270" r="9"/>
    <circle cx="377" cy="320" r="9"/>
  </g>
  <!-- Gold accent bar at the base — matches the Watch Party mark motif -->
  <rect x="0" y="464" width="512" height="48" fill="#E8A020"/>
</svg>`

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512]
const OUT_DIR = path.join(process.cwd(), 'public', 'icons')

await fs.mkdir(OUT_DIR, { recursive: true })

for (const size of SIZES) {
  const out = path.join(OUT_DIR, `icon-${size}x${size}.png`)
  await sharp(Buffer.from(SVG))
    .resize(size, size, { fit: 'contain', background: { r: 196, g: 30, b: 58, alpha: 1 } })
    .png({ compressionLevel: 9 })
    .toFile(out)
  console.log(`  wrote ${path.relative(process.cwd(), out)}`)
}

console.log(`\n✓ Generated ${SIZES.length} icons in ${path.relative(process.cwd(), OUT_DIR)}/`)
