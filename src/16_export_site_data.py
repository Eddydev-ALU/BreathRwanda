"""Step 16: export small, aggregate-only JSON/CSV files for the static website.

  site/data/districts.json      one record per district (field names match the planner JS)
  site/data/model_summary.json  outcome definitions, validation, odds ratios, importance, checks
  site/data/ranking_default.csv default priority ranking for download
  site/data/assumptions.json    stove cost/usage/effect with sources (copied from data/reference)

"Why this district?" factors: for the logistic model, each child's prediction decomposes
exactly into beta_j * (x_ij - national mean_j) per factor (linear SHAP, log-odds). We average
these within each district and convert to approximate percentage points around the national risk.
"""
import json

import numpy as np
import pandas as pd

from common import OUTPUTS, PROCESSED, REFERENCE, ROOT
from model_spec import LABELS, design, feature_of, fit_logit, prepare

SITE = ROOT / "site" / "data"
OUTCOME = "cough_fast"


def r(x, nd=4):
    return None if pd.isna(x) else round(float(x), nd)


def district_factors(dhs, kids):
    X = design(dhs)
    fit = fit_logit(X, dhs[OUTCOME].to_numpy(), dhs.w.to_numpy())
    Xk = design(kids).drop(columns="const")
    beta = fit.params.drop("const")
    w = kids.w.to_numpy()
    contrib = (Xk - np.average(Xk, axis=0, weights=w)) * beta.values
    by_feat = contrib.T.groupby(contrib.columns.map(feature_of)).sum().T.drop(columns=["survey2025"])
    p_nat = np.average(1 / (1 + np.exp(-(design(kids).to_numpy() @ fit.params.values))), weights=w)
    scale = 100 * p_nat * (1 - p_nat)   # d p / d logit at the national mean, in percentage points
    by_feat["district"] = kids.district.to_numpy()
    by_feat["w"] = w
    out = {}
    for d, g in by_feat.groupby("district"):
        vals = {f: float(np.average(g[f], weights=g.w)) * scale for f in by_feat.columns if f not in ("district", "w")}
        out[int(d)] = sorted(({"factor": LABELS[f], "key": f, "pp": round(v, 2)} for f, v in vals.items()),
                             key=lambda x: -abs(x["pp"]))
    return out, round(100 * p_nat, 2)


