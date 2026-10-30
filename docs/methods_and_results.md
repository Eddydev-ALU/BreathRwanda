# Methods and results

**Project:** Clean Air, Healthy Children (NISR 2026 Big Data Hackathon, Track 3)
**Status:** analysis complete, 27 October 2026; revised the same day after an internal audit (official DHS ARI definition, Census-based exposure, corrected stove assumptions). Rebuild everything with `./run_pipeline.sh`.
**Companion document:** `docs/data_inventory.md` lists the datasets, verified variable names and harmonisation evidence.

---

## 1. Summary

- **The problem.** Polluting cooking fuel is close to universal in Rwanda. **1.68 million of the 1.73 million children under five (96.9%, Census 2022)** live in homes that cook mainly with wood, straw or charcoal. About **290,000** of them live where this fuel is burned **inside the house**.
- **The data.** We trained a survey-weighted model on **14,692 children** from the Rwanda DHS 2019-20 and 2025. It predicts *cough with short, rapid breathing in the last two weeks*. We applied it to every child under five in **EICV7 2023/24** and scaled the results to **Census 2022** district counts. That is about **149,000 children with these symptoms in any two-week period** nationally.
- **The main finding.** Without adjustment, symptoms are more common in homes using wood or straw (8.6%) than charcoal (6.2%) or clean fuel (5.3%), and more common where polluting fuel is burned indoors (9.2% vs 7.8%). **After adjusting** for wealth, province, child age and household size, cooking fuel and cooking place have **no statistically significant association** in this survey data. This is reported openly. The surveys cannot isolate the effect of fuel, because clean-fuel households are few (3%) and mostly urban and rich. The planner therefore takes the **effect of a cleaner stove from published research**, and uses our model for **where children are and how much baseline risk they carry**.
- **The ranking.** Priority districts: **Nyaruguru and Gisagara** come first, with stable ranks (90% interval 1–3 and 1–5). Nyagatare, Nyanza, Bugesera, Kamonyi, Rwamagana, Nyamagabe, Rubavu and Rusizi make up the rest of the "High" tier. Kigali's three districts are consistently last.

## 2. Data preparation

| Step | DHS 2019-20 | DHS 2025 | EICV7 |
|---|---:|---:|---:|
| Starting records | 8,092 children | 7,214 children | 15,054 households / 62,110 persons |
| Alive and under 5 | 7,796 | 7,000 | 7,671 children aged 0–4 |
| Matched to household file (`v001,v002 = hv001,hv002`) | 7,796 | 7,000 | n/a (`hhid`) |
| Cough question answered (drop "don't know") | 7,758 | 6,944 | n/a |
| Fuel in harmonised set (drop kerosene/other/no cooking) | 7,758 | 6,934 | 7,667 |
| Cooking place in/separate/outdoors | 7,758 | 6,934 | 7,667 |
| **Analysis sample** | **7,758** | **6,934** | **7,667** |

Logs: `outputs/cleaning_log_dhs.csv`, `outputs/cleaning_log_eicv7.csv`. The harmonised categories (code lists in `src/harmonise.py`) are:

| Predictor | Categories (reference first) |
|---|---|
| Cooking fuel | clean (LPG, electricity, biogas, solar, ethanol); charcoal; wood/straw/other biomass. Wood and straw are merged because the surveys split them inconsistently. |
| Where food is cooked | outdoors (incl. EICV7 veranda); separate building; in the house |
| Wealth | quintile 5 (richest) … 1 (poorest). DHS uses an asset index, EICV7 uses consumption; treated as approximately comparable. |
| Residence | urban; rural |
| Child age | 2–4 years; 1 year; under 1 |
| Household size | 4–5; 1–3; 6–7; 8+ |
| Province | Kigali; Southern; Western; Northern; Eastern |
| Child sex | boy; girl |
| Survey round | 2019-20; 2025 (set to 2025 when predicting for EICV7) |

Weights: DHS `v005/1,000,000`; EICV7 household `weight` (identical in the household and poverty files). The design uses DHS clusters `v001` with strata `v022`, and EICV7 `clust` with `strata_id`.

## 3. Outcomes

