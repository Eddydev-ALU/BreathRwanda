import { useEffect, useRef, useState } from 'react'

let observer = null
const callbacks = new WeakMap()

function observe(el, cb) {
  if (!('IntersectionObserver' in window)) {
    cb()
    return () => {}
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            callbacks.get(e.target)?.()
            observer.unobserve(e.target)
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.05 },
    )
  }
  callbacks.set(el, cb)
  observer.observe(el)
  return () => observer?.unobserve(el)
}

// Calls back once, the first time the element scrolls into view.
export function useInView() {
  const ref = useRef(null)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (!ref.current || seen) return
    return observe(ref.current, () => setSeen(true))
  }, [seen])
  return [ref, seen]
}

// Fades and lifts its content into place when it scrolls into view.
export default function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const [ref, seen] = useInView()
  return (
    <Tag
      ref={ref}
      className={`reveal ${seen ? 'is-visible' : ''} ${className}`}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
