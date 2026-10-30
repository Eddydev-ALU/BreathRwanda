// What-if planner (guide sections 7.3 and 8.4).
// Districts are served in order of cases averted per stove, each up to its number of
// polluting-fuel households, until the stoves run out.

// One "segment" is a group of households in a district that can receive stoves.
// "risk" priority: all polluting-fuel households, one segment per district.
// "indoor" priority: households that burn polluting fuel inside the house come first;
// the rest of each district's polluting-fuel households follow, using the district
// totals minus the indoor part (children and risk-weighted children are additive).
function segments(districts, priority) {
  if (priority !== 'indoor') {
    return districts.map((d) => ({
      d,
      pass: 1,
      childrenPerHH: d.childrenPerHH,
      risk: d.riskExposed,
      limit: Math.max(0, Math.floor(d.pollutingHH)),
    }))
  }
  const out = []
  for (const d of districts) {
    const indoorHH = Math.max(0, Math.min(Math.floor(d.indoorPollutingHH), Math.floor(d.pollutingHH)))
    out.push({ d, pass: 1, childrenPerHH: d.childrenPerIndoorHH, risk: d.riskIndoor, limit: indoorHH })

    const restHH = Math.max(0, Math.floor(d.pollutingHH) - indoorHH)
    const allChildren = d.childrenPerHH * d.pollutingHH
    const indoorChildren = d.childrenPerIndoorHH * indoorHH
    const restChildren = Math.max(0, allChildren - indoorChildren)
    const restRiskChildren = Math.max(0, d.riskExposed * allChildren - d.riskIndoor * indoorChildren)
    out.push({
      d,
      pass: 2,
      childrenPerHH: restHH > 0 ? restChildren / restHH : 0,
      risk: restChildren > 0 ? restRiskChildren / restChildren : 0,
      limit: restHH,
    })
  }
  return out
}

const toNumber = (x) => (Number.isFinite(Number(x)) ? Number(x) : 0)

export function plan(districts, stove, budgetInput, priority = 'risk') {
  const budget = Math.max(0, Math.floor(toNumber(budgetInput)))
  const cost = toNumber(stove.cost)
  const usage = Math.min(1, Math.max(0, toNumber(stove.usage)))
  const effA = Math.min(1, Math.max(0, toNumber(stove.effectTrial)))
  const effB = Math.min(1, Math.max(0, toNumber(stove.effectObservational)))
  const effLow = Math.min(effA, effB)
  const effHigh = Math.max(effA, effB)

  const affordable = cost > 0 ? Math.floor(budget / cost) : 0

  const segs = segments(districts, priority)
    .map((s) => ({ ...s, score: s.childrenPerHH * s.risk }))
    .sort((a, b) => a.pass - b.pass || b.score - a.score || a.d.priorityRank - b.d.priorityRank)

  const byCode = new Map()
  let left = affordable
  let order = 0
  for (const s of segs) {
    if (left <= 0) break
    const give = Math.min(left, s.limit)
    if (give <= 0) continue
    left -= give
    let row = byCode.get(s.d.code)
    if (!row) {
      row = { code: s.d.code, name: s.d.name, province: s.d.province, order: order++, stoves: 0, children: 0, casesPerEffect: 0 }
      byCode.set(s.d.code, row)
    }
    row.stoves += give
    row.children += give * s.childrenPerHH * usage
    row.casesPerEffect += give * s.childrenPerHH * s.risk * usage
  }

  // Rows are rounded first and the totals are sums of the rounded rows,
  // so the big numbers, the chart and the table always agree.
  const rows = [...byCode.values()]
    .sort((a, b) => a.order - b.order)
    .map((r) => ({
      code: r.code,
      name: r.name,
      province: r.province,
      order: r.order + 1,
      stoves: r.stoves,
      children: Math.round(r.children),
      casesLow: Math.round(r.casesPerEffect * effLow),
      casesHigh: Math.round(r.casesPerEffect * effHigh),
      cost: r.stoves * cost,
      budgetShare: budget > 0 ? (r.stoves * cost) / budget : 0,
    }))

  const sum = (k) => rows.reduce((t, r) => t + r[k], 0)
  const stoves = sum('stoves')
  const spent = stoves * cost
  return {
    budget,
    cost,
    affordable,
    stoves,
    unplacedStoves: affordable - stoves,
    spent,
    leftover: budget - spent,
    children: sum('children'),
    casesLow: sum('casesLow'),
    casesHigh: sum('casesHigh'),
    effLow,
    effHigh,
    rows,
  }
}
