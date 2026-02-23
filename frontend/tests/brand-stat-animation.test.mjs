import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const FRONTEND_DIR = resolve(TEST_DIR, '..')
const appSource = readFileSync(resolve(FRONTEND_DIR, 'src/App.jsx'), 'utf8')
const stylesSource = readFileSync(resolve(FRONTEND_DIR, 'src/styles.css'), 'utf8')

test('Clarify stat card uses dedicated animated text markup', () => {
  assert.match(appSource, /className="stat-card brand-stat-card"/)
  assert.match(appSource, /className="brand-stat-title">Clarify</)
  assert.match(appSource, /className="brand-stat-subtitle">Experience collaborative learning</)
})

test('Clarify title animation keyframes and reduced-motion fallback exist', () => {
  assert.match(stylesSource, /\.brand-stat-title\{[\s\S]*animation:brandTitleShimmer/)
  assert.match(stylesSource, /@keyframes brandTitleShimmer/)
  assert.match(stylesSource, /@keyframes brandTitleFloat/)
  assert.match(stylesSource, /\.brand-stat-subtitle\{[\s\S]*animation:brandSubtitlePulse/)
  assert.match(stylesSource, /@media \(prefers-reduced-motion: reduce\)\{[\s\S]*\.brand-stat-title/)
})
