# Data inventory and verification report

**Project:** Clean Air, Healthy Children (NISR 2026 Big Data Hackathon, Track 3)
**Prepared:** 27 October 2026 (data exploration only; no modelling yet)
**Reproduce:** run the scripts in `src/` in order (`00_` to `06_`) with `.venv/bin/python`. All numbers below come from those scripts; outputs are aggregate-only CSVs in `outputs/`.

---

## 0. Summary

| Item | Status | Key fact |
|---|---|---|
| EICV7 2023/24 | ✅ Ready | 15,054 households, 62,110 persons, 7,671 children <5. Fuel counts match the guide exactly (9,601 / 2,554 / 758). |
| DHS 2025 (RW 91) | ✅ Ready, ⚠️ small outcome | 7,000 living children <5; official ARI definition = **119 cases (1.79% weighted)**, matching the published 1.8% exactly. |
| DHS 2019-20 (RW 81) | ✅ Ready, ⚠️ small outcome | 7,796 living children <5; official ARI = **130 cases (1.70%)**, matching the published 1.7% exactly. |
| Census 2022 (PHC5 10% sample) | ✅ Ready | Weighted population **13,245,753**; children <5 **1,731,594**. Also has cooking fuel and "energy-saving stove". |
| District boundaries (RBC) | ✅ Ready | 30 districts, EPSG:4326; `district_id` = NISR code, all 30 codes and names match. Simplified file 152 KB. |
| District code system | ✅ Same everywhere | EICV7 `district`, Census `ml02`, DHS `sdistrict`/`shdistrict`, RBC `district_id`. All use codes 11–57. |

**Main issues to decide before modelling (details in §8):**
1. The official DHS ARI outcome has only ~120–130 cases per survey, and at district level 0–12 cases. That is too few for a stable model with several predictors.
2. Polluting fuel is almost universal: 97% of children <5 in EICV7, and 95–100% in every district outside Kigali. On its own it cannot rank districts.
3. In DHS 2025 the descriptive ARI gradient by fuel and cooking place is weak or absent. In 2019-20 it is in the expected direction but small.
4. DHS 2025 and EICV7 split "wood" and "straw/shrubs/grass" very differently, so these must be merged into one category.

---

## 1. Setup

```
data/raw/archives/   original zips (moved here, unmodified; read-only)
data/raw/eicv7/      extracted .dta (read-only)
data/raw/dhs2025/    RWKR91FL, RWHR91FL, RWPR91FL (read-only)
data/raw/dhs2019/    RWKR81FL, RWHR81FL, RWPR81FL (read-only)
data/raw/census2022/ PHC5_Public_microdata.dta (read-only)
data/processed/      (empty; row-level clean tables go here, git-ignored)
data/reference/      district_lookup.csv (+ full-res boundary, git-ignored)
src/                 00_inventory … 06_district_overview, common.py
outputs/             aggregate CSVs only
docs/variables/      variable name + label list for every file (metadata only)
website/data/           districts.geojson (simplified, for the website)
```

- `.gitignore` excludes `data/raw/`, `data/processed/`, every `*.dta/*.DTA/*.sav/*.zip/*.parquet`, `.venv/` and the full-resolution boundary file.
- Environment: Python 3.12 virtualenv in `.venv` (created with `uv`), packages in `requirements.txt` (pandas, numpy, pyreadstat, geopandas, shapely, pyproj, requests, tabulate).
- The DHS 2019-20 Stata files are not UTF-8; `common.py` falls back to latin-1 automatically.
- **Not extracted** (not needed for this project): EICV7 expenditure/transfer/credit modules (including the 1.1 GB food file), and the DHS IR/MR/BR/CR/GR/NR/SR/AR/FW recodes. They remain in the zips in `data/raw/archives/`.

## 2. Inventory

| Key | File | Size (MB) | Rows | Cols | ID variables |
|---|---|---:|---:|---:|---|
| eicv7_household | CS_S01_S5_S7_Household.dta | 3.3 | 15,054 | 112 | hhid, clust, province, district |
| eicv7_person | CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person.dta | 28.7 | 62,110 | 157 | hhid, pid, clust, province, district |
| eicv7_poverty | CS_EICV7_poverty_file.dta | 2.4 | 15,054 | 32 | hhid, clust, province, district |
| eicv7_services | CS_S5F_access_to_services.dta | 17.6 | 225,810 | 22 | hhid, clust (long format; not needed) |
| dhs2025_kr | RWKR91FL.dta | 10.6 | 7,214 | 1,295 | caseid, v001, v002, v003 |
| dhs2025_hr | RWHR91FL.dta | 41.3 | 14,427 | 2,452 | hhid, hv001, hv002 |
| dhs2025_pr | RWPR91FL.dta | 30.6 | 57,046 | 426 | hhid, hv001, hv002, hvidx |
| dhs2019_kr | RWKR81FL.DTA | 11.5 | 8,092 | 1,216 | caseid, v001, v002, v003 |
| dhs2019_hr | RWHR81FL.DTA | 56.6 | 12,949 | 3,485 | hhid, hv001, hv002 |
| dhs2019_pr | RWPR81FL.DTA | 43.8 | 55,920 | 581 | hhid, hv001, hv002, hvidx |
| census2022 | PHC5_Public_microdata.dta | 409.9 | 1,313,015 | 250 | hhid, p01 |

