"""Step 15: robustness of the district priority ranking (guide section 11.2).

Recomputes the priority score (children per polluting household x risk among exposed children)
under alternative modelling choices and compares with the main specification:
Spearman rank correlation and overlap of the top-10 districts.

Output: outputs/district/robustness.csv
"""
import importlib

import pandas as pd

from common import OUTPUTS, PROCESSED, REFERENCE
from model_spec import design, fit_logit, fit_xgb, predict_logit, predict_xgb, prepare

di = importlib.import_module("14_district_index")


def scores(dhs, kids, hh, outcome="cough_fast", drop=None, model="logistic"):
    keep = [c for c in design(dhs).columns if not (drop and c.startswith(f"{drop}["))]
    Xd, Xk = design(dhs)[keep], design(kids)[keep]
    Xc = design(kids.assign(fuel=pd.Categorical(["clean"] * len(kids), categories=kids.fuel.cat.categories)))[keep]
    y, w = dhs[outcome].to_numpy(), dhs.w.to_numpy()
    if model == "xgboost":
        m = fit_xgb(Xd, y, w)
        p, pc = predict_xgb(m, Xk), predict_xgb(m, Xc)
    else:
        b = fit_logit(Xd, y, w).params
        p, pc = predict_logit(b, Xk), predict_logit(b, Xc)
    return di.district_stats(kids, hh, p, pc, kids.w.to_numpy(), hh.w.to_numpy()).priority_score


def main():
    dhs = prepare(pd.read_parquet(PROCESSED / "dhs_children.parquet")).reset_index(drop=True)
    kids = prepare(pd.read_parquet(PROCESSED / "eicv7_children.parquet")).reset_index(drop=True)
    kids["survey2025"] = 1
    hh = pd.read_parquet(PROCESSED / "eicv7_households.parquet")
    hh = hh[hh.fuel.notna()].reset_index(drop=True)
    names = pd.read_csv(REFERENCE / "district_lookup.csv").set_index("district_code").district_name

    main_s = scores(dhs, kids, hh)
    top_main = set(main_s.nlargest(10).index)
    variants = {
        "Strict ARI outcome": dict(outcome="ari"),
        "DHS 2025 only": dict(dhs=dhs[dhs.survey == 2025].reset_index(drop=True), drop="survey2025"),
        "Without province": dict(drop="province"),
        "Without wealth": dict(drop="wealth_q"),
        "Without household size": dict(drop="hhsize"),
        "XGBoost instead of logistic": dict(model="xgboost"),
    }
    rows = []
    for name, kw in variants.items():
        d = kw.pop("dhs", dhs)
        s = scores(d, kids, hh, **kw)
        top = set(s.nlargest(10).index)
        rows.append({"variant": name, "spearman_vs_main": round(main_s.corr(s, method="spearman"), 3),
                     "top10_overlap": len(top & top_main),
                     "entered_top10": ", ".join(names[sorted(top - top_main)]),
                     "left_top10": ", ".join(names[sorted(top_main - top)])})
    t = pd.DataFrame(rows)
    t.to_csv(OUTPUTS / "district" / "robustness.csv", index=False)
    print("main top 10:", ", ".join(names[main_s.nlargest(10).index]))
    print(t.to_string(index=False))


if __name__ == "__main__":
    main()
