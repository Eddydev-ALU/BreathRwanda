# Clean Air, Healthy Children

**Where will clean cooking stoves protect the most children in Rwanda?**

NISR 2026 Big Data Hackathon, Track 3 (Open Innovation: Health). Live site: _link to be added_.

97% of Rwanda's 1.73 million children under five live in homes that cook mainly with wood, straw or charcoal, and about 290,000 of them breathe that smoke inside the house. This project combines four NISR datasets to estimate, for each of the 30 districts, how many young children are exposed to cooking smoke and how often they have cough with fast breathing. It ranks districts for clean-stove programmes and lets planners test budgets and stove types in a what-if tool.

## How it works

1. **Train** a survey-weighted risk model on 14,692 children from the Rwanda DHS 2019-20 and 2025 (outcome: cough with short, rapid breathing in the last two weeks).
2. **Apply** it to every child under five in the EICV7 2023/24 household survey.
3. **Scale** to Census 2022 district populations and quantify uncertainty with a 500-round two-stage cluster bootstrap.
4. **Publish** small aggregate files that a static website turns into a map, a ranking and a budget planner.

Full methods, results and limitations: [docs/methods_and_results.md](docs/methods_and_results.md). Dataset verification: [docs/data_inventory.md](docs/data_inventory.md).

## Repository layout

```
src/            analysis pipeline (run in order, or ./run_pipeline.sh)
  00-06         inventory and verification of each dataset, boundaries
  10-11         clean, harmonised child tables (DHS, EICV7)
  12            weighted descriptive rates
  13            model training and validation (logistic vs XGBoost, both outcomes)
  14            district index with bootstrap uncertainty
  15            robustness of the ranking
  16-17         export of website data and automated QA checks
notebooks/      walkthrough.ipynb: results tour (reads aggregate outputs only)
outputs/        aggregate tables and figures only
docs/           documentation
website/        the website (Vite + React; website/data holds the exported JSON/GeoJSON/CSV, see "Website")
data/raw/       survey microdata (NOT in the repository)
```

## Reproduce

```bash
uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python -r requirements.txt
# macOS only, for XGBoost: brew install libomp
# put the survey files in data/raw/ (see below), then:
./run_pipeline.sh
```

## Website

`website/` holds the public website: a static Vite + React + Tailwind CSS app with a Leaflet map. Everything runs in the browser from five small files; there is no server and no database.

| Page | What it shows | Data files |
|---|---|---|
| Home (`/`) | Headline question and four national numbers | `model_summary.json` |
| Map (`/map`) | Choropleth of the 30 districts (risk index, children exposed, children exposed indoors) and a district panel with tier, rank interval, risk interval and "why" factors. `/map?district=Rubavu&measure=indoor` opens a district directly | `districts.json`, `districts.geojson`, `model_summary.json` |
| Ranking (`/ranking`) | Sortable table with tier, rank interval, province filter, search and CSV download | `districts.json` |
| Planner (`/planner`) | Budget and stove-type what-if tool (greedy allocation, guide §7.3 and §8.4), cases averted as a trial-to-observational range, CSV download | `districts.json`, `assumptions.json` |
| Methods (`/methods`) | Sources, method steps, model validation and odds ratios, stove evidence, limitations, AI disclosure | `model_summary.json`, `assumptions.json` |

### Run it locally
```bash
cd website
npm install
npm run dev        # http://localhost:5173
npm test           # planner tests: 5 billion RWF case, budget 0, huge and non-divisible budgets
npm run build      # static site in website/dist
```

### Where the data comes from
`src/16_export_site_data.py` writes `website/data/` (`districts.json`, `districts.geojson`, `assumptions.json`, `model_summary.json`, `ranking_default.csv`) from the aggregate outputs of the pipeline. `website/scripts/prepare-data.mjs` runs before every `dev` and `build`. It checks that the 30 district names and codes match between `districts.json` and the boundaries, turns `NaN` into valid JSON, keeps only the fields the site uses, removes source text that names a diagnosis (the site only uses the term "cough with fast breathing"), checks the total is under 1 MB, and writes the result to `website/public/data/` (generated, not committed). No household or child records are used.

Planner choices worth knowing:
- *Highest baseline risk first* serves districts by cases averted per stove (children per polluting household × risk among exposed children), each up to its number of polluting-fuel households.
- *Indoor cooking first* first serves households that burn polluting fuel inside the house, starting with the districts with the most children exposed indoors (Rubavu first). The remaining polluting-fuel households then follow in the default order, using each district's totals minus its indoor part.
- Rows are rounded before totals are summed, so the big numbers, chart and table always agree.

### Deploy
On Vercel: import the GitHub repository, set **Root Directory** to `website`, and keep the defaults (build `npm run build`, output `dist`; `website/vercel.json` adds the page rewrites). Netlify works the same way with base directory `website` (`website/netlify.toml`).

### Data availability
The survey microdata used in this project cannot be redistributed. To reproduce the analysis, register at the [NISR microdata portal](https://microdata.statistics.gov.rw/index.php/auth/login) and request:

| Dataset | Catalog | Files | Put in |
|---|---|---|---|
| EICV7 2023/24 (cross-section) | [catalog/119](https://microdata.statistics.gov.rw/index.php/catalog/119) | `CS_S01_S5_S7_Household.dta`, `CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person.dta`, `CS_EICV7_poverty_file.dta` | `data/raw/eicv7/` |
| Rwanda DHS 2025 | [catalog/126](https://microdata.statistics.gov.rw/index.php/catalog/126) | `RWKR91FL.dta`, `RWHR91FL.dta` | `data/raw/dhs2025/` |
| Rwanda DHS 2019-20 | [catalog/98](https://microdata.statistics.gov.rw/index.php/catalog/98) | `RWKR81FL.DTA`, `RWHR81FL.DTA` | `data/raw/dhs2019/` |
| Population and Housing Census 2022 | [catalog/109](https://microdata.statistics.gov.rw/index.php/catalog/109) | `PHC5_Public_microdata.dta` | `data/raw/census2022/` |

District boundaries are downloaded automatically from the [RBC boundary service](https://gis.rbc.gov.rw/server/rest/services/Full_District_boundary_2022/MapServer). This repository contains code and aggregated results only.

## Limitations (short)
The outcome is a symptom reported by mothers, not a diagnosis of pneumonia. Results are associations, not proof of cause. In the survey data, cooking fuel shows no significant effect after adjusting for wealth, province and age, so stove impact in the planner uses published research and is an editable assumption. District numbers are approximate; read rankings as tiers. Details: [docs/methods_and_results.md §8](docs/methods_and_results.md#8-limitations).

## Sources and acknowledgements
Data: National Institute of Statistics of Rwanda (NISR), Integrated Household Living Conditions Survey (EICV7) 2023/24; Rwanda Demographic and Health Survey 2019-20 and 2025 (NISR, Ministry of Health, The DHS Program/ICF); Rwanda Population and Housing Census 2022; administrative boundaries from NISR / Rwanda Biomedical Centre. Official DHS indicator values for validation: DHS Program API.

## AI tool disclosure
AI tools were used for research, planning, code assistance and drafting support. The team reviewed, tested and is responsible for all analysis, code, results and text in this submission.

## Team
Team: Eddy, De Noella