def main():
    SITE.mkdir(parents=True, exist_ok=True)
    t = pd.read_csv(OUTPUTS / "district" / "district_index.csv")
    census = pd.read_csv(OUTPUTS / "census" / "district_population.csv").set_index("district")
    dhs = prepare(pd.read_parquet(PROCESSED / "dhs_children.parquet")).reset_index(drop=True)
    kids = prepare(pd.read_parquet(PROCESSED / "eicv7_children.parquet")).reset_index(drop=True)
    kids["survey2025"] = 1
    factors, p_nat = district_factors(dhs, kids)

    records = []
    for _, d in t.sort_values("district_code").iterrows():
        c = int(d.district_code)
        records.append({
            "code": c, "name": d.district_name, "province": d.province_name,
            "population": round(d.population), "childrenU5": round(d.children_u5), "households": round(d.households),
            "exposureShare": r(d.exposure_share), "exposureShareLo": r(d.exposure_share_lo), "exposureShareHi": r(d.exposure_share_hi),
            "indoorSmokeShare": r(d.indoor_smoke_share), "indoorSmokeShareLo": r(d.indoor_smoke_share_lo),
            "indoorSmokeShareHi": r(d.indoor_smoke_share_hi),
            "childrenExposed": round(d.children_exposed), "childrenIndoorSmoke": round(d.children_indoor_smoke),
            "risk": r(d.risk), "riskLo": r(d.risk_lo), "riskHi": r(d.risk_hi),
            "riskIndex": r(d.risk_index, 1), "riskIndexLo": r(d.risk_index_lo, 1), "riskIndexHi": r(d.risk_index_hi, 1),
            "childrenWithSymptoms": round(d.children_with_symptoms),
            "childrenWithSymptomsLo": round(d.children_with_symptoms_lo),
            "childrenWithSymptomsHi": round(d.children_with_symptoms_hi),
            "riskExposed": r(d.risk_exposed), "pollutingHH": round(d.polluting_hh), "childrenPerHH": r(d.children_per_hh),
            "riskIndoor": r(d.risk_indoor), "indoorPollutingHH": round(d.indoor_polluting_hh),
            "childrenPerIndoorHH": r(d.children_per_indoor_hh),
            "priorityScore": r(d.priority_score, 5), "priorityScoreLo": r(d.priority_score_lo, 5),
            "priorityScoreHi": r(d.priority_score_hi, 5),
            "priorityRank": int(d.priority_rank), "priorityRankLo": r(d.priority_rank_lo, 0),
            "priorityRankHi": r(d.priority_rank_hi, 0), "priorityTier": d.priority_tier,
            "rankUncertain": bool(d.rank_uncertain), "riskRank": int(d.risk_rank),
            "modelFuelEffect": r(d.model_fuel_effect), "modelFuelEffectLo": r(d.model_fuel_effect_lo),
            "modelFuelEffectHi": r(d.model_fuel_effect_hi),
            "censusPollutingShare": r(census.loc[c, "pct_hh_polluting"] / 100),
            "censusSavingStoveShare": r(census.loc[c, "pct_hh_saving_stove"] / 100),
            "sampleHouseholds": int(d.sample_households), "sampleClusters": int(d.sample_clusters),
            "sampleChildren": int(d.sample_children), "sampleIndoorHouseholds": int(d.sample_indoor_households),
            "lowConfidenceIndoor": bool(d.sample_indoor_households < 30),
            "whyFactors": factors[c],
        })
    (SITE / "districts.json").write_text(json.dumps(records, separators=(",", ":")))

    ors = pd.read_csv(OUTPUTS / "model" / "odds_ratios.csv")
    imp = pd.read_csv(OUTPUTS / "model" / "feature_importance.csv")
    ms = json.loads((OUTPUTS / "model" / "model_summary.json").read_text())
    nat = json.loads((OUTPUTS / "district" / "national_checks.json").read_text())
    rob = pd.read_csv(OUTPUTS / "district" / "robustness.csv")
    rates = pd.read_csv(OUTPUTS / "descriptives" / "rates_cough_fast.csv")
    summary = {
        "outcomes": {
            "cough_fast": {**ms["cough_fast"], "role": "main", "definition":
                           "Child under 5, alive, mother reports cough in the last 2 weeks (h31 = 1 or 2) AND short, rapid breaths (h31b = 1)."},
            "ari": {**ms["ari"], "role": "sensitivity", "definition":
                    "Short, rapid breaths (h31b = 1) with a problem in the chest (h31c = 1 chest only or 3 both); cough not required. The official DHS-7/8 ARI definition; reproduces the published 1.8% (2025) and 1.7% (2019-20)."},
        },
        "oddsRatios": {o: [{"feature": f.feature, "label": LABELS[f.feature], "level": f.level, "or": r(f.odds_ratio, 3),
                            "lo": r(f.or_lo, 3), "hi": r(f.or_hi, 3), "p": r(f.p_value, 4)}
                           for f in g.itertuples()] for o, g in ors.groupby("outcome")},
        "featureImportance": {f"{o}_{m}": [{"label": x.label, "key": x.feature, "meanAbsShap": r(x.mean_abs_shap, 4)}
                                            for x in g.itertuples()]
                              for (o, m), g in imp.groupby(["outcome", "model"])},
        "descriptiveRates": [{"variable": x.variable, "category": x.category, "n": int(x.n), "events": int(x.n_events),
                              "pct": x.pct, "lo": x.ci_lo, "hi": x.ci_hi}
                             for x in rates[rates.scope == "pooled"].itertuples()],
        "robustness": rob.to_dict(orient="records"),
        "national": {**nat, "eicv7_mean_predicted_risk_pct_model": p_nat},
        "training": {"surveys": ["Rwanda DHS 2019-20 (RW 81)", "Rwanda DHS 2025 (RW 91)"],
                     "children": ms["cough_fast"]["n_children"], "validation": "5-fold cross-validation grouped by survey cluster, repeated 5 times",
                     "bootstrap": f"{nat['n_bootstrap']} rounds; DHS clusters (model refit) and EICV7 clusters resampled within strata"},
        "appliedTo": "EICV7 2023/24 children under 5 (7,667), scaled to Census 2022 district counts",
    }
    (SITE / "model_summary.json").write_text(json.dumps(summary, indent=1))

    rk = t.sort_values("priority_rank")[[
        "priority_rank", "priority_rank_lo", "priority_rank_hi", "priority_tier", "district_code", "district_name",
        "province_name", "children_u5", "children_exposed", "children_indoor_smoke", "exposure_share",
        "indoor_smoke_share", "risk", "risk_lo", "risk_hi", "risk_index", "children_with_symptoms", "polluting_hh",
        "children_per_hh", "priority_score", "rank_uncertain"]].copy()
    for c in ["exposure_share", "indoor_smoke_share", "risk", "risk_lo", "risk_hi"]:
        rk[c] = (100 * rk[c]).round(1)
    rk = rk.rename(columns={"exposure_share": "exposure_pct", "indoor_smoke_share": "indoor_smoke_pct",
                            "risk": "risk_pct", "risk_lo": "risk_pct_lo", "risk_hi": "risk_pct_hi"})
    rk.round(3).to_csv(SITE / "ranking_default.csv", index=False)

    (SITE / "assumptions.json").write_text((REFERENCE / "assumptions.json").read_text())

    sizes = {p.name: round(p.stat().st_size / 1024, 1) for p in SITE.iterdir()}
    print("site/data sizes (KB):", sizes, "total", round(sum(sizes.values()), 1))
    print("example district:", json.dumps(records[0])[:700])


if __name__ == "__main__":
    main()
