import { useEffect } from 'react'

function observeReveals(observer: IntersectionObserver) {
  document.querySelectorAll('.reveal').forEach((el) => {
    if (!el.classList.contains('visible')) observer.observe(el)
  })
}

export function useScrollReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add('visible')
        })
      },
      { threshold: 0.12 }
    )
    observeReveals(observer)
    // Re-query when DOM changes so dynamically added .reveal elements (e.g. after fetch) get observed
    const mo = new MutationObserver(() => observeReveals(observer))
    mo.observe(document.body, { childList: true, subtree: true })
    return () => {
      mo.disconnect()
      observer.disconnect()
    }
  }, [])
}
