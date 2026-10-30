import { lazy, Suspense, useEffect } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import { Loading } from './components/Status.jsx'

const MapPage = lazy(() => import('./pages/MapPage.jsx'))
const Ranking = lazy(() => import('./pages/Ranking.jsx'))
const Planner = lazy(() => import('./pages/Planner.jsx'))
const Methods = lazy(() => import('./pages/Methods.jsx'))

const LINKS = [
  { to: '/', label: 'Home', end: true },
  { to: '/map', label: 'Map' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/planner', label: 'Planner' },
  { to: '/methods', label: 'Methods' },
]

function Header() {
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 px-4 sm:px-6">
        <NavLink to="/" className="py-3 font-serif text-xl font-semibold text-ink no-underline">
          BreathRwanda
        </NavLink>
        <nav aria-label="Main" className="-mx-2 flex w-full overflow-x-auto sm:mx-0 sm:w-auto">
          {LINKS.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) =>
                `flex min-h-11 items-center border-b-2 px-2 text-[0.95rem] no-underline sm:px-3 ${
                  isActive ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'
                }`
              }
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
      </div>
    </header>
  )
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-8 text-sm text-muted sm:px-6">
        <p className="max-w-prose">
          BreathRwanda is a project for the NISR 2026 Big Data Hackathon. Data: NISR EICV7 2023/24, Rwanda DHS 2019-20
          and 2025, Population and Housing Census 2022.{' '}
          <NavLink to="/methods">Methods and limits</NavLink>
        </p>
      </div>
    </footer>
  )
}

function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <h1 className="text-3xl">Page not found</h1>
      <p className="mt-4">
        <NavLink to="/">Go to the home page</NavLink>
      </p>
    </div>
  )
}

export default function App() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-2 focus:bg-surface focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/ranking" element={<Ranking />} />
            <Route path="/planner" element={<Planner />} />
            <Route path="/methods" element={<Methods />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
