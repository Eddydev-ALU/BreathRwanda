import { useId, useState } from 'react'

// A plain sortable table. columns: [{ key, header, sort: (row) => value, render: (row) => node, align, term }]
// On phones, rows become cards (card: (row) => node) with a "Sort by" menu; the table shows from 768px up.
export default function SortTable({ columns, rows, initial, caption, rowKey, footer, card, cardFooter, minWidth = '640px' }) {
  const [sort, setSort] = useState(initial || { key: columns[0].key, dir: 'asc' })
  const selectId = useId()
  const col = columns.find((c) => c.key === sort.key) || columns[0]
  const sorted = [...rows].sort((a, b) => {
    const x = col.sort(a)
    const y = col.sort(b)
    const cmp = typeof x === 'string' ? x.localeCompare(y) : (x ?? -Infinity) - (y ?? -Infinity)
    return sort.dir === 'asc' ? cmp : -cmp
  })

  const toggle = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }))

  return (
    <>
      {card && (
        <div className="md:hidden">
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <label htmlFor={selectId} className="block text-sm font-medium">
                Sort by
              </label>
              <select
                id={selectId}
                value={sort.key}
                onChange={(e) => setSort({ key: e.target.value, dir: sort.dir })}
                className="mt-1 min-h-11 w-full rounded-lg border border-line bg-surface px-3"
              >
                {columns.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.sortLabel || c.header}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => setSort((s) => ({ ...s, dir: s.dir === 'asc' ? 'desc' : 'asc' }))}
              className="min-h-11 rounded-lg border border-line bg-surface px-3 text-sm"
            >
              {sort.dir === 'asc' ? 'Low to high' : 'High to low'}
              <span className="sr-only">, change order</span>
            </button>
          </div>
          <ul className="mt-3 space-y-3" aria-label={caption}>
            {sorted.map((r) => (
              <li key={rowKey(r)} className="box p-4">
                {card(r)}
              </li>
            ))}
            {sorted.length === 0 && <li className="py-6 text-muted">No districts match.</li>}
          </ul>
          {cardFooter}
        </div>
      )}

      <div className={`box overflow-x-auto ${card ? 'hidden md:block' : ''}`}>
        <table className="w-full border-collapse text-sm" style={{ minWidth }}>
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="border-b border-line bg-surface">
              {columns.map((c) => {
                const active = c.key === sort.key
                return (
                  <th
                    key={c.key}
                    scope="col"
                    aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    className={`whitespace-nowrap px-3 py-1 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    <span className="inline-flex items-center">
                      <button
                        type="button"
                        onClick={() => toggle(c.key)}
                        className={`inline-flex min-h-11 items-center gap-1 ${active ? 'text-ink' : 'text-muted hover:text-ink'}`}
                      >
                        {c.header}
                        <span aria-hidden="true" className="w-3 text-xs">
                          {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
                        </span>
                      </button>
                      {c.term}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => (
              <tr key={rowKey(r)} className="border-b border-line last:border-b-0">
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={`px-3 py-2.5 align-top tabular-nums ${c.align === 'right' ? 'text-right' : 'text-left'}`}
                  >
                    {c.render(r)}
                  </td>
                ))}
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-3 py-6 text-muted">
                  No districts match.
                </td>
              </tr>
            )}
          </tbody>
          {footer}
        </table>
      </div>
    </>
  )
}
