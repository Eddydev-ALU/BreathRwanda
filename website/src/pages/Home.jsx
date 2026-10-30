import { Link } from 'react-router-dom'
import { useData } from '../lib/data.js'
import { fmtAbout, fmtMillions, NO_DATA } from '../lib/format.js'
import { usePageMeta } from '../components/Status.jsx'
import { Term } from '../components/terms.jsx'

function Stat({ value, children }) {
  const missing = value === '…' || /No data/.test(value)
  return (
    <div className="border-t border-line pt-4">
      <p className={`font-serif text-4xl font-semibold leading-none sm:text-5xl ${missing ? 'text-muted' : ''}`}>{value}</p>
      <p className="mt-3 max-w-[22ch] text-[0.95rem] text-muted">{children}</p>
    </div>
  )
}

export default function Home() {
  usePageMeta(
    null,
    'Which Rwandan districts have the most young children exposed to cooking smoke, and where clean cooking stoves would protect the most children for a given budget.',
  )
  const { status, data, retry } = useData(['model'])
  const n = data?.model?.national || {}
  const share =
    Number.isFinite(n.national_children_exposed) && Number.isFinite(n.census_children_u5)
      ? `${Math.round((100 * n.national_children_exposed) / n.census_children_u5)}%`
      : NO_DATA
  const show = (v) => (status === 'loading' ? '…' : v)

  return (
    <div className="mx-auto max-w-6xl px-4 pb-8 pt-10 sm:px-6 sm:pt-16">
      <p className="text-sm font-medium uppercase tracking-wider text-muted">Children and cooking smoke in Rwanda</p>
      <h1 className="mt-3 max-w-[20ch] text-4xl sm:text-5xl lg:text-6xl">
        Where will clean cooking stoves protect the most children in Rwanda?
      </h1>
      <p className="mt-6 max-w-prose text-lg">
        Most Rwandan homes cook with firewood or charcoal. The smoke is linked to cough with fast breathing in young
        children. BreathRwanda shows which districts have the most children exposed, and helps planners decide where
        a stove budget protects the most children.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          to="/map"
          className="inline-flex min-h-12 items-center rounded border border-accent bg-accent px-6 font-medium text-white no-underline hover:bg-ink hover:border-ink"
        >
          Explore the map
        </Link>
        <Link
          to="/planner"
          className="inline-flex min-h-12 items-center rounded border border-accent px-6 font-medium text-accent no-underline hover:bg-surface"
        >
          Plan a budget
        </Link>
      </div>

      <section aria-labelledby="numbers" className="mt-14 sm:mt-20">
        <h2 id="numbers" className="sr-only">
          Key numbers
        </h2>
        {status === 'error' && (
          <p role="alert" className="mb-6">
            The numbers could not be loaded.{' '}
            <button type="button" onClick={retry} className="min-h-11 text-accent underline">
              Try again
            </button>
          </p>
        )}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4" aria-busy={status === 'loading'}>
          <Stat value={show(fmtMillions(n.census_children_u5))}>children under 5 in Rwanda</Stat>
          <Stat value={show(share)}>
            live in homes cooking with polluting fuel
            <Term k="pollutingFuel" />
          </Stat>
          <Stat value={show(`about ${fmtAbout(n.national_children_indoor_smoke)}`)}>
            breathe that smoke inside the house
            <Term k="indoor" />
          </Stat>
          <Stat value={show(`about ${fmtAbout(n.national_children_with_symptoms)}`)}>
            have cough with fast breathing in any two-week period
          </Stat>
        </div>
        <p className="mt-8 max-w-prose text-sm text-muted">
          These numbers are estimates from household surveys (EICV7 2023/24, Rwanda DHS 2019-20 and 2025) scaled to
          the 2022 Census. <Link to="/methods">How they were made</Link>.
        </p>
      </section>
    </div>
  )
}
