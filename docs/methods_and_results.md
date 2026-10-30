# Methods and results

**Project:** Clean Air, Healthy Children (NISR 2026 Big Data Hackathon, Track 3)
**Status:** analysis complete, 27 October 2026. Rebuild everything with `./run_pipeline.sh`.
**Companion document:** `docs/data_inventory.md` lists the datasets, verified variable names and harmonisation evidence.

---

## 1. Summary

- **The problem.** Polluting cooking fuel is close to universal in Rwanda. **1.68 million of the 1.73 million children under five (97%)** live in homes that cook mainly with wood, straw or charcoal. About **290,000** of them live where this fuel is burned **inside the house**.
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
| ARI symptoms (strict DHS) | as above AND chest problem (`h31c` ∈ 1 chest only, 3 both) | Sensitivity | 219 | 1.54% |

**Why two outcomes.** The strict DHS ARI indicator is the standard, but with ~100 cases per survey it cannot support a model (see §5). The broader outcome has 5× more events. It also includes children whose fast breathing was linked to a blocked nose, so the website calls it **"cough with fast breathing"**, never pneumonia.

## 4. Descriptive results (weighted, pooled DHS, 95% CI)

Chart: `outputs/figures/rates_cough_fast.png`. Full tables: `outputs/descriptives/`.

| Group | Cough with fast breathing | Strict ARI |
|---|---|---|
| All children | 8.0% (7.4–8.5) | 1.5% (1.3–1.8) |
| Wood, straw, biomass | 8.6% (8.0–9.2) | 1.8% (1.5–2.0) |
| Charcoal | 6.2% (5.1–7.3) | 0.9% (0.5–1.3) |
| Clean fuel | 5.3% (3.1–7.5) | 0.9% (0.0–1.9) |
| Polluting fuel, cooked in the house | 9.2% (7.9–10.4) | 1.8% (1.3–2.3) |
| Polluting fuel, cooked outside the house | 7.8% (7.2–8.4) | 1.5% (1.3–1.8) |
| Poorest / richest quintile | 9.6% / 5.5% | 1.8% / 1.0% |
| Rural / urban | 8.5% / 6.3% | 1.7% / 1.0% |
| Kigali / Southern | 4.2% / 10.0% | 0.8% / 1.6% |
| Under 1 / 1 year / 2–4 years | 9.4% / 10.1% / 6.8% | 1.8% / 1.8% / 1.4% |

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

Rural residence, household size and child sex were not significant. **Sign check:** polluting fuel and indoor cooking do not appear protective (all ORs ≥ 1.0 except "separate building"), but their confidence intervals are wide and include 1. The strict ARI model gives the same picture (biomass OR 1.33, 0.42–4.25).

### 5.3 Validation (5-fold cross-validation grouped by cluster, repeated 5×; weighted metrics)

| Outcome | Model | AUC | Brier | Calibration slope |
|---|---|---:|---:|---:|
| Cough + fast breathing | **Logistic (chosen)** | **0.588** | **0.0729** | 0.79 |
| | XGBoost (depth 3, 300 trees) | 0.584 | 0.0732 | 0.65 |
| | Province only | 0.556 | 0.0731 | 0.88 |
| | No skill (prevalence) | 0.500 | 0.0734 | – |
| Strict ARI | Logistic | 0.543 | 0.0152 | 0.29 |
| | XGBoost | 0.542 | 0.0152 | 0.31 |

