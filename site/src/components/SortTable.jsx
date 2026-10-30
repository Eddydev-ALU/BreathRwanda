import { useState } from 'react'

// A plain sortable table. columns: [{ key, header, sort: (row) => value, render: (row) => node, align, term }]
export default function SortTable({ columns, rows, initial, caption, rowKey, footer }) {
  const [sort, setSort] = useState(initial || { key: columns[0].key, dir: 'asc' })
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
    <div className="overflow-x-auto border border-line">
      <table className="w-full min-w-[640px] border-collapse text-sm">
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
  )
}
