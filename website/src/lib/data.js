import { useEffect, useState } from 'react'

const base = `${import.meta.env.BASE_URL}data/`
const FILES = {
  districts: 'districts.json',
  geo: 'districts.geojson',
  assumptions: 'assumptions.json',
  model: 'model_summary.json',
}
const cache = {}

function load(key) {
  if (!cache[key]) {
    cache[key] = fetch(base + FILES[key]).then((res) => {
      if (!res.ok) throw new Error(`${FILES[key]} could not be loaded (HTTP ${res.status})`)
      return res.json()
    })
    cache[key].catch(() => {
      delete cache[key]
    })
  }
  return cache[key]
}

// Each page asks only for the files it needs; files already downloaded are reused.
export function useData(keys) {
  const id = keys.join(',')
  const [state, setState] = useState({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let live = true
    setState({ status: 'loading' })
    Promise.all(keys.map(load)).then(
      (values) => live && setState({ status: 'ready', data: Object.fromEntries(keys.map((k, i) => [k, values[i]])) }),
      (error) => live && setState({ status: 'error', error }),
    )
    return () => {
      live = false
    }
  }, [id, attempt])
  return { ...state, retry: () => setAttempt((a) => a + 1) }
}