- The **logistic model is chosen**: XGBoost is not better on AUC or Brier and is less well calibrated. This follows the guide's rule of preferring the simpler model.
- Discrimination is **modest**, as expected. Two-week symptoms depend on many things a household survey does not measure (infections in the community, vaccination, nutrition, season). The model is **well calibrated across deciles** (predicted 3.7% → 13.4%, observed 3.7% → 12.3%; `outputs/figures/model_calibration_cough_fast.png`), so it ranks groups sensibly. That is what the district index needs.
- The **strict ARI model has no useful skill** (AUC 0.54, slope 0.29). It is kept only as a sensitivity analysis.

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
| Exposure share E_d | EICV7 child-weighted share in households whose primary fuel is polluting |
| Indoor-smoke share | ... polluting fuel **and** cooking inside the house |
| Risk R_d | mean predicted probability of cough with fast breathing |
| Children with symptoms | C_d × R_d (expected number in a typical two-week period) |
| Risk index | R_d rescaled 0–100 across districts (min-max) |
| H_d | EICV7 share of households with polluting fuel × Census households |
| Children per polluting household | EICV7: weighted children <5 in polluting households / weighted polluting households |
| Priority score | children per polluting household × mean risk among exposed children. Multiplying by stove effectiveness e and usage u gives cases averted per stove (guide §7.3). |
| Model fuel effect | model-based drop in risk if a child's fuel switched to clean (shown for transparency, not used for ranking) |

### 6.3 Uncertainty: two-stage cluster bootstrap (500 rounds)
Each round (1) resamples DHS clusters within strata and refits the model, then (2) resamples EICV7 clusters within strata and recomputes every district quantity and the ranking. Intervals are the 5th–95th percentiles. Census counts are treated as fixed, since it is a 10% sample with 30–90k persons per district. A district's rank is marked **uncertain** when its 90% rank interval spans more than 10 places. Tiers: ranks 1–10 High, 11–20 Medium, 21–30 Lower.

### 6.4 National totals
| | |
|---|---:|
| Children under 5 (Census 2022) | 1,731,594 |
| Living in homes with polluting primary fuel | 1,682,492 (97.2%) |
| ... where it is burned inside the house | 290,346 (16.8%) |
| Expected children with cough + fast breathing (two-week window) | 148,977 |
| Households cooking with polluting fuel | 3,133,313 |
| Model-based effect of switching fuel to clean (national, among exposed) | −0.5 percentage points (interval includes 0) |

### 6.5 Top 10 priority districts

| Rank (90% interval) | District | Province | Children <5 | In polluting-fuel homes | Fuel burned in house | Risk % (90% CI) | Children per polluting household |
|---|---|---|---:|---:|---:|---|---:|
| 1 (1–3) | Nyaruguru | Southern | 42,169 | 42,169 | 19,088 | 11.0 (9.7–12.5) | 0.62 |
| 2 (1–5) | Gisagara | Southern | 54,355 | 54,355 | 23,522 | 11.4 (10.1–12.7) | 0.57 |
| 3 (2–13) | Nyagatare | Eastern | 94,260 | 94,260 | 895 | 9.9 (8.7–11.1) | 0.57 |
| 4 (3–12) | Nyanza | Southern | 46,837 | 46,837 | 9,873 | 10.6 (9.3–12.0) | 0.54 |
| 5 (2–13) | Bugesera | Eastern | 81,757 | 78,389 | 5,428 | 9.5 (8.4–10.7) | 0.59 |
| 6 (3–15) | Kamonyi | Southern | 56,348 | 56,043 | 9,704 | 10.7 (9.5–12.0) | 0.51 |
| 7 (3–16) | Rwamagana | Eastern | 63,927 | 60,973 | 4,900 | 9.3 (8.3–10.6) | 0.58 |
| 8 (4–15) | Nyamagabe | Southern | 43,729 | 43,729 | 13,053 | 11.0 (9.8–12.3) | 0.49 |
| 9 (3–16) | Rubavu | Western | 78,964 | 77,093 | 38,632 | 8.6 (7.4–9.8) | 0.61 |
| 10 (3–17) | Rusizi | Western | 69,849 | 69,386 | 8,522 | 8.0 (7.0–9.0) | 0.66 |

Full table: `outputs/district/district_index.csv`; download version: `website/data/ranking_default.csv`. **Rubavu** has by far the most children exposed to smoke inside the house (38,632), so it moves to the top under the planner's "indoor cooking first" option.

### 6.6 Robustness (`outputs/district/robustness.csv`)

