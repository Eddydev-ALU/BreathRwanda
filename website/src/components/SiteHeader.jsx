import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'

const NAV = [
  { label: 'The Problem', to: '/problem' },
  {
    label: 'Explore the Data',
    items: [
      { to: '/map', label: 'Risk map', text: 'District map of risk and children exposed to smoke, with a panel for each district.' },
      { to: '/ranking', label: 'Ranking', text: 'All 30 districts in priority order, with uncertainty ranges and a CSV download.' },
    ],
  },
  { label: 'Plan a Budget', to: '/planner' },
  { label: 'Methods and Limits', to: '/methods' },
]

function useScrolled(limit = 24) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > limit)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [limit])
  return scrolled
}

function Dropdown({ item, solid }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const { pathname } = useLocation()
  const active = item.items.some((i) => pathname.startsWith(i.to))

  useEffect(() => setOpen(false), [pathname])
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    const onDown = (e) => !wrap.current?.contains(e.target) && setOpen(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div
      ref={wrap}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onBlur={(e) => !wrap.current?.contains(e.relatedTarget) && setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen((o) => !o)}
        className={`flex min-h-11 items-center gap-1.5 border-b-2 px-3 text-[0.95rem] ${
          active ? (solid ? 'border-accent' : 'border-white') : 'border-transparent'
        }`}
      >
        {item.label}
        <svg aria-hidden="true" width="10" height="6" viewBox="0 0 10 6" className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}>
          <path d="M1 1l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>
      <div
        className={`absolute left-1/2 top-full w-[34rem] -translate-x-1/2 pt-2 transition duration-200 ${
          open ? 'visible translate-y-0 opacity-100' : 'invisible -translate-y-1 opacity-0'
        }`}
      >
        <ul className="grid grid-cols-2 gap-px border border-line bg-line text-ink">
          {item.items.map((i) => (
            <li key={i.to} className="bg-card">
              <Link to={i.to} className="card-link block h-full p-5 text-ink no-underline hover:bg-bg">
                <span className="flex items-center gap-2 font-serif text-lg font-semibold">
                  <span className="grow-underline">{i.label}</span>
                  <span aria-hidden="true" className="card-arrow text-accent">→</span>
                </span>
                <span className="mt-1 block text-sm text-muted">{i.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function MobileMenu({ open, onClose }) {
  const panel = useRef(null)
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panel.current?.querySelector('a,button')?.focus()
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      document.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const link = 'flex min-h-12 items-center border-b border-line text-lg text-ink no-underline'
  return (
    <div
      className={`fixed inset-0 z-[1200] lg:hidden ${open ? 'visible' : 'invisible'}`}
      aria-hidden={!open}
    >
      <div
        className={`absolute inset-0 bg-ink/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`}
        onClick={onClose}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={`absolute inset-y-0 right-0 flex w-full max-w-sm flex-col bg-bg px-6 pb-8 pt-3 text-ink transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between">
          <Link to="/" onClick={onClose} className="py-3 font-serif text-xl font-semibold text-ink no-underline">
            BreathRwanda
          </Link>
          <button type="button" onClick={onClose} className="min-h-11 min-w-11 rounded border border-line px-3 text-sm text-ink">
            Close<span className="sr-only"> menu</span>
          </button>
        </div>
        <nav aria-label="Main" className="mt-6">
          <Link to="/" onClick={onClose} className={link}>
            Home
          </Link>
          {NAV.map((n) =>
            n.items ? (
              <div key={n.label} className="border-b border-line py-3">
                <p className="text-sm font-medium uppercase tracking-wider text-muted">{n.label}</p>
                {n.items.map((i) => (
                  <Link key={i.to} to={i.to} onClick={onClose} className="flex min-h-12 items-center pl-3 text-lg text-ink no-underline">
                    {i.label}
                  </Link>
                ))}
              </div>
            ) : (
              <Link key={n.to} to={n.to} onClick={onClose} className={link}>
                {n.label}
              </Link>
            ),
          )}
        </nav>
      </div>
    </div>
  )
}

export default function SiteHeader() {
  const scrolled = useScrolled()
  const [menu, setMenu] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setMenu(false), [pathname])
  const solid = scrolled

  return (
    <header
      className={`fixed inset-x-0 top-0 z-[1100] transition-colors duration-300 ${
        solid ? 'border-b border-line bg-bg text-ink' : 'border-b border-transparent bg-transparent text-white'
      }`}
    >
      <div className="page-x flex h-16 items-center justify-between">
        <Link to="/" className={`font-serif text-xl font-semibold no-underline ${solid ? 'text-ink' : 'text-white'}`}>
          BreathRwanda
        </Link>
        <nav aria-label="Main" className="hidden items-center lg:flex">
          {NAV.map((n) =>
            n.items ? (
              <Dropdown key={n.label} item={n} solid={solid} />
            ) : (
              <NavLink
                key={n.to}
                to={n.to}
                className={({ isActive }) =>
                  `flex min-h-11 items-center border-b-2 px-3 text-[0.95rem] no-underline ${
                    solid ? 'text-ink' : 'text-white'
                  } ${isActive ? (solid ? 'border-accent' : 'border-white') : 'border-transparent'}`
                }
              >
                {n.label}
              </NavLink>
            ),
          )}
        </nav>
        <button
          type="button"
          onClick={() => setMenu(true)}
          aria-expanded={menu}
          className={`min-h-11 rounded border px-4 text-sm lg:hidden ${solid ? 'border-line text-ink' : 'border-white/70 text-white'}`}
        >
          Menu
        </button>
      </div>
      <MobileMenu open={menu} onClose={() => setMenu(false)} />
    </header>
  )
}
