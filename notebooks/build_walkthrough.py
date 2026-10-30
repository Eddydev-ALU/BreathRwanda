"""Build and execute notebooks/walkthrough.ipynb from the aggregate pipeline outputs.

Usage (after ./run_pipeline.sh): .venv/bin/python notebooks/build_walkthrough.py
The notebook reads only outputs/ and website/data/ (never raw microdata), so its saved outputs are safe to commit.
Requires a Jupyter kernel for the venv:
  .venv/bin/python -m ipykernel install --user --name breathrwanda
"""
import sys
from pathlib import Path

import nbformat as nbf
from nbclient import NotebookClient

ROOT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1]
nb = nbf.v4.new_notebook()
md, code = nbf.v4.new_markdown_cell, nbf.v4.new_code_cell
cells = []

cells.append(md("""# Clean Air, Healthy Children: analysis walkthrough

This notebook walks through the results of the analysis pipeline in `src/` (run it with `./run_pipeline.sh`).

**It only reads aggregate outputs** (`outputs/`, `website/data/`). It never loads the survey microdata, so it is safe to share and commit with its outputs. To change the analysis, edit the scripts in `src/` and rerun the pipeline, then rerun this notebook.

| Section | What it shows |
|---|---|
| 1 | Data checks: what went in, what was dropped, national sanity checks |
| 2 | How common cough with fast breathing is, by household characteristics |
| 3 | The risk model: odds ratios, validation, explanation |
| 4 | District results: maps, ranking, uncertainty |
| 5 | Robustness of the ranking |
| 6 | Example: how the stove planner allocates a budget |"""))

cells.append(code("""import json
from pathlib import Path

import geopandas as gpd
import matplotlib.pyplot as plt
import pandas as pd
from IPython.display import Image, display
from matplotlib.colors import LinearSegmentedColormap

ROOT = Path.cwd().parent if Path.cwd().name == "notebooks" else Path.cwd()
OUT, SITE = ROOT / "outputs", ROOT / "website" / "data"
pd.set_option("display.max_columns", 30, "display.width", 160)

# Sequential single-hue ramp (light -> dark blue) for maps
BLUES = LinearSegmentedColormap.from_list("blues", ["#cde2fb", "#86b6ef", "#2a78d6", "#184f95", "#0d366b"])
INK2, SURFACE = "#52514e", "#fcfcfb\""""))

cells.append(md("""## 1. Data checks

Four NISR datasets: **EICV7 2023/24**, **Rwanda DHS 2019-20 and 2025**, **Census 2022**, plus district boundaries from RBC. Full verification of every variable is in `docs/data_inventory.md`."""))
cells.append(code("""inv = pd.read_csv(OUT / "inventory.csv")
inv[["key", "file", "size_mb", "rows", "cols"]]"""))
cells.append(md("Every record removed during cleaning is counted:"))
cells.append(code("""pd.concat([pd.read_csv(OUT / "cleaning_log_dhs.csv"),
           pd.read_csv(OUT / "cleaning_log_eicv7.csv").assign(survey="EICV7")])"""))
cells.append(md("""National sanity checks. The model's average predicted risk for EICV7 children should be close to the rate observed in DHS 2025, and district totals must add up to the Census."""))
cells.append(code("""nat = json.loads((OUT / "district" / "national_checks.json").read_text())
pd.Series(nat).to_frame("value")"""))
cells.append(md("""DHS and EICV7 describe children's households in very similar ways once categories are harmonised. Wood and straw are merged because DHS 2025 splits them very differently from the other surveys (% of children under 5):"""))
cells.append(code("""pd.read_csv(OUT / "harmonisation_comparison.csv").set_index(["variable", "category"])"""))

cells.append(md("""## 2. How common is cough with fast breathing?

Weighted percentages of children under 5 in the pooled DHS 2019-20 + 2025 data, with design-based 95% confidence intervals (clusters within strata).

- **Main outcome:** cough in the last two weeks with short, rapid breathing.
- **Sensitivity outcome:** the official DHS "ARI symptoms" indicator: fast breathing with a chest problem (cough not required)."""))
cells.append(code("""rates = pd.read_csv(OUT / "descriptives" / "rates_cough_fast.csv")
rates[rates.scope == "pooled"][["variable", "category", "n", "n_events", "pct", "ci_lo", "ci_hi"]]"""))
cells.append(code("""display(Image(OUT / "figures" / "rates_cough_fast.png", width=700))"""))
cells.append(md("""**Reading:** before adjustment, symptoms are more common in homes using wood or straw than charcoal or clean fuel, and where polluting fuel is burned inside the house. They are also more common among poorer, rural and younger children and outside Kigali. Section 3 checks which of these hold once the factors are considered together."""))

