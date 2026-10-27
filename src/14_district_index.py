"""Step 14: apply the risk model to EICV7 children, aggregate to districts, scale by Census
counts, and quantify uncertainty with a 500-round two-stage cluster bootstrap.

Each bootstrap round:
  1. resample DHS clusters within strata and refit the logistic model (model uncertainty);
  2. resample EICV7 clusters within strata (sampling uncertainty of district shares);
  3. recompute every district quantity and the priority rank.
Census counts (10% sample, ~30-90k persons per district) are treated as fixed.

Quantities per district d (EICV7 child- or household-weighted unless noted):
  children_u5 (C_d, Census), households (Census)
  exposure_share        share of children <5 in households with polluting primary fuel
  indoor_smoke_share    ... with polluting fuel AND cooking inside the house
  risk                  mean predicted probability of cough with fast breathing (R_d)
  risk_exposed          mean predicted risk among children in polluting-fuel households
  polluting_hh          share of households with polluting fuel x Census households (H_d)
  children_per_hh       children <5 per polluting-fuel household
  priority_score        children_per_hh x risk_exposed (= cases averted per stove / (e x u))
  model_fuel_effect     model-based drop in risk if polluting -> clean fuel (survey estimate)

Outputs: outputs/district/district_index.csv, bootstrap draws (aggregate), sanity checks.
"""
import json
import sys

import numpy as np
import pandas as pd

from common import OUTPUTS, PROCESSED, REFERENCE
from model_spec import design, feature_of, fit_logit, predict_logit, prepare

OUT = OUTPUTS / "district"
N_BOOT = int(sys.argv[1]) if len(sys.argv) > 1 else 500
OUTCOME = "cough_fast"
SEED = 2026


def cluster_multiplicity(clusters, strata, rng):
    """Bootstrap multiplicity per cluster: resample n_h clusters with replacement within each stratum."""
    cs = pd.DataFrame({"c": clusters, "s": strata}).drop_duplicates("c")
    counts = {}
    for _, g in cs.groupby("s"):
        draw = rng.choice(g.c.to_numpy(), size=len(g), replace=True)
        for c, n in zip(*np.unique(draw, return_counts=True)):
            counts[c] = n
    return pd.Series(clusters).map(counts).fillna(0).to_numpy()


