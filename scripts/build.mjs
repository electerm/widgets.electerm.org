/**
 * Build the static widget registry.
 *
 * Reads data/widgets.json, downloads every widget at its pinned commit sha,
 * computes a file manifest + digest, then writes:
 *   - public/api/v1/index.json
 *   - public/api/v1/widgets/<id>.json
 *   - public/api/v1/revocations.json
 *   - public/index.html, public/widget/<id>/index.html, public/404.html
 *     (rendered from src/views pug templates)
 *   - public/styles.<hash>.css (compiled from src/css stylus parts)
 *   - public/js/** (native ESM pages + parts)
 *   - public/site.webmanifest (generated; shared icons/logo are served from electerm.org)
 *   - public/_headers
 *   - public/health
 *
 * Sources are always downloaded from the author's repository. Any failure
 * aborts the build with a non-zero exit code: a partial index is never
 * published.
 *
 * Run: node scripts/build.mjs
 */
import { createHash } from 'node:crypto'
import { readFile, writeFile, mkdir, rm, mkdtemp, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import { gunzipSync } from 'node:zlib'
import * as tar from 'tar'
import {
  computeDigest,
  isSafeRelativePath,
  isSafeSegment
} from './lib/registry.mjs'
import { renderSite } from './lib/render.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const DATA_FILE = path.join(ROOT, 'data', 'widgets.json')
const PUBLIC_DIR = path.join(ROOT, 'public')
const API_DIR = path.join(PUBLIC_DIR, 'api', 'v1')
const WIDGETS_API_DIR = path.join(API_DIR, 'widgets')
const HOST = 'https://widgets.electerm.org'

// Custom headers for static assets. CORS and cache behaviour used to be added
// by the Worker; without a Worker script they must live in _headers.
const HEADERS_FILE = [
  '/api/v1/*',
  '  Access-Control-Allow-Origin: *',
  '  Cache-Control: public, max-age=300',
  '',
  '/health',
  '  Content-Type: application/json; charset=utf-8',
  ''
].join('\n')

const FETCH_TIMEOUT_MS = 30000
const MAX_BYTES = 32 * 1024 * 1024
const MAX_FILES = 800
const ATOMGIT_CONCURRENCY = 3
const ALLOWED_HOSTS = new Set(['github.com', 'atomgit.com'])
const SHA_RE = /^[0-9a-f]{40}$/
const ID_RE = /^[a-z0-9-]+$/
const UNSAFE_TAR_TYPES = new Set([
  'SymbolicLink', 'Link', 'CharacterDevice', 'BlockDevice', 'FIFO'
])

// ── Small pure helpers ──────────────────────────────────────
function sha256Hex (buf) {
  return createHash('sha256').update(buf).digest('hex')
}

function coerceStr (v) {
  if (v == null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (typeof v === 'object') {
    if (typeof v.name === 'string') return v.name
    try {
      return JSON.stringify(v)
    } catch {
      return ''
    }
  }
  return String(v)
}

function limit (s, max) {
  return s.length > max ? s.slice(0, max) : s
}

function pickField (el, pkg, key, max) {
  return limit(coerceStr(el[key] ?? pkg[key]), max)
}

function safeHref (u) {
  try {
    const p = new URL(String(u))
    return (p.protocol === 'http:' || p.protocol === 'https:') ? String(u) : ''
  } catch {
    return ''
  }
}

function sourceUrlFor (spec) {
  const base = spec.host === 'github.com'
    ? `https://github.com/${spec.owner}/${spec.repo}/tree/${spec.ref}`
    : `https://atomgit.com/${spec.owner}/${spec.repo}/tree/${spec.ref}`
  return spec.subdir ? `${base}/${spec.subdir}` : base
}

function normalizeBase (subdir) {
  return String(subdir || '').replace(/^\/+|\/+$/g, '')
}

function encodePath (p) {
  return p.split('/').map(encodeURIComponent).join('/')
}

function validateAtomgitDownload (raw) {
  let u
  try {
    u = new URL(String(raw))
  } catch {
    throw new Error(`invalid atomgit download_url: ${raw}`)
  }
  const host = u.hostname
  const allowed = host === 'raw.atomgit.com' || host.endsWith('.raw.atomgit.com')
  if (u.protocol !== 'https:' || !allowed) {
    throw new Error(`disallowed atomgit download_url: ${raw}`)
  }
  return u.toString()
}

function contentsUrl (spec, dir) {
  const owner = encodeURIComponent(spec.owner)
  const repo = encodeURIComponent(spec.repo)
  const base = `https://atomgit.com/api/v5/repos/${owner}/${repo}/contents`
  const suffix = dir ? `/${encodePath(dir)}` : ''
  return `${base}${suffix}?ref=${encodeURIComponent(spec.ref)}`
}

// ── Network helpers ─────────────────────────────────────────
async function fetchBuffer (url, opts = {}) {
  const { timeout = FETCH_TIMEOUT_MS, maxBytes = MAX_BYTES } = opts
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeout)
  try {
    let res
    try {
      res = await fetch(url, { signal: controller.signal, redirect: 'follow' })
    } catch (err) {
      throw new Error(`network error fetching ${url}: ${err.message}`)
    }
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status} fetching ${url}`)
    }
    const reader = res.body.getReader()
    const chunks = []
    let total = 0
    while (true) {
      let value
      try {
        const step = await reader.read()
        if (step.done) break
        value = step.value
      } catch (err) {
        throw new Error(`error reading body from ${url}: ${err.message}`)
      }
      total += value.length
      if (total > maxBytes) {
        reader.cancel().catch(() => null)
        throw new Error(`response exceeds ${maxBytes} bytes at ${url}`)
      }
      chunks.push(Buffer.from(value))
    }
    return Buffer.concat(chunks)
  } finally {
    clearTimeout(timer)
  }
}

async function fetchJson (url) {
  const buf = await fetchBuffer(url)
  try {
    return JSON.parse(buf.toString('utf8'))
  } catch (err) {
    throw new Error(`invalid JSON from ${url}: ${err.message}`)
  }
}

async function mapPool (items, concurrency, fn) {
  const results = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++
      results[i] = await fn(items[i], i)
    }
  })
  await Promise.all(workers)
  return results
}

// ── Source acquisition ──────────────────────────────────────
async function fetchGithub (spec, checkoutDir) {
  const url = `https://codeload.github.com/${spec.owner}/${spec.repo}/tar.gz/${spec.ref}`
  const gz = await fetchBuffer(url)
  let tarBuf
  try {
    tarBuf = gunzipSync(gz)
  } catch (err) {
    throw new Error(`gunzip failed for ${url}: ${err.message}`)
  }

  const unsafe = []
  await new Promise((resolve, reject) => {
    let done = false
    const finish = (err) => {
      if (done) return
      done = true
      if (err) reject(err)
      else resolve()
    }
    const unpack = tar.x({
      cwd: checkoutDir,
      strip: 1,
      filter: (entryPath, entry) => {
        const normalized = entryPath.replace(/\/+$/, '')
        // npm creates executable symlinks in node_modules/.bin. A widget loads
        // its vendored packages with require(), never through those links, so
        // the site and the electerm client both skip .bin and every link. What
        // is left is a plain file tree both sides can hash identically.
        if (normalized.split('/').includes('.bin') || UNSAFE_TAR_TYPES.has(entry.type)) {
          return false
        }
        if (!isSafeRelativePath(normalized)) {
          unsafe.push(`unsafe path: ${entryPath}`)
          return false
        }
        return true
      }
    })
    unpack.on('error', (err) => finish(err))
    unpack.on('close', () => finish())
    const src = Readable.from([tarBuf])
    src.on('error', (err) => finish(err))
    src.pipe(unpack)
  })
  if (unsafe.length > 0) {
    throw new Error(`rejected unsafe tar entries from ${url}: ${unsafe.join('; ')}`)
  }
}

async function fetchAtomgit (spec, widgetRoot) {
  const base = normalizeBase(spec.subdir)
  const dirQueue = [{ dir: base, rel: '' }]
  const fileEntries = []
  let fileCount = 0

  while (dirQueue.length > 0) {
    const { dir, rel } = dirQueue.shift()
    const url = contentsUrl(spec, dir)
    const entries = await fetchJson(url)
    if (!Array.isArray(entries)) {
      throw new Error(`expected a directory listing from ${url}`)
    }
    for (const entry of entries) {
      const name = String(entry.name)
      if (!isSafeSegment(name)) {
        throw new Error(`unsafe entry name from ${url}: ${name}`)
      }
      const childRel = rel ? `${rel}/${name}` : name
      if (!isSafeRelativePath(childRel)) {
        throw new Error(`unsafe entry path from ${url}: ${childRel}`)
      }
      const childDir = dir ? `${dir}/${name}` : name
      if (entry.type === 'dir') {
        // Same tree shape as the tarball filter: no .git, no .bin links.
        if (name === '.git' || name === '.bin') continue
        dirQueue.push({ dir: childDir, rel: childRel })
      } else if (entry.type === 'file') {
        fileCount++
        if (fileCount > MAX_FILES) {
          throw new Error(`too many files (> ${MAX_FILES}) from ${url}`)
        }
        fileEntries.push({
          relPath: childRel,
          downloadUrl: validateAtomgitDownload(entry.download_url)
        })
      }
      // Links and submodules are skipped, matching the tarball filter.
    }
  }

  const budget = { bytes: 0 }
  const downloaded = await mapPool(fileEntries, ATOMGIT_CONCURRENCY, async (fe) => {
    const buf = await fetchBuffer(fe.downloadUrl)
    budget.bytes += buf.length
    if (budget.bytes > MAX_BYTES) {
      throw new Error(`atomgit download exceeds ${MAX_BYTES} bytes at ${fe.downloadUrl}`)
    }
    return { relPath: fe.relPath, buffer: buf }
  })

  for (const f of downloaded) {
    const dest = path.join(widgetRoot, f.relPath)
    await mkdir(path.dirname(dest), { recursive: true })
    await writeFile(dest, f.buffer)
  }
}

// ── Manifest / metadata ─────────────────────────────────────
async function readMeta (widgetRoot, spec) {
  const label = `${spec.owner}/${spec.repo}${spec.subdir ? '/' + spec.subdir : ''}`
  let pkg
  try {
    pkg = JSON.parse(await readFile(path.join(widgetRoot, 'package.json'), 'utf8'))
  } catch (err) {
    throw new Error(`cannot read package.json for ${label}: ${err.message}`)
  }
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) {
    throw new Error(`package.json for ${label} must be an object`)
  }
  const el = pkg.electerm
  if (!el || typeof el !== 'object' || Array.isArray(el)) {
    throw new Error(`package.json for ${label} must contain an "electerm" object`)
  }
  const id = coerceStr(el.id)
  if (!ID_RE.test(id)) {
    throw new Error(`electerm.id "${id}" for ${label} must match ${ID_RE}`)
  }
  return {
    id,
    version: pickField(el, pkg, 'version', 100),
    name: pickField(el, pkg, 'name', 120),
    description: pickField(el, pkg, 'description', 600),
    author: pickField(el, pkg, 'author', 200),
    license: pickField(el, pkg, 'license', 100),
    homepage: pickField(el, pkg, 'homepage', 500)
  }
}

