/**
 * Unit tests for the pure registry helpers.
 * Run: npm test
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import {
  computeDigest,
  escapeHtml,
  isSafeRelativePath,
  isSafeSegment
} from '../scripts/lib/registry.mjs'

const SAMPLE = [
  { path: 'src/main.js', size: 10, sha256: 'a'.repeat(64) },
  { path: 'package.json', size: 3, sha256: 'b'.repeat(64) },
  { path: 'README.md', size: 7, sha256: 'c'.repeat(64) }
]

// Independent re-implementation of the canonical form, used to lock the
// exact byte layout the client consumes.
function referenceDigest (files) {
  const sorted = [...files].sort((a, b) => a.path < b.path ? -1 : a.path > b.path ? 1 : 0)
  const canonical = sorted.map((f) => `${f.path}\0${f.size}\0${f.sha256}\n`).join('')
  return 'sha256:' + createHash('sha256').update(canonical, 'utf8').digest('hex')
}

test('digest matches the exact client canonical algorithm', () => {
  // Known-answer test: computed from the fixed SAMPLE list below.
  const expected = 'sha256:e8af97d205579895a5bbf25562868d8b9e05eb0f98c0ee0182be3ff374d218b4'
  assert.equal(computeDigest(SAMPLE), expected)
  assert.equal(computeDigest(SAMPLE), referenceDigest(SAMPLE))
  assert.match(computeDigest(SAMPLE), /^sha256:[0-9a-f]{64}$/)
})

test('digest is independent of the input file order', () => {
  const reordered = [SAMPLE[2], SAMPLE[0], SAMPLE[1]]
  const shuffled = [SAMPLE[1], SAMPLE[2], SAMPLE[0]]
  assert.equal(computeDigest(reordered), computeDigest(SAMPLE))
  assert.equal(computeDigest(shuffled), computeDigest(SAMPLE))
  // Input array must not be mutated.
  assert.equal(SAMPLE[0].path, 'src/main.js')
})

test('tampering with any field or with the file set changes the digest', () => {
  const base = computeDigest(SAMPLE)
  const cases = [
    SAMPLE.map((f) => ({ ...f, size: f.size + 1 })),
    SAMPLE.map((f) => ({ ...f, sha256: 'd'.repeat(64) })),
    SAMPLE.map((f) => ({ ...f, path: f.path + '.x' })),
    SAMPLE.slice(1),
    [...SAMPLE, { path: 'extra.js', size: 1, sha256: 'e'.repeat(64) }]
  ]
  for (const files of cases) {
    assert.notEqual(computeDigest(files), base)
  }
})

test('path traversal and unsafe paths are rejected', () => {
  const bad = [
    '../evil',
    '/etc/passwd',
    'a/../../b',
    '..\\evil',
    'C:/windows',
    'foo\\..\\bar',
    'a//b',
    '',
    '.',
    '..'
  ]
  for (const p of bad) {
    assert.equal(isSafeRelativePath(p), false, p)
  }
  const good = [
    'main.js',
    'src/main.js',
    'a/b/c.txt',
    '.gitignore',
    'node_modules/x/index.js'
  ]
  for (const p of good) {
    assert.equal(isSafeRelativePath(p), true, p)
  }
})

test('unsafe single path segments are rejected', () => {
  for (const s of ['a/b', 'a\\b', '..', '.', '']) {
    assert.equal(isSafeSegment(s), false, s)
  }
  assert.equal(isSafeSegment('main.js'), true)
  assert.equal(isSafeSegment('.hidden'), true)
})

test('HTML escaping covers every dangerous character', () => {
  assert.equal(
    escapeHtml('<a href="x">&\'</a>'),
    '&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;'
  )
  assert.equal(
    escapeHtml('<script>alert(1)</script>'),
    '&lt;script&gt;alert(1)&lt;/script&gt;'
  )
  assert.equal(escapeHtml(42), '42')
  assert.equal(escapeHtml(null), 'null')
})
