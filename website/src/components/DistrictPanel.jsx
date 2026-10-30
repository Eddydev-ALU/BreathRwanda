import { fmtInt, fmtPct, fmtPctRange, isLowConfidence, lowConfidenceReasons, rankText } from '../lib/format.js'
import { LowConfidence, TierLabel } from './Status.jsx'
import { Term } from './terms.jsx'

// Plain-language names for the model factors.
const FACTOR_NAMES = {
  province: 'Province (regional differences)',
  wealth_q: 'Household wealth',
  place: 'Where food is cooked',
  rural: 'Living in a rural area',
  fuel: 'Cooking fuel',
  age_group: 'Age of the children',
  hhsize: 'Household size',
  sex_female: 'Mix of girls and boys',
}

function WhyBars({ factors, nationalPct }) {
  const max = Math.max(0.5, ...factors.map((f) => Math.abs(f.pp)))
  return (
    <div>
      <p className="text-sm text-muted">
        Each bar shows how much a factor moves this district’s estimated risk above or below the national average
        {Number.isFinite(nationalPct) ? ` of ${nationalPct.toFixed(1)}%` : ''}, in percentage points.
      </p>
      <div className="mt-2 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>← lowers risk</span>
        <span>raises risk →</span>
      </div>
      <ul className="mt-1 space-y-3">
        {factors.map((f) => {
          const w = (Math.abs(f.pp) / max) * 50
          const up = f.pp > 0
          return (
            <li key={f.key}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span>{FACTOR_NAMES[f.key] || f.factor}</span>
                <span className="tabular-nums text-muted">
                  {f.pp >= 0.05 ? '+' : f.pp <= -0.05 ? '−' : ''}
                  {Math.abs(f.pp).toFixed(1)} points
                  <span className="sr-only">{up ? ', raises risk' : f.pp < 0 ? ', lowers risk' : ''}</span>
                </span>
              </div>
              <div className="relative mt-1 h-3 border-x border-line" aria-hidden="true">
                <span className="absolute inset-y-0 left-1/2 w-px bg-line" />
                <span
                  className={`absolute inset-y-0 transition-[width] duration-500 ease-out motion-reduce:transition-none ${up ? 'bg-scale-4' : 'bg-scale-2'}`}
                  style={up ? { left: '50%', width: `${w}%` } : { right: '50%', width: `${w}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Row({ label, term, children }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
      <dt className="text-sm text-muted">
        {label}
        {term && <Term k={term} />}
      </dt>
      <dd className="text-right tabular-nums">{children}</dd>
    </div>
  )
}

export default function DistrictPanel({ d, nationalPct, onClose, headingRef }) {
  const factors = Array.isArray(d.whyFactors) ? d.whyFactors : []
  return (
    <article key={d.code} aria-labelledby="district-heading" className="panel-in space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="district-heading" ref={headingRef} tabIndex={-1} className="text-3xl focus:outline-none">
            {d.name}
          </h2>
          <p className="text-muted">{d.province}</p>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 min-w-11 rounded border border-line px-3 text-sm hover:border-muted"
          >
            Close<span className="sr-only"> district details</span>
          </button>
        )}
      </div>

      <div>
        <p className="text-sm text-muted">
          Priority tier
          <Term k="tier" />
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <TierLabel tier={d.priorityTier} large />
          {isLowConfidence(d) && <LowConfidence />}
        </div>
        {isLowConfidence(d) && (
          <ul className="mt-2 text-sm text-muted">
            {lowConfidenceReasons(d).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        )}
        <p className="mt-2 text-sm text-muted">
          {rankText(d)}
          <Term k="rank" />
        </p>
      </div>

      <dl>
        <Row label="Risk of cough with fast breathing" term="interval">
          {fmtPct(d.risk)}
          <span className="block whitespace-nowrap text-xs text-muted">90% interval {fmtPctRange(d.riskLo, d.riskHi)}</span>
        </Row>
        <Row label="Risk index" term="riskIndex">
          {Number.isFinite(d.riskIndex) ? Math.round(d.riskIndex) : 'No data'} of 100
        </Row>
        <Row label="Children under 5">{fmtInt(d.childrenU5)}</Row>
        <Row label="Children in polluting-fuel homes" term="exposed">
          {fmtInt(d.childrenExposed)}
        </Row>
        <Row label="Children exposed indoors" term="indoor">
          {fmtInt(d.childrenIndoorSmoke)}
        </Row>
        <Row label="Children per polluting household">
          {Number.isFinite(d.childrenPerHH) ? d.childrenPerHH.toFixed(2) : 'No data'}
        </Row>
      </dl>

      <section aria-labelledby="why-heading">
        <h3 id="why-heading" className="text-xl">
          {d.priorityTier === 'High' ? 'Why is this district high risk?' : 'What raises or lowers risk here?'}
        </h3>
        {d.priorityTier === 'High' && (
          <p className="mt-2 text-sm">
            The tier is not set by risk alone. It also counts how many young children live in each polluting-fuel
            household here ({Number.isFinite(d.childrenPerHH) ? d.childrenPerHH.toFixed(2) : 'No data'}), because
            one stove protects more children where there are more of them.
          </p>
        )}
        <div className="mt-3">
          {factors.length ? <WhyBars factors={factors} nationalPct={nationalPct} /> : <p>No data</p>}
        </div>
        <p className="mt-4 text-xs text-muted">
          These are associations from the survey model, not proven causes.
        </p>
      </section>
    </article>
  )
}