| Outcome | Definition | Role | Events (pooled) | Weighted prevalence |
|---|---|---|---:|---:|
| **Cough with fast breathing** | cough in last 2 weeks (`h31` ∈ 1,2) AND short, rapid breaths (`h31b` = 1) | **Main** | 1,178 | 7.97% |
| ARI symptoms (official DHS) | short, rapid breaths (`h31b` = 1) with a chest problem (`h31c` ∈ 1 chest only, 3 both); **cough not required** (DHS-7/8 definition) | Sensitivity | 249 | 1.76% |

Our ARI rates reproduce the published DHS figures exactly: 1.79% in 2025 (FR401 Table 10.6: 1.8%, weighted 126 cases) and 1.70% in 2019-20 (FR370 Table 10.5: 1.7%, 137 cases), on all living children under 5. The pooled 1.76% above is on the analysis sample, which excludes the 94 children whose cough answer was "don't know".

**Why two outcomes.** The DHS ARI indicator is the standard, but with ~120–130 cases per survey it cannot support a model (see §5). The broader outcome has 5× more events. It also includes children whose fast breathing was linked to a blocked nose, so the website calls it **"cough with fast breathing"**, never pneumonia.

## 4. Descriptive results (weighted, pooled DHS, 95% CI)

Chart: `outputs/figures/rates_cough_fast.png`. Full tables: `outputs/descriptives/`.

| Group | Cough with fast breathing | ARI (official DHS) |
|---|---|---|
| All children | 8.0% (7.4–8.5) | 1.8% (1.5–2.0) |
| Wood, straw, biomass | 8.6% (8.0–9.2) | 2.0% (1.7–2.3) |
| Charcoal | 6.2% (5.1–7.3) | 1.1% (0.6–1.5) |
| Clean fuel | 5.3% (3.1–7.5) | 1.0% (0.0–2.0) |
| Polluting fuel, cooked in the house | 9.2% (7.9–10.4) | 2.0% (1.4–2.5) |
| Polluting fuel, cooked outside the house | 7.8% (7.2–8.4) | 1.8% (1.5–2.0) |
| Poorest / richest quintile | 9.6% / 5.5% | 2.1% / 1.2% |
| Rural / urban | 8.5% / 6.3% | 1.9% / 1.2% |
| Kigali / Southern | 4.2% / 10.0% | 1.0% / 1.8% |
| Under 1 / 1 year / 2–4 years | 9.4% / 10.1% / 6.8% | 2.1% / 2.0% / 1.6% |

## 5. Model

### 5.1 Specification
Survey-weighted logistic regression (statsmodels GLM, binomial, `var_weights` = survey weight) with all predictors in §2. Standard errors are **cluster-robust** (clusters = DHS PSUs). statsmodels warns that cluster SEs are "not fully supported" with variance weights, so we verified them against a hand-computed sandwich estimator; they agree to three decimals.

### 5.2 Odds ratios, main outcome (`outputs/figures/model_odds_ratios_cough_fast.png`)

| Factor (vs reference) | OR | 95% CI |
|---|---:|---|
| Wood/straw/biomass (vs clean fuel) | 1.08 | 0.63–1.85 |
| Charcoal (vs clean fuel) | 1.02 | 0.64–1.62 |
| Cooking in the house (vs outdoors) | 1.02 | 0.83–1.27 |
| Separate building (vs outdoors) | 0.88 | 0.74–1.05 |
| Poorest quintile (vs richest) | 1.36 | 1.00–1.84 |
| Poorer quintile (vs richest) | 1.39 | 1.03–1.88 |
| Under 1 year (vs 2–4) | 1.40 | 1.20–1.63 |
| 1 year (vs 2–4) | 1.51 | 1.30–1.76 |
| Southern province (vs Kigali) | 2.26 | 1.52–3.35 |
| Eastern province (vs Kigali) | 2.10 | 1.41–3.12 |
| Western province (vs Kigali) | 1.69 | 1.14–2.51 |
| Northern province (vs Kigali) | 1.62 | 1.07–2.44 |
| DHS 2025 (vs 2019-20) | 1.17 | 1.00–1.39 |

Rural residence, household size and child sex were not significant. **Sign check:** polluting fuel and indoor cooking do not appear protective (all ORs ≥ 1.0 except "separate building"), but their confidence intervals are wide and include 1. The ARI model gives the same picture (biomass OR 1.41, 0.47–4.26).

### 5.3 Validation (5-fold cross-validation grouped by cluster, repeated 5×; weighted metrics)

