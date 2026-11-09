/**
 * Render the site from src/ templates.
 *
 * Mirrors the electerm.org layout: pug pages + views/parts, stylus entry +
 * css/parts, and native ESM js/pages + js/parts. No bundler is needed for the
 * browser scripts — they are copied as-is and loaded with type="module".
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises'
import path from 'node:path'
import pug from 'pug'
import stylus from 'stylus'

const HTML_COMMENT = /<!--(?!\[if\b)/i

// Favicons, the wordmark and the PWA icons are served from electerm.org, which
// sets `Access-Control-Allow-Origin: *`. Keeping one origin for the shared
// brand assets avoids shipping a second, drifting copy of the same binaries.
const ASSET_HOST = 'https://electerm.org'

// Only the manifest is site-specific (name / start_url / scope), so it is
// generated here with absolute icon URLs instead of being copied.
const MANIFEST = {
  name: 'electerm widgets',
  short_name: 'widgets',
  description: 'Community registry of electerm widgets',
  icons: [
    {
      src: `${ASSET_HOST}/android-chrome-192x192.png`,
      sizes: '192x192',
      type: 'image/png'
    },
    {
      src: `${ASSET_HOST}/android-chrome-512x512.png`,
      sizes: '512x512',
      type: 'image/png'
    }
  ],
  theme_color: '#ffffff',
  background_color: '#ffffff',
  display: 'standalone',
  start_url: '/',
  scope: '/'
}

async function renderPug (from, to, data) {
  const src = await readFile(from, 'utf8')
  const html = pug.render(src, { filename: from, ...data })
  if (HTML_COMMENT.test(html)) {
    throw new Error(`${from} rendered an HTML comment; use "//-" in pug templates`)
  }
  await mkdir(path.dirname(to), { recursive: true })
  await writeFile(to, html, 'utf8')
}

async function compileCss (root, publicDir) {
  const entry = path.join(root, 'src', 'css', 'main.styl')
  const src = await readFile(entry, 'utf8')
  const css = stylus(src)
    .set('filename', entry)
    .set('compress', true)
    .render()
  const hash = createHash('sha256').update(css).digest('hex').slice(0, 8)
  const name = `styles.${hash}.css`
  await writeFile(path.join(publicDir, name), css, 'utf8')
  return { cssUrl: '/' + name, cssName: name }
}

/**
 * @param {object} opts
 * @param {string} opts.root project root
 * @param {string} opts.publicDir generated output directory
 * @param {string} opts.host canonical site origin
 * @param {Array<object>} opts.widgets full widget records prepared for views
 * @param {string} opts.generatedAt ISO build timestamp
 */
export async function renderSite ({ root, publicDir, host, widgets, generatedAt }) {
  await writeFile(
    path.join(publicDir, 'site.webmanifest'),
    JSON.stringify(MANIFEST, null, 2) + '\n',
    'utf8'
  )
  // Browser modules: pages import parts with native ESM, no bundling step.
  await cp(path.join(root, 'src', 'js'), path.join(publicDir, 'js'), { recursive: true })

  const { cssUrl, cssName } = await compileCss(root, publicDir)
  const views = path.join(root, 'src', 'views')
  const base = {
    host,
    assetHost: ASSET_HOST,
    cssUrl,
    generatedAt,
    updatedLabel: generatedAt.slice(0, 10),
    count: widgets.length
  }

  await renderPug(path.join(views, 'index.pug'), path.join(publicDir, 'index.html'), {
    ...base,
    title: 'electerm widgets',
    description: 'Community registry of electerm widgets, indexed at pinned commits.',
    url: '/',
    widgets
  })

  for (const w of widgets) {
    await renderPug(
      path.join(views, 'widget.pug'),
      path.join(publicDir, 'widget', w.id, 'index.html'),
      {
        ...base,
        title: `${w.name || w.id} - electerm widgets`,
        description: w.description,
        url: `/widget/${w.id}/`,
        widget: w
      }
    )
  }

  await renderPug(path.join(views, '404.pug'), path.join(publicDir, '404.html'), {
    ...base,
    title: 'Not found - electerm widgets',
    description: 'Page not found.',
    url: '/404.html'
  })

  return cssName
}
