#!/usr/bin/env node
/**
 * Gera os PNGs do PWA a partir de um SVG.
 * O apple-touch-icon precisa ser PNG: o iOS ignora SVG ali.
 *
 *   node scripts/make-icons.mjs
 */
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const PUBLIC = join(ROOT, 'public')

const TERRA = '#B4522F'
const SAND = '#FBF7F2'

/** Marca: um pino sobre o mar, em terracota. */
const glyph = (bg, inset = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="${bg === TERRA ? 0 : 112}" fill="${bg}"/>
  <g transform="translate(${inset}, ${inset}) scale(${(512 - inset * 2) / 512})">
    <path d="M256 108c-53 0-96 43-96 96 0 68 96 164 96 164s96-96 96-164c0-53-43-96-96-96Z"
          fill="none" stroke="${bg === TERRA ? SAND : TERRA}" stroke-width="30"
          stroke-linejoin="round"/>
    <circle cx="256" cy="202" r="34" fill="${bg === TERRA ? SAND : TERRA}"/>
    <path d="M96 418c22 18 44 30 80 30s58-30 80-30 44 30 80 30 58-12 80-30"
          fill="none" stroke="${bg === TERRA ? SAND : TERRA}" stroke-width="26"
          stroke-linecap="round" opacity="0.85"/>
  </g>
</svg>`

const targets = [
  { file: 'icon-192.png', size: 192, svg: glyph(SAND) },
  { file: 'icon-512.png', size: 512, svg: glyph(SAND) },
  // maskable: fundo cheio ate a borda, conteudo dentro da zona segura
  { file: 'icon-maskable-512.png', size: 512, svg: glyph(TERRA, 64) },
  { file: 'apple-touch-icon.png', size: 180, svg: glyph(SAND) },
]

for (const { file, size, svg } of targets) {
  const png = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  writeFileSync(join(PUBLIC, file), png)
  console.log(`  ok ${file} (${size}x${size})`)
}

writeFileSync(join(PUBLIC, 'favicon.svg'), glyph(SAND).trim() + '\n', 'utf8')
console.log('  ok favicon.svg')