| Outcome | Model | AUC | Brier | Calibration slope |
|---|---|---:|---:|---:|
| Cough + fast breathing | **Logistic (chosen)** | **0.588** | **0.0729** | 0.79 |
| | XGBoost (depth 3, 300 trees) | 0.584 | 0.0732 | 0.65 |
| | Province only | 0.556 | 0.0731 | 0.88 |
| | No skill (prevalence) | 0.500 | 0.0734 | – |
| ARI (official DHS) | Logistic | 0.563 | 0.0173 | 0.44 |
| | XGBoost | 0.563 | 0.0173 | 0.41 |

- The **logistic model is chosen**: XGBoost is not better on AUC or Brier and is less well calibrated. This follows the guide's rule of preferring the simpler model.
- Discrimination is **modest**, as expected. Two-week symptoms depend on many things a household survey does not measure (infections in the community, vaccination, nutrition, season). The model is **well calibrated across deciles** (predicted 3.7% → 13.4%, observed 3.7% → 12.3%; `outputs/figures/model_calibration_cough_fast.png`), so it ranks groups sensibly. That is what the district index needs.
- The **ARI model has little skill** (AUC 0.56, slope 0.44). It is kept only as a sensitivity analysis.

### 5.4 Explanation
Mean |SHAP| (log-odds), main outcome. For logistic regression this is the exact linear SHAP value.

| Factor | Logistic | XGBoost |
|---|---:|---:|
| Province | 0.20 | 0.16 |
| Child age | 0.18 | 0.18 |
| Household wealth | 0.10 | 0.06 |
| Survey round | 0.08 | 0.09 |
| Where food is cooked | 0.07 | 0.07 |
| Household size | 0.05 | 0.06 |
| Cooking fuel | 0.02 | 0.08 |

The website's "Why is this district high risk?" panel uses each district's average linear SHAP contribution per factor relative to the national average, converted to percentage points (`whyFactors` in `website/data/districts.json`).

## 6. District index

### 6.1 Applying the model to EICV7
- Predictor distributions match well (`outputs/harmonisation_comparison.csv`). Cooking place, for example, splits 19/60/21% in EICV7 and 17/60/23% in DHS 2025.
- Each of the 7,667 EICV7 children gets a predicted probability (survey round set to 2025).
- **Sanity check passed:** the national average predicted risk is **8.59%**, against **8.66%** observed in DHS 2025.

### 6.2 Quantities (per district; formulas follow guide §7)

| Quantity | Definition |
|---|---|
| C_d | children aged 0–4, Census 2022 (weighted) |
| Exposure share E_d | **Census 2022**: weighted share of children aged 0–4 whose household's main cooking fuel is polluting, with design-based 90% intervals (households as clusters). The Census samples 4,000–11,700 children per district. EICV7 (~200–300) hits 100% in 11 districts, so it can give no interval there, and it probably misses refugee camps. The EICV7 share is kept as `eicv7ExposureShare` for comparison. |
| Indoor-smoke share | EICV7: polluting fuel **and** cooking inside the house (the Census does not ask where food is cooked) |
| Risk R_d | mean predicted probability of cough with fast breathing |
| Children with symptoms | C_d × R_d (expected number in a typical two-week period) |
| Risk index | R_d rescaled 0–100 across districts (min-max) |
| H_d | Census households whose main cooking fuel is polluting |
| Children per polluting household | EICV7: weighted children <5 in polluting households / weighted polluting households |
| Priority score | children per polluting household × mean risk among exposed children. Multiplying by stove effectiveness e and usage u gives cases averted per stove (guide §7.3). |
| Model fuel effect | model-based drop in risk if a child's fuel switched to clean (shown for transparency, not used for ranking) |

### 6.3 Uncertainty: two-stage cluster bootstrap (500 rounds)
Each round (1) resamples DHS clusters within strata and refits the model, then (2) resamples EICV7 clusters within strata and recomputes every district quantity and the ranking. Intervals are the 5th–95th percentiles. Census counts are treated as fixed, since it is a 10% sample with 30–90k persons per district; Census exposure shares carry their own design-based intervals. A district's rank is marked **uncertain** when its 90% rank interval spans more than 10 places. Tiers: ranks 1–10 High, 11–20 Medium, 21–30 Lower.