cells.append(md("""## 3. The risk model

Survey-weighted logistic regression on 14,692 children, with cluster-robust standard errors. Odds ratios above 1 mean higher risk than the reference group."""))
cells.append(code("""ors = pd.read_csv(OUT / "model" / "odds_ratios.csv")
ors[ors.outcome == "cough_fast"][["term", "odds_ratio", "or_lo", "or_hi", "p_value"]].round(3)"""))
cells.append(code("""display(Image(OUT / "figures" / "model_odds_ratios_cough_fast.png", width=650))"""))
cells.append(md("""**Key honest finding.** After adjustment, **cooking fuel and cooking place are not significantly associated** with the symptom (their confidence intervals include 1). Child age, wealth and province are. Clean fuel is rare (3% of children) and concentrated in richer urban households, so household surveys cannot separate the effect of fuel from those factors. The planner therefore uses **published research** for the effect of a cleaner stove, and uses this model for **baseline risk**."""))
cells.append(md("""### Validation

5-fold cross-validation **grouped by survey cluster** (so neighbours never appear in both training and test data), repeated 5 times. The logistic model is compared with a shallow XGBoost model and simple baselines."""))
cells.append(code("""cv = pd.read_csv(OUT / "model" / "cv_metrics.csv")
cv.groupby(["outcome", "model"])[["auc", "brier", "calib_intercept", "calib_slope"]].mean().round(4)"""))
cells.append(code("""display(Image(OUT / "figures" / "model_calibration_cough_fast.png", width=450))"""))
cells.append(md("""XGBoost is no better than logistic regression, so the simpler, explainable model is kept. Discrimination is modest (AUC ≈ 0.59), but predictions are well calibrated from about 4% to 13%. That is what matters for comparing groups and districts. The official DHS ARI model has little skill (AUC ≈ 0.56) and is kept only as a sensitivity check.

### Which factors matter most?
Mean absolute SHAP value (log-odds) per factor:"""))
cells.append(code("""imp = pd.read_csv(OUT / "model" / "feature_importance.csv")
imp[imp.outcome == "cough_fast"].pivot(index="label", columns="model", values="mean_abs_shap").sort_values("logistic", ascending=False).round(3)"""))

cells.append(md("""## 4. District results

The model is applied to every child under 5 in EICV7, aggregated to districts, and scaled to Census 2022 counts. Intervals come from a 500-round bootstrap that resamples both the DHS clusters (refitting the model each time) and the EICV7 clusters."""))
cells.append(code("""districts = pd.DataFrame(json.loads((SITE / "districts.json").read_text()))
geo = gpd.read_file(SITE / "districts.geojson").merge(districts, left_on="district_code", right_on="code")

fig, axes = plt.subplots(1, 3, figsize=(15, 5), facecolor=SURFACE)
for ax, (col, title, fmt) in zip(axes, [
        ("risk", "Predicted risk of cough with fast breathing", "{:.0%}"),
        ("indoorSmokeShare", "Children where polluting fuel is burned in the house", "{:.0%}"),
        ("childrenWithSymptoms", "Expected children with symptoms (2-week window)", "{:,.0f}")]):
    geo.plot(column=col, cmap=BLUES, edgecolor="white", linewidth=0.8, ax=ax, legend=True,
             legend_kwds={"shrink": 0.6})
    ax.set_title(title, fontsize=10, loc="left")
    ax.set_axis_off()
plt.tight_layout()"""))
cells.append(md("""Predicted risk is highest in the South and East and lowest in Kigali. Exposure to polluting fuel comes from the Census (4,000-11,700 sampled children per district); indoor cooking comes from EICV7, because the Census does not ask where food is cooked. **Indoor smoke** follows a different pattern: it is concentrated in the West and South (Rubavu, Nyabihu, Nyaruguru, Gisagara, Rutsiro) and almost absent in the East, where most cooking happens in a separate building."""))
cells.append(md("""### Priority ranking

Priority score = children under 5 per polluting-fuel household × their average risk. Multiplied by a stove's effectiveness and usage rate, this is the number of symptom cases averted per stove. The 90% rank interval shows how certain each position is."""))
cells.append(code("""rank = pd.read_csv(SITE / "ranking_default.csv")
rank[["priority_rank", "priority_rank_lo", "priority_rank_hi", "priority_tier", "district_name", "province_name",
      "children_u5", "children_indoor_smoke", "risk_pct", "risk_pct_lo", "risk_pct_hi", "children_per_hh"]]"""))
