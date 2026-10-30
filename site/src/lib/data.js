import { useEffect, useState } from 'react'

const base = `${import.meta.env.BASE_URL}data/`
let pending = null

async function fetchJson(name) {
  const res = await fetch(base + name)
  if (!res.ok) throw new Error(`${name} could not be loaded (HTTP ${res.status})`)
  return res.json()
}

function loadAll() {
  if (!pending) {
    pending = Promise.all(
      ['districts.json', 'districts.geojson', 'assumptions.json', 'model_summary.json'].map(fetchJson),
    ).then(([districts, geo, assumptions, model]) => ({ districts, geo, assumptions, model }))
    pending.catch(() => {
      pending = null
    })
  }
  return pending
}

// All pages share one download of the small data files.
export function useData() {
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    loadAll().then(
      (data) => live && setState({ status: 'ready', data }),
      (error) => live && setState({ status: 'error', error }),
    )
    return () => {
      live = false
    }
  }, [attempt])
  return { ...state, retry: () => setAttempt((a) => a + 1) }
}