**Low-confidence flag** (`lowConfidence`, with reason): a district is flagged when its indoor-cooking estimate rests on fewer than 30 sampled households, or when EICV7 and Census exposure differ by more than 5 points. Flagged: Nyagatare, Bugesera, Ngoma, Gatsibo, Kayonza, Gicumbi (few indoor-cooking households) and Kirehe (both reasons). Census Mahama sector, almost certainly the refugee camp, has 12,805 children under 5, 21% of Kirehe's total, and 62% of its households cook with gas; EICV7 probably does not sample it.

### 6.4 National totals
| | |
|---|---:|
| Children under 5 (Census 2022) | 1,731,594 |
| Living in homes with polluting primary fuel (Census) | 1,677,923 (96.9%) |
| ... where it is burned inside the house (EICV7 share × Census) | 290,345 (16.8%) |
| Expected children with cough + fast breathing (two-week window) | 148,977 |
| Households cooking with polluting fuel (Census) | 3,113,811 |
| Model-based effect of switching fuel to clean (national, among exposed) | −0.5 percentage points (interval includes 0) |

### 6.5 Top 10 priority districts

| Rank (90% interval) | District | Province | Children <5 | In polluting-fuel homes | Fuel burned in house | Risk % (90% CI) | Children per polluting household |
|---|---|---|---:|---:|---:|---|---:|
| 1 (1–3) | Nyaruguru | Southern | 42,169 | 42,042 | 19,088 | 11.0 (9.7–12.5) | 0.62 |
| 2 (1–5) | Gisagara | Southern | 54,355 | 53,148 | 23,522 | 11.4 (10.1–12.7) | 0.57 |
| 3 (2–13) | Nyagatare | Eastern | 94,260 | 93,120 | 895 | 9.9 (8.7–11.1) | 0.57 |
| 4 (3–12) | Nyanza | Southern | 46,837 | 46,589 | 9,873 | 10.6 (9.3–12.0) | 0.54 |
| 5 (2–13) | Bugesera | Eastern | 81,757 | 79,411 | 5,428 | 9.5 (8.4–10.7) | 0.59 |
| 6 (3–15) | Kamonyi | Southern | 56,348 | 55,221 | 9,704 | 10.7 (9.5–12.0) | 0.51 |
| 7 (3–16) | Rwamagana | Eastern | 63,927 | 62,182 | 4,900 | 9.3 (8.3–10.6) | 0.58 |
| 8 (4–15) | Nyamagabe | Southern | 43,729 | 43,624 | 13,053 | 11.0 (9.8–12.3) | 0.49 |
| 9 (3–16) | Rubavu | Western | 78,964 | 76,911 | 38,632 | 8.6 (7.4–9.8) | 0.61 |
| 10 (3–17) | Rusizi | Western | 69,849 | 69,458 | 8,522 | 8.0 (7.0–9.0) | 0.66 |

Full table: `outputs/district/district_index.csv`; download version: `website/data/ranking_default.csv`. **Rubavu** has by far the most children exposed to smoke inside the house (38,632), so it moves to the top under the planner's "indoor cooking first" option.

### 6.6 Robustness (`outputs/district/robustness.csv`)

| Variant | Spearman vs main | Top-10 overlap |
|---|---:|---:|
| Without household size | 0.997 | 10 |
| Without wealth | 0.989 | 8 |
| XGBoost instead of logistic | 0.919 | 8 |
| DHS 2025 only | 0.863 | 8 |
| Without province | 0.779 | 7 |
| ARI outcome (official DHS) | 0.629 | 5 |

The ranking is stable to model form, survey round and most predictors. It changes under the ARI outcome, but that model has little predictive skill (AUC 0.56), so this variant is reported and not used. Province carries much of the signal: Southern and Eastern provinces have higher adjusted risk than Kigali.

## 7. Planner assumptions (stove cost, effectiveness, usage)
All values, with full citations and URLs, are in `data/reference/assumptions.json` (copied to `website/data/assumptions.json`); every citation was checked against its source on 27 Oct 2026. **These are editable assumptions from published research and programme documents, not results from our data.** Our survey data cannot estimate the stove effect (§5.2). Trials measured severe or doctor-diagnosed pneumonia in infants; we apply their effects to cough with fast breathing in children under 5, so **cases averted are an illustrative range, not a prediction**.

