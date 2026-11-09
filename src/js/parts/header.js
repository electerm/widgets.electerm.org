// Give the sticky header a hairline shadow once the page scrolls.
const header = document.querySelector('.site-header')
if (header) {
  const update = () => {
    header.classList.toggle('is-scrolled', window.scrollY > 8)
  }
  update()
  window.addEventListener('scroll', update, { passive: true })
}
