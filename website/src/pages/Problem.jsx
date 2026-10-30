import { Link } from 'react-router-dom'
import { useData } from '../lib/data.js'
import { fmtInt, fmtRWF, NO_DATA } from '../lib/format.js'
import { LoadError, Loading, usePageMeta } from '../components/Status.jsx'
import { Term } from '../components/terms.jsx'
import PageHero from '../components/PageHero.jsx'
import Photo from '../components/Photo.jsx'
import Reveal from '../components/Reveal.jsx'

const WHO_URL = 'https://www.who.int/news-room/fact-sheets/detail/household-air-pollution-and-health'

// Our own line drawing, used where no freely licensed photo of an LPG kit was found.
function LpgDrawing() {
  return (
    <svg viewBox="0 0 320 200" role="img" aria-label="Line drawing of a gas cylinder connected to a two-burner stove" className="h-full w-full bg-scale-0">
      <g fill="none" stroke="#1F5C4A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <rect x="52" y="70" width="64" height="104" rx="18" />
        <path d="M70 70v-14h28v14M76 56v-10h16v10" />
        <path d="M52 100h64M52 146h64" />
        <path d="M116 120c30 0 34-24 64-24" />
        <rect x="170" y="112" width="110" height="36" rx="3" />
        <path d="M190 112v-8h24v8M236 112v-8h24v8" />
        <path d="M184 164h12M254 164h12M190 148v16M260 148v16" />
        <circle cx="202" cy="130" r="5" />
        <circle cx="248" cy="130" r="5" />
      </g>
    </svg>
  )
}

function Section({ n, id, title, image, imageNode, children, flip }) {
  return (
    <section aria-labelledby={id} className={n % 2 ? 'bg-card' : 'bg-bg'}>
      <div className={`page-x grid items-start gap-10 py-16 sm:py-20 lg:grid-cols-2 lg:gap-16 ${flip ? 'lg:[&>*:first-child]:order-2' : ''}`}>
        <Reveal>
          <p className="text-sm font-medium uppercase tracking-wider text-muted">Part {n}</p>
          <h2 id={id} className="rule mt-2 text-3xl sm:text-4xl">
            {title}
          </h2>
          <div className="mt-5 max-w-prose space-y-4">{children}</div>
        </Reveal>
        <Reveal delay={100} className="aspect-[16/10] overflow-hidden rounded border border-line">
          {imageNode || <Photo slug={image} />}
        </Reveal>
      </div>
    </section>
  )
}

function Fact({ value, children }) {
  return (
    <div className="border-t border-line pt-3">
      <p className="font-serif text-3xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-sm text-muted">{children}</p>
    </div>
  )
}