| Variant | Spearman vs main | Top-10 overlap |
|---|---:|---:|
| Without household size | 0.997 | 10 |
| Without wealth | 0.989 | 8 |
| XGBoost instead of logistic | 0.919 | 8 |
| DHS 2025 only | 0.863 | 8 |
| Without province | 0.779 | 7 |
| Strict ARI outcome | 0.629 | 5 |

The ranking is stable to model form, survey round and most predictors. It changes under the strict ARI outcome, but that model has no predictive skill (AUC 0.54), so this variant is reported and not used. Province carries much of the signal: Southern and Eastern provinces have higher adjusted risk than Kigali.

## 7. Planner assumptions (stove cost, effectiveness, usage)
All values, with full citations and URLs, are in `data/reference/assumptions.json` (copied to `website/data/assumptions.json`). All are editable on the website. Our survey data cannot estimate the stove effect (§5.2), so effectiveness comes from published research. Because trials and observational studies disagree, **cases averted are shown as a range**.

| Stove | Cost to programme (RWF) | Sustained use | Effect: trial | Effect: observational upper bound |
|---|---:|---:|---:|---:|
| Improved biomass cookstove, Tier 3 (default) | 36,000 (EAQIP subsidy example; 45,000 full price) | 0.83 (Barstow 2016, Rwanda) | 0.16 (RESPIRE, RR 0.84, n.s.) | 0.21 (derived: 0.44 × ~48% exposure cut, Pope 2017) |
| LPG kit | 150,000 (KT Press 2025; refills extra) | 0.90 (HAPIN trial conditions; real-world likely lower) | 0.04 (HAPIN, IRR 0.96, n.s.) | 0.44 (derived: 1 − 1/1.78, Dherani 2008) |
| Electric pressure cooker | 85,000 (SEforALL 2023, Kigali) | 0.41 of cooking events (same) | 0.04 (as LPG) | 0.44 (as LPG) |

Cases averted per stove in district d = children per polluting household × risk among exposed children × effect × usage. Cost, usage and effect are the same in every district, so they scale the totals but **do not change the ranking**.

**Example** (walkthrough notebook §6): 5 billion RWF buys 138,888 Tier 3 cookstoves. These go to Nyaruguru, then Gisagara. They reach about 68,800 children under 5 and avert about 1,230 (trial) to 1,610 (observational) cases of cough with fast breathing in any two-week window.

Programme context: EAQIP targets 500,000 households with US$17M in subsidies, paid in instalments tied to verified use (BRD Operations Manual Ver 05, 2024). The reported 2029 target is to cut biomass cooking from 79.9% to 42% of households (New Times, Nov 2025; the NST2 text itself was not located).

## 8. Limitations
1. The symptom is reported by mothers. It is a symptom, **not a diagnosis of pneumonia**.
2. The results show **associations, not causes**. After adjustment, the surveys show no significant fuel or cooking-place effect, because clean fuel is rare (3%) and concentrated among urban, richer households. Stove impact relies on external research.
3. The model is trained on DHS and applied to EICV7. Wealth is measured differently in the two (assets vs consumption), so predicted risks are approximate.
4. Model discrimination is modest (AUC 0.59). District differences in predicted risk mainly reflect province, wealth and the child age mix.
5. District estimates carry sampling uncertainty (EICV7 has ~485 households per district). **Read rankings as tiers.** Indoor-cooking estimates for Eastern districts rest on very few households (`sampleIndoorHouseholds` < 30 flagged).
6. Stove stacking, actual stove use and outdoor air pollution are not captured.
7. Refugee-camp households (for example Mahama, Kirehe) appear in the Census but probably not in the EICV7 sample frame.
8. The strict DHS ARI rates we compute (1.55% / 1.51%) are ~0.2 points below the official DHS figures (1.8% / 1.7%) despite identical denominators. The cause is unresolved (see `data_inventory.md` Q1).

## 9. Reproducibility
`./run_pipeline.sh` runs steps 00–17. Raw data go in `data/raw/` (see `data_inventory.md` for the files). Step 17 runs 16 automated checks on the exported website data; all pass.
