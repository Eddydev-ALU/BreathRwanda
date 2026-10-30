import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data.js'
import { plan } from '../lib/planner.js'
import { downloadCsv } from '../lib/csv.js'
import { fmtInt, fmtRWF, parseAmount } from '../lib/format.js'
import { AnimatedNumber, Banner, Loading, LoadError, usePageMeta } from '../components/Status.jsx'
import SortTable from '../components/SortTable.jsx'
import Tip from '../components/Tip.jsx'
import { Term } from '../components/terms.jsx'
import PageHero from '../components/PageHero.jsx'

const SLIDER_MAX_RWF = 20_000_000_000
const SLIDER_STEPS = 1000
// The slider is quadratic so small budgets stay easy to pick and 20 billion is still reachable.
const fromSlider = (t) => {
  const v = SLIDER_MAX_RWF * (t / SLIDER_STEPS) ** 2
  return v < 1e8 ? Math.round(v / 1e6) * 1e6 : Math.round(v / 1e7) * 1e7
}
const toSlider = (b) => Math.round(Math.sqrt(Math.min(b, SLIDER_MAX_RWF) / SLIDER_MAX_RWF) * SLIDER_STEPS)

const STOVE_NAMES = { ics: 'Improved cookstove', lpg: 'LPG kit', epc: 'Electric pressure cooker' }
const STOVE_ORDER = ['ics', 'lpg', 'epc']

const paramsOf = (s) => ({
  cost: s.cost,
  usage: s.usage,
  effectTrial: s.effect?.trial,
  effectObservational: s.effect?.observational,
})

// Turns the URLs inside a source note into links.
function SourceText({ text }) {
  if (!text) return <span>No source given.</span>
  const parts = text.split(/(https?:\/\/[^\s)]+[^\s).,;])/g)
  return parts.map((p, i) =>
    /^https?:\/\//.test(p) ? (
      <a key={i} href={p} target="_blank" rel="noreferrer" className="break-all">
        {p.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]}
      </a>
    ) : (
      <span key={i}>{p}</span>
    ),
  )
}

function NumberField({ id, label, value, onChange, suffix, hint }) {
  const [text, setText] = useState(null)
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          value={text ?? String(value)}
          onChange={(e) => {
            setText(e.target.value)
            const n = Number(e.target.value.replace(/,/g, ''))
            if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(n)
          }}
          onBlur={() => setText(null)}
          aria-describedby={hint ? `${id}-hint` : undefined}
          className="min-h-11 w-32 rounded border border-line bg-surface px-3 tabular-nums"
        />
        <span className="text-sm text-muted">{suffix}</span>
      </div>
      {hint && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  )
}

function BigNumber({ label, children, extra, wide }) {
  return (
    <div className={`border-t border-line pt-3 ${wide ? 'col-span-2' : ''}`}>
      <p className="text-sm text-muted">
        {label}
        {extra}
      </p>
      <p className="mt-1 font-serif text-3xl font-semibold leading-tight sm:text-4xl">{children}</p>
    </div>
  )
}

function BarChart({ rows }) {
  const max = Math.max(1, ...rows.map((r) => r.stoves))
  return (
    <figure>
      <figcaption className="text-sm text-muted">Stoves per district, in the order they are served</figcaption>
      <ol className="mt-3 space-y-2" aria-hidden="true">
        {rows.map((r) => (
          <li key={r.code} className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
            <span className="truncate">{r.name}</span>
            <span className="flex items-center gap-2">
              <span className="h-4 bg-scale-4 transition-[width] duration-500 ease-out motion-reduce:transition-none" style={{ width: `${Math.max(0.5, (r.stoves / max) * 75)}%` }} />
              <span className="whitespace-nowrap tabular-nums text-muted">{fmtInt(r.stoves)}</span>
            </span>
          </li>
        ))}
      </ol>
      <p className="sr-only">The same numbers are in the table below.</p>
    </figure>
  )
}

