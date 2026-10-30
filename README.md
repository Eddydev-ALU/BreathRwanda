# Clean Air, Healthy Children (BreathRwanda)

**Where will clean cooking stoves protect the most children in Rwanda?**

**Live website:** https://breathrwanda.vercel.app/
**Demo video:** https://youtu.be/rzA0xFetffU

NISR 2026 Big Data Hackathon, Track 3 (Open Innovation: Health).

---

## Contents

1. [The problem](#the-problem)
2. [What this project does](#what-this-project-does)
3. [Key findings](#key-findings)
4. [The website](#the-website)
5. [Data sources](#data-sources)
6. [Method](#method)
7. [Model results](#model-results)
8. [District ranking](#district-ranking)
9. [The budget planner](#the-budget-planner)
10. [Quality checks and privacy](#quality-checks-and-privacy)
11. [Repository layout](#repository-layout)
12. [Reproduce the analysis](#reproduce-the-analysis)
13. [Run and deploy the website](#run-and-deploy-the-website)
14. [Limitations](#limitations)
15. [Policy relevance](#policy-relevance)
16. [Sources and acknowledgements](#sources-and-acknowledgements)
17. [AI tool disclosure](#ai-tool-disclosure)
18. [Team](#team)

---

## The problem

Cooking smoke from wood, straw and charcoal is one of the main causes of household air pollution, and young children are among the most exposed because they spend much of the day near the cooking fire.

In Rwanda, according to the 2022 Census:

- **1.73 million** children are under the age of five.
- **97%** of them (1.68 million) live in homes that cook mainly with polluting fuel.
- About **290,000** of them live in homes where that fuel is burned **inside the house**.
- About **149,000** young children have a cough with fast breathing in any two-week period (model estimate).

Clean cooking programmes have limited budgets. Planners need to know **which districts to serve first** and **what a given budget can realistically achieve**. That information is spread across several national surveys that were never designed to be read together. This project brings them together.

## What this project does

1. **Combines four national datasets** from the National Institute of Statistics of Rwanda (NISR): EICV7 2023/24, the Rwanda DHS 2019-20 and 2025, and the 2022 Population and Housing Census, plus official district boundaries.
2. **Trains a survey-weighted risk model** on 14,692 children from the DHS to estimate how likely a child is to have a cough with fast breathing, based on household and child characteristics.
3. **Applies the model to every child under five in EICV7** and scales the results to Census 2022 district populations.
4. **Ranks all 30 districts** for clean-stove programmes, with 90% uncertainty intervals from a 500-round bootstrap, so rankings are read as tiers rather than exact positions.
5. **Publishes an interactive website** with a risk map, a ranking table and a budget planner that shows where stoves should go and how many children they would reach.
6. **Is open about its limits**: every number carries an interval, districts with thin data are flagged, and the stove effects come from published research, not from our model.

## Key findings

- **Exposure is near universal.** 96.9% of children under five live in homes that cook mainly with polluting fuel. Fuel type alone therefore does little to separate districts. **Smoke inside the house** does.
- **Before adjustment**, symptoms are more common in homes using wood or straw (8.6%) than charcoal (6.2%) or clean fuel (5.3%), and more common where polluting fuel is burned indoors (9.2% against 7.8%).
- **After adjusting** for wealth, province, child age and household size, cooking fuel and cooking place show **no statistically significant association** in the survey data. Clean fuel users are few (3%) and mostly urban and wealthier, so surveys cannot isolate the effect of fuel. We report this openly and take stove effects from published trials instead.
- **What does predict risk**: child age (under two), province (Southern and Eastern highest, Kigali lowest) and household wealth.
- **Priority districts:** **Nyaruguru** and **Gisagara** rank first and second, with stable ranks (90% intervals 1 to 3 and 1 to 5). The rest of the High tier: Nyagatare, Nyanza, Bugesera, Kamonyi, Rwamagana, Nyamagabe, Rubavu and Rusizi. Kigali's three districts are consistently last.
- **Rubavu** has by far the most children exposed to smoke inside the house (38,632), so it comes first when the planner prioritises indoor cooking.
- **What a budget buys:** 5 billion RWF buys 138,888 improved cookstoves, which reach about 68,800 children under five in Nyaruguru and Gisagara and avert an estimated 1,229 to 1,383 cases of cough with fast breathing in a typical two-week period.

## The website

**https://breathrwanda.vercel.app/**

A fast, static, mobile-friendly site that needs no login, no server and no database. It reads five small aggregate data files.

| Page | What you can do |
|---|---|
| **Home** (`/`) | The headline question, Rwanda in four numbers, key findings and links to each tool |
| **The Problem** (`/problem`) | Why cooking smoke matters for young children, the survey evidence and what clean cooking can change |
| **Risk map** (`/map`) | Colour the 30 districts by risk index, children exposed or children exposed to smoke indoors. Click a district to open its panel: priority tier, rank with its 90% range, risk with its interval, children counts, a low-confidence note where relevant and a "why is this district high?" breakdown. Links such as `/map?district=Rubavu&measure=indoor` open a district directly |
| **Ranking** (`/ranking`) | Sortable table of all 30 districts with tier, rank range, province filter, search and CSV download. On phones it switches to easy-to-read cards |
| **Planner** (`/planner`) | Enter a budget, pick a stove (improved cookstove, LPG or electric pressure cooker), edit any assumption, and choose a priority rule. See stoves bought, children reached, cases averted as a range, and a district-by-district allocation you can download as CSV |
| **Methods** (`/methods`) | Data sources, method steps, model accuracy, odds ratios, stove evidence with citations, limitations and the AI disclosure |

Design choices:

- **Honesty built in.** Intervals next to every estimate, a survey banner on every data page, low-confidence flags with reasons, and cases averted always shown as a range.
- **Plain language.** The site says "cough with fast breathing", never "pneumonia", because the survey records a symptom, not a diagnosis. Each technical term has a "?" tooltip.
- **Accessible.** Keyboard navigation, screen-reader labels, 44 px touch targets, reduced-motion support and layouts tested at phone width.
- **Built with** React 18, Vite 6, Tailwind CSS 4, Leaflet and React Router, with the PT Sans typeface.

## Data sources

All survey data come from the [NISR microdata portal](https://microdata.statistics.gov.rw/). The microdata are not redistributed in this repository.

| Dataset | What we use it for | Sample |
|---|---|---|
| **Rwanda DHS 2019-20** and **2025** | Training the risk model: child symptoms, cooking fuel, where food is cooked, wealth, age, province | 14,692 children under five (7,758 and 6,934) |
| **EICV7 2023/24** | Applying the model: household and child characteristics, cooking place, children per household | 7,667 children under five in 15,054 households |
| **Census 2022** | District populations, share of children in polluting-fuel homes, number of polluting-fuel households | 1,731,594 children under five (weighted) |
| **District boundaries** | The map (Rwanda Biomedical Centre boundary service, 2022 districts) | 30 districts |

Checks on the data before modelling:

- All 30 districts match across every source by code and name.
- EICV7 fuel shares match the published NISR EICV7 report table.
- Our ARI (acute respiratory infection) rates reproduce the published DHS figures exactly: 1.79% in 2025 and 1.70% in 2019-20.
- Variable names were verified against each file; see [docs/data_inventory.md](docs/data_inventory.md).

## Method

```
DHS 2019-20 + 2025  ──►  survey-weighted model  ──►  applied to every EICV7 child  ──►  scaled to Census 2022
 (14,692 children)        (logistic regression)        (7,667 children)                 (30 districts)
                                                                                              │
                                     500-round two-stage cluster bootstrap  ◄─────────────────┤
                                                                                              ▼
                                               ranking + intervals  ──►  website (map, ranking, planner)
```

1. **Clean and harmonise.** Cooking fuel is grouped into clean (LPG, electricity, biogas, solar, ethanol), charcoal, and wood, straw or other biomass. Cooking place is grouped into outdoors, separate building and inside the house. Wealth, residence, child age, household size, province, child sex and survey round are coded the same way across surveys.
2. **Outcome.** The main outcome is **cough with short, rapid breathing in the last two weeks** (7.97% of children). The official DHS ARI indicator (1.76%) is kept as a sensitivity check. With only about 120 to 130 cases per survey, it is too rare to support a model on its own.
3. **Model.** Survey-weighted logistic regression with cluster-robust standard errors, compared against XGBoost and simple baselines using 5-fold cross-validation grouped by survey cluster, repeated five times.
4. **Explain.** SHAP values show which factors drive each district's risk. These feed the "why is this district high?" panel on the website.
5. **District numbers.** For each district: children under five (Census), share in polluting-fuel homes (Census, with design-based intervals), share where fuel is burned indoors (EICV7), average risk, expected children with symptoms, children per polluting household and number of polluting-fuel households.
6. **Uncertainty.** A two-stage cluster bootstrap with 500 rounds: each round resamples DHS clusters and refits the model, then resamples EICV7 clusters and recomputes every district number and the ranking. Intervals are the 5th to 95th percentiles.
7. **Priority score.** Children per polluting household multiplied by the risk among exposed children: the expected cases one stove can prevent in that district.

Full details: [docs/methods_and_results.md](docs/methods_and_results.md).

## Model results

| Model (main outcome) | AUC | Brier score | Calibration slope |
|---|---:|---:|---:|
| **Logistic regression (chosen)** | **0.588** | **0.0729** | 0.79 |
| XGBoost | 0.584 | 0.0732 | 0.65 |
| Province only | 0.556 | 0.0731 | 0.88 |
| No skill | 0.500 | 0.0734 | |

- The **logistic model was chosen**: XGBoost was not more accurate and was less well calibrated, so the simpler, more transparent model wins.
- Discrimination is **modest**, as expected for a two-week symptom that depends on many things surveys do not record (infections in the community, vaccination, nutrition, season). The model is **well calibrated** (predicted risk by decile from 3.7% to 13.4%, observed 3.7% to 12.3%), which is what a district ranking needs.
- **Sanity check:** the average predicted risk for EICV7 children is 8.59%, against 8.66% observed in DHS 2025.

Strongest factors (odds ratios, 95% CI):

| Factor | Odds ratio |
|---|---|
| Southern province (against Kigali) | 2.26 (1.52 to 3.35) |
| Eastern province (against Kigali) | 2.10 (1.41 to 3.12) |
| Child aged 1 year (against 2 to 4) | 1.51 (1.30 to 1.76) |
| Child under 1 year (against 2 to 4) | 1.40 (1.20 to 1.63) |
| Poorer wealth quintile (against richest) | 1.39 (1.03 to 1.88) |
| Wood, straw or biomass (against clean fuel) | 1.08 (0.63 to 1.85), not significant |
| Cooking inside the house (against outdoors) | 1.02 (0.83 to 1.27), not significant |

## District ranking

| Rank (90% range) | District | Province | Children under 5 | Fuel burned in the house | Risk % (90% CI) |
|---|---|---|---:|---:|---|
| 1 (1 to 3) | Nyaruguru | Southern | 42,169 | 19,088 | 11.0 (9.7 to 12.5) |
| 2 (1 to 5) | Gisagara | Southern | 54,355 | 23,522 | 11.4 (10.1 to 12.7) |
| 3 (2 to 13) | Nyagatare | Eastern | 94,260 | 895 | 9.9 (8.7 to 11.1) |
| 4 (3 to 12) | Nyanza | Southern | 46,837 | 9,873 | 10.6 (9.3 to 12.0) |
| 5 (2 to 13) | Bugesera | Eastern | 81,757 | 5,428 | 9.5 (8.4 to 10.7) |
| 6 (3 to 15) | Kamonyi | Southern | 56,348 | 9,704 | 10.7 (9.5 to 12.0) |
| 7 (3 to 16) | Rwamagana | Eastern | 63,927 | 4,900 | 9.3 (8.3 to 10.6) |
| 8 (4 to 15) | Nyamagabe | Southern | 43,729 | 13,053 | 11.0 (9.8 to 12.3) |
| 9 (3 to 16) | Rubavu | Western | 78,964 | 38,632 | 8.6 (7.4 to 9.8) |
| 10 (3 to 17) | Rusizi | Western | 69,849 | 8,522 | 8.0 (7.0 to 9.0) |

- **Tiers:** ranks 1 to 10 are High, 11 to 20 Medium and 21 to 30 Lower. Because the rank ranges overlap, tiers are the right way to read the list.
- **Low confidence:** seven districts are flagged. Nyagatare, Bugesera, Ngoma, Gatsibo, Kayonza and Gicumbi have fewer than 30 sampled households that cook indoors with polluting fuel. Kirehe is flagged for that reason and because the Census and EICV7 disagree on fuel use by more than 5 points, most likely because the Mahama refugee camp (about 21% of Kirehe's children under five) is in the Census but not in the EICV7 sample.
- **Robustness:** the ranking barely changes without household size (Spearman 0.997) or wealth (0.989), with XGBoost (0.919) or using DHS 2025 only (0.863). Full table in [docs/methods_and_results.md](docs/methods_and_results.md#66-robustness-outputsdistrictrobustnesscsv).

The full ranking of all 30 districts can be downloaded from the website or from `website/data/ranking_default.csv`.

## The budget planner

The planner answers: **"With this budget and this stove, where should stoves go, and what would they achieve?"**

How it works:

1. Stoves bought = budget ÷ cost per stove.
2. Stoves go to districts in priority order, each up to its number of polluting-fuel households.
3. Children reached = stoves × children per household × usage rate.
4. Cases averted = children reached × risk × stove effect, shown as a range from the trial estimate to the observational upper bound.

Two priority rules:

- **Highest baseline risk first** (default): districts with the most cases averted per stove come first.
- **Indoor cooking first**: households that burn polluting fuel inside the house are served first, starting with the districts with the most children exposed indoors (Rubavu first).

Default stove assumptions, all editable on the site and all cited in [data/reference/assumptions.json](data/reference/assumptions.json):

| Stove | Cost per household (RWF) | Sustained use | Effect: trial | Effect: observational upper bound |
|---|---:|---:|---:|---:|
| Improved biomass cookstove, Tier 3 (default) | 36,000 (EAQIP subsidy; 45,000 full price) | 83% | 16% (RESPIRE trial) | 18% |
| LPG gas stove | 150,000 (stove only, retail) | 90% | 4% (HAPIN trial) | 44% |
| Electric pressure cooker | 85,000 (retail) | 41% | 4% | 44% |

The trials measured severe or doctor-diagnosed pneumonia in infants, while the planner applies their effects to cough with fast breathing in all children under five. **Cases averted are therefore an illustration, not a prediction.** Cost, usage and effect are the same in every district, so they change the totals but not the ranking.

## Quality checks and privacy

- `src/17_qa_checks.py` runs **26 automated checks** on every pipeline run, including: all 30 districts present with matching codes and names, Census totals reproduced, values within valid ranges, every interval containing its estimate, the website files agreeing with each other, national figures in the methods document matching the outputs, every stove assumption having a source, valid map geometry, strict JSON, and guards against row-level data in the repository. All pass.
- The website has its own tests (`npm test`) for the planner: the 5 billion RWF example, a zero budget, a huge budget, a budget that does not divide by the stove cost, the indoor-first rule and bad inputs.
- **No individual records leave the analysis machine.** Raw and cleaned microdata are excluded by `.gitignore`. Only district-level and national aggregates are committed, and the notebook shows no table longer than 30 rows.

## Repository layout

```
src/                      analysis pipeline (run in order, or ./run_pipeline.sh)
  00-06                   inventory and verification of each dataset, district boundaries
  10-11                   clean, harmonised child tables (DHS, EICV7)
  12                      weighted descriptive rates
  13                      model training and validation (logistic and XGBoost, both outcomes)
  14                      district index with bootstrap uncertainty
  15                      robustness of the ranking
  16                      export of website data
  17                      automated QA checks
  common.py, harmonise.py, survey_stats.py, model_spec.py   shared code
notebooks/
  walkthrough.ipynb       guided tour of the results (reads aggregate outputs only)
  build_walkthrough.py    rebuilds the notebook
outputs/                  aggregate tables and figures only
docs/
  methods_and_results.md  full methods, results and limitations
  data_inventory.md       datasets, verified variable names, harmonisation evidence
data/reference/           district lookup, boundaries, stove assumptions with sources
website/                  the website (React + Vite)
  data/                   the five data files exported by the pipeline
  src/                    pages, components and planner logic
  tests/                  planner tests
data/raw/                 survey microdata (not in the repository)
run_pipeline.sh           runs steps 00 to 17
requirements.txt          Python dependencies
requirements.lock         exact pinned versions
```

## Reproduce the analysis

Requirements: Python 3.12, [uv](https://github.com/astral-sh/uv) (or pip) and, on macOS, `libomp` for XGBoost.

```bash
uv venv --python 3.12 .venv
uv pip install --python .venv/bin/python -r requirements.lock
brew install libomp          # macOS only, for XGBoost
```

Then request the survey files from the [NISR microdata portal](https://microdata.statistics.gov.rw/index.php/auth/login) and place them as follows:

| Dataset | Catalog | Files | Folder |
|---|---|---|---|
| EICV7 2023/24 (cross-section) | [catalog/119](https://microdata.statistics.gov.rw/index.php/catalog/119) | `CS_S01_S5_S7_Household.dta`, `CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person.dta`, `CS_EICV7_poverty_file.dta` | `data/raw/eicv7/` |
| Rwanda DHS 2025 | [catalog/126](https://microdata.statistics.gov.rw/index.php/catalog/126) | `RWKR91FL.dta`, `RWHR91FL.dta` | `data/raw/dhs2025/` |
| Rwanda DHS 2019-20 | [catalog/98](https://microdata.statistics.gov.rw/index.php/catalog/98) | `RWKR81FL.DTA`, `RWHR81FL.DTA` | `data/raw/dhs2019/` |
| Census 2022 | [catalog/109](https://microdata.statistics.gov.rw/index.php/catalog/109) | `PHC5_Public_microdata.dta` | `data/raw/census2022/` |

Run everything:

```bash
./run_pipeline.sh                                   # about 5 to 7 minutes; step 04 needs internet
.venv/bin/python notebooks/build_walkthrough.py     # optional: rebuild the results notebook
```

District boundaries are downloaded automatically from the [RBC boundary service](https://gis.rbc.gov.rw/server/rest/services/Full_District_boundary_2022/MapServer). The pipeline writes aggregate results to `outputs/` and the website files to `website/data/`. Random seeds are fixed (2026), so results are reproducible.

## Run and deploy the website

```bash
cd website
npm install
npm run dev        # http://localhost:5173
npm test           # planner tests
npm run build      # static site in website/dist
```

- `website/scripts/prepare-data.mjs` runs before every `dev` and `build`. It checks that district names and codes match between the data and the map, keeps only the fields the site uses, checks the total size stays under 1 MB and writes the result to `website/public/data/` (generated, not committed).
- **Deploy on Vercel:** import the repository, set **Root Directory** to `website` and keep the defaults (build `npm run build`, output `dist`). `website/vercel.json` adds the page rewrites. Netlify works the same way with base directory `website` (`website/netlify.toml`).
- After re-running the pipeline, commit the updated `website/data/` and redeploy.

## Limitations

1. The outcome is a symptom reported by mothers, **not a diagnosis of pneumonia**.
2. Results show **associations, not causes**. After adjustment, the surveys show no significant fuel or cooking-place effect, so stove impact relies on published research, which measured a more specific outcome. Randomised trials, including HAPIN with its Rwandan site, found no significant effect on pneumonia.
3. The model is trained on DHS and applied to EICV7. Wealth is measured differently in the two surveys (assets against consumption), so predicted risks are approximate.
4. Model discrimination is modest (AUC 0.59). District differences in risk mainly reflect province, wealth and the child age mix.
5. District estimates carry sampling uncertainty, so **rankings should be read as tiers**. Seven districts are flagged low confidence.
6. Stove stacking (using old and new stoves together), real-world stove use and outdoor air pollution are not captured.
7. Refugee-camp households (Mahama, Kirehe) are in the Census but probably not in EICV7.
8. Stove costs, usage and effects are assumptions from cited sources, not our estimates.

Full list: [docs/methods_and_results.md, section 8](docs/methods_and_results.md#8-limitations).

## Policy relevance

- **Clean cooking targets.** Rwanda aims to sharply reduce cooking with biomass; the reported 2029 target is to cut it from 79.9% to 42% of households (The New Times, November 2025). The Energy Access and Quality Improvement Project (EAQIP) targets 500,000 households by 2026 with US$17 million in results-based subsidies. This tool shows where those stoves would reach the most young children at highest risk.
- **Child health.** It links clean energy spending to a child health outcome and makes the trade-offs (stove type, cost, usage, priority rule) visible and editable.
- **Evidence-based targeting.** Ranges, tiers and low-confidence flags help decision makers avoid over-reading small differences between districts.

## Sources and acknowledgements

**Data:** National Institute of Statistics of Rwanda (NISR): Integrated Household Living Conditions Survey (EICV7) 2023/24; Rwanda Demographic and Health Survey 2019-20 and 2025 (NISR, Ministry of Health, The DHS Program/ICF); Rwanda Population and Housing Census 2022. Administrative boundaries from NISR and the Rwanda Biomedical Centre. Official DHS indicator values for validation from the DHS Program API.

**Stove evidence:** RESPIRE trial (Smith et al., 2011), HAPIN trial (McCollum et al., 2024), Dherani et al. (2008), Pope et al. (2017), Barstow et al. (2016), SEforALL (2023), the EAQIP operations manual (BRD, 2024) and KT Press (2025). Full citations and links are in [data/reference/assumptions.json](data/reference/assumptions.json).

Photos on the website are credited on the pages where they appear.

## AI tool disclosure

AI tools were used for research, planning, code assistance and drafting support. The team reviewed, tested and is responsible for all analysis, code, results and text in this submission.

## Team

- Eddy
- De Noella
