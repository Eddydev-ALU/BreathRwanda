import { useEffect, useRef } from 'react'

// Moves an element slightly as the page scrolls. Off when reduced motion is on.
export function useParallax(strength = 0.1) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let raf = 0
    const update = () => {
      raf = 0
      const box = el.parentElement.getBoundingClientRect()
      if (box.bottom < 0 || box.top > window.innerHeight) return
      const offset = (box.top + box.height / 2 - window.innerHeight / 2) * strength
      el.style.transform = `translate3d(0, ${offset.toFixed(1)}px, 0)`
    }
    const on = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', on, { passive: true })
    window.addEventListener('resize', on)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', on)
      window.removeEventListener('resize', on)
    }
  }, [strength])
  return ref
}