async function collectFiles (widgetRoot) {
  const files = []
  let totalSize = 0

  async function walk (dir, relBase) {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const ent of entries) {
      // Ignored by both source downloads, so it must not enter the manifest.
      if (ent.name === '.git' || ent.name === '.bin') continue
      const rel = relBase ? `${relBase}/${ent.name}` : ent.name
      const full = path.join(dir, ent.name)
      if (ent.isSymbolicLink()) {
        throw new Error(`symlink not allowed in widget: ${rel}`)
      }
      if (ent.isDirectory()) {
        await walk(full, rel)
      } else if (ent.isFile()) {
        const buf = await readFile(full)
        const size = buf.length
        const sha256 = sha256Hex(buf)
        totalSize += size
        files.push({ path: rel, sha256, size })
        if (files.length > MAX_FILES) {
          throw new Error(`widget exceeds ${MAX_FILES} files`)
        }
        if (totalSize > MAX_BYTES) {
          throw new Error(`widget exceeds ${MAX_BYTES} bytes`)
        }
      } else {
        throw new Error(`non-regular file in widget: ${rel}`)
      }
    }
  }

  await walk(widgetRoot, '')
  files.sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  return { files, totalSize }
}

async function buildWidget (spec, workRoot) {
  const widgetWork = await mkdtemp(path.join(workRoot, 'w-'))
  const checkoutDir = path.join(widgetWork, 'checkout')
  const widgetRoot = spec.subdir
    ? path.join(checkoutDir, spec.subdir)
    : checkoutDir
  await mkdir(checkoutDir, { recursive: true })

  if (spec.host === 'github.com') {
    await fetchGithub(spec, checkoutDir)
  } else {
    await fetchAtomgit(spec, widgetRoot)
  }

  const meta = await readMeta(widgetRoot, spec)
  const { files, totalSize } = await collectFiles(widgetRoot)
  const digest = computeDigest(files)
  const id = meta.id
  const shared = {
    id,
    host: spec.host,
    owner: spec.owner,
    repo: spec.repo,
    subdir: spec.subdir,
    ref: spec.ref,
    version: meta.version,
    name: meta.name,
    description: meta.description,
    author: meta.author,
    license: meta.license,
    homepage: meta.homepage,
    sourceUrl: sourceUrlFor(spec),
    digest,
    fileCount: files.length,
    totalSize,
    status: 'public',
    filesUrl: `/api/v1/widgets/${id}.json`
  }
  return { ...shared, files }
}