// Phones only: keeps the totals in view while the settings are being changed.
function SummaryBar({ result, target }) {
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    const el = target.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(([e]) => setHidden(e.isIntersecting || e.boundingClientRect.top < 0), {
      threshold: 0,
    })
    io.observe(el)
    return () => io.disconnect()
  }, [target])
  if (hidden) return null
  return (
    <div className="fixed inset-x-0 bottom-0 z-[900] border-t border-line bg-bg px-4 py-2 lg:hidden">
      <a
        href="#results-heading"
        className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink no-underline"
        onClick={(e) => {
          e.preventDefault()
          target.current?.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        <span className="tabular-nums">
          <strong>{fmtInt(result.stoves)}</strong> stoves · <strong>{fmtInt(result.children)}</strong> children ·{' '}
          <strong>
            {fmtInt(result.casesLow)}–{fmtInt(result.casesHigh)}
          </strong>{' '}
          cases averted
        </span>
        <span className="shrink-0 text-accent underline">Results</span>
      </a>
    </div>
  )
}

export default function Planner() {
  usePageMeta(
    'Stove budget planner',
    'Choose a budget and a stove type to see how many stoves can be bought, which districts they reach and how many children they protect.',
  )
  const { status, data, error, retry } = useData(['districts', 'assumptions'])
  const a = data?.assumptions
  const stoves = useMemo(
    () => (a ? STOVE_ORDER.map((id) => a.stoves.find((s) => s.id === id)).filter(Boolean) : []),
    [a],
  )

  const [stoveId, setStoveId] = useState(null)
  const [budget, setBudget] = useState(null)
  const [priority, setPriority] = useState('risk')
  const [edits, setEdits] = useState({})
  const resultsRef = useRef(null)

  const activeId = stoveId || a?.defaults?.stove || 'ics'
  const stove = stoves.find((s) => s.id === activeId) || stoves[0]
  const amount = budget ?? a?.defaults?.budgetRWF ?? 0
  const params = stove ? { ...paramsOf(stove), ...edits[stove.id] } : null
  const result = useMemo(
    () => (data && params ? plan(data.districts, params, amount, priority) : null),
    [data, params?.cost, params?.usage, params?.effectTrial, params?.effectObservational, amount, priority],
  )

  const hero = (
    <PageHero image="cookstoves-uganda" eyebrow="Plan a budget" title="What-if stove planner">
      Set a budget and a stove type. Stoves go first to the districts where each one is expected to prevent the most
      cases of cough with fast breathing, up to the number of households there that cook with polluting fuel.
    </PageHero>
  )
  if (status === 'loading') return <>{hero}<Loading what="the planner" /></>
  if (status === 'error') return <>{hero}<LoadError error={error} retry={retry} /></>
  if (!stove) return <LoadError error={new Error('No stove types found in assumptions.json.')} retry={retry} />

  const edited = Boolean(edits[stove.id])
  const setParam = (k, v) => setEdits((e) => ({ ...e, [stove.id]: { ...paramsOf(stove), ...e[stove.id], [k]: v } }))
  const costInvalid = !(params.cost > 0)

  const columns = [
    { key: 'order', header: 'Order', sortLabel: 'Order served', sort: (r) => r.order, render: (r) => r.order },
    { key: 'name', header: 'District', sort: (r) => r.name, render: (r) => r.name },
    { key: 'stoves', header: 'Stoves', align: 'right', sort: (r) => r.stoves, render: (r) => fmtInt(r.stoves) },
    {
      key: 'children',
      header: 'Children reached',
      align: 'right',
      sort: (r) => r.children,
      render: (r) => fmtInt(r.children),
    },
    {
      key: 'cases',
      header: 'Cases averted',
      term: <Term k="casesAverted" />,
      align: 'right',
      sort: (r) => r.casesHigh,
      render: (r) => `${fmtInt(r.casesLow)} to ${fmtInt(r.casesHigh)}`,
    },
    {
      key: 'share',
      header: 'Budget share',
      align: 'right',
      sort: (r) => r.budgetShare,
      render: (r) => `${(100 * r.budgetShare).toFixed(1)}%`,
    },
  ]

  const exportCsv = () =>
    downloadCsv(
      'breathrwanda-plan.csv',
      [
        { header: 'order', value: (r) => r.order },
        { header: 'district', value: (r) => r.name },
        { header: 'province', value: (r) => r.province },
        { header: 'stoves', value: (r) => r.stoves },
        { header: 'children_reached', value: (r) => r.children },
        { header: 'cases_averted_low', value: (r) => r.casesLow },
        { header: 'cases_averted_high', value: (r) => r.casesHigh },
        { header: 'cost_rwf', value: (r) => r.cost },
        { header: 'share_of_budget_pct', value: (r) => (100 * r.budgetShare).toFixed(2) },
        { header: 'stove_type', value: () => STOVE_NAMES[stove.id] || stove.name },
        { header: 'cost_per_stove_rwf', value: () => params.cost },
        { header: 'usage_rate', value: () => params.usage },
        { header: 'effect_trial', value: () => params.effectTrial },
        { header: 'effect_observational', value: () => params.effectObservational },
        { header: 'priority', value: () => (priority === 'indoor' ? 'indoor cooking first' : 'highest baseline risk first') },
        { header: 'budget_rwf', value: () => result.budget },
      ],
      result.rows,
    )

  return (
    <>
    {hero}
    <div className="page-x pb-16 pt-10 lg:pb-0">
      {!costInvalid && <SummaryBar result={result} target={resultsRef} />}
      <Banner />

      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* Inputs */}
        <form className="space-y-8" onSubmit={(e) => e.preventDefault()} aria-label="Planner settings">
          <fieldset>
            <legend className="font-serif text-xl font-semibold">1. Budget</legend>
            <label htmlFor="budget-number" className="mt-3 block text-sm font-medium">
              Budget in RWF
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id="budget-number"
                type="text"
                inputMode="numeric"
                value={fmtInt(amount)}
                onChange={(e) => setBudget(parseAmount(e.target.value))}
                className="min-h-11 w-full max-w-xs rounded border border-line bg-surface px-3 text-lg tabular-nums"
              />
              <span className="text-muted">RWF</span>
            </div>
            <label htmlFor="budget-slider" className="sr-only">
              Budget slider, 0 to 20 billion RWF
            </label>
            <input
              id="budget-slider"
              type="range"
              min={0}
              max={SLIDER_STEPS}
              step={1}
              value={toSlider(amount)}
              onChange={(e) => setBudget(fromSlider(Number(e.target.value)))}
              aria-valuetext={fmtRWF(amount)}
              className="mt-4 h-11 w-full accent-accent"
            />
            <div className="flex justify-between text-xs text-muted" aria-hidden="true">
              <span>0</span>
              <span>5 billion</span>
              <span>20 billion</span>
            </div>
            {amount > SLIDER_MAX_RWF && (
              <p className="mt-2 text-xs text-muted">The slider stops at 20 billion RWF; the box above takes any amount.</p>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-serif text-xl font-semibold">2. Stove type</legend>
            <div className="mt-3 space-y-2">
              {stoves.map((s) => {
                const p = { ...paramsOf(s), ...edits[s.id] }
                const on = s.id === stove.id
                return (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer gap-3 rounded border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                      on ? 'border-accent bg-surface' : 'border-line hover:border-muted'
                    }`}
                  >
                    <input
                      type="radio"
                      name="stove"
                      value={s.id}
                      checked={on}
                      onChange={() => setStoveId(s.id)}
                      className="mt-1 h-5 w-5 shrink-0 accent-accent"
                    />
                    <span>
                      <span className="block font-medium">{STOVE_NAMES[s.id] || s.name}</span>
                      <span className="block text-sm text-muted">
                        {fmtRWF(p.cost)} each · used by {Math.round(100 * p.usage)}% · removes{' '}
                        {Math.round(100 * Math.min(p.effectTrial, p.effectObservational))}–
                        {Math.round(100 * Math.max(p.effectTrial, p.effectObservational))}% of smoke-related risk
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>

            <div className="mt-5 rounded border border-line p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-medium">Assumptions for: {STOVE_NAMES[stove.id] || stove.name}</p>
                <button
                  type="button"
                  onClick={() => setEdits((e) => ({ ...e, [stove.id]: undefined }))}
                  disabled={!edited}
                  className="min-h-11 rounded border border-line px-3 text-sm enabled:hover:border-muted disabled:text-muted"
                >
                  Reset to defaults
                </button>
              </div>
              <p className="mt-1 text-sm text-muted">{stove.name}</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <NumberField
                  key={`${stove.id}-cost-${edited}`}
                  id="cost"
                  label="Cost per stove"
                  suffix="RWF"
                  value={params.cost}
                  onChange={(v) => setParam('cost', Math.max(0, v))}
                  hint={costInvalid ? 'Enter a cost above 0 RWF.' : undefined}
                />
                <NumberField
                  key={`${stove.id}-usage-${edited}`}
                  id="usage"
                  label="Usage rate"
                  suffix="% of households"
                  value={Math.round(1000 * params.usage) / 10}
                  onChange={(v) => setParam('usage', Math.min(100, Math.max(0, v)) / 100)}
                />
                <NumberField
                  key={`${stove.id}-trial-${edited}`}
                  id="eff-trial"
                  label="Effectiveness, trial estimate"
                  suffix="%"
                  value={Math.round(1000 * params.effectTrial) / 10}
                  onChange={(v) => setParam('effectTrial', Math.min(100, Math.max(0, v)) / 100)}
                />
                <NumberField
                  key={`${stove.id}-obs-${edited}`}
                  id="eff-obs"
                  label="Effectiveness, observational estimate"
                  suffix="%"
                  value={Math.round(1000 * params.effectObservational) / 10}
                  onChange={(v) => setParam('effectObservational', Math.min(100, Math.max(0, v)) / 100)}
                />
              </div>
              <details className="mt-4 text-sm">
                <summary className="flex min-h-11 cursor-pointer items-center text-accent">Sources for these values</summary>
                <dl className="mt-2 space-y-3 text-muted">
                  <div>
                    <dt className="font-medium text-ink">Cost</dt>
                    <dd>
                      <SourceText text={stove.costSource} />
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Usage rate</dt>
                    <dd>
                      <SourceText text={stove.usageSource} />
                    </dd>
                  </div>
                  <div>
                    <dt className="font-medium text-ink">Effectiveness</dt>
                    <dd>
                      <SourceText text={stove.effectSource} />
                    </dd>
                  </div>
                </dl>
              </details>
            </div>
            <p className="mt-3 text-sm">Cost and effectiveness come from published research and can be changed.</p>
            {a?.howToRead?.cost && <p className="mt-2 text-sm text-muted">{a.howToRead.cost}</p>}
            {stove.id === 'epc' && a?.howToRead?.usage && (
              <p className="mt-2 text-sm text-muted">{a.howToRead.usage}</p>
            )}
          </fieldset>

          <fieldset>
            <legend className="font-serif text-xl font-semibold">3. Priority</legend>
            <div className="mt-3 space-y-2">
              {[
                {
                  id: 'risk',
                  label: 'Highest baseline risk first',
                  text: 'Districts where one stove prevents the most cases, using all polluting-fuel households.',
                },
                {
                  id: 'indoor',
                  label: 'Indoor cooking first',
                  text: 'Homes that burn polluting fuel inside the house first, starting with the districts that have the most children exposed indoors. Other polluting-fuel homes follow.',
                },
              ].map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer gap-3 rounded border p-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    priority === o.id ? 'border-accent bg-surface' : 'border-line hover:border-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="priority"
                    value={o.id}
                    checked={priority === o.id}
                    onChange={() => setPriority(o.id)}
                    className="mt-1 h-5 w-5 shrink-0 accent-accent"
                  />
                  <span>
                    <span className="block font-medium">{o.label}</span>
                    <span className="block text-sm text-muted">{o.text}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        </form>

        {/* Results */}
        <section ref={resultsRef} aria-labelledby="results-heading" aria-live="polite" className="scroll-mt-4">
          <h2 id="results-heading" className="text-2xl">
            Results
          </h2>
          {costInvalid ? (
            <p className="mt-4">Enter a cost per stove above 0 RWF to see results.</p>
          ) : (
            <>
              <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-4">
                <BigNumber label="Stoves bought">
                  <AnimatedNumber value={result.stoves} format={fmtInt} />
                </BigNumber>
                <BigNumber label="Children reached">
                  <AnimatedNumber value={result.children} format={fmtInt} />
                </BigNumber>
                <BigNumber
                  wide
                  label="Cases averted"
                  extra={
                    <>
                      <Term k="casesAverted" />
                      <Tip label="Why a range?">
                        Studies disagree on how much a cleaner stove reduces cough with fast breathing in children. The
                        low number uses the effect found in randomised trials ({Math.round(100 * result.effLow)}% for
                        this stove). The high number uses an upper bound from observational studies (
                        {Math.round(100 * result.effHigh)}%). Our own survey model cannot measure this effect. The
                        trials also measured more serious, doctor-diagnosed illness in infants; here their effects are
                        applied to cough with fast breathing in all children under 5, so the range is an illustration,
                        not a prediction.
                      </Tip>
                    </>
                  }
                >
                  <AnimatedNumber value={result.casesLow} format={fmtInt} />
                  <span className="text-muted"> to </span>
                  <AnimatedNumber value={result.casesHigh} format={fmtInt} />
                </BigNumber>
              </div>
              <p className="mt-3 text-sm text-muted">
                Children reached counts children under 5 in homes that receive and use a stove. Cases averted are in a
                typical two-week period.
              </p>

              <dl className="mt-6 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div className="flex justify-between border-b border-line py-2">
                  <dt className="text-muted">Budget used</dt>
                  <dd className="tabular-nums">{fmtRWF(result.spent)}</dd>
                </div>
                <div className="flex justify-between border-b border-line py-2">
                  <dt className="text-muted">Budget left over</dt>
                  <dd className="tabular-nums">{fmtRWF(result.leftover)}</dd>
                </div>
                <div className="flex justify-between border-b border-line py-2">
                  <dt className="text-muted">Districts reached</dt>
                  <dd className="tabular-nums">{result.rows.length} of 30</dd>
                </div>
                <div className="flex justify-between border-b border-line py-2">
                  <dt className="text-muted">Cost per stove</dt>
                  <dd className="tabular-nums">{fmtRWF(result.cost)}</dd>
                </div>
              </dl>
              {result.unplacedStoves > 0 && (
                <p className="mt-3 text-sm">
                  This budget could buy {fmtInt(result.affordable)} stoves, but only {fmtInt(result.stoves)} households
                  cook with polluting fuel. The other {fmtInt(result.unplacedStoves)} stoves are not bought, and the
                  money is shown as left over.
                </p>
              )}
              {result.budget > 0 && result.affordable === 0 && (
                <p className="mt-3 text-sm">The budget is less than the cost of one stove.</p>
              )}

              {result.rows.length > 0 ? (
                <>
                  <div className="mt-8">
                    <BarChart rows={result.rows} />
                  </div>
                  <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl">Stoves by district</h3>
                    <button
                      type="button"
                      onClick={exportCsv}
                      className="min-h-11 rounded border border-accent px-4 text-accent hover:bg-surface"
                    >
                      Download CSV
                    </button>
                  </div>
                  <div className="mt-3">
                    <SortTable
                      columns={columns}
                      rows={result.rows}
                      initial={{ key: 'order', dir: 'asc' }}
                      caption="Stoves, children reached and cases averted by district"
                      rowKey={(r) => r.code}
                      minWidth="520px"
                      card={(r) => (
                        <div>
                          <div className="flex items-baseline justify-between gap-3">
                            <p className="font-medium">
                              <span className="text-muted">{r.order}.</span> {r.name}
                            </p>
                            <p className="text-sm text-muted">{(100 * r.budgetShare).toFixed(1)}% of budget</p>
                          </div>
                          <dl className="mt-1 grid grid-cols-3 gap-2 text-sm">
                            <div>
                              <dt className="text-xs text-muted">Stoves</dt>
                              <dd className="tabular-nums">{fmtInt(r.stoves)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted">Children reached</dt>
                              <dd className="tabular-nums">{fmtInt(r.children)}</dd>
                            </div>
                            <div>
                              <dt className="text-xs text-muted">Cases averted</dt>
                              <dd className="tabular-nums">
                                {fmtInt(r.casesLow)} to {fmtInt(r.casesHigh)}
                              </dd>
                            </div>
                          </dl>
                        </div>
                      )}
                      cardFooter={
                        <dl className="grid grid-cols-3 gap-2 border-b border-line py-3 text-sm font-medium">
                          <div>
                            <dt className="text-xs text-muted">Total stoves</dt>
                            <dd className="tabular-nums">{fmtInt(result.stoves)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted">Total children</dt>
                            <dd className="tabular-nums">{fmtInt(result.children)}</dd>
                          </div>
                          <div>
                            <dt className="text-xs text-muted">Total cases averted</dt>
                            <dd className="tabular-nums">
                              {fmtInt(result.casesLow)} to {fmtInt(result.casesHigh)}
                            </dd>
                          </div>
                        </dl>
                      }
                      footer={
                        <tfoot>
                          <tr className="border-t border-ink/40 bg-surface font-medium">
                            <td className="px-3 py-2.5" />
                            <th scope="row" className="px-3 py-2.5 text-left">
                              Total
                            </th>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(result.stoves)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">{fmtInt(result.children)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {fmtInt(result.casesLow)} to {fmtInt(result.casesHigh)}
                            </td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {result.budget > 0 ? `${((100 * result.spent) / result.budget).toFixed(1)}%` : '0.0%'}
                            </td>
                          </tr>
                        </tfoot>
                      }
                    />
                  </div>
                </>
              ) : (
                <p className="mt-8 text-muted">No stoves are placed with this budget. Raise the budget to see districts.</p>
              )}
              <p className="mt-6 text-sm text-muted">
                How this works is explained on the <Link to="/methods">Methods page</Link>.
              </p>
            </>
          )}
        </section>
      </div>
    </div>
    </>
  )
}
