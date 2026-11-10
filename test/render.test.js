/**
 * Render-level tests for the static pages.
 *
 * renderSite() is offline (pug + stylus + file copies), so it can be exercised
 * with stub widget records in a temp dir. This locks the /widgets/ page contract:
 * every widget listed once, and no homepage sections on the standalone page.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderSite } from '../scripts/lib/render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const HOST = 'https://widgets.electerm.org'
const GENERATED_AT = '2026-11-10T05:00:00.000Z'

function stubWidget (id, name) {
  const sha = 'a'.repeat(40)
  return {
    id,
    name,
    version: '1.0.0',
    description: `Description for ${name}`,
    author: 'electerm',
    license: 'MIT',
    homepage: '',
    homepageUrl: '',
    host: 'github.com',
    owner: 'electerm',
    repo: `widget-${id}`,
    subdir: '',
    ref: sha,
    sourceUrl: `https://github.com/electerm/widget-${id}`,
    digest: 'sha256:' + 'b'.repeat(64),
    fileCount: 3,
    totalSize: 1234,
    status: 'public',
    filesUrl: `/api/v1/widgets/${id}.json`,
    installString: `electerm/widget-${id}#${sha}`
  }
}

async function renderWidgetsPage (t, widgets) {
  const publicDir = await mkdtemp(path.join(tmpdir(), 'electerm-widgets-render-'))
  t.after(() => rm(publicDir, { recursive: true, force: true }))
  await renderSite({ root: ROOT, publicDir, host: HOST, widgets, generatedAt: GENERATED_AT })
  const html = await readFile(path.join(publicDir, 'widgets', 'index.html'), 'utf8')
  return { publicDir, html }
}

test('/widgets/ lists every widget and nothing but the list', async (t) => {
  const widgets = [stubWidget('alpha', 'Alpha Widget'), stubWidget('beta', 'Beta Widget')]
  const { publicDir, html } = await renderWidgetsPage(t, widgets)

  assert.match(html, /<link rel="canonical" href="https:\/\/widgets\.electerm\.org\/widgets\/">/)
  assert.match(html, /<title>All widgets - electerm widgets<\/title>/)
  assert.equal((html.match(/class="widget-row"/g) || []).length, widgets.length)
  for (const w of widgets) {
    assert.ok(html.includes(`href="/widget/${w.id}/"`), `missing detail link for ${w.id}`)
    assert.ok(html.includes(`data-copy="${w.installString}"`), `missing install string for ${w.id}`)
    assert.ok(html.includes(w.name))
  }
  assert.match(html, /2 widgets/)
  assert.match(html, /last built 2026-11-10/)
  assert.ok(html.includes('/js/pages/widgets.js'))
  assert.ok((await readdir(path.join(publicDir, 'js', 'pages'))).includes('widgets.js'))

  // Standalone means no homepage marketing sections or their scripts.
  for (const fragment of ['class="hero"', 'id="how-to"', 'class="trust', 'hero-animate', 'data-how-banner', '/js/pages/index.js']) {
    assert.ok(!html.includes(fragment), `unexpected homepage content: ${fragment}`)
  }
  assert.ok(!html.includes('<!--'))
})

test('/widgets/ has an empty state when the registry is empty', async (t) => {
  const { html } = await renderWidgetsPage(t, [])
  assert.match(html, /0 widgets/)
  assert.match(html, /No widgets indexed yet\./)
  assert.ok(!html.includes('class="widget-row"'))
})
