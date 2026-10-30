import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'

// A small "?" button that opens a short definition. Works with mouse, touch and keyboard:
// click or Enter/Space toggles it, Escape or a click elsewhere closes it.
export default function Tip({ label, children }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btn = useRef(null)
  const box = useRef(null)
  const id = useId()

  useLayoutEffect(() => {
    if (!open || !btn.current || !box.current) return
    const place = () => {
      const r = btn.current.getBoundingClientRect()
      const w = box.current.offsetWidth
      const h = box.current.offsetHeight
      const left = Math.max(16, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 16))
      const below = r.bottom + 8
      const top = below + h > window.innerHeight - 8 && r.top - h - 8 > 8 ? r.top - h - 8 : below
      setPos({ left, top })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setOpen(false)
        btn.current?.focus()
      }
    }
    const onDown = (e) => {
      if (!btn.current?.contains(e.target) && !box.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <span className="inline-block align-middle">
      <button
        ref={btn}
        type="button"
        aria-label={`What does "${label}" mean?`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation()
          setOpen((o) => !o)
        }}
        className="relative ml-1 inline-flex h-6 w-6 items-center justify-center rounded-lg border border-line bg-surface font-sans text-xs font-semibold leading-none text-muted after:absolute after:-inset-2.5 after:content-[''] hover:border-muted hover:text-ink"
      >
        ?
      </button>
      {open && (
        <span
          ref={box}
          id={id}
          role="tooltip"
          style={pos ? { left: pos.left, top: pos.top } : { visibility: 'hidden', left: 0, top: 0 }}
          className="fixed z-[1100] block w-72 max-w-[calc(100vw-32px)] rounded-xl border border-line bg-surface p-3 shadow-box text-left font-sans text-sm font-normal normal-case leading-normal tracking-normal text-ink"
        >
          <span className="mb-1 block font-semibold">{label}</span>
          {children}
        </span>
      )}
    </span>
  )
}
