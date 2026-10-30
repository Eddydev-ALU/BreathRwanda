// One-hue sequential scale, light sand to burnt orange. The same steps are used
// for the map, the legend and the tier labels.
export const STEPS = ['#F1E6D0', '#E2BFA4', '#D39778', '#C4704B', '#B5481F']

export const TIER = {
  High: { bg: STEPS[4], fg: '#FFFFFF' },
  Medium: { bg: STEPS[2], fg: '#1F2421' },
  Lower: { bg: STEPS[0], fg: '#1F2421' },
}

// Five equal-width classes between the lowest and highest district.
export function makeScale(values) {
  const finite = values.filter((v) => Number.isFinite(v))
  const min = Math.min(...finite)
  const max = Math.max(...finite)
  const width = (max - min) / STEPS.length || 1
  const breaks = STEPS.map((_, i) => min + i * width)
  return {
    color: (v) => (Number.isFinite(v) ? STEPS[Math.min(STEPS.length - 1, Math.floor((v - min) / width))] : '#FFFFFF'),
    classes: STEPS.map((c, i) => ({ color: c, from: breaks[i], to: i === STEPS.length - 1 ? max : breaks[i + 1] })),
  }
}
