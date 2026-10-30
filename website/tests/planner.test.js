import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { plan } from '../src/lib/planner.js'

const districts = JSON.parse(readFileSync(new URL('../data/districts.json', import.meta.url)))
const raw = JSON.parse(readFileSync(new URL('../data/assumptions.json', import.meta.url)))
const stoveOf = (id) => {
  const s = raw.stoves.find((x) => x.id === id)
  return { cost: s.cost, usage: s.usage, effectTrial: s.effect.trial, effectObservational: s.effect.observational }
}
const limits = new Map(districts.map((d) => [d.code, Math.floor(d.pollutingHH)]))

function checkInvariants(r) {
  assert.ok(r.stoves <= r.affordable, 'never place more stoves than bought')
  for (const row of r.rows) assert.ok(row.stoves <= limits.get(row.code), `${row.name} over its limit`)
  assert.equal(r.rows.reduce((t, x) => t + x.stoves, 0), r.stoves)
  assert.equal(r.rows.reduce((t, x) => t + x.children, 0), r.children)
  assert.equal(r.rows.reduce((t, x) => t + x.casesLow, 0), r.casesLow)
  assert.equal(r.rows.reduce((t, x) => t + x.casesHigh, 0), r.casesHigh)
  assert.ok(r.casesLow <= r.casesHigh)
  assert.ok(r.leftover >= 0)
  assert.equal(r.spent + r.leftover, r.budget)
}

test('5 billion RWF, improved cookstove, default priority', () => {
  const r = plan(districts, stoveOf('ics'), 5_000_000_000, 'risk')
  assert.equal(r.affordable, 138888)
  assert.equal(r.stoves, 138888)
  assert.deepEqual(r.rows.map((x) => x.name), ['Nyaruguru', 'Gisagara'])
  // Matches the walkthrough notebook: about 68,800 children, 1,230 to 1,610 cases.
  assert.ok(Math.abs(r.children - 68800) < 100, `children ${r.children}`)
  assert.ok(Math.abs(r.casesLow - 1230) < 10, `low ${r.casesLow}`)
  assert.ok(Math.abs(r.casesHigh - 1610) < 10, `high ${r.casesHigh}`)
  checkInvariants(r)
})

test('budget 0 gives an empty plan', () => {
  const r = plan(districts, stoveOf('ics'), 0, 'risk')
  assert.equal(r.stoves, 0)
  assert.equal(r.rows.length, 0)
  checkInvariants(r)
})

test('huge budget covers every polluting household and leaves money over', () => {
  const r = plan(districts, stoveOf('lpg'), 1e15, 'risk')
  const all = [...limits.values()].reduce((a, b) => a + b, 0)
  assert.equal(r.stoves, all)
  assert.equal(r.rows.length, 30)
  assert.ok(r.unplacedStoves > 0 && r.leftover > 0)
  checkInvariants(r)
})

test('budget that does not divide by the cost', () => {
  const r = plan(districts, stoveOf('ics'), 36_000 * 10 + 35_999, 'risk')
  assert.equal(r.stoves, 10)
  assert.equal(r.leftover, 35_999)
  checkInvariants(r)
})

test('indoor priority starts with Rubavu and respects limits', () => {
  const r = plan(districts, stoveOf('ics'), 5_000_000_000, 'indoor')
  checkInvariants(r)
  assert.equal(r.rows[0].name, 'Rubavu')
  const huge = plan(districts, stoveOf('ics'), 1e15, 'indoor')
  assert.equal(huge.stoves, [...limits.values()].reduce((a, b) => a + b, 0))
  checkInvariants(huge)
})

test('bad inputs do not throw', () => {
  for (const b of [NaN, -5, 'abc', Infinity]) checkInvariants(plan(districts, stoveOf('ics'), b, 'risk'))
  checkInvariants(plan(districts, { cost: 0, usage: 1, effectTrial: 0.1, effectObservational: 0.2 }, 1e9, 'risk'))
})