// ── Site rendering (pug + stylus) ───────────────────────────
// Templates, style parts and page scripts live in src/. See scripts/lib/render.mjs.

function installString (w) {
  return `${w.owner}/${w.repo}#${w.ref}`
}

// ── Output ──────────────────────────────────────────────────
async function writeJson (file, data) {
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(data, null, 2) + '\n', 'utf8')
}

function validateSpecs (raw) {
  if (!Array.isArray(raw)) {
    throw new Error('data/widgets.json must be an array')
  }
  return raw.map((spec, i) => {
    if (!spec || typeof spec !== 'object' || Array.isArray(spec)) {
      throw new Error(`data/widgets.json[${i}] must be an object`)
    }
    const host = String(spec.host || '')
    const owner = String(spec.owner || '')
    const repo = String(spec.repo || '')
    const ref = String(spec.ref || '')
    const subdir = typeof spec.subdir === 'string' ? spec.subdir : ''
    if (!ALLOWED_HOSTS.has(host)) {
      throw new Error(`data/widgets.json[${i}].host must be one of ${[...ALLOWED_HOSTS].join(', ')}, got "${host}"`)
    }
    if (!owner || !repo) {
      throw new Error(`data/widgets.json[${i}] needs owner and repo`)
    }
    if (!SHA_RE.test(ref)) {
      throw new Error(`data/widgets.json[${i}].ref must be a 40-char lowercase hex sha, got "${ref}"`)
    }
    return { host, owner, repo, subdir, ref }
  })
}

