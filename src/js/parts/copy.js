// Copy install strings from [data-copy] buttons.
document.addEventListener('click', async (event) => {
  const target = event.target
  if (!(target instanceof Element)) return
  const btn = target.closest('[data-copy]')
  if (!btn) return
  const label = btn.textContent
  try {
    await navigator.clipboard.writeText(btn.dataset.copy)
    btn.textContent = 'Copied'
  } catch {
    btn.textContent = 'Copy failed'
  }
  btn.classList.add('copied')
  window.setTimeout(() => {
    btn.textContent = label
    btn.classList.remove('copied')
  }, 1800)
})
