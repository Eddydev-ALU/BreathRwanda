import { useEffect, useRef, useState } from 'react'
import Photo from './Photo.jsx'
import { IMAGES, SLIDES } from '../lib/images.js'

const INTERVAL = 7000
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// Full-bleed photo slideshow behind the home hero. Cross-fades with a slow zoom,
// pauses on hover, focus, hidden tab or the pause button, and never auto-plays
// when reduced motion is on. Only the current and next photos are loaded.
export default function HeroSlideshow() {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(() => !reduced())
  const [hold, setHold] = useState(false)
  const [loaded, setLoaded] = useState(() => new Set([0]))
  const [cycle, setCycle] = useState(0)
  const root = useRef(null)
  const n = SLIDES.length

  const go = (i) => {
    const next = (i + n) % n
    setLoaded((s) => new Set(s).add(next).add((next + 1) % n))
    setIndex(next)
    setCycle((c) => c + 1)
  }

  // Preload the second photo once the first is on screen.
  useEffect(() => {
    const t = setTimeout(() => setLoaded((s) => new Set(s).add(1 % n)), 1500)
    return () => clearTimeout(t)
  }, [n])

  useEffect(() => {
    if (!playing || hold) return
    const t = setTimeout(() => go(index + 1), INTERVAL)
    return () => clearTimeout(t)
  }, [index, playing, hold, cycle])

  useEffect(() => {
    const onVis = () => setHold(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  const current = IMAGES[SLIDES[index]]
  const running = playing && !hold

  return (
    <div
      ref={root}
      className="absolute inset-0"
      role="region"
      aria-roledescription="carousel"
      aria-label="Photos of Rwanda"
    >
      {SLIDES.map((slug, i) => (
        <div
          key={slug}
          aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-[1400ms] ease-in-out motion-reduce:duration-0 ${
            i === index ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {loaded.has(i) && (
            <Photo
              key={i === index ? `${slug}-${cycle}` : slug}
              slug={slug}
              eager={i === 0}
              imgClassName={i === index ? (i % 2 ? 'kenburns-rev' : 'kenburns-once') : ''}
            />
          )}
        </div>
      ))}
      <div className="absolute inset-0 bg-overlay" />
      <div className="absolute inset-0 bg-ink/25" />

      {/* Controls and caption, above the text layer */}
      <div className="absolute inset-x-0 bottom-0 z-20">
        <div className="page-x flex flex-wrap items-center justify-between gap-3 pb-4">
          <p key={`cap-${index}`} className="fade-up order-2 text-xs text-white sm:order-1" aria-live={running ? 'off' : 'polite'}>
            {current.caption} · Photo: {current.author}, {current.license}
          </p>
          <div
            className="order-1 flex items-center gap-1 sm:order-2"
            onMouseEnter={() => setHold(true)}
            onMouseLeave={() => setHold(document.hidden)}
            onFocus={() => setHold(true)}
            onBlur={(e) => !root.current?.contains(e.relatedTarget) && setHold(false)}
          >
            <button type="button" onClick={() => go(index - 1)} className="slide-btn" aria-label="Previous photo">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            </button>
            <button
              type="button"
              onClick={() => setPlaying((p) => !p)}
              className="slide-btn"
              aria-label={playing ? 'Pause slideshow' : 'Play slideshow'}
            >
              {playing ? (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M5 3v10M11 3v10" stroke="currentColor" strokeWidth="2" /></svg>
              ) : (
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z" fill="currentColor" /></svg>
              )}
            </button>
            <button type="button" onClick={() => go(index + 1)} className="slide-btn" aria-label="Next photo">
              <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.8" /></svg>
            </button>
            <ol className="ml-2 flex items-center">
              {SLIDES.map((slug, i) => (
                <li key={slug}>
                  <button
                    type="button"
                    onClick={() => go(i)}
                    aria-label={`Photo ${i + 1} of ${n}: ${IMAGES[slug].caption}`}
                    aria-current={i === index ? 'true' : undefined}
                    className="flex h-11 w-8 items-center justify-center"
                  >
                    <span className="relative block h-0.5 w-6 overflow-hidden bg-white/40">
                      {i === index && (
                        <span
                          key={`p-${cycle}`}
                          className={`slide-progress absolute inset-y-0 left-0 bg-white ${running ? '' : 'is-paused'}`}
                          style={{ animationDuration: `${INTERVAL}ms` }}
                        />
                      )}
                      {i < index && <span className="absolute inset-0 bg-white/80" />}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
