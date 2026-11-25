// Give the sticky header a hairline shadow once the page scrolls.
const header = document.querySelector('.site-header')
if (header) {
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8)
  }
  update()
  window.addEventListener('scroll', update, { passive: true })
}

const themeToggle = document.querySelector('[data-theme-toggle]')
if (themeToggle) {
  const root = document.documentElement
  themeToggle.setAttribute('aria-pressed', String(root.dataset.theme === 'dark'))
  themeToggle.addEventListener('click', () => {
    const dark = root.dataset.theme !== 'dark'
    const theme = dark ? 'dark' : 'light'
    root.dataset.theme = theme
    themeToggle.setAttribute('aria-pressed', String(dark))
    document.querySelector('meta[name="theme-color"]').content = dark ? '#0f172a' : '#ffffff'
    try {
      window.localStorage.setItem('theme', theme)
    } catch {}
  })
}