cells.append(code("""d = districts.sort_values("priorityRank")
fig, ax = plt.subplots(figsize=(7, 8), facecolor=SURFACE)
ax.hlines(d["name"], d.priorityRankLo, d.priorityRankHi, color="#2a78d6", lw=2)
ax.scatter(d.priorityRank, d["name"], color="#2a78d6", s=30, zorder=3, edgecolor=SURFACE)
ax.invert_yaxis()
ax.set_xlabel("Priority rank (1 = highest), 90% bootstrap interval", color=INK2)
ax.set_title("Read the ranking as tiers: only the top two and Kigali are clearly separated", fontsize=10, loc="left")
ax.grid(axis="x", color="#e6e5e1")
for s in ax.spines.values():
    s.set_visible(False)"""))
cells.append(md("""### Why is a district high risk?

For each district, how much each factor pushes average predicted risk above (+) or below (−) the national average, in percentage points (district-average linear SHAP). The example below is the top-ranked district:"""))
cells.append(code("""top = districts.sort_values("priorityRank").iloc[0]
print(top["name"], "- predicted risk", f"{top.risk:.1%}")
pd.DataFrame(top.whyFactors)[["factor", "pp"]]"""))

cells.append(md("""## 5. Robustness

The ranking recomputed under alternative choices: Spearman correlation with the main ranking, and how many of the top 10 districts stay in the top 10."""))
cells.append(code("""pd.read_csv(OUT / "district" / "robustness.csv")"""))
cells.append(md("""The ranking is stable to the model type, the survey round and most predictors. It changes under the official DHS ARI outcome, but that model has little predictive skill, so this variant is reported and not used."""))

cells.append(md("""## 6. Example: allocating a stove budget

The website's planner follows the same greedy rule as below. Districts are served in order of cases averted per stove, each up to its number of polluting-fuel households. Stove cost, usage and effect come from `website/data/assumptions.json`, where every value has a source.

Trials and observational studies disagree on how much a cleaner stove reduces child respiratory illness, so **cases averted are shown as a range**: from the randomised-trial estimate (low) to an upper bound from observational studies (high). **Children reached** is the more certain number."""))
cells.append(code("""assumptions = json.loads((SITE / "assumptions.json").read_text())
stoves = pd.DataFrame(assumptions["stoves"]).set_index("id")
stoves[["name", "cost", "usage", "effect"]]"""))
cells.append(code("""def plan(districts, stove, budget, scenario):
    n = int(budget // stove.cost)
    e = stove.effect[scenario]
    rows = districts.assign(per_stove=districts.childrenPerHH * districts.riskExposed * e * stove.usage)
    rows = rows.sort_values("priorityScore", ascending=False).reset_index(drop=True)
    left, out = n, []
    for _, r in rows.iterrows():
        give = min(left, int(r.pollutingHH))
        left -= give
        out.append({"district": r["name"], "stoves": give, "children_reached": give * r.childrenPerHH * stove.usage,
                    "cases_averted_2wk": give * r.per_stove})
    return pd.DataFrame(out), n - left


budget = assumptions["defaults"]["budgetRWF"]
stove = stoves.loc[assumptions["defaults"]["stove"]]
low, used = plan(districts, stove, budget, "trial")
high, _ = plan(districts, stove, budget, "observational")
print(f"{stove['name']}: budget {budget:,} RWF buys {used:,} stoves")
print(f"Children under 5 reached: {low.children_reached.sum():,.0f}")
print(f"Cases of cough with fast breathing averted in a 2-week window: "
      f"{low.cases_averted_2wk.sum():,.0f} (trial) to {high.cases_averted_2wk.sum():,.0f} (observational upper bound)")
low.assign(cases_averted_high=high.cases_averted_2wk)[low.stoves > 0].round(0)"""))

nb.cells = cells
nb.metadata["kernelspec"] = {"name": "breathrwanda", "display_name": "BreathRwanda (.venv)", "language": "python"}
out_dir = ROOT / "notebooks"
out_dir.mkdir(exist_ok=True)
NotebookClient(nb, timeout=300, kernel_name="breathrwanda", resources={"metadata": {"path": str(out_dir)}}).execute()
nb.metadata["kernelspec"] = {"name": "python3", "display_name": "Python 3", "language": "python"}
nbf.write(nb, out_dir / "walkthrough.ipynb")
print("written", (out_dir / "walkthrough.ipynb").stat().st_size)