def district_stats(kids, hh, p, p_clean, wk, wh):
    """All district quantities for one set of child predictions and weights."""
    k = pd.DataFrame({"d": kids.district.to_numpy(), "w": wk, "p": p, "dp": p - p_clean,
                      "pol": kids.polluting.to_numpy(), "ind": kids.polluting.to_numpy() * kids.cooks_in_house.to_numpy()})
    k["wp"], k["wpol"], k["wind"] = k.w * k.p, k.w * k.pol, k.w * k.ind
    k["wp_pol"], k["wdp_pol"], k["wp_ind"] = k.wp * k.pol, k.w * k.dp * k.pol, k.wp * k.ind
    g = k.groupby("d")[["w", "wp", "wpol", "wind", "wp_pol", "wdp_pol", "wp_ind"]].sum()
    ind = hh.polluting.to_numpy() * hh.cooks_in_house.to_numpy()
    h = pd.DataFrame({"d": hh.district.to_numpy(), "w": wh, "pol": hh.polluting.to_numpy(), "ind": ind,
                      "u5": hh.n_u5.to_numpy()})
    h["wpol"], h["wu5pol"], h["wind"], h["wu5ind"] = h.w * h.pol, h.w * h.u5 * h.pol, h.w * h.ind, h.w * h.u5 * h.ind
    gh = h.groupby("d")[["w", "wpol", "wu5pol", "wind", "wu5ind"]].sum()
    out = pd.DataFrame({
        "exposure_share": g.wpol / g.w,
        "indoor_smoke_share": g.wind / g.w,
        "risk": g.wp / g.w,
        "risk_exposed": g.wp_pol / g.wpol,
        "model_fuel_effect": g.wdp_pol / g.wpol,
        "hh_polluting_share": gh.wpol / gh.w,
        "children_per_hh": gh.wu5pol / gh.wpol,
        # Indoor-cooking subgroup (polluting fuel AND cooking inside the house): for the planner's
        # "indoor cooking first" option. Small samples in the East -> see sample_indoor_households.
        "risk_indoor": g.wp_ind / g.wind.replace(0, np.nan),
        "hh_indoor_share": gh.wind / gh.w,
        "children_per_indoor_hh": gh.wu5ind / gh.wind.replace(0, np.nan),
    })
    out["priority_score"] = out.children_per_hh * out.risk_exposed
    out["priority_score_indoor"] = out.children_per_indoor_hh * out.risk_indoor
    return out


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rng = np.random.default_rng(SEED)
    dhs = prepare(pd.read_parquet(PROCESSED / "dhs_children.parquet")).reset_index(drop=True)
    kids = prepare(pd.read_parquet(PROCESSED / "eicv7_children.parquet")).reset_index(drop=True)
    hh = pd.read_parquet(PROCESSED / "eicv7_households.parquet")
    hh = hh[hh.fuel.notna()].reset_index(drop=True)   # 96 households with no cooking/other fuel
    census = pd.read_csv(OUTPUTS / "census" / "district_population.csv").set_index("district")
    lookup = pd.read_csv(REFERENCE / "district_lookup.csv").set_index("district_code")

    # Predict as if surveyed in the latest DHS round (EICV7 is 2023/24).
    kids["survey2025"] = 1
    Xd, Xk = design(dhs), design(kids)
    Xk_clean = design(kids.assign(fuel=pd.Categorical(["clean"] * len(kids), categories=kids.fuel.cat.categories)))
    y, w = dhs[OUTCOME].to_numpy(), dhs.w.to_numpy()

    fit = fit_logit(Xd, y, w)
    p, pc = predict_logit(fit.params, Xk), predict_logit(fit.params, Xk_clean)
    point = district_stats(kids, hh, p, pc, kids.w.to_numpy(), hh.w.to_numpy())

    # National sanity checks
    nat = {
        "eicv7_mean_predicted_risk_pct": round(100 * np.average(p, weights=kids.w), 2),
        "dhs2025_observed_pct": round(100 * np.average(y[dhs.survey == 2025], weights=w[dhs.survey == 2025]), 2),
        "dhs_pooled_observed_pct": round(100 * np.average(y, weights=w), 2),
        "eicv7_children_weighted": round(float(kids.w.sum())),
        "census_children_u5": round(float(census.children_u5.sum())),
    }
    print("sanity:", nat)

    # Bootstrap
    draws = []
    for b in range(N_BOOT):
        md = cluster_multiplicity(dhs.cluster.to_numpy(), dhs.strata.to_numpy(), rng)
        fb = fit_logit(Xd, y, w * md)
        # One EICV7 cluster draw (over all household clusters), shared by children and households.
        mh = cluster_multiplicity(hh.cluster.to_numpy(), hh.strata.to_numpy(), rng)
        mk = kids.cluster.map(pd.Series(mh, index=hh.cluster).groupby(level=0).first()).fillna(0).to_numpy()
        s = district_stats(kids, hh, predict_logit(fb.params, Xk), predict_logit(fb.params, Xk_clean),
                           kids.w.to_numpy() * mk, hh.w.to_numpy() * mh)
        s["priority_rank"] = s.priority_score.rank(ascending=False)
        s["risk_rank"] = s.risk.rank(ascending=False)
        s["b"] = b
        draws.append(s.reset_index())
        if (b + 1) % 100 == 0:
            print(f"bootstrap {b + 1}/{N_BOOT}")
    draws = pd.concat(draws)
    draws.round(6).to_csv(OUT / "bootstrap_draws.csv.gz", index=False)

    q = draws.groupby("d").quantile([0.05, 0.95]).unstack()
    t = point.copy()
    for c in ["exposure_share", "indoor_smoke_share", "risk", "risk_exposed", "priority_score", "model_fuel_effect",
              "priority_score_indoor"]:
        t[f"{c}_lo"], t[f"{c}_hi"] = q[(c, 0.05)], q[(c, 0.95)]
    t["priority_rank"] = t.priority_score.rank(ascending=False).astype(int)
    t["priority_rank_lo"], t["priority_rank_hi"] = q[("priority_rank", 0.05)], q[("priority_rank", 0.95)]
    t["risk_rank"] = t.risk.rank(ascending=False).astype(int)

    t = t.join(census[["children_u5", "households", "population"]])
    t = t.join(lookup[["district_name", "province_code", "province_name"]])
    t["children_exposed"] = t.children_u5 * t.exposure_share
    t["children_indoor_smoke"] = t.children_u5 * t.indoor_smoke_share
    t["children_with_symptoms"] = t.children_u5 * t.risk
    t["children_with_symptoms_lo"] = t.children_u5 * t.risk_lo
    t["children_with_symptoms_hi"] = t.children_u5 * t.risk_hi
    t["polluting_hh"] = t.households * t.hh_polluting_share
    t["indoor_polluting_hh"] = t.households * t.hh_indoor_share
    rmin, rmax = t.risk.min(), t.risk.max()
    t["risk_index"] = 100 * (t.risk - rmin) / (rmax - rmin)
    t["risk_index_lo"] = (100 * (t.risk_lo - rmin) / (rmax - rmin)).clip(lower=0)
    t["risk_index_hi"] = (100 * (t.risk_hi - rmin) / (rmax - rmin)).clip(upper=100)
    # Tiers by thirds of the priority ranking; uncertain when the 90% rank interval spans > 10 places.
    t["priority_tier"] = pd.cut(t.priority_rank, [0, 10, 20, 30], labels=["High", "Medium", "Lower"])
    t["rank_uncertain"] = (t.priority_rank_hi - t.priority_rank_lo) > 10

    samp = kids.groupby("district").agg(sample_children=("pid", "size"), sample_clusters=("cluster", "nunique"))
    samp["sample_households"] = hh.groupby("district").size()
    samp["sample_indoor_households"] = hh[(hh.polluting == 1) & (hh.cooks_in_house == 1)].groupby("district").size()
    samp["sample_indoor_households"] = samp.sample_indoor_households.fillna(0).astype(int)
    t = t.join(samp)
    t.index.name = "district_code"
    t = t.reset_index().sort_values("priority_rank")
    t.to_csv(OUT / "district_index.csv", index=False)

    # Checks
    nat["census_children_total_matches"] = bool(abs(t.children_u5.sum() - census.children_u5.sum()) < 1)
    nat["districts"] = int(len(t))
    nat["national_children_exposed"] = round(float(t.children_exposed.sum()))
    nat["national_children_indoor_smoke"] = round(float(t.children_indoor_smoke.sum()))
    nat["national_children_with_symptoms"] = round(float(t.children_with_symptoms.sum()))
    nat["national_polluting_hh"] = round(float(t.polluting_hh.sum()))
    nat["model_fuel_effect_national_pp"] = round(100 * float(np.average(
        (p - pc)[kids.polluting == 1], weights=kids.w[kids.polluting == 1])), 3)
    nat["n_bootstrap"] = N_BOOT
    (OUT / "national_checks.json").write_text(json.dumps(nat, indent=2))
    print(json.dumps(nat, indent=2))
    cols = ["priority_rank", "priority_rank_lo", "priority_rank_hi", "district_name", "children_u5", "exposure_share",
            "indoor_smoke_share", "risk", "risk_lo", "risk_hi", "risk_exposed", "children_per_hh", "priority_score",
            "model_fuel_effect", "model_fuel_effect_lo", "model_fuel_effect_hi", "rank_uncertain"]
    print(t[cols].round(3).to_string(index=False))


if __name__ == "__main__":
    main()
