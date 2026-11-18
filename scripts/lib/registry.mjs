/**
 * Pure helpers shared by the build script and the test suite.
 *
 * No network, no filesystem access, no global state: every export here is a
 * deterministic function of its arguments so it can be unit tested in
 * isolation and reused by the client that consumes the registry.
 */
import { createHash } from 'node:crypto'

/**
 * Compute a widget digest exactly as the electerm client does.
 *
 * Files are sorted by their POSIX-relative path, then rendered into a
 * canonical string `path\0size\0sha256\n` per file. The result is a
 * `sha256:` prefixed, lowercase 64-char hex string.
 *
 * @param {Array<{path: string, size: number, sha256: string}>} files
 * @returns {string}
 */
export function computeDigest (files) {
  const sorted = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  const canonical = sorted.map((f) => `${f.path}\0${f.size}\0${f.sha256}\n`).join('')
  return 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex')
}

/**
 * Escape a value for safe interpolation into HTML text or a double-quoted
 * HTML attribute. Used for every piece of text that originates in a widget
 * repository.
 *
 * @param {unknown} value
 * @returns {string}
 */
export function escapeHtml (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Display strings a widget translates inside its own repository, under
 * `electerm.i18n.<locale>`. The registry republishes them so electerm can show
 * the online list in the user's language. Only text the host renders is kept;
 * a widget repo cannot add behaviour through this field.
 *
 * @param {unknown} value
 * @returns {Record<string, object>}
 */
export function sanitizeWidgetI18n (value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out = {}
  const text = (v, max) => typeof v === 'string' && v ? v.slice(0, max) : ''
  for (const lang of Object.keys(value)) {
    const raw = value[lang]
    if (!/^[a-z]{2}_[a-z]{2}$/.test(lang) || !raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    const item = {}
    for (const key of ['name', 'description', 'submitLabel']) {
      const v = text(raw[key], key === 'description' ? 2000 : 300)
      if (v) item[key] = v
    }
    if (raw.configs && typeof raw.configs === 'object' && !Array.isArray(raw.configs)) {
      const configs = {}
      for (const name of Object.keys(raw.configs)) {
        const conf = raw.configs[name]
        if (!conf || typeof conf !== 'object' || Array.isArray(conf)) continue
        const patch = {}
        for (const key of ['label', 'description', 'placeholder']) {
          const v = text(conf[key], 2000)
          if (v) patch[key] = v
        }
        if (conf.choices && typeof conf.choices === 'object' && !Array.isArray(conf.choices)) {
          const choices = {}
          for (const val of Object.keys(conf.choices)) {
            const label = text(conf.choices[val], 200)
            if (label) choices[val] = label
          }
          if (Object.keys(choices).length) patch.choices = choices
        }
        if (Object.keys(patch).length) configs[name] = patch
      }
      if (Object.keys(configs).length) item.configs = configs
    }
    if (Object.keys(item).length) out[lang] = item
  }
  return out
}

/**
 * Validate a single path segment (a file or directory name). Segments may
 * not be empty, `.`, `..`, or contain a path separator.
 *
 * @param {unknown} name
 * @returns {boolean}
 */
export function isSafeSegment (name) {
  if (typeof name !== 'string' || name.length === 0) return false
  if (name === '.' || name === '..') return false
  if (name.includes('/') || name.includes('\\')) return false
  return true
}

/**
 * Validate a relative POSIX path that must stay inside the widget root.
 * Rejects absolute paths, Windows drive paths, backslashes, `..` segments,
 * and empty segments.
 *
 * @param {unknown} p
 * @returns {boolean}
 */
export function isSafeRelativePath (p) {
  if (typeof p !== 'string' || p.length === 0) return false
  if (p.startsWith('/') || p.startsWith('\\')) return false
  if (/^[a-zA-Z]:/.test(p)) return false
  if (p.includes('\\')) return false
  return p.split('/').every(isSafeSegment)
}
