import { useEffect, useMemo, useRef } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AttributionControl, GeoJSON, MapContainer } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { useData } from '../lib/data.js'
import { fmtInt, fmtPct } from '../lib/format.js'
import { makeScale } from '../lib/scale.js'
import { Banner, Loading, LoadError, usePageMeta } from '../components/Status.jsx'
import DistrictPanel from '../components/DistrictPanel.jsx'
import Tip from '../components/Tip.jsx'
import { Term } from '../components/terms.jsx'
import PageHero from '../components/PageHero.jsx'

const MEASURES = [
  { id: 'risk', label: 'Risk index', field: 'riskIndex', fmt: (v) => Math.round(v), unit: 'index, 0 to 100' },
  { id: 'exposed', label: 'Children exposed', field: 'childrenExposed', fmt: fmtInt, unit: 'children under 5' },
  {
    id: 'indoor',
    label: 'Children exposed to smoke indoors',
    field: 'childrenIndoorSmoke',
    fmt: fmtInt,
    unit: 'children under 5',
  },
]

function Legend({ measure, scale }) {
  return (
    <figure className="mt-3" aria-label={`Legend: ${measure.label}`}>
      <figcaption className="text-sm text-muted">
        {measure.label} ({measure.unit})
      </figcaption>
      <ol className="mt-2 grid grid-cols-5 gap-px text-xs">
        {scale.classes.map((c, i) => (
          <li key={c.color}>
            <span className="block h-3 border border-line" style={{ background: c.color }} />
            <span className="mt-1 block tabular-nums text-muted">
              {i === 0 ? measure.fmt(c.from) : `${measure.fmt(c.from)}`}
              {i === scale.classes.length - 1 && <span className="block">to {measure.fmt(c.to)}</span>}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  )
}

function DistrictMap({ geo, byCode, measure, scale, selectedCode, onSelect }) {
  const layer = useRef(null)
  const state = useRef({})
  state.current = { byCode, measure, scale, selectedCode, onSelect }

  const style = (feature) => {
    const { byCode, measure, scale, selectedCode } = state.current
    const d = byCode.get(feature.properties.district_code)
    const selected = feature.properties.district_code === selectedCode
    return {
      fillColor: d ? scale.color(d[measure.field]) : '#FFFFFF',
      fillOpacity: 1,
      color: selected ? '#1F2421' : '#6B706C',
      weight: selected ? 3 : 1,
      className: 'district-path',
    }
  }

  useEffect(() => {
    const l = layer.current
    if (!l) return
    l.setStyle(style)
    l.eachLayer((p) => {
      if (p.feature.properties.district_code === selectedCode) p.bringToFront()
    })
  }, [measure, scale, selectedCode])

  const bounds = useMemo(() => L.geoJSON(geo).getBounds(), [geo])

  const onEachFeature = (feature, path) => {
    const code = feature.properties.district_code
    path.bindTooltip(
      () => {
        const d = state.current.byCode.get(code)
        if (!d) return feature.properties.district_name
        return `<strong>${d.name}</strong><br>Children under 5: ${fmtInt(d.childrenU5)}<br>Risk: ${fmtPct(d.risk)} (index ${Math.round(d.riskIndex)})`
      },
      { sticky: true, direction: 'top', offset: [0, -8] },
    )
    path.on({
      mouseover: () => path.setStyle({ fillOpacity: 0.8 }),
      mouseout: () => path.setStyle({ fillOpacity: 1 }),
      click: () => state.current.onSelect(code),
    })
  }

  return (
    <MapContainer
      bounds={bounds}
      maxBounds={bounds.pad(0.5)}
      zoomSnap={0.25}
      scrollWheelZoom={false}
      attributionControl={false}
      style={{ background: 'var(--color-bg)' }}
      className="h-[46vh] min-h-[300px] w-full border border-line sm:h-[58vh] lg:h-[620px]"
      aria-label="Map of Rwanda's 30 districts"
    >
      <GeoJSON
        ref={layer}
        data={geo}
        style={style}
        onEachFeature={onEachFeature}
        attribution="Boundaries: NISR / Rwanda Biomedical Centre"
      />
      <AttributionControl position="bottomright" prefix='<a href="https://leafletjs.com">Leaflet</a>' />
    </MapContainer>
  )
}

export default function MapPage() {
  usePageMeta(
    'District map',
    'Map of the 30 districts of Rwanda by risk of cough with fast breathing in children under 5 and children exposed to cooking smoke.',
  )
  const { status, data, error, retry } = useData(['districts', 'geo', 'model'])
  const [params, setParams] = useSearchParams()
  const heading = useRef(null)

  const measure = MEASURES.find((m) => m.id === params.get('measure')) || MEASURES[0]
  const districts = data?.districts
  const byCode = useMemo(() => new Map((districts || []).map((d) => [d.code, d])), [districts])
  const scale = useMemo(() => makeScale((districts || []).map((d) => d[measure.field])), [districts, measure])
  const selected = districts?.find((d) => d.name.toLowerCase() === (params.get('district') || '').toLowerCase())

  const update = (changes) => {
    const next = new URLSearchParams(params)
    for (const [k, v] of Object.entries(changes)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    setParams(next, { replace: true })
  }

  const mapBox = useRef(null)
  useEffect(() => {
    if (!selected) return
    heading.current?.focus({ preventScroll: true })
    // On phones the panel is a bottom sheet: bring the map to the top so it stays visible above it.
    if (window.matchMedia('(max-width: 1023px)').matches) {
      const top = mapBox.current?.getBoundingClientRect().top
      if (Number.isFinite(top) && Math.abs(top) > 8) window.scrollBy({ top: top - 8, behavior: 'smooth' })
    }
  }, [selected?.code])

  useEffect(() => {
    if (!selected) return
    const onKey = (e) => {
      if (e.key === 'Escape' && !document.querySelector('[role="tooltip"]')) update({ district: null })
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [selected?.code, params])

  const hero = (
    <PageHero image="kinigi-hills" eyebrow="Explore the data" title="District risk map">
      Tap or click a district to see its numbers. Risk means the estimated share of children under 5 with cough and fast
      breathing in a two-week period.
    </PageHero>
  )
  if (status === 'loading') return <>{hero}<Loading what="the map" /></>
  if (status === 'error') return <>{hero}<LoadError error={error} retry={retry} /></>

  const shares = districts.map((d) => d.exposureShare).filter(Number.isFinite)
  const exposureRange = `${Math.round(100 * Math.min(...shares))}% and ${Math.round(100 * Math.max(...shares))}%`
  const sorted = [...districts].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <>
    {hero}
    <div className={`mx-auto max-w-6xl px-4 pt-10 sm:px-6 ${selected ? 'pb-[50vh] lg:pb-0' : ''}`}>
      <Banner />

      <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <fieldset>
            <legend className="text-sm font-medium">
              Colour districts by
              <Tip label="Which measure to use">
                Between {exposureRange} of children under 5 live in homes cooking with polluting fuel, in every
                district. “Children exposed” therefore mostly follows the number of children. Smoke inside the house
                varies much more, so the indoor measure is the one that tells districts apart.
              </Tip>
            </legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {MEASURES.map((m) => (
                <label
                  key={m.id}
                  className={`flex min-h-11 cursor-pointer items-center rounded border px-3 text-sm has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent ${
                    m.id === measure.id ? 'border-accent bg-accent text-white' : 'border-line bg-surface hover:border-muted'
                  }`}
                >
                  <input
                    type="radio"
                    name="measure"
                    value={m.id}
                    checked={m.id === measure.id}
                    onChange={() => update({ measure: m.id === 'risk' ? null : m.id })}
                    className="sr-only"
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="mt-4 scroll-mt-2" ref={mapBox}>
            <DistrictMap
              geo={data.geo}
              byCode={byCode}
              measure={measure}
              scale={scale}
              selectedCode={selected?.code}
              onSelect={(code) => update({ district: byCode.get(code)?.name })}
            />
            <Legend measure={measure} scale={scale} />
            {measure.id === 'risk' && (
              <p className="mt-2 text-sm text-muted">
                Risk index
                <Term k="riskIndex" /> 0 is the lowest-risk district, 100 the highest.
              </p>
            )}
          </div>

          <div className="mt-6">
            <label htmlFor="district-select" className="text-sm font-medium">
              Or choose a district from the list
            </label>
            <select
              id="district-select"
              value={selected?.name || ''}
              onChange={(e) => update({ district: e.target.value || null })}
              className="mt-2 block min-h-11 w-full max-w-sm rounded border border-line bg-surface px-3"
            >
              <option value="">Select a district</option>
              {sorted.map((d) => (
                <option key={d.code} value={d.name}>
                  {d.name} ({d.province})
                </option>
              ))}
            </select>
          </div>
        </div>

        <aside
          aria-label="District details"
          className={
            selected
              ? 'fixed inset-x-0 bottom-0 z-[1000] max-h-[50vh] overflow-y-auto overscroll-contain border-t border-line bg-bg px-4 pb-8 pt-3 lg:static lg:z-auto lg:max-h-none lg:overflow-visible lg:border lg:p-5'
              : 'hidden lg:block lg:border lg:border-line lg:p-5'
          }
        >
          {selected && <span aria-hidden="true" className="mx-auto mb-3 block h-1 w-10 rounded bg-line lg:hidden" />}
          {selected ? (
            <DistrictPanel
              d={selected}
              nationalPct={data.model.national?.eicv7_mean_predicted_risk_pct}
              headingRef={heading}
              onClose={() => update({ district: null })}
            />
          ) : (
            <div className="text-muted">
              <p>Select a district on the map or from the list to see its tier, risk and the factors behind it.</p>
              <p className="mt-4">
                The full list is on the <Link to="/ranking">ranking page</Link>.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
    </>
  )
}
