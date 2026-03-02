import { useEffect, useRef } from 'react'

const DURATION = 1600

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function animateValue(
  el: HTMLElement,
  target: number,
  prefix: string,
  suffix: string,
  formatter: (n: number) => string
) {
  const start = performance.now()
  function update(now: number) {
    const elapsed = now - start
    const progress = Math.min(elapsed / DURATION, 1)
    const eased = easeOutCubic(progress)
    const current = Math.floor(eased * target)
    el.textContent = prefix + formatter(current) + suffix
    if (progress < 1) {
      requestAnimationFrame(update)
    } else {
      el.textContent = prefix + formatter(target) + suffix
    }
  }
  requestAnimationFrame(update)
}

export function useCountUp() {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const el = entry.target as HTMLElement
          const target = parseInt(el.dataset.countTarget ?? '0', 10)
          const prefix = el.dataset.countPrefix ?? ''
          const suffix = el.dataset.countSuffix ?? ''
          if (el.dataset.countAnimated === 'true') return
          el.dataset.countAnimated = 'true'
          const formatter = (n: number) => n.toLocaleString()
          animateValue(el, target, prefix, suffix, formatter)
        })
      },
      { threshold: 0.2 }
    )

    const counters = container.querySelectorAll('[data-count-target]')
    counters.forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [])

  return containerRef
}
