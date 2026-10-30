import { lazy, Suspense, useEffect } from 'react'
import { Link, Route, Routes, useLocation } from 'react-router-dom'
import Home from './pages/Home.jsx'
import { Loading } from './components/Status.jsx'
import SiteHeader from './components/SiteHeader.jsx'
import SiteFooter from './components/SiteFooter.jsx'
import PageHero from './components/PageHero.jsx'

const Problem = lazy(() => import('./pages/Problem.jsx'))
const MapPage = lazy(() => import('./pages/MapPage.jsx'))
const Ranking = lazy(() => import('./pages/Ranking.jsx'))
const Planner = lazy(() => import('./pages/Planner.jsx'))
const Methods = lazy(() => import('./pages/Methods.jsx'))

function NotFound() {
  return (
    <>
      <PageHero image="hills-mist" title="Page not found" />
      <div className="page-x py-12">
        <Link to="/">Go to the home page</Link>
      </div>
    </>
  )
}

export default function App() {
  const { pathname, hash } = useLocation()
  useEffect(() => {
    if (hash) {
      // Wait for the lazy page to render, then jump to the section.
      const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView(), 300)
      return () => clearTimeout(t)
    }
    window.scrollTo(0, 0)
  }, [pathname, hash])

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-[1300] focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        <Suspense fallback={<Loading />}>
          <div key={pathname} className="page-fade">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/problem" element={<Problem />} />
              <Route path="/map" element={<MapPage />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/planner" element={<Planner />} />
              <Route path="/methods" element={<Methods />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </Suspense>
      </main>
      <SiteFooter />
    </div>
  )
}
