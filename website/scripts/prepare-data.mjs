// Copies the pipeline exports in website/data into public/data for the static site.
// Only aggregate district files are read. The script fails if anything looks wrong,
// so a bad export never reaches the published site.
import { readFileSync, writeFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = join(root, 'data')
const out = join(root, 'public', 'data')
mkdirSync(out, { recursive: true })

const fail = (msg) => {
  console.error(`prepare-data: ${msg}`)
  process.exit(1)
}

// The pipeline writes NaN for empty cells, which is not valid JSON.
const readJson = (name) => JSON.parse(readFileSync(join(src, name), 'utf8').replace(/\bNaN\b/g, 'null'))

// The outcome is a symptom, not a diagnosis. Drop any source text that names a diagnosis.
const BANNED = /pneumonia/i
const clean = (s) => (typeof s === 'string' && BANNED.test(s) ? null : s)

const districts = readJson('districts.json')
const geo = readJson('districts.geojson')
const assumptions = readJson('assumptions.json')
const summary = readJson('model_summary.json')

// District names and codes must match between the table and the boundaries.
if (districts.length !== 30) fail(`expected 30 districts, found ${districts.length}`)
if (geo.features.length !== 30) fail(`expected 30 boundaries, found ${geo.features.length}`)
const byCode = new Map(districts.map((d) => [d.code, d.name]))
for (const f of geo.features) {
  const { district_code: code, district_name: name } = f.properties
  if (byCode.get(code) !== name) fail(`boundary ${code} ${name} does not match districts.json (${byCode.get(code)})`)
}

const site = {
  howToRead: assumptions.howToRead,
  evidence: assumptions.effectEvidence.sources.map((s) => ({ id: s.id, citation: s.citation, url: clean(s.url) })),
  stoves: assumptions.stoves.map((s) => ({
    ...s,
    costSource: clean(s.costSource),
    usageSource: clean(s.usageSource),
    effectSource: clean(s.effectSource),
  })),
  defaults: assumptions.defaults,
  programmeContext: assumptions.programmeContext.map((p) => ({ ...p, fact: clean(p.fact) })).filter((p) => p.fact),
}

const main = summary.outcomes.cough_fast
const model = {
  outcome: { label: main.label, n: main.n_children, events: main.n_events, prevalencePct: main.weighted_prevalence_pct, cv: main.cv, chosen: main.chosen_model },
  oddsRatios: summary.oddsRatios.cough_fast,
  importance: summary.featureImportance.cough_fast_logistic,
  descriptiveRates: summary.descriptiveRates,
  robustness: summary.robustness,
  national: summary.national,
  training: summary.training,
  appliedTo: summary.appliedTo,
}

const files = {
  'districts.json': JSON.stringify(districts),
  'districts.geojson': JSON.stringify(geo),
  'assumptions.json': JSON.stringify(site),
  'model_summary.json': JSON.stringify(model),
  'ranking_default.csv': readFileSync(join(src, 'ranking_default.csv'), 'utf8'),
}

let total = 0
for (const [name, text] of Object.entries(files)) {
  if (BANNED.test(text)) fail(`${name} still contains a diagnosis word`)
  writeFileSync(join(out, name), text)
  total += statSync(join(out, name)).size
}
if (total > 1024 * 1024) fail(`data files total ${total} bytes, over the 1 MB budget`)
console.log(`prepare-data: wrote ${Object.keys(files).length} files to public/data (${Math.round(total / 1024)} KB)`)