async function main () {
  let raw
  try {
    raw = JSON.parse(await readFile(DATA_FILE, 'utf8'))
  } catch (err) {
    throw new Error(`cannot read ${DATA_FILE}: ${err.message}`)
  }
  const specs = validateSpecs(raw)

  await rm(PUBLIC_DIR, { recursive: true, force: true })
  await mkdir(WIDGETS_API_DIR, { recursive: true })

  const generatedAt = new Date().toISOString()
  const fulls = []
  const seenIds = new Set()
  const workRoot = await mkdtemp(path.join(tmpdir(), 'electerm-widgets-'))

  try {
    for (const spec of specs) {
      const label = `${spec.host}/${spec.owner}/${spec.repo}@${spec.ref.slice(0, 7)}`
      let full
      try {
        full = await buildWidget(spec, workRoot)
      } catch (err) {
        throw new Error(`failed to build ${label}: ${err.message}`)
      }
      if (seenIds.has(full.id)) {
        throw new Error(`duplicate widget id "${full.id}" from ${label}`)
      }
      seenIds.add(full.id)
      fulls.push(full)
      console.log(`ok ${label} -> ${full.id} (${full.fileCount} files, ${full.totalSize} bytes, ${full.digest})`)
    }
  } finally {
    await rm(workRoot, { recursive: true, force: true })
  }

  const summaries = fulls.map((w) => {
    const s = { ...w }
    delete s.files
    return s
  })

  await writeJson(path.join(API_DIR, 'index.json'), {
    version: 1,
    generatedAt,
    widgets: summaries
  })
  for (const w of fulls) {
    await writeJson(path.join(WIDGETS_API_DIR, `${w.id}.json`), w)
  }
  await writeJson(path.join(API_DIR, 'revocations.json'), {
    version: 1,
    generatedAt,
    revocations: []
  })

  const viewWidgets = fulls.map((w) => ({
    ...w,
    installString: installString(w),
    homepageUrl: safeHref(w.homepage),
    sourceUrl: safeHref(w.sourceUrl)
  }))
  const cssName = await renderSite({
    root: ROOT,
    publicDir: PUBLIC_DIR,
    host: HOST,
    widgets: viewWidgets,
    generatedAt
  })
  await writeFile(path.join(PUBLIC_DIR, '_headers'), HEADERS_FILE, 'utf8')
  await writeFile(path.join(PUBLIC_DIR, 'health'), '{"ok":true}\n', 'utf8')

  console.log(`wrote ${fulls.length} widgets, ${cssName}, generatedAt ${generatedAt}`)
}

main().catch((err) => {
  console.error(`build failed: ${err.message}`)
  process.exitCode = 1
})