Full variable lists with labels: `docs/variables/<key>.csv`.

---

## 3. EICV7 2023/24 (cross-section)

### 3.1 Files and links
- `hhid` is unique in the household and poverty files (15,054 each) and the same set of households appears in both. The person file has 62,110 rows linked by `hhid` (+ `pid`).
- All persons in the person file are household members (`s1q14` = 1 for every row).
- `weight` is identical in the household and poverty files, and `pop_wt = weight × member` (max diff 0.0002).

### 3.2 Verified variables

| Concept | File | Variable | Label (from file) | Codes / notes |
|---|---|---|---|---|
| Main cooking fuel | Household | `s5cq22a` | "Three main sources of cooking fuel … Most used (Primary)" | 1 Firewood, 2 Charcoal, 3 Gas, 4 Biogas, 5 Solar power, 6 Electricity, 7 Oil/kerosene, 8 Crop waste, 9 Animal dung, 10 Briquette, 11 Peat, 12 Saw dust, 13 Straw/shrub/grass (udushari), 14 Other |
| 2nd / 3rd fuel | Household | `s5cq22b`, `s5cq22c` | second / third most used | same codes (stacking) |
| Primary cook stove | Household | `s5cq21` | "Type of your primary cook stove" | 1 Gas, 2 Electric, 3 Biogas, 4 Solar cooker, 5 Kerosene, 6 Self-built solid fuel, 7 Charcoal/fire stove, 8 Improved cooking stove, 9 Three stone/Traditional, 10 No cooking option at home, 11 Other |
| Place of cooking | Household | `s5cq23` | "Where did you normally cook with the cook stove?" | 1 In dwelling, not in sleeping area; 2 In dwelling, in a sleeping area; 3 In a separate dwelling; 4 In a veranda (roofed, ≥2 open sides); 5 Outdoors; 6 Other |
| Household size | Poverty | `member` | "hhsize" | count |
| Member age | Person | `s1q3y` (years), `s1q3m` (months, only for some) | "Age (Years)" | 998 = Don't know (0 cases) |
| Member sex | Person | `s1q1` | Sex | 1 Male, 2 Female |
| Household weight | Poverty (also Household) | `weight` | "Household Weight" | sum = 3,289,819 households |
| Population weight | Poverty | `pop_wt` | "Population Weight" | sum = 13,549,457 persons |
| Province | all | `province` | Province | 1 Kigali, 2 Southern, 3 Western, 4 Northern, 5 Eastern |
| District | all | `district` | District | 11–57 (30 districts) |
| Urban/rural | Poverty / Household | `ur` | Area of Residence | 1 Urban, 2 Rural (household-file label set also lists 3 Peri-urban, 4 Semi-urban, but **no rows use them**) |
| Consumption quintile | Poverty | `quintile` | "Quintiles of real consumption per ae" | 1 Poor … 5 Upper |
| Poverty status | Poverty | `poverty` | Welfare Categories | 1 Severely poor, 2 Moderately poor, 3 Non poor |
| Poverty (binary) | Poverty | `pov_jan` | Total Poverty Headcount Ratio | 0 Non poor, 100 Poor |
| Cluster | all | `clust` | Clust | 1,674 clusters |
| Strata | Household / Person | `strata_id` | strata_id | 60 strata (**not** in the poverty file) |

Possibly useful extra: the person file has `s3q4` "Suffer from an illness or injury over the last 4 weeks" (1/2) but no respiratory-specific symptom.

### 3.3 Key numbers
- Households 15,054; persons 62,110; **children <5: 7,671 in 6,395 households** (unweighted); weighted children <5 = **1,681,621** (household weight × number of under-5s).

**Main cooking fuel (`s5cq22a`)**

| Fuel | n | % unweighted | % household-weighted | % child-weighted |
|---|---:|---:|---:|---:|
| Firewood | 9,601 | 63.8 | 62.4 | 62.5 |
| Charcoal | 2,554 | 17.0 | 18.7 | 20.4 |
| Straw/shrub/grass | 1,949 | 12.9 | 12.1 | 13.4 |
| Gas | 758 | 5.0 | 5.4 | 2.9 |
| Crop waste | 83 | 0.6 | 0.6 | 0.6 |
| Missing (= "no cooking option at home") | 88 | 0.6 | 0.6 | 0.0 |
| Other (briquette, peat, sawdust, biogas, electricity, kerosene, other) | 21 | 0.1 | 0.1 | 0.1 |

