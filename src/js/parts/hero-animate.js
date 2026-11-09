/**
 * Canvas tech background for the homepage hero.
 *
 * Adapted from electerm.org/src/js/parts/animate.js, tuned down for a page
 * where the text has to stay readable: a faint grid, drifting nodes with
 * links, hex outlines, a scan band and a slow rain of registry keywords.
 * No dependencies, no images, no CSS gradients.
 */
const RGB = '37, 99, 235'

const WORDS = [
  'Widgets', 'Online', 'sha256', 'pin commit', 'package.json',
  'main.js', 'digest', 'verified', 'owner/repo#sha', 'registry',
  'SSH', 'SFTP', 'Terminal', 'import', 'per-file', 'electerm',
  'copy install', 'pinned'
]

function rgba (a) {
  return 'rgba(' + RGB + ', ' + a + ')'
}

function rand (min, max) {
  return min + Math.random() * (max - min)
}

export default class HeroAnimate {
  constructor (el) {
    this.el = el
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = 'display:block;width:100%;height:100%'
    this.canvas.setAttribute('aria-hidden', 'true')
    this.el.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')
    this.raf = null
    this.w = 0
    this.h = 0
    this.scanY = -40
    this.particles = []
    this.drops = []
    this.hexes = []
    this.reduce = typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    this._resize = this.resize.bind(this)
    this._frame = this.frame.bind(this)
    this.resizeObserver = null
    this.visibilityObserver = null
    this.init()
  }

  init () {
    this.resize()
    if (window.ResizeObserver) {
      this.resizeObserver = new window.ResizeObserver(this._resize)
      this.resizeObserver.observe(this.el)
    } else {
      window.addEventListener('resize', this._resize)
    }
    if (this.reduce) return
    this.play()
    if (window.IntersectionObserver) {
      this.visibilityObserver = new window.IntersectionObserver((entries) => {
        if (entries[0].isIntersecting) this.play()
        else this.pause()
      }, { threshold: 0 })
      this.visibilityObserver.observe(this.el)
    }
  }

