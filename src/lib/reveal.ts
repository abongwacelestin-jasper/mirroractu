/**
 * Scroll reveal for the whole site. Put `data-reveal` on an element (optionally "left" or
 * "zoom") and it fades and slides in the first time it enters the screen. Elements that arrive
 * together are staggered. One observer serves every page, including content added later.
 *
 * The matching CSS is in styles/index.css. It is off for reduced-motion readers, and nothing is
 * hidden unless this script has started.
 */
let started = false

export function initReveal() {
  if (started || typeof IntersectionObserver === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  started = true

  const io = new IntersectionObserver(
    (entries) => {
      let order = 0
      for (const e of entries) {
        if (!e.isIntersecting) continue
        const el = e.target as HTMLElement
        el.style.setProperty('--reveal-delay', `${Math.min(order++, 6) * 70}ms`)
        // An attribute, not a class: React rewrites className on re-render but leaves this alone.
        el.setAttribute('data-revealed', '')
        io.unobserve(el)
      }
    },
    { rootMargin: '0px 0px -6% 0px', threshold: 0.04 }
  )

  const scan = (root: ParentNode) => root.querySelectorAll('[data-reveal]:not([data-revealed])').forEach((el) => io.observe(el))
  scan(document)
  new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (!(n instanceof Element)) return
        if (n.matches('[data-reveal]:not([data-revealed])')) io.observe(n)
        scan(n)
      })
    }
  }).observe(document.body, { childList: true, subtree: true })

  document.documentElement.classList.add('reveal-on')
}