✅ Raw counts match the guide **exactly** (9,601 firewood, 2,554 charcoal, 758 gas). Weighted shares are within 2 points. **They also match NISR's published figures exactly:** the EICV7 Main Indicators Report 2023/24, Table 5.9 (p. 57), gives firewood 75.0%, charcoal 18.8%, gas or biogas 5.4%, crop waste 0.6%. Ours, among households that cook, are firewood + straw/shrub/grass 75.0, charcoal 18.8, gas/biogas/electricity 5.4, crop waste 0.6. NISR counts straw/shrub/grass as firewood, which supports merging them. Source: https://statistics.gov.rw/sites/default/files/documents/2025-07/EICV7_Main%20Indicator%20Report.pdf The guide does not mention the 1,949 straw/shrub/grass households (13%), which are also polluting.

**Polluting vs clean:** 94.0% of households / **97.0% of children <5** use a polluting primary fuel; 5.4% of households / 2.9% of children use clean fuel.

**Place of cooking (`s5cq23`, household-weighted):** in dwelling 19.9% (not in sleeping area 16.3%, in sleeping area 3.6%); separate dwelling 60.1%; veranda 1.2%; outdoors 18.3%.

**Stove type (`s5cq21`, household-weighted):** three-stone/traditional 35.6%, improved cooking stove 33.7%, charcoal/fire stove 21.6%, gas 5.3%, self-built solid fuel 3.1%. All "improved cooking stoves" burn polluting fuel.

---

## 4. DHS 2025 (RW 91) and DHS 2019-20 (RW 81)

### 4.1 Verified variables (Kids recode, KR)

