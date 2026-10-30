import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useData } from '../lib/data.js'
import { downloadCsv } from '../lib/csv.js'
import { fmtInt, fmtPct, fmtPctRange, rankShort } from '../lib/format.js'
import { Banner, Loading, LoadError, LowConfidence, TierLabel, usePageMeta } from '../components/Status.jsx'
import SortTable from '../components/SortTable.jsx'
import { Term } from '../components/terms.jsx'

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

  if (status === 'loading') return <Loading what="the ranking" />
  if (status === 'error') return <LoadError error={error} retry={retry} />

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
      term: <Term k="lowConfidence" />,
      sort: (d) => (d.lowConfidenceIndoor ? 1 : 0),
      render: (d) => (d.lowConfidenceIndoor ? <LowConfidence withTip={false} /> : <span className="text-muted">Normal</span>),
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
        { header: 'low_confidence_indoor', value: (d) => (d.lowConfidenceIndoor ? 'yes' : 'no') },
      ],
      [...shown].sort((a, b) => a.priorityRank - b.priorityRank),
    )

  return (
    <div className="mx-auto max-w-6xl px-4 pt-8 sm:px-6">
      <h1 className="text-3xl sm:text-4xl">District ranking</h1>
      <p className="mt-3 max-w-prose">
        Districts are ranked by how many cases of cough with fast breathing one clean stove is expected to prevent.
        Ranks overlap a lot, so read the tier first and the rank range second: rank 7 is not clearly worse than rank 8.
      </p>
      <div className="mt-5">
        <Banner />
      </div>

      <div className="mt-6 flex flex-wrap items-end gap-4">
        <div>
          <label htmlFor="province" className="block text-sm font-medium">
            Province
          </label>
          <select
            id="province"
            value={province}
            onChange={(e) => setProvince(e.target.value)}
            className="mt-1 min-h-11 rounded border border-line bg-surface px-3"
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
            className="mt-1 min-h-11 w-56 rounded border border-line bg-surface px-3"
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
        Showing {shown.length} of {districts.length} districts. Select a column heading to sort.
      </p>

      <div className="mt-3">
        <SortTable
          columns={columns}
          rows={shown}
          initial={{ key: 'rank', dir: 'asc' }}
          caption="Priority ranking of districts"
          rowKey={(d) => d.code}
        />
      </div>
    </div>
  )
}