| Stove | Cost per household (RWF) | Sustained use | Effect: trial | Effect: observational upper bound |
|---|---:|---:|---:|---:|
| Improved biomass cookstove, Tier 3 (default) | 36,000: EAQIP subsidy, the programme's share (45,000 full price) | 0.83: observed use at ~1 year, Rwanda (25 of 30 households; Barstow 2016) | 0.16 (RESPIRE, chimney stove, physician-diagnosed pneumonia, RR 0.84, n.s.) | 0.18 (derived: 0.438 × 41% kitchen PM2.5 cut for advanced-combustion stoves, Pope 2017) |
| LPG gas stove | 150,000: retail price of the stove alone (KT Press 2025); refills Rwf 23,000–28,000 extra | 0.90: assumption based on HAPIN trial conditions (free fuel); real-world likely lower | 0.04 (HAPIN, severe infant pneumonia, IRR 0.96, n.s.) | 0.44 (derived: 1 − 1/1.78, Dherani 2008 odds ratio) |
| Electric pressure cooker | 85,000: retail list price (SEforALL 2023, Kigali) | 0.41: share of **cooking events**, ~3-month pilot (same) | 0.04 (as LPG) | 0.44 (as LPG) |

Costs are not on the same basis: the improved cookstove uses the subsidy amount, LPG and the cooker use retail prices. The observational values are upper bounds. They assume the association is fully causal and the exposure fully removed. At ~8% prevalence the 1.78 odds ratio slightly overstates the risk ratio (≈1.7), so 0.44 is generous.

Cases averted per stove in district d = children per polluting household × risk among exposed children × effect × usage. Cost, usage and effect are the same in every district, so they scale the totals but **do not change the ranking**.

**Example** (walkthrough notebook §6): 5 billion RWF buys 138,888 Tier 3 cookstoves. These go to Nyaruguru, then Gisagara. They reach about 68,800 children under 5 and avert about 1,230 (trial) to 1,380 (observational) cases of cough with fast breathing in any two-week window. This is an illustrative range.

Programme context: EAQIP targets 500,000 households by 2026 with US$17M in results-based subsidies. For pay-as-you-go sales the subsidy is paid in instalments tied to verified use: 50% at sale, 40% after a 3-month check, 10% after a year (BRD Operations Manual Ver 05, 2024). The reported 2029 target is to cut biomass cooking from 79.9% to 42% of households (New Times, Nov 2025; the NST2 text itself was not located).

## 8. Limitations
1. The symptom is reported by mothers. It is a symptom, **not a diagnosis of pneumonia**.
2. The results show **associations, not causes**. After adjustment, the surveys show no significant fuel or cooking-place effect, because clean fuel is rare (3%) and concentrated among urban, richer households. Stove impact relies on external research, which measured a different and more specific outcome (severe or doctor-diagnosed pneumonia in infants). Randomised trials, including HAPIN with its Rwandan site, found no significant effect.
3. The model is trained on DHS and applied to EICV7. Wealth is measured differently in the two (assets vs consumption), so predicted risks are approximate.
4. Model discrimination is modest (AUC 0.59). District differences in predicted risk mainly reflect province, wealth and the child age mix.
5. District estimates carry sampling uncertainty (EICV7 has ~485 households and 54–72 clusters per district). **Read rankings as tiers.** Indoor-cooking estimates for six Eastern and Northern districts rest on fewer than 30 households; these districts are flagged `lowConfidence`.
6. Stove stacking, actual stove use and outdoor air pollution are not captured.
7. Refugee-camp households (Mahama, Kirehe) appear in the Census but probably not in EICV7. Exposure now comes from the Census, which includes them. Indoor cooking and risk for Kirehe still come from EICV7, so Kirehe is flagged low-confidence.
8. Stove costs, usage and effects are assumptions from the cited sources (§7), not our estimates.

## 9. Reproducibility
`./run_pipeline.sh` runs steps 00–17 in about 5–7 minutes. Step 04 needs internet access to the RBC boundary service. Raw data go in `data/raw/` (see `data_inventory.md` for the files). Exact package versions are pinned in `requirements.lock`; install with `uv pip install -r requirements.lock`. Step 17 runs 25 automated checks:
- site file consistency;
- Census totals;
- value ranges and intervals;
- national figures quoted in this document match the outputs;
- every assumption has a source;
- geometry validity;
- guards against row-level data.

All pass. `notebooks/build_walkthrough.py` rebuilds the walkthrough notebook from the aggregate outputs.