| Concept | Variable | Label in 2025 file | Codes | 2019-20 file |
|---|---|---|---|---|
| Cough last 2 weeks | `h31` | had cough in last two weeks | 0 no, 1 yes last 24h, 2 yes last two weeks, 8 DK | same |
| Short rapid breaths | `h31b` | short, rapid breaths | 0 no, 1 yes, 8 DK (asked only if cough) | same |
| Chest problem | `h31c` | problem in the chest or blocked or running nose | 1 chest only, 2 nose only, 3 both, 6 other, 8 DK (asked only if h31b=1) | same |
| Child alive | `b5` | child is alive | 0 no, 1 yes | same |
| Age | `b19` (months), `b8` (years), `hw1` | current age of child in months | | same |
| Sex | `b4` | sex of child | 1 male, 2 female | same |
| Weight | `v005` | women's individual sample weight (6 decimals) | ÷ 1,000,000 | same |
| Cluster / PSU | `v001` / `v021` | cluster number / primary sampling unit | 560 clusters (2025), 500 (2019-20) | same |
| Strata | `v022` (also `v023`) | sample strata for sampling errors | 60 strata | same |
| Region | `v024` | region | 1 Kigali, 2 South, 3 West, 4 North, 5 East | same codes |
| Urban/rural | `v025` | type of place of residence | 1 urban, 2 rural | same |
| Wealth quintile | `v190` | wealth index combined | 1 poorest … 5 richest | same |
| Household size | `v136` | number of household members (listed) | count | same |
| **District** | **`sdistrict`** | district code | **11–57, same as NISR** | same (`sdistrict`) |
| Cooking fuel (woman's hh) | `v161` | type of cooking fuel | see below; **97 = not a de jure resident** | same |

`h31a`, `hv226` and `hv241` are **not** in the KR file.

### 4.2 Household recode (HR) and merge

| Concept | Variable | 2025 | 2019-20 |
|---|---|---|---|
| Cooking fuel | `hv226` | 1 electricity, 2 solar, 3 LPG, 4 piped gas, 5 biogas, 6 ethanol, 7 gasoline/diesel, 8 kerosene, 9 coal, **10 charcoal, 11 wood, 12 straw/shrubs/grass**, 13 crop, 14 dung, 15 pellets/woodchips, 16 garbage, 17 sawdust, 95 no cooking, 96 other | 1 electricity, 2 LPG/natural gas, 3 natural gas, 4 biogas, 5 kerosene, 6 coal, **7 charcoal, 8 wood, 9 straw/shrubs/grass**, 10 crop, 11 dung, 12 briquette, 13 sawdust, 95 no cooking, 96 other |
| Place of cooking | `hv241` | 1 in the house, 2 separate building, 3 outdoors, 6 other (99.9% filled) | same (100% filled) |
| Separate kitchen room | `hv242` | 0/1, only asked if cooking in the house (17% filled) | same (23%) |
| Stove type | `hv222` (new in DHS-8) | 1 electric … 7 manufactured solid fuel, 8 traditional solid fuel, 9 three stone/open fire | **not available** |
| Chimney | `hv240` | 0/1/8 (52% filled) | variable present but empty ("na") |
| Indoor tobacco smoke | `hv252` | 0 never … 4 less than monthly | same |
| District | `shdistrict` | 11–57 | same |
| Weight | `hv005` ÷ 1e6 | | |

- **Merge key:** KR `(v001, v002)` → HR `(hv001, hv002)`. HR is unique on this key; 100% of KR children matched in both surveys (7,214 and 8,092).
- `v024=hv024`, `v025=hv025`, `v190=hv270`, `v136=hv009`, `sdistrict=shdistrict` for every child. **`v161` ≠ `hv226` for 80 (2025) / 106 (2019-20) children**, all because `v161=97` ("mother not a de jure resident"). **Use `hv226` from HR**, not `v161`.
- ⚠️ **Fuel codes differ between DHS-7 and DHS-8** (e.g., wood is 8 in 2019-20 and 11 in 2025). Recode each survey separately (done in `src/02_explore_dhs.py`).

### 4.3 ARI definition used

> **ARI symptoms = 1** if the child is alive and under 5 (`b5=1`, `b19<60`), had short, rapid breaths or difficult breathing (`h31b`=1), **and** the problem was in the chest (`h31c` ∈ {1 "chest only", 3 "both"}). **Cough is not required.** Otherwise 0. Denominator: all living children <5; "don't know" counts as no, following DHS convention.

Why: this is the DHS-7/DHS-8 definition. The *Guide to DHS Statistics* (DHS-8 edition) gives numerator "(b5=1 & b19 < 60 & h31b = 1 & h31c in 1,3)" and notes that "in prior surveys, the definition of symptoms of ARI included cough". The DHS Program's own code (`DHS-Indicators-Stata`, `Chap10_CH/CH_ARI_FV.do`) uses `h31b==1 & (h31c==1 | h31c==3)`. Both final reports give the same footnote: "Symptoms of ARI include short, rapid breathing that is chest-related and/or difficult breathing that is chest-related" (FR370 Table 10.5; FR401 Table 10.6). `h31b` is asked of every child, not only those with a cough. Children with only a blocked or running nose ("nose only") are **excluded**.

*Correction (27 Oct 2026 audit):* our first version also required a cough (`h31` ∈ {1,2}). That gave 1.55% / 1.51%, 0.2 points below the official values. Dropping the cough condition reproduces them exactly. The pipeline now uses the official definition.

**Check against official DHS figures** (DHS Program API, indicator `CH_ARIS_C_ARI`, preferred rows):

| | Our unweighted N | Official unweighted N | Our weighted N | Official weighted N | Our ARI % | Official ARI % |
|---|---:|---:|---:|---:|---:|---:|
| DHS 2025 | 7,000 | 7,000 | 7,056 | 7,056 | 1.79 (weighted cases 126) | 1.8 (126; FR401 Table 10.6) |
| DHS 2019-20 | 7,796 | 7,796 | 8,020 | 8,020 | 1.70 (137) | 1.7 (137; FR370 Table 10.5) |

Denominators, rates and weighted case counts all match the published tables exactly.

### 4.4 Key numbers

| | DHS 2025 | DHS 2019-20 |
|---|---:|---:|
| Children in KR | 7,214 | 8,092 |
| Dead (excluded) | 214 | 296 |
| Living children <5 | 7,000 | 7,796 |
| Missing / DK cough (`h31`=8) | 56 (0.8%) | 38 (0.5%) |
| Cough, 2 weeks (weighted %) | 26.75 | 28.38 |
| Cough + short rapid breaths (n / weighted %) | 592 / 8.58 | 587 / 7.34 |
| **ARI, official definition (n / weighted %)** | **119 / 1.79** | **130 / 1.70** |
| ARI excluding missing cough | 1.81 | 1.71 |
| Clusters / strata / districts | 560 / 60 / 30 | 500 / 60 / 30 |
| Children per district (min–max) | 162–371 | 200–360 |
| **ARI cases per district (min–max)** | **0–11** | **0–12** |

**Weighted ARI % by group** (n children / n ARI cases in brackets):

| Group | DHS 2025 | DHS 2019-20 |
|---|---|---|
| Clean fuel (electricity, LPG, biogas, solar…) | 1.47 (276 / **4**) | 0.32 (235 / **1**) |
| Polluting fuel | 1.80 (6,714 / 115) | 1.75 (7,561 / 129) |
| – wood | 1.54 | 1.81 |
| – charcoal | 0.92 | 1.21 |
| – straw/shrubs/grass + other biomass | 2.69 | 2.06 |
| Cook in the house | 1.59 (1,211 / 21) | 2.00 (1,777 / 35) |
| Separate building | 1.84 (4,298 / 73) | 1.41 (4,460 / 65) |
| Outdoors | 1.81 (1,484 / 25) | 2.17 (1,559 / 30) |
| Polluting fuel **and** in the house | 1.71 (1,077 / 19) | 2.08 (1,667 / 34) |
| Urban / rural | 1.23 / 2.03 | 0.99 / 1.86 |
| Poorest → richest quintile | 1.94, 2.80, 1.76, 1.03, 1.36 | 2.14, 2.48, 1.94, 0.86, 0.98 |

Full tables: `outputs/dhs/<year>/ari_breakdowns.csv`.

### 4.5 Household fuel and cooking place (household-weighted, HR)

| | DHS 2025 | DHS 2019-20 |
|---|---:|---:|
| Wood | 37.1 | 61.4 |
| Straw/shrubs/grass | 33.4 | 17.4 |
| Charcoal | 21.0 | 16.2 |
| LPG | 6.0 | 4.2 |
| Cook in the house / separate building / outdoors | 18.3 / 61.5 / 19.4 | 22.3 / 58.2 / 19.2 |

### 4.6 Problems flagged
- **Very few outcome events.** ~120–130 ARI cases per survey, only 1–4 among clean-fuel children, and 0–12 per district. District-level DHS ARI rates are not usable directly.
- **Weak exposure gradient.** In 2025, cooking place shows no ARI difference (1.6–1.8%) and polluting vs clean is 1.80 vs 1.47 with only 4 clean-fuel cases. In 2019-20 the direction is as expected but based on very few cases. Charcoal users have *lower* ARI than wood users, likely because charcoal users are more urban and richer (confounding).
- **Wood/straw split changed sharply** between DHS 2019-20 (61/17) and DHS 2025 (37/33), and EICV7 (62/13) resembles 2019-20. This looks like a change in how "udushari" (straw/shrubs) was recorded, not a real shift in fuel use. → Merge wood + straw/shrubs into one category.
- **Urban share jumps** from 17.6% (2019-20) to 30.5% (2025) of children, probably because of the 2022 Census urban reclassification. Urban is not comparable across the two DHS rounds.
- `hv222` stove type exists only in 2025; `hv240` chimney is empty in 2019-20 and half-filled in 2025.

---

## 5. Census 2022 (PHC5 public microdata)

| Concept | Variable | Label | Notes |
|---|---|---|---|
| Province | `ml01` | Province | 1–5 |
| District | `ml02` | District | 11–57, same names as EICV7 |
| Sector | `ml03` | Sector | 4-digit |
| Urban/rural | `ml07` | Area of residence | 1 Urban, 2 Rural |
| Age | `p04` | Age | 0–122, no missing |
| Residence status | `p07a` | Residence Status | all rows = 1 "Usual resident" |
| Household id | `hhid` | | 331,917 households |
| **Population weight** | `Pop_weight` | population weight | min 5.1, mean 10.1 (≈10% sample) |
| **Household weight** | `HH_weight` | household weight | constant within household |
| Cooking fuel | `h16` | Main source of energy for cooking | 1 Firewood, 2 Charcoal, 3 Gas, 4 Electricity, 5 Kerosene, 6 Biogas, 7 Solar, 8 Crop waste, 9 Dung, 10 Briquette, 11 Peat, 12 Sawdust, 13 Straw/shrub/grass, 14 Other, 15 Do not cook, 99 Not stated |
| Energy-saving stove | `h18` | Does your HH use a cooking energy saving stove? | 1 Yes, 2 No |

**Totals:** weighted population **13,245,753** (✅ ≈ 13.2 M), children aged 0–4 **1,731,594** (13.1%), households **3,312,795**. (EICV7 gives 1.68 M children <5 and 3.29 M households, which is consistent.)

**Cooking fuel nationally (household-weighted):** firewood 70.6%, charcoal 17.3%, straw/shrub/grass 5.5%, gas 4.5%, crop waste 0.5%, do not cook 1.4%.

⚠️ **Kirehe anomaly:** 11.0% of Kirehe households cook with gas, almost all in **Mahama sector (5506)**: 1,166 sampled households. This is very likely the Mahama refugee camp (interpretation, not confirmed from the data). Refugee camps are probably not in the EICV7 sample frame, which explains why EICV7 shows 100% polluting fuel among Kirehe under-5s. Decide whether to treat camp households separately (open question Q4).

`h18` "energy-saving stove" varies strongly by district (5.7% Nyarugenge to 75.6% Gisagara). This could be useful for targeting improved stoves, though the question differs from EICV7 `s5cq21`.

---

## 6. District boundaries

- Service: `https://gis.rbc.gov.rw/server/rest/services/Full_District_boundary_2022/MapServer`. One layer: **id 0 "Full_District_boundary_2022"** (polygon, native CRS EPSG:3857, maxRecordCount 2,000; supports GeoJSON queries).
- Downloaded with `outSR=4326` and paging logic (one page was enough). **30 features** (25 Polygon, 5 MultiPolygon), 0 invalid geometries; bounds lon 28.86–30.90, lat −2.84 to −1.05.
- Fields: `OBJECTID`, `province`, `province_id`, `district`, `district_id`, `province_data`, `Shape_Length`, `Shape_Area`.
- `district_id` equals the NISR code. **All 30 codes and all 30 names match** `data/reference/district_lookup.csv`. No mismatches. The REMA fallback was not needed.
- Website file: `website/data/districts.geojson`, simplified with tolerance 0.001° (~110 m), coordinates rounded to 5 dp, fields `district_code` and `district_name` only, **152 KB**.
- Lookup table: `data/reference/district_lookup.csv` (district_code, district_name, province_code, province_name).

## 7. District overview (all sources)

From `outputs/district_overview.csv`. Census numbers are weighted; EICV7/DHS columns are sample sizes unless marked %.

| Code | District | Census pop | Census <5 | Census % hh polluting | Census % saving stove | EICV7 hh / clusters / <5 | EICV7 % <5 polluting | EICV7 % <5 cook in dwelling | DHS25 <5 / ARI | DHS19 <5 / ARI |
|---|---|---:|---:|---:|---:|---|---:|---:|---|---|
| 11 | Nyarugenge | 374,312 | 46,934 | 78.2 | 5.7 | 647 / 72 / 277 | 86.6 | 22.4 | 183 / 1 | 277 / 2 |
| 12 | Gasabo | 879,476 | 117,275 | 79.9 | 7.2 | 644 / 72 / 313 | 87.0 | 21.9 | 371 / 4 | 360 / 2 |
| 13 | Kicukiro | 491,731 | 59,317 | 71.2 | 7.0 | 647 / 72 / 287 | 82.8 | 17.2 | 205 / 0 | 283 / 5 |
| 21 | Nyanza | 365,718 | 46,837 | 97.8 | 65.1 | 486 / 54 / 258 | 100.0 | 21.1 | 187 / 5 | 232 / 2 |
| 22 | Gisagara | 396,996 | 54,355 | 97.2 | 75.6 | 486 / 54 / 277 | 100.0 | 43.3 | 277 / 11 | 234 / 1 |
| 23 | Nyaruguru | 318,126 | 42,169 | 98.9 | 30.9 | 486 / 54 / 299 | 100.0 | 45.3 | 201 / 5 | 250 / 5 |
| 24 | Huye | 381,894 | 49,310 | 97.0 | 24.1 | 485 / 54 / 229 | 96.7 | 29.7 | 219 / 6 | 200 / 2 |
| 25 | Nyamagabe | 371,501 | 43,729 | 98.9 | 30.7 | 486 / 54 / 235 | 100.0 | 29.8 | 189 / 0 | 227 / 7 |
| 26 | Ruhango | 359,121 | 43,538 | 98.1 | 65.3 | 486 / 54 / 218 | 99.5 | 27.1 | 196 / 2 | 231 / 3 |
| 27 | Muhanga | 358,433 | 42,432 | 96.8 | 66.7 | 486 / 54 / 204 | 99.1 | 19.3 | 162 / 3 | 207 / 0 |
| 28 | Kamonyi | 450,849 | 56,348 | 96.3 | 42.1 | 484 / 54 / 239 | 99.5 | 17.2 | 237 / 4 | 203 / 1 |
| 31 | Karongi | 373,869 | 45,414 | 98.1 | 28.5 | 486 / 54 / 245 | 98.8 | 21.0 | 200 / 1 | 257 / 1 |
| 32 | Rutsiro | 369,180 | 47,942 | 99.2 | 38.9 | 486 / 54 / 276 | 100.0 | 43.0 | 219 / 6 | 304 / 8 |
| 33 | Rubavu | 546,680 | 78,964 | 95.2 | 6.8 | 485 / 54 / 283 | 97.6 | 50.7 | 319 / 11 | 313 / 7 |
| 34 | Nyabihu | 319,041 | 41,306 | 99.2 | 17.1 | 486 / 54 / 263 | 100.0 | 46.5 | 205 / 0 | 276 / 12 |
| 35 | Ngororero | 367,955 | 45,901 | 99.2 | 28.6 | 485 / 54 / 226 | 100.0 | 21.2 | 191 / 1 | 259 / 4 |
| 36 | Rusizi | 485,513 | 69,849 | 97.2 | 21.7 | 486 / 54 / 309 | 98.7 | 12.5 | 293 / 0 | 294 / 7 |
| 37 | Nyamasheke | 434,157 | 57,161 | 98.8 | 18.8 | 486 / 54 / 267 | 100.0 | 10.8 | 259 / 7 | 295 / 12 |
| 41 | Rulindo | 360,144 | 45,278 | 98.0 | 29.6 | 486 / 54 / 231 | 99.5 | 9.8 | 185 / 3 | 212 / 3 |
| 42 | Gakenke | 365,292 | 41,970 | 98.8 | 56.3 | 486 / 54 / 223 | 99.5 | 11.0 | 185 / 6 | 227 / 3 |
| 43 | Musanze | 476,522 | 59,938 | 95.1 | 35.9 | 486 / 54 / 239 | 94.6 | 19.8 | 253 / 5 | 283 / 2 |
| 44 | Burera | 387,729 | 48,354 | 99.2 | 13.2 | 486 / 54 / 248 | 100.0 | 6.0 | 190 / 0 | 270 / 2 |
| 45 | Gicumbi | 448,824 | 56,817 | 98.4 | 57.8 | 486 / 54 / 222 | 99.5 | 2.9 | 217 / 4 | 237 / 10 |
| 51 | Rwamagana | 484,953 | 63,927 | 96.1 | 24.5 | 486 / 54 / 277 | 95.4 | 11.4 | 249 / 7 | 218 / 1 |
| 52 | Nyagatare | 653,861 | 94,260 | 96.3 | 48.1 | 486 / 54 / 274 | 100.0 | 0.9 | 315 / 9 | 297 / 10 |
| 53 | Gatsibo | 551,127 | 73,344 | 97.2 | 28.6 | 486 / 54 / 251 | 99.2 | 2.6 | 249 / 3 | 248 / 0 |
| 54 | Kayonza | 457,156 | 61,862 | 96.6 | 40.5 | 485 / 54 / 239 | 98.7 | 6.0 | 282 / 3 | 312 / 2 |
| 55 | Kirehe | 460,860 | 62,156 | 87.4 | 45.6 | 486 / 54 / 226 | 100.0 | 0.8 | 217 / 4 | 252 / 7 |
| 56 | Ngoma | 404,048 | 53,150 | 97.4 | 28.1 | 486 / 54 / 259 | 99.3 | 2.0 | 239 / 4 | 236 / 2 |
| 57 | Bugesera | 550,685 | 81,757 | 94.2 | 18.9 | 486 / 54 / 277 | 95.2 | 9.5 | 306 / 4 | 302 / 7 |
| | **Total** | **13,245,753** | **1,731,594** | | | **15,054 / 1,674 / 7,671** | | | **7,000 / 119** | **7,796 / 130** |

Every district has 54–72 EICV7 clusters and 200–313 sampled children <5, so no district is extremely thin, but all district estimates still need intervals. **Cooking inside the dwelling** varies from 0.8% (Kirehe) to 50.7% (Rubavu) and is the exposure dimension that actually differs between districts. The West and South are high; the East is very low.

---

## 8. Harmonisation (DHS ↔ EICV7)

Child-weighted % of children <5 under the proposed shared categories (`outputs/harmonisation_comparison.csv`):

| Variable | Category | EICV7 2023/24 | DHS 2025 | DHS 2019-20 |
|---|---|---:|---:|---:|
| Fuel | wood | 62.5 | 35.5 | 61.4 |
| | straw/shrubs/grass | 13.4 | 34.5 | 17.2 |
| | *wood + straw (merged)* | *75.9* | *70.0* | *78.6* |
| | charcoal | 20.4 | 24.9 | 18.3 |
| | other biomass | 0.7 | 1.1 | 0.2 |
| | clean | 2.9 | 3.9 | 3.0 |
| Cooking place | in the house | 18.7 | 16.9 | 21.5 |
| | separate building | 60.2 | 60.3 | 56.7 |
| | outdoors (incl. veranda) | 21.1 | 22.7 | 21.8 |
| Residence | urban | 28.5 | 30.5 | 17.6 |
| Wealth quintile | Q1 … Q5 | 19.6 / 20.5 / 20.3 / 20.4 / 19.2 | 22.5 / 19.8 / 19.5 / 19.3 / 18.8 | 23.3 / 19.2 / 19.4 / 19.5 / 18.6 |
| Age | <1 y / 1 y / 2–4 y | 19.7 / 19.6 / 60.7 | 20.6 / 19.9 / 59.5 | 20.3 / 20.4 / 59.4 |
| Household size | 1–3 / 4–5 / 6–7 / 8+ | 20.1 / 42.9 / 24.7 / 12.3 | 22.3 / 44.0 / 24.8 / 8.9 | 15.9 / 43.6 / 28.0 / 12.5 |
| Province | Kigali / S / W / N / E | 13.6 / 22.3 / 21.8 / 14.5 / 27.8 | 14.4 / 21.5 / 21.8 / 13.9 / 28.4 | 14.1 / 20.1 / 24.2 / 15.1 / 26.5 |

### Proposed shared categories

| Concept | EICV7 source → category | DHS source → category | Recommendation / compromise |
|---|---|---|---|
| Fuel (main) | `s5cq22a`: 1,13 → wood/straw; 2 → charcoal; 8–12 → other biomass; 3,4,5,6 → clean; 7,14 → other | `hv226` (2025: 11,12 / 10 / 9,13–17 / 1–6; 2019: 8,9 / 7 / 6,10–13 / 1–4) | **Use 3 levels: wood/straw/other biomass, charcoal, clean.** Wood and straw must be merged because their split is inconsistent across surveys. Clean is only ~3% of children (few events), so the "clean" coefficient will be imprecise. Kerosene (≈0) goes with polluting (WHO definition). |
| Polluting yes/no | as above | as above | Simple binary for the exposure share E_d. |
| Cooking place | `s5cq23`: 1,2 → in the house; 3 → separate building; 4,5 → outdoors; 6 → other | `hv241`: 1, 2, 3, 6 | Very good match (19/60/21 vs 17/60/23). Veranda (1.2%) grouped with outdoors because it is open on two or more sides. EICV7's "in sleeping area" (3.6%) has no DHS equivalent. |
| Urban/rural | `ur` | `v025` | Matches for DHS 2025 (28.5 vs 30.5). **Not comparable with 2019-20**, which used the old urban definition. If both DHS rounds are pooled, add a survey-year term or drop urban. |
| Wealth | `quintile` (consumption per adult equivalent) | `v190` (asset index) | Different constructs; both are national quintiles and give similar child distributions. Use as approximately comparable and state this in the limitations. Alternative: use a poverty-status binary in EICV7 against DHS bottom-2 quintiles. |
| Child age | `s1q3y` → <1, 1, 2–4 years | `b19` → 0–11, 12–23, 24–59 months | Matches well. |
| Household size | `member` | `v136` (or `hv009`) | Groups 1–3, 4–5, 6–7, 8+ (cap at 8). Close match. |
| Province | `province` | `v024` | Identical codes 1–5. |
| District | `district` | `sdistrict` | Identical codes; could serve as a random effect or for validation, but DHS district samples are small. |
| Stove type | `s5cq21` (improved cooking stove 34%) | `hv222` 2025 only (manufactured solid-fuel 0.6%, traditional 49%) | **Not harmonisable.** "Improved" vs "traditional" are defined differently. Do not use as a model predictor; describe separately. |

---

## 9. Problems and open questions

**Q1. ARI numerator gap: RESOLVED.** The official DHS-7/8 definition does not require a cough (see §4.3). With it we reproduce 1.79% / 1.70% and the published weighted case counts exactly.

**Q2. Outcome choice (most important decision).** The strict ARI outcome has ~100 events per survey. Options:
- (a) Official ARI, **pooling DHS 2019-20 + 2025** (249 events in the 14,692-child analysis sample) with a survey-year term. This is the standard, defensible definition, but still few events for ~10 parameters.
- (b) **Cough with short, rapid breaths** (no chest condition): 592 + 587 events (8.6% / 7.3%). Much more statistical power, but it includes upper-respiratory ("nose only") cases, so it must be labelled honestly as "cough with fast breathing", not pneumonia/ARI.
- (c) Use (b) as the main model and (a) as a sensitivity check.

**Q3. Is the exposure signal strong enough?** The descriptive association between cooking place and ARI is flat in 2025. Polluting vs clean rests on 1–3 clean-fuel cases. A model may show weak or non-significant fuel/place effects. Plan for honest reporting, and consider the guide's §6.8 exposure-index fallback as a parallel product (it does not depend on the outcome). The exposure index should combine polluting fuel **and** indoor cooking, since fuel alone is ~97% everywhere outside Kigali.

**Q4. Refugee camp households (Mahama, Kirehe)** appear in the Census and push Kirehe's clean-fuel share to 11%. Census Mahama sector has 12,805 children under 5 (21% of Kirehe), with 62% of households cooking with gas. *Decision:* exposure and polluting households now come from the Census, which includes them. Kirehe is flagged low-confidence because EICV7 (100%) and the Census (84.8%) disagree.

**Q5. Census vs EICV7 for exposure shares: DONE.** Polluting-fuel exposure is taken from the Census (child-level, 4,000–11,700 sampled children per district, design-based intervals). Cooking place and predicted risk come from EICV7.

**Q6. Stove cost/effectiveness sources** are still needed for `assumptions.json` (not part of this step).

Other notes:
- EICV7 `strata_id` is in the household/person files but not the poverty file; take it from the household file for the cluster bootstrap.
- EICV7 `ur` label set lists peri-urban/semi-urban codes that are never used.
- DHS `hv242` (separate kitchen) is mostly missing because it is only asked when cooking happens in the house.

## 10. Recommended next steps

1. **Decide the outcome (Q2)** and whether to pool both DHS rounds.
2. Write `src/10_clean_dhs.py`: build the child-level analysis table (both rounds) with the harmonised categories above → `data/processed/` (git-ignored).
3. Write `src/11_clean_eicv7.py`: one row per child <5 with household fuel, place, quintile, urban, household size, age group, district, weight, cluster, strata → `data/processed/`.
4. Descriptive weighted tables (guide §6.2) from step 2, which mostly exist already in `outputs/dhs/`.
5. Weighted logistic regression with cluster-robust SEs; GroupKFold-by-cluster validation; calibration.
6. Apply to EICV7, aggregate to districts with Census C_d, and run the cluster bootstrap within strata.
7. Build an exposure index (polluting fuel × cooking in dwelling) as a parallel, outcome-independent layer.
8. Export the website JSON files.
