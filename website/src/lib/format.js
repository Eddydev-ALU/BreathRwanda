const int = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

export const NO_DATA = 'No data'
const ok = (x) => typeof x === 'number' && Number.isFinite(x)

export const fmtInt = (x) => (ok(x) ? int.format(Math.round(x)) : NO_DATA)
export const fmtRWF = (x) => (ok(x) ? `${int.format(Math.round(x))} RWF` : NO_DATA)

// Shares stored as 0 to 1.
export const fmtPct = (x, digits = 1) => (ok(x) ? `${(x * 100).toFixed(digits)}%` : NO_DATA)
export const fmtPctRange = (lo, hi, digits = 1) =>
  ok(lo) && ok(hi) ? `${(lo * 100).toFixed(digits)}–${(hi * 100).toFixed(digits)}%` : NO_DATA

// "about 290,000": rounded to the nearest thousand for headline numbers.
export const fmtAbout = (x) => (ok(x) ? int.format(Math.round(x / 1000) * 1000) : NO_DATA)

export const fmtMillions = (x) => (ok(x) ? `${(x / 1e6).toFixed(2)} million` : NO_DATA)

export const rankText = (d) =>
  ok(d.priorityRank) && ok(d.priorityRankLo) && ok(d.priorityRankHi)
    ? `Rank ${d.priorityRank}, likely between ${Math.round(d.priorityRankLo)} and ${Math.round(d.priorityRankHi)}`
    : NO_DATA

export const rankShort = (d) =>
  ok(d.priorityRank) ? `${d.priorityRank} (${Math.round(d.priorityRankLo)}–${Math.round(d.priorityRankHi)})` : NO_DATA

// Digits only, for the budget box. "5,000,000" -> 5000000.
export const parseAmount = (s) => {
  const digits = String(s).replace(/[^0-9]/g, '')
  return digits === '' ? 0 : Number(digits)
}
