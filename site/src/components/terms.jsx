import Tip from './Tip.jsx'

// Plain-language definitions shown next to each technical term.
export const TERMS = {
  riskIndex: {
    label: 'Risk index',
    text: 'A score from 0 to 100 that compares districts. 0 is the district with the lowest estimated share of children under 5 with cough and fast breathing, 100 is the highest. It compares districts; it is not a percentage.',
  },
  tier: {
    label: 'Tier',
    text: 'Districts grouped by priority rank: High is ranks 1 to 10, Medium 11 to 20, Lower 21 to 30. District estimates are uncertain, so read the tier rather than the exact rank.',
  },
  exposed: {
    label: 'Exposed',
    text: 'A child under 5 who lives in a home whose main cooking fuel is polluting.',
  },
  pollutingFuel: {
    label: 'Polluting fuel',
    text: 'Firewood, charcoal, straw, crop residue or dung used for cooking. Clean fuels are gas (LPG), electricity, biogas and ethanol.',
  },
  indoor: {
    label: 'Indoor exposure',
    text: 'A child under 5 in a home that burns polluting fuel inside the house, rather than in a separate kitchen building or outdoors. The smoke stays in the rooms where children spend their time.',
  },
  interval: {
    label: '90% interval',
    text: 'The analysis was repeated 500 times on resampled survey data. 90% of the results fell inside this range. A wide range means the survey had less information about this district.',
  },
  lowConfidence: {
    label: 'Low confidence',
    text: 'Fewer than 30 sampled households in this district cook with polluting fuel inside the house. The indoor-smoke numbers for this district rest on very few households and could be quite different in reality.',
  },
  casesAverted: {
    label: 'Cases averted',
    text: 'How many fewer children under 5 would have cough with fast breathing in a typical two-week period, if the stoves are used as assumed. It is an estimate from published research, not a prediction.',
  },
  rank: {
    label: 'Rank',
    text: 'Districts are ranked by how many cases of cough with fast breathing one clean stove is expected to prevent there. Rank 1 is served first. The range shows how much the rank moved across 500 repeats of the analysis.',
  },
}

export function Term({ k }) {
  const t = TERMS[k]
  return <Tip label={t.label}>{t.text}</Tip>
}
