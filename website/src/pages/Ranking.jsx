import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data.js'
import { downloadCsv } from '../lib/csv.js'
import { fmtInt, fmtPct, fmtPctRange, isLowConfidence, lowConfidenceReasons, rankShort, rankText } from '../lib/format.js'
import { Banner, Loading, LoadError, LowConfidence, TierLabel, usePageMeta } from '../components/Status.jsx'
import SortTable from '../components/SortTable.jsx'
import { Term } from '../components/terms.jsx'
import PageHero from '../components/PageHero.jsx'

const TIER_ORDER = { High: 1, Medium: 2, Lower: 3 }
const pct1 = (x) => (Number.isFinite(x) ? (100 * x).toFixed(1) : '')

export default function Ranking() {
  usePageMeta('District ranking', 'Priority ranking of Rwanda’s 30 districts for clean cooking stoves, with uncertainty ranges.')
  const { status, data, error, retry } = useData(['districts'])
  const [province, setProvince] = useState('')
  const [query, setQuery] = useState('')

  const districts = data?.districts || []
  const provinces = useMemo(() => [...new Set(districts.map((d) => d.province))].sort(), [districts])
  const shown = districts.filter(
    (d) => (!province || d.province === province) && d.name.toLowerCase().includes(query.trim().toLowerCase()),
  )

  const hero = (
    <PageHero image="village" eyebrow="Explore the data" title="District ranking">
      Districts ranked by how many cases of cough with fast breathing one clean stove is expected to prevent. Read the
      tier first and the rank range second: rank 7 is not clearly worse than rank 8.
    </PageHero>
  )
  if (status === 'loading') return <>{hero}<Loading what="the ranking" /></>
  if (status === 'error') return <>{hero}<LoadError error={error} retry={retry} /></>

  const columns = [
    {
      key: 'tier',
      header: 'Tier',
      term: <Term k="tier" />,
      sort: (d) => TIER_ORDER[d.priorityTier] * 100 + d.priorityRank,
      render: (d) => <TierLabel tier={d.priorityTier} />,
    },
    {
      key: 'rank',
      header: 'Rank (90% interval)',
      sortLabel: 'Rank',
      term: <Term k="rank" />,
      sort: (d) => d.priorityRank,
      render: (d) => rankShort(d),
    },
    {
      key: 'name',
      header: 'District',
      sort: (d) => d.name,
      render: (d) => <Link to={`/map?district=${encodeURIComponent(d.name)}`}>{d.name}</Link>,
    },
    { key: 'province', header: 'Province', sort: (d) => d.province, render: (d) => d.province },
    { key: 'u5', header: 'Children under 5', align: 'right', sort: (d) => d.childrenU5, render: (d) => fmtInt(d.childrenU5) },
    {
      key: 'risk',
      header: 'Risk (90% interval)',
      sortLabel: 'Risk',
      term: <Term k="interval" />,
      align: 'right',
      sort: (d) => d.risk,
      render: (d) => (
        <>
          {fmtPct(d.risk)} <span className="text-muted">({fmtPctRange(d.riskLo, d.riskHi)})</span>
        </>
      ),
    },
    {
      key: 'indoor',
      header: 'Exposed indoors',
      term: <Term k="indoor" />,
      align: 'right',
      sort: (d) => d.childrenIndoorSmoke,
      render: (d) => fmtInt(d.childrenIndoorSmoke),
    },
    {
      key: 'conf',
      header: 'Confidence',
      sortLabel: 'Low confidence',
      term: <Term k="lowConfidence" />,
      sort: (d) => (isLowConfidence(d) ? 1 : 0),
      render: (d) => (isLowConfidence(d) ? <LowConfidence withTip={false} /> : <span className="text-muted">Normal</span>),
    },
  ]

  const exportCsv = () =>
    downloadCsv(
      'breathrwanda-ranking.csv',
      [
        { header: 'tier', value: (d) => d.priorityTier },
        { header: 'rank', value: (d) => d.priorityRank },
        { header: 'rank_90_low', value: (d) => d.priorityRankLo },
        { header: 'rank_90_high', value: (d) => d.priorityRankHi },
        { header: 'district', value: (d) => d.name },
        { header: 'province', value: (d) => d.province },
        { header: 'children_under_5', value: (d) => d.childrenU5 },
        { header: 'risk_cough_fast_breathing_pct', value: (d) => pct1(d.risk) },
        { header: 'risk_90_low_pct', value: (d) => pct1(d.riskLo) },
        { header: 'risk_90_high_pct', value: (d) => pct1(d.riskHi) },
        { header: 'children_exposed_indoors', value: (d) => d.childrenIndoorSmoke },
        { header: 'low_confidence', value: (d) => (isLowConfidence(d) ? 'yes' : 'no') },
        { header: 'low_confidence_reason', value: (d) => lowConfidenceReasons(d).join(' ') },
      ],
      [...shown].sort((a, b) => a.priorityRank - b.priorityRank),
    )

  return (
    <>
    {hero}
    <div className="page-x pt-10">
      <Banner />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:flex sm:flex-wrap sm:items-end">
        <div>
          <label htmlFor="province" className="block text-sm font-medium">
            Province
          </label>
          <select
            id="province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="mt-1 min-h-11 w-full rounded border border-line bg-surface px-3 sm:w-auto"
          >
            <option value="">All provinces</option>
            {provinces.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="search" className="block text-sm font-medium">
            Search district
          </label>
          <input
            id="search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="For example Rubavu"
            className="mt-1 min-h-11 w-full rounded border border-line bg-surface px-3 sm:w-56"
          />
        </div>
        <button
          type="button"
          onClick={exportCsv}
          className="min-h-11 rounded border border-accent px-4 text-accent hover:bg-surface sm:ml-auto"
        >
          Download CSV
        </button>
      </div>
      <p className="mt-3 text-sm text-muted" aria-live="polite">
        Showing {shown.length} of {districts.length} districts. Select a column heading or use “Sort by” to change the order.
      </p>

      <div className="mt-3">
        <SortTable
          columns={columns}
          rows={shown}
          initial={{ key: 'rank', dir: 'asc' }}
          caption="Priority ranking of districts"
          rowKey={(d) => d.code}
          card={(d) => (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link to={`/map?district=${encodeURIComponent(d.name)}`} className="text-lg font-medium">
                    {d.name}
                  </Link>
                  <p className="text-sm text-muted">{d.province}</p>
                </div>
                <TierLabel tier={d.priorityTier} />
              </div>
              <p className="mt-1 text-sm text-muted">{rankText(d)}</p>
              <dl className="mt-2 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">Children under 5</dt>
                  <dd className="tabular-nums">{fmtInt(d.childrenU5)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Risk</dt>
                  <dd className="tabular-nums">
                    {fmtPct(d.risk)}
                    <span className="block text-xs text-muted">{fmtPctRange(d.riskLo, d.riskHi)}</span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Exposed indoors</dt>
                  <dd className="tabular-nums">{fmtInt(d.childrenIndoorSmoke)}</dd>
                </div>
              </dl>
              {isLowConfidence(d) && (
                <div className="mt-2">
                  <LowConfidence />
                </div>
              )}
            </div>
          )}
        />
      </div>
    </div>
    </>
  )
}