  resize () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.w = this.el.clientWidth
    this.h = this.el.clientHeight
    if (!this.w || !this.h) return
    this.canvas.width = Math.round(this.w * dpr)
    this.canvas.height = Math.round(this.h * dpr)
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.seed()
    // A reduced-motion visitor gets one still frame, redrawn on resize.
    if (this.reduce) this.draw()
  }

  seed () {
    const count = Math.min(54, Math.max(22, Math.round(this.w / 24)))
    this.particles = []
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: rand(0, this.w),
        y: rand(0, this.h),
        vx: rand(-0.32, 0.32) || 0.1,
        vy: rand(-0.32, 0.32) || 0.1,
        r: rand(0.9, 2.1),
        a: rand(0.18, 0.42)
      })
    }
    const dropCount = Math.min(20, Math.max(7, Math.round(this.w / 70)))
    this.drops = []
    for (let i = 0; i < dropCount; i++) {
      this.drops.push({
        x: rand(0, this.w),
        y: rand(-this.h, this.h),
        speed: rand(0.22, 0.6),
        size: rand(11, 14),
        a: rand(0.035, 0.085),
        word: WORDS[Math.floor(Math.random() * WORDS.length)]
      })
    }
    this.hexes = []
    for (let i = 0; i < 6; i++) {
      this.hexes.push({
        x: rand(0, this.w),
        y: rand(0, this.h),
        vx: rand(-0.14, 0.14) || 0.05,
        vy: rand(-0.14, 0.14) || 0.05,
        size: rand(9, 20),
        rot: rand(0, Math.PI),
        vr: rand(-0.004, 0.004) || 0.001,
        a: rand(0.05, 0.11)
      })
    }
  }

  drawGrid () {
    const ctx = this.ctx
    const size = 58
    ctx.strokeStyle = rgba('0.045')
    ctx.lineWidth = 0.5
    ctx.beginPath()
    for (let x = 0; x < this.w; x += size) {
      ctx.moveTo(x, 0)
      ctx.lineTo(x, this.h)
    }
    for (let y = 0; y < this.h; y += size) {
      ctx.moveTo(0, y)
      ctx.lineTo(this.w, y)
    }
    ctx.stroke()
  }

  // A stepped band instead of a gradient: same scan effect, no createLinearGradient.
  drawScan () {
    const ctx = this.ctx
    const band = 12
    for (let i = -3; i <= 3; i++) {
      const a = (1 - Math.abs(i) / 4) * 0.022
      ctx.fillStyle = rgba(a.toFixed(4))
      ctx.fillRect(0, this.scanY + i * band, this.w, band)
    }
    this.scanY += 0.45
    if (this.scanY > this.h + band * 4) this.scanY = -band * 4
  }

  drawRain () {
    const ctx = this.ctx
    ctx.textBaseline = 'top'
    for (const d of this.drops) {
      ctx.font = '500 ' + d.size.toFixed(1) + 'px "SF Mono", "Fira Code", monospace'
      ctx.fillStyle = rgba(d.a.toFixed(3))
      ctx.fillText(d.word, d.x, d.y)
      d.y += d.speed
      if (d.y > this.h + 24) {
        d.y = rand(-260, -20)
        d.x = rand(0, this.w)
        d.word = WORDS[Math.floor(Math.random() * WORDS.length)]
      }
    }
  }

  drawHexes () {
    const ctx = this.ctx
    for (const n of this.hexes) {
      n.x += n.vx
      n.y += n.vy
      n.rot += n.vr
      if (n.x < -40 || n.x > this.w + 40) n.vx *= -1
      if (n.y < -40 || n.y > this.h + 40) n.vy *= -1
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const angle = n.rot + (Math.PI / 3) * i
        const px = n.x + n.size * Math.cos(angle)
        const py = n.y + n.size * Math.sin(angle)
        if (i === 0) ctx.moveTo(px, py)
        else ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.strokeStyle = rgba(n.a.toFixed(3))
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  drawParticles () {
    const ctx = this.ctx
    const link = 128
    for (const p of this.particles) {
      p.x += p.vx
      p.y += p.vy
      if (p.x < 0 || p.x > this.w) p.vx *= -1
      if (p.y < 0 || p.y > this.h) p.vy *= -1
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = rgba(p.a.toFixed(3))
      ctx.fill()
    }
    ctx.lineWidth = 0.7
    for (let i = 0; i < this.particles.length; i++) {
      for (let j = i + 1; j < this.particles.length; j++) {
        const a = this.particles[i]
        const b = this.particles[j]
        const dx = a.x - b.x
        const dy = a.y - b.y
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist >= link) continue
        ctx.strokeStyle = rgba(((1 - dist / link) * 0.13).toFixed(3))
        ctx.beginPath()
        ctx.moveTo(a.x, a.y)
        ctx.lineTo(b.x, b.y)
        ctx.stroke()
      }
    }
  }

  draw () {
    this.ctx.clearRect(0, 0, this.w, this.h)
    this.drawGrid()
    this.drawScan()
    this.drawRain()
    this.drawHexes()
    this.drawParticles()
  }

  frame () {
    this.draw()
    this.raf = window.requestAnimationFrame(this._frame)
  }

  play () {
    if (this.raf === null) this.raf = window.requestAnimationFrame(this._frame)
  }

  pause () {
    if (this.raf !== null) {
      window.cancelAnimationFrame(this.raf)
      this.raf = null
    }
  }

  destroy () {
    this.pause()
    if (this.resizeObserver) this.resizeObserver.disconnect()
    else window.removeEventListener('resize', this._resize)
    if (this.visibilityObserver) this.visibilityObserver.disconnect()
    this.canvas.remove()
  }
}

function initHeroBg () {
  const el = document.querySelector('[data-hero-bg]')
  if (!el) return
  try {
    el.__heroAnimate = new HeroAnimate(el)
  } catch (err) {
    console.warn('[hero] animation init failed', err)
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeroBg)
  } else {
    initHeroBg()
  }
}
