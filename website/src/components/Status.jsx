import { useEffect, useRef, useState } from 'react'
import { TIER } from '../lib/scale.js'
import { Term } from './terms.jsx'

export function Loading({ what = 'data' }) {
  return (
    <div className="page-x pb-16 pt-28 text-muted" role="status" aria-live="polite">
      Loading {what}…
    </div>
  )
}

export function LoadError({ error, retry }) {
  return (
    <div className="page-x pb-16 pt-28" role="alert">
      <h1 className="text-2xl">The data could not be loaded</h1>
      <p className="mt-3 max-w-prose text-muted">
        {error?.message || 'Something went wrong.'} Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={retry}
        className="btn btn-solid mt-6"
      >
        Try again
      </button>
    </div>
  )
}

// Shown on the Map, Ranking and Planner pages.
export function Banner() {
  return (
    <p className="border-l-2 border-scale-4 bg-surface px-4 py-3 text-sm text-ink">
      Estimates from household surveys. Not a medical diagnosis. District numbers are approximate.
    </p>
  )
}

export function TierLabel({ tier, large = false }) {
  const t = TIER[tier]
  if (!t) return <span className="text-muted">No data</span>
  return (
    <span
      className={`inline-block rounded border border-ink/20 font-semibold ${
        large ? 'px-3 py-1 text-lg' : 'px-2 py-0.5 text-sm'
      }`}
      style={{ background: t.bg, color: t.fg }}
    >
      {tier}
      <span className="sr-only"> priority</span>
    </span>
  )
}

export function LowConfidence({ withTip = true }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap">
      <span className="rounded border border-muted px-2 py-0.5 text-xs font-medium text-muted">Low confidence</span>
      {withTip && <Term k="lowConfidence" />}
    </span>
  )
}

// Moves smoothly to a new value unless the visitor prefers reduced motion.
export function AnimatedNumber({ value, format }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce || !Number.isFinite(value) || !Number.isFinite(from.current)) {
      from.current = value
      setShown(value)
      return
    }
    const start = performance.now()
    const a = from.current
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - start) / 300)
      const eased = 1 - (1 - k) ** 3
      setShown(a + (value - a) * eased)
      if (k < 1) raf = requestAnimationFrame(step)
      else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(raf)
      from.current = value
    }
  }, [value])
  return <>{format(shown)}</>
}

export function usePageMeta(title, description) {
  useEffect(() => {
    document.title = title ? `${title} | BreathRwanda` : 'BreathRwanda'
    const meta = document.querySelector('meta[name="description"]')
    if (meta && description) meta.setAttribute('content', description)
  }, [title, description])
}
