import { useData } from '../lib/data.js'
import { fmtInt } from '../lib/format.js'
import { Loading, LoadError, usePageMeta } from '../components/Status.jsx'
import { Term } from '../components/terms.jsx'

const REPO_URL = 'https://github.com/Eddydev-ALU/BreathRwanda'

const SOURCES = [
  {
    name: 'Integrated Household Living Conditions Survey (EICV7) 2023/24',
    by: 'NISR',
    use: 'Cooking fuel, cooking place and household details for every child under 5. The model is applied to these children.',
    url: 'https://microdata.statistics.gov.rw/index.php/catalog/119',
  },
  {
    name: 'Rwanda Demographic and Health Survey 2019-20',
    by: 'NISR, Ministry of Health, The DHS Program/ICF',
    use: 'Training data for the risk model (cough with fast breathing in the last two weeks).',
    url: 'https://microdata.statistics.gov.rw/index.php/catalog/98',
  },
  {
    name: 'Rwanda Demographic and Health Survey 2025',
    by: 'NISR, Ministry of Health, The DHS Program/ICF',
    use: 'Training data for the risk model, pooled with 2019-20.',
    url: 'https://microdata.statistics.gov.rw/index.php/catalog/126',
  },
  {
    name: 'Population and Housing Census 2022',
    by: 'NISR',
    use: 'Number of children under 5 and households in each district.',
    url: 'https://microdata.statistics.gov.rw/index.php/catalog/109',
  },
  {
    name: 'District boundaries 2022',
    by: 'NISR / Rwanda Biomedical Centre',
    use: 'The district shapes on the map.',
    url: 'https://gis.rbc.gov.rw/server/rest/services/Full_District_boundary_2022/MapServer',
  },
]

// Plain names for the model's comparison groups.
const PROVINCE = { 2: 'Southern', 3: 'Western', 4: 'Northern', 5: 'Eastern' }
const WEALTH = { 1: 'Poorest fifth', 2: 'Second fifth', 3: 'Middle fifth', 4: 'Fourth fifth' }
function levelName(o) {
  switch (o.feature) {
    case 'fuel':
      return { group: 'Cooking fuel', level: o.level === 'charcoal' ? 'Charcoal' : 'Wood, straw or other biomass', ref: 'clean fuel' }
    case 'place':
      return { group: 'Where food is cooked', level: o.level === 'in the house' ? 'In the house' : 'Separate building', ref: 'outdoors' }
    case 'wealth_q':
      return { group: 'Household wealth', level: WEALTH[o.level] || o.level, ref: 'richest fifth' }
    case 'rural':
      return { group: 'Residence', level: 'Rural', ref: 'urban' }
    case 'age_group':
      return { group: 'Child age', level: o.level === '<1y' ? 'Under 1 year' : '1 year', ref: '2 to 4 years' }
    case 'hhsize':
      return { group: 'Household size', level: `${o.level} people`, ref: '4 to 5 people' }
    case 'province':
      return { group: 'Province', level: PROVINCE[o.level] || o.level, ref: 'City of Kigali' }
    case 'sex_female':
      return { group: 'Child sex', level: 'Girl', ref: 'boy' }
    case 'survey2025':
      return { group: 'Survey round', level: 'DHS 2025', ref: 'DHS 2019-20' }
    default:
      return { group: o.label, level: o.level, ref: '' }
  }
}

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="text-2xl">
        {title}
      </h2>
      <div className="mt-4 max-w-prose space-y-4">{children}</div>
    </section>
  )
}

