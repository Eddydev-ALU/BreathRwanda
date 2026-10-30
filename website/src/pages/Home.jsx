import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useData } from '../lib/data.js'
import { fmtInt, fmtPct, NO_DATA } from '../lib/format.js'
import { usePageMeta } from '../components/Status.jsx'
import { Term } from '../components/terms.jsx'
import Photo from '../components/Photo.jsx'
import Reveal, { useInView } from '../components/Reveal.jsx'
import HeroSlideshow from '../components/HeroSlideshow.jsx'
import { useParallax } from '../components/useParallax.js'

const WHO_URL = 'https://www.who.int/news-room/fact-sheets/detail/household-air-pollution-and-health'

// Thin rising lines over the hero photo, like smoke. Decorative only.
function Smoke() {
  const lines = [12, 27, 41, 58, 73, 88]
  return (
    <svg aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 w-full" viewBox="0 0 100 50" preserveAspectRatio="none">
      {lines.map((x, i) => (
        <path
          key={x}
          className="smoke-line"
          style={{ animationDelay: `${i * 1.4}s` }}
          d={`M${x} 50 C ${x - 3} 40, ${x + 3} 32, ${x} 24 S ${x - 3} 10, ${x + 1} 2`}
          fill="none"
          stroke="#FFFFFF"
          strokeOpacity="0.14"
          strokeWidth="0.25"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

// Counts from 0 to the value once, when it scrolls into view.
function CountUp({ value, format }) {
  const [ref, seen] = useInView()
  const [shown, setShown] = useState(0)
  useEffect(() => {
    if (!seen || !Number.isFinite(value)) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value)
      return
    }
    const start = performance.now()
    let raf
    const step = (t) => {
      const k = Math.min(1, (t - start) / 1400)
      setShown(value * (1 - (1 - k) ** 3))
      if (k < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [seen, value])
  if (!Number.isFinite(value)) return <span ref={ref}>{NO_DATA}</span>
  return (
    <span ref={ref}>
      <span aria-hidden="true">{format(shown)}</span>
      <span className="sr-only">{format(value)}</span>
    </span>
  )
}

function Stat({ value, format, children, delay }) {
  return (
    <Reveal delay={delay} className="box h-full p-6">
      <p className="font-serif text-3xl font-bold leading-none tabular-nums sm:text-4xl">
        <CountUp value={value} format={format} />
      </p>
      <p className="mt-3 text-[0.95rem] text-muted">{children}</p>
    </Reveal>
  )
}

function Card({ to, image, label, title, children, delay, external }) {
  const inner = (
    <>
      <div className="aspect-[16/10] overflow-hidden bg-line">
        <Photo slug={image} imgClassName="card-img" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
        <h3 className="mt-2 text-lg text-ink">
          <span className="grow-underline">{title}</span>
        </h3>
        <p className="mt-2 flex-1 text-[0.95rem] text-muted">{children}</p>
        <p className="mt-4 text-sm font-medium text-accent">
          {external ? 'Read more' : 'Open'} <span aria-hidden="true" className="card-arrow inline-block">→</span>
        </p>
      </div>
    </>
  )
  return (
    <Reveal delay={delay} className="h-full">
      <Link to={to} className="card-link box flex h-full flex-col overflow-hidden no-underline">
        {inner}
      </Link>
    </Reveal>
  )
}

function findings(districts) {
  if (!districts?.length) return []
  const byRank = [...districts].sort((a, b) => a.priorityRank - b.priorityRank)
  const [first, second] = byRank
  const indoor = districts.reduce((m, d) => (d.childrenIndoorSmoke > m.childrenIndoorSmoke ? d : m))
  const hi = districts.reduce((m, d) => (d.risk > m.risk ? d : m))
  const lo = districts.reduce((m, d) => (d.risk < m.risk ? d : m))
  return [
    {
      to: '/ranking',
      image: 'village',
      title: `${first.name} and ${second.name} come first for clean stoves`,
      text: `Ranked 1 and 2, likely between ${first.priorityRankLo}–${first.priorityRankHi} and ${second.priorityRankLo}–${second.priorityRankHi}. Each stove there reaches many young children with high baseline risk.`,
    },
    {
      to: `/map?district=${encodeURIComponent(indoor.name)}&measure=indoor`,
      image: 'cooking-wood',
      title: `${indoor.name} has the most children breathing smoke indoors`,
      text: `${fmtInt(indoor.childrenIndoorSmoke)} children under 5 live in homes that burn polluting fuel inside the house.`,
    },
    {
      to: '/map',
      image: 'firewood-carry',
      title: `Risk ranges from ${fmtPct(lo.risk)} in ${lo.name} to ${fmtPct(hi.risk)} in ${hi.name}`,
      text: 'Estimated share of children under 5 with cough and fast breathing in a two-week period, by district.',
    },
  ]
}

function ParallaxPhoto({ slug }) {
  const ref = useParallax(0.12)
  return (
    <div ref={ref} className="absolute inset-x-0 -bottom-[12%] -top-[12%] will-change-transform">
      <Photo slug={slug} />
    </div>
  )
}

export default function Home() {
  usePageMeta(
    null,
    'Which Rwandan districts have the most young children exposed to cooking smoke, and where clean cooking stoves would protect the most children for a given budget.',
  )
  const navigate = useNavigate()
  const { status, data, retry } = useData(['model', 'districts'])
  const n = data?.model?.national || {}
  const share =
    Number.isFinite(n.national_children_exposed) && Number.isFinite(n.census_children_u5)
      ? (100 * n.national_children_exposed) / n.census_children_u5
      : NaN
  const districts = data?.districts
  const sorted = districts ? [...districts].sort((a, b) => a.name.localeCompare(b.name)) : []

  return (
    <>
      {/* Hero */}
      <section className="relative isolate flex min-h-[86svh] items-end overflow-hidden bg-ink text-white">
        <HeroSlideshow />
        <Smoke />
        <div className="page-x relative z-10 w-full pb-32 pt-32 sm:pb-28">
          <p className="fade-up text-sm font-medium uppercase tracking-wider text-white">Children and cooking smoke in Rwanda</p>
          <h1 className="fade-up mt-3 max-w-[20ch] text-3xl text-white sm:text-5xl" style={{ animationDelay: '120ms' }}>
            Where will clean cooking stoves protect the most children in Rwanda?
          </h1>
          <p className="fade-up mt-5 max-w-prose text-white sm:text-lg" style={{ animationDelay: '240ms' }}>
            Most homes cook with firewood or charcoal. BreathRwanda shows which districts have the most children exposed,
            and where a stove budget protects the most of them.
          </p>
          <div className="fade-up mt-8" style={{ animationDelay: '360ms' }}>
            <Link
              to="/map"
              className="card-link btn btn-light"
            >
              Explore the map <span aria-hidden="true" className="card-arrow inline-block">→</span>
            </Link>
          </div>
          <a
            href="#numbers"
            className="scroll-cue mt-10 hidden items-center gap-2 text-sm text-white no-underline lg:inline-flex"
            onClick={(e) => {
              e.preventDefault()
              document.getElementById('numbers')?.scrollIntoView({ behavior: 'smooth' })
            }}
          >
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14"><path d="M2 5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>
            Scroll to the numbers
          </a>
        </div>
      </section>

      {/* Key numbers */}
      <section aria-labelledby="numbers" className="bg-bg">
        <div className="page-x py-16 sm:py-20">
          <Reveal>
            <h2 id="numbers" className="rule text-2xl sm:text-3xl">
              Rwanda in four numbers
            </h2>
          </Reveal>
          {status === 'error' && (
            <p role="alert" className="mt-4">
              The numbers could not be loaded.{' '}
              <button type="button" onClick={retry} className="min-h-11 text-accent underline">
                Try again
              </button>
            </p>
          )}
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-busy={status === 'loading'}>
            <Stat delay={0} value={n.census_children_u5 / 1e6} format={(x) => `${x.toFixed(2)} million`}>
              children under 5 in Rwanda
            </Stat>
            <Stat delay={90} value={share} format={(x) => `${Math.round(x)}%`}>
              live in homes cooking with polluting fuel
              <Term k="pollutingFuel" />
            </Stat>
            <Stat delay={180} value={n.national_children_indoor_smoke} format={(x) => `about ${fmtInt(Math.round(x / 1000) * 1000)}`}>
              breathe that smoke inside the house
              <Term k="indoor" />
            </Stat>
            <Stat delay={270} value={n.national_children_with_symptoms} format={(x) => `about ${fmtInt(Math.round(x / 1000) * 1000)}`}>
              have cough with fast breathing in any two-week period
            </Stat>
          </div>
          <p className="mt-10 max-w-prose text-sm text-muted">
            Estimates from household surveys (EICV7 2023/24, Rwanda DHS 2019-20 and 2025) and the 2022 Census.{' '}
            <Link to="/methods">How they were made</Link>.
          </p>
        </div>
      </section>

      {/* Explore the data */}
      <section aria-labelledby="explore" className="bg-card">
        <div className="page-x grid items-center gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16">
          <Reveal className="box aspect-[16/10] overflow-hidden">
            <Photo slug="hills-terraces" />
          </Reveal>
          <Reveal delay={100}>
            <p className="text-sm font-medium uppercase tracking-wider text-muted">Explore the data</p>
            <h2 id="explore" className="rule mt-2 text-2xl sm:text-3xl">
              See the numbers for your district
            </h2>
            <p className="mt-4 max-w-prose">
              See risk, children exposed and smoke inside the house for each of Rwanda’s 30 districts, with the
              uncertainty behind every number.
            </p>
            <div className="mt-6 flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="home-district" className="block text-sm font-medium">
                  Your district
                </label>
                <select
                  id="home-district"
                  defaultValue=""
                  onChange={(e) => e.target.value && navigate(`/map?district=${encodeURIComponent(e.target.value)}`)}
                  className="mt-1 min-h-11 w-64 max-w-full rounded-lg border border-line bg-card px-3"
                >
                  <option value="">Choose a district</option>
                  {sorted.map((d) => (
                    <option key={d.code} value={d.name}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <Link
                to="/map"
                className="btn btn-solid"
              >
                Open the risk map
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Resources */}
      <section aria-labelledby="tools" className="bg-bg">
        <div className="page-x py-16 sm:py-20">
          <Reveal>
            <h2 id="tools" className="rule text-2xl sm:text-3xl">
              Tools and methods
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Card delay={0} to="/map" image="kinigi-hills" label="Tool" title="Risk map">
              Colour the 30 districts by risk, children exposed or smoke indoors, and open any district for its details.
            </Card>
            <Card delay={90} to="/planner" image="cookstove-improved" label="Tool" title="Priority planner">
              Set a budget and a stove type, and see which districts get stoves first and how many children they reach.
            </Card>
            <Card delay={180} to="/methods" image="nyabarongo" label="Report" title="Methods and limits">
              The data, the model, how good it is, and what these numbers cannot tell you.
            </Card>
          </div>
        </div>
      </section>

      {/* Key findings */}
      <section aria-labelledby="findings" className="bg-card">
        <div className="page-x py-16 sm:py-20">
          <Reveal>
            <h2 id="findings" className="rule text-2xl sm:text-3xl">
              Key findings
            </h2>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {findings(districts).map((f, i) => (
              <Card key={f.title} delay={i * 90} to={f.to} image={f.image} label="Finding · EICV7 2023/24 and Census 2022" title={f.title}>
                {f.text}
              </Card>
            ))}
            {status === 'loading' && <p className="text-muted">Loading findings…</p>}
          </div>
        </div>
      </section>

      {/* Learn more */}
      <section aria-labelledby="learn" className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10">
          <ParallaxPhoto slug="hills-mist" />
          <div className="absolute inset-0 bg-overlay" />
          <div className="absolute inset-0 bg-ink/25" />
        </div>
        <div className="page-x py-20 sm:py-24">
          <Reveal>
            <p className="text-sm font-medium uppercase tracking-wider text-white/80">Learn more</p>
            <h2 id="learn" className="rule rule-light mt-2 max-w-[30ch] text-3xl text-white sm:text-4xl">
              Why smoke from cooking matters for children under 5
            </h2>
            <p className="mt-4 max-w-prose text-white">
              Household air pollution is the smoke from cooking with wood, charcoal and other polluting fuels in and
              around the home. In Rwanda, nearly every child under 5 lives in a home that cooks this way.
            </p>
          </Reveal>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              {
                h: 'Most exposed',
                t: 'Women and children spend the most time near the hearth, so their exposure is the highest.',
                src: true,
              },
              {
                h: '100 times',
                t: 'In poorly ventilated homes, fine particles from indoor smoke can be 100 times higher than acceptable levels.',
                src: true,
              },
              {
                h: Number.isFinite(share) ? `${Math.round(share)}%` : NO_DATA,
                t: 'of children under 5 in Rwanda live in homes that cook mainly with polluting fuel (Census 2022).',
              },
            ].map((f, i) => (
              <Reveal key={f.h} delay={i * 90} className="rounded-2xl bg-white/10 p-6 shadow-box backdrop-blur-sm">
                <p className="font-serif text-2xl font-semibold text-white">{f.h}</p>
                <p className="mt-2 text-white">{f.t}</p>
                {f.src && (
                  <p className="mt-2 text-sm">
                    <a href={WHO_URL} target="_blank" rel="noreferrer" className="text-white underline underline-offset-4">
                      Source: WHO fact sheet, 2025
                    </a>
                  </p>
                )}
              </Reveal>
            ))}
          </div>
          <Reveal className="mt-10">
            <Link
              to="/problem"
              className="btn btn-ghost-light"
            >
              Read about the problem <span aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}