export default function Problem() {
  usePageMeta('The problem', 'Why smoke from cooking matters for children under 5 in Rwanda, and what clean cooking can change.')
  const { status, data, error, retry } = useData(['model', 'districts', 'assumptions'])

  const hero = (
    <PageHero image="hills-mist" eyebrow="The problem" title="Cooking smoke and Rwanda’s youngest children">
      Most Rwandan homes cook with wood or charcoal. This page explains why that matters for children under 5, using
      our data and published sources.
    </PageHero>
  )
  if (status === 'loading') return <>{hero}<Loading /></>
  if (status === 'error') return <>{hero}<LoadError error={error} retry={retry} /></>

  const n = data.model.national
  const rate = (cat) => data.model.descriptiveRates.find((r) => r.category === cat)
  const inside = rate('Polluting fuel, cooked in the house')
  const outside = rate('Polluting fuel, cooked outside the house')
  const clean = rate('Clean fuel')
  const pct = (r) => (r ? `${r.pct.toFixed(1)}%` : NO_DATA)
  const exposedShare = n.national_children_exposed / n.census_children_u5
  const indoorShare = n.national_children_indoor_smoke / n.census_children_u5
  const topIndoor = [...data.districts].sort((a, b) => b.childrenIndoorSmoke - a.childrenIndoorSmoke).slice(0, 3)
  const stoveName = { ics: 'Improved cookstove', lpg: 'LPG kit', epc: 'Electric pressure cooker' }

  return (
    <>
      {hero}

      <Section n={1} id="why" title="Why cooking smoke matters" image="cooking-wood">
        <p>
          Burning wood, charcoal, straw or dung in simple stoves and open fires fills the home with smoke. The World Health
          Organization describes household air pollution as coming from “inefficient and polluting fuels and
          technologies in and around the home”.
        </p>
        <p>
          In homes with poor ventilation, indoor smoke can carry fine particles at levels 100 times higher than
          acceptable.{' '}
          <a href={WHO_URL} target="_blank" rel="noreferrer">
            Source: WHO fact sheet on household air pollution (2025)
          </a>
          .
        </p>
      </Section>

      <Section n={2} id="children" title="Children under 5 are most exposed" image="firewood-carry" flip>
        <p>
          According to the WHO, exposure is highest among women and children, who spend the most time near the
          cooking fire.{' '}
          <a href={WHO_URL} target="_blank" rel="noreferrer">
            Source: WHO (2025)
          </a>
          .
        </p>
        <p>
          In the Rwanda DHS 2019-20 and 2025, cough with fast breathing was reported for {pct(inside)} of children in
          homes that burn polluting fuel inside the house, {pct(outside)} where it is burned outside the house, and{' '}
          {pct(clean)} in homes with clean fuel.
        </p>
        <p className="text-sm text-muted">
          These are raw survey rates. After taking wealth, province and child age into account, the surveys cannot show a
          clear effect of fuel on its own. See <Link to="/methods">Methods and limits</Link>.
        </p>
      </Section>

      <Section n={3} id="today" title="Rwanda today" image="kigali">
        <div className="grid grid-cols-2 gap-6">
          <Fact value={fmtInt(n.census_children_u5)}>children under 5 (Census 2022)</Fact>
          <Fact value={`${(100 * exposedShare).toFixed(1)}%`}>
            live in homes cooking mainly with polluting fuel
            <Term k="pollutingFuel" />
          </Fact>
          <Fact value={`${(100 * indoorShare).toFixed(1)}%`}>
            live where it is burned inside the house (about {fmtInt(Math.round(n.national_children_indoor_smoke / 1000) * 1000)})
            <Term k="indoor" />
          </Fact>
          <Fact value={fmtInt(n.national_polluting_hh)}>households cook mainly with polluting fuel (Census 2022)</Fact>
        </div>
        <p>
          Smoke inside the house is most common in {topIndoor.map((d) => d.name).join(', ')}.{' '}
          <Link to={`/map?measure=indoor&district=${encodeURIComponent(topIndoor[0].name)}`}>See it on the map</Link>.
        </p>
      </Section>

      <Section
        n={4}
        id="change"
        title="What clean cooking can change"
        flip
        imageNode={
          <div className="grid h-full grid-cols-3 gap-px bg-line">
            <Photo slug="cookstove-improved" />
            <LpgDrawing />
            <Photo slug="pressure-cooker" />
          </div>
        }
      >
        <p>Cleaner stoves cut the smoke a family breathes. The planner compares three options:</p>
        <ul className="divide-y divide-line border-y border-line">
          {['ics', 'lpg', 'epc'].map((id) => data.assumptions.stoves.find((s) => s.id === id)).filter(Boolean).map((s) => (
            <li key={s.id} className="flex items-baseline justify-between gap-4 py-2.5">
              <span>{stoveName[s.id] || s.name}</span>
              <span className="tabular-nums text-muted">{fmtRWF(s.cost)}</span>
            </li>
          ))}
        </ul>
        <p>
          How much this lowers cough with fast breathing is uncertain. Randomised trials found small effects that were not
          statistically clear, while observational studies suggest larger ones. So the planner shows cases averted
          <Term k="casesAverted" /> as a range, with every source listed on the <Link to="/methods">Methods page</Link>.
        </p>
        <p>
          <Link
            to="/planner"
            className="inline-flex min-h-12 items-center rounded border border-accent bg-accent px-6 font-medium text-white no-underline hover:border-ink hover:bg-ink"
          >
            Plan a budget
          </Link>
        </p>
      </Section>
    </>
  )
}