export default function Methods() {
  usePageMeta('Methods and limits', 'Data sources, method, model results and limitations of BreathRwanda.')
  const { status, data, error, retry } = useData()
  if (status === 'loading') return <Loading what="the methods" />
  if (status === 'error') return <LoadError error={error} retry={retry} />

  const m = data.model
  const n = m.national
  const cv = m.outcome.cv || {}
  const auc = (x) => (Number.isFinite(x?.auc) ? x.auc.toFixed(2) : 'No data')
  const maxImp = Math.max(...m.importance.map((x) => x.meanAbsShap))

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 pt-8 sm:px-6">
      <div>
        <h1 className="text-3xl sm:text-4xl">Methods and limits</h1>
        <p className="mt-3 max-w-prose">
          How the numbers on this site were made, how good they are, and what they cannot tell you.
        </p>
      </div>

      <Section id="sources" title="Data sources">
        <ul className="space-y-4">
          {SOURCES.map((s) => (
            <li key={s.name}>
              <a href={s.url} target="_blank" rel="noreferrer" className="font-medium">
                {s.name}
              </a>
              <span className="text-muted"> · {s.by}</span>
              <p className="text-sm text-muted">{s.use}</p>
            </li>
          ))}
        </ul>
        <p className="text-sm">
          The survey microdata cannot be redistributed. This site reads only small district-level summary files; no
          household or child records are published.
        </p>
      </Section>

      <Section id="steps" title="How it works">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Train a model.</strong> A survey-weighted logistic regression is fitted on {fmtInt(m.training.children)}{' '}
            children under 5 from the Rwanda DHS 2019-20 and 2025. It predicts whether a mother reports that her child
            had a cough with short, rapid breathing in the last two weeks. Predictors: cooking fuel, where food is
            cooked, household wealth, rural or urban, child age, household size, province and child sex.
          </li>
          <li>
            <strong>Apply it to EICV7.</strong> {m.appliedTo}. Each child gets a predicted risk.
          </li>
          <li>
            <strong>Add up by district.</strong> For each district: the share of children in homes with polluting fuel
            <Term k="pollutingFuel" />, the share where that fuel is burned inside the house, and the average risk.
            These are multiplied by the Census 2022 number of children under 5.
          </li>
          <li>
            <strong>Measure uncertainty.</strong> {m.training.bootstrap}. The 5th and 95th percentiles give the 90%
            interval
            <Term k="interval" /> for every district number and rank.
          </li>
          <li>
            <strong>Rank districts.</strong> Each district is scored by children per polluting household times the
            risk among exposed children: the cases one stove can prevent there. Ranks 1 to 10 form the High tier, 11
            to 20 Medium and 21 to 30 Lower
            <Term k="tier" />.
          </li>
          <li>
            <strong>Plan a budget.</strong> The planner buys as many stoves as the budget allows and gives them to
            districts in priority order, each up to its number of polluting-fuel households, until the stoves run out.
          </li>
        </ol>
        <p className="border-l-2 border-scale-4 bg-surface px-4 py-3">
          Surveys cannot separate the effect of fuel from other causes, so the benefit of a stove comes from published
          research, not from this model.
        </p>
      </Section>

      <Section id="results" title="Model results">
        <p>
          The outcome, cough with fast breathing, was reported for {fmtInt(m.outcome.events)} of{' '}
          {fmtInt(m.outcome.n)} children ({m.outcome.prevalencePct}% after survey weighting).
        </p>
        <h3 className="text-lg">Validation</h3>
        <p className="text-sm text-muted">{m.training.validation}.</p>
        <dl className="text-sm">
          {[
            ['How well the model separates children with and without symptoms (AUC, 0.5 = chance, 1 = perfect)', `${auc(cv.logistic)} (a model using province only: ${auc(cv.province_only)})`],
            ['Calibration slope (1 = predicted risks spread exactly as observed)', Number.isFinite(cv.logistic?.calib_slope) ? cv.logistic.calib_slope.toFixed(2) : 'No data'],
            ['Average predicted risk for EICV7 children', `${n.eicv7_mean_predicted_risk_pct}%`],
            ['Observed rate in DHS 2025', `${n.dhs2025_observed_pct}%`],
            ['Children under 5, sum of districts vs Census', n.census_children_total_matches ? `${fmtInt(n.census_children_u5)}, matches` : 'Does not match'],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col justify-between gap-1 border-b border-line py-2.5 sm:flex-row sm:gap-6">
              <dt className="text-muted">{k}</dt>
              <dd className="tabular-nums sm:text-right">{v}</dd>
            </div>
          ))}
        </dl>
        <p>
          The model separates children only modestly. It is good at the national level (the average predicted risk is
          close to the observed rate) and is used to compare districts, not to predict any one child.
        </p>

        <h3 className="text-lg">Which factors matter most</h3>
        <p className="text-sm text-muted">Average size of each factor’s effect on the predicted risk (larger = more influence).</p>
        <ul className="space-y-2">
          {m.importance.map((f) => (
            <li key={f.key} className="grid grid-cols-[9.5rem_minmax(0,1fr)] items-center gap-3 text-sm">
              <span>{f.label}</span>
              <span className="flex items-center gap-2">
                <span className="h-3 bg-accent" style={{ width: `${(f.meanAbsShap / maxImp) * 75}%` }} aria-hidden="true" />
                <span className="tabular-nums text-muted">{f.meanAbsShap.toFixed(3)}</span>
              </span>
            </li>
          ))}
        </ul>
      </Section>

      <section aria-labelledby="or-heading" className="max-w-4xl">
        <h3 id="or-heading" className="text-lg">
          Odds ratios
        </h3>
        <p className="mt-2 max-w-prose text-sm text-muted">
          An odds ratio above 1 means higher odds of cough with fast breathing than the comparison group, below 1 means
          lower. If the 95% confidence interval includes 1, the survey cannot tell the difference from no effect.
          Cooking fuel and cooking place both include 1.
        </p>
        <div className="mt-3 overflow-x-auto border border-line">
          <table className="w-full min-w-[560px] text-sm">
            <caption className="sr-only">Odds ratios from the risk model</caption>
            <thead className="bg-surface">
              <tr className="border-b border-line text-left">
                <th scope="col" className="px-3 py-2 font-medium">Factor</th>
                <th scope="col" className="px-3 py-2 font-medium">Group (compared with)</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Odds ratio</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">95% interval</th>
              </tr>
            </thead>
            <tbody>
              {m.oddsRatios.map((o) => {
                const l = levelName(o)
                const includesOne = o.lo <= 1 && o.hi >= 1
                return (
                  <tr key={`${o.feature}-${o.level}`} className="border-b border-line last:border-b-0">
                    <td className="px-3 py-2">{l.group}</td>
                    <td className="px-3 py-2">
                      {l.level} <span className="text-muted">({l.ref})</span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{o.or.toFixed(2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {o.lo.toFixed(2)}–{o.hi.toFixed(2)}
                      {includesOne && <span className="block text-xs text-muted">includes 1</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <Section id="stoves" title="Stove assumptions">
        <p>
          Stove cost, usage and effectiveness come from programme documents and published studies. Every value can be
          changed in the planner. Randomised trials found small effects that were not statistically clear, while
          observational studies suggest larger ones, so the planner shows cases averted
          <Term k="casesAverted" /> as a range.
        </p>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {data.assumptions.evidence.map((e) => (
            <li key={e.id}>
              {e.url ? (
                <a href={e.url} target="_blank" rel="noreferrer">
                  {e.citation}
                </a>
              ) : (
                e.citation
              )}
            </li>
          ))}
        </ul>
      </Section>

      <Section id="limits" title="Limitations">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            The outcome is a symptom reported by mothers: cough with fast breathing. It is not a medical diagnosis.
          </li>
          <li>The results show associations, not proof of cause.</li>
          <li>
            The model is trained on the DHS and applied to EICV7. The two surveys are designed differently and measure
            wealth differently (assets versus spending), so predicted risks are approximate.
          </li>
          <li>
            Neither survey is built for precise district estimates. District numbers carry uncertainty, so read the
            ranking as broad tiers. Indoor-cooking estimates for most Eastern districts, and for Gicumbi, rest on fewer
            than 30 sampled households and are marked low confidence
            <Term k="lowConfidence" />.
          </li>
          <li>
            Stove cost, effectiveness and usage are assumptions taken from the sources listed. Real results depend on
            how households use the stoves, including whether they keep using the old one as well.
          </li>
          <li>The survey data are from 2019 to 2025. Conditions may have changed since.</li>
          <li>
            Cooking smoke is one of several causes of breathing illness in children. The tool does not include others,
            such as nutrition, vaccination or outdoor air pollution.
          </li>
          <li>
            Refugee-camp households (for example Mahama camp in Kirehe) are counted in the Census but are probably
            missing from the EICV7 survey sample.
          </li>
        </ul>
      </Section>

      <Section id="ai" title="AI disclosure">
        <p>
          AI tools were used for research, planning, code assistance and drafting support. The team reviewed, tested
          and is responsible for all analysis, code, results and text in this submission.
        </p>
      </Section>

      <Section id="thanks" title="Acknowledgements">
        <p>
          Data: National Institute of Statistics of Rwanda (NISR), Integrated Household Living Conditions Survey
          (EICV7) 2023/24; Rwanda Demographic and Health Survey 2019-20 and 2025 (NISR, Ministry of Health, The DHS
          Program/ICF); Rwanda Population and Housing Census 2022; administrative boundaries from NISR / Rwanda
          Biomedical Centre.
        </p>
        <p>
          Code and analysis:{' '}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            BreathRwanda on GitHub
          </a>
        </p>
        <p>Team: Member 1, Member 2</p>
      </Section>
    </div>
  )
}
