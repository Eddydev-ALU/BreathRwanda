"""Step 13: train and validate the risk models on pooled DHS 2019-20 + 2025.

For each outcome (cough_fast = main, ari = strict sensitivity):
  1. Weighted logistic regression, cluster-robust SEs -> odds ratios with 95% CI.
  2. Cluster-grouped 5-fold CV, repeated 5x: logistic vs shallow XGBoost vs baselines.
     Metrics (weighted): AUC, Brier score, calibration intercept/slope, calibration by decile.
  3. Model choice: XGBoost only if it beats logistic by > 0.01 AUC AND has a lower Brier score.
  4. Explanations: odds ratios (logistic) and mean |SHAP| per feature (both models).

Outputs: outputs/model/*.csv|json, outputs/figures/model_*.png
"""
import json

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
import pandas as pd  # noqa: E402
import shap  # noqa: E402
import statsmodels.api as sm  # noqa: E402
from sklearn.metrics import brier_score_loss, roc_auc_score  # noqa: E402
from sklearn.model_selection import GroupKFold  # noqa: E402

from common import OUTPUTS, PROCESSED  # noqa: E402
from model_spec import (LABELS, PROVINCES, design, feature_of, fit_logit, fit_xgb,  # noqa: E402
                        predict_logit, predict_xgb, prepare)

OUT = OUTPUTS / "model"
FIG = OUTPUTS / "figures"
OUTCOMES = {"cough_fast": "Cough with short, rapid breathing", "ari": "ARI symptoms (official DHS definition)"}
INK, INK2, MUTED, GRID, SURFACE = "#0b0b0b", "#52514e", "#8a8984", "#e6e5e1", "#fcfcfb"
S1, S2 = "#2a78d6", "#eb6834"   # categorical slots 1-2 (logistic, XGBoost)


def calibration_stats(y, p, w):
    lp = np.log(np.clip(p, 1e-6, 1 - 1e-6) / np.clip(1 - p, 1e-6, 1))
    slope = sm.GLM(y, sm.add_constant(lp), family=sm.families.Binomial(), var_weights=w).fit().params[1]
    citl = sm.GLM(y, np.ones_like(lp), family=sm.families.Binomial(), var_weights=w, offset=lp).fit().params[0]
    return citl, slope


def decile_table(y, p, w):
    d = pd.DataFrame({"y": y, "p": p, "w": w})
    d["decile"] = pd.qcut(d.p.rank(method="first"), 10, labels=False) + 1
    g = d.groupby("decile")
    return pd.DataFrame({"n": g.size(), "pred_pct": 100 * g.apply(lambda x: np.average(x.p, weights=x.w)),
                         "obs_pct": 100 * g.apply(lambda x: np.average(x.y, weights=x.w))}).round(2)


def cross_validate(df, X, outcome, n_repeats=5, k=5):
    y, w, groups = df[outcome].to_numpy(), df.w.to_numpy(), df.cluster.to_numpy()
    Xprov = X[["const"] + [c for c in X.columns if c.startswith("province")]]
    rows, oof_keep = [], {}
    for rep in range(n_repeats):
        oof = {m: np.zeros(len(df)) for m in ["logistic", "xgboost", "province_only"]}
        for tr, te in GroupKFold(n_splits=k, shuffle=True, random_state=rep).split(X, y, groups):
            lr = fit_logit(X.iloc[tr], y[tr], w[tr])
            oof["logistic"][te] = predict_logit(lr.params, X.iloc[te])
            oof["xgboost"][te] = predict_xgb(fit_xgb(X.iloc[tr], y[tr], w[tr], seed=rep), X.iloc[te])
            pr = fit_logit(Xprov.iloc[tr], y[tr], w[tr])
            oof["province_only"][te] = predict_logit(pr.params, Xprov.iloc[te])
        for m, p in oof.items():
            citl, slope = calibration_stats(y, p, w)
            rows.append(dict(outcome=outcome, model=m, repeat=rep, auc=roc_auc_score(y, p, sample_weight=w),
                             brier=brier_score_loss(y, p, sample_weight=w), calib_intercept=citl,
                             calib_slope=slope))
        if rep == 0:
            oof_keep = oof
    rows.append(dict(outcome=outcome, model="no_skill", repeat=-1, auc=0.5,
                     brier=brier_score_loss(y, np.full(len(y), np.average(y, weights=w)), sample_weight=w)))
    return pd.DataFrame(rows), oof_keep


def odds_ratios(res):
    ci = res.conf_int()
    t = pd.DataFrame({"term": res.params.index, "coef": res.params.values, "se": res.bse.values,
                      "odds_ratio": np.exp(res.params.values), "or_lo": np.exp(ci[0].values),
                      "or_hi": np.exp(ci[1].values), "p_value": res.pvalues.values})
    t = t[t.term != "const"].copy()
    t["feature"] = t.term.map(feature_of)
    t["level"] = t.term.str.extract(r"\[(.*)\]")[0]
    return t


def pretty_level(feature, level):
    if feature == "province":
        return PROVINCES[int(level)]
    if feature == "wealth_q":
        return {"1": "Poorest", "2": "Poorer", "3": "Middle", "4": "Richer"}[level]
    return {"wood/straw/biomass": "Wood, straw, biomass", "charcoal": "Charcoal", "in the house": "In the house",
            "separate building": "Separate building", "1": {"rural": "Rural", "sex_female": "Girl",
                                                          "survey2025": "DHS 2025"}.get(feature, "1")}.get(level, level)


REF_TEXT = {"fuel": "vs clean fuel", "place": "vs outdoors", "wealth_q": "vs richest", "rural": "vs urban",
            "age_group": "vs 2-4 years", "hhsize": "vs 4-5 members", "province": "vs Kigali",
            "sex_female": "vs boy", "survey2025": "vs 2019-20"}


def plot_or(t, outcome, path):
    t = t[t.feature != "survey2025"].reset_index(drop=True)
    fig, ax = plt.subplots(figsize=(7.5, 0.3 * len(t) + 1.8), dpi=150)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)
    ax.axvline(1, color=MUTED, lw=1, ls=(0, (3, 3)))
    ys, labels, y, prev = [], [], 0, None
    for _, r in t.iterrows():
        if r.feature != prev:
            y += 0.5 if prev else 0
            prev = r.feature
        ax.plot([r.or_lo, r.or_hi], [y, y], color=S1, lw=2, solid_capstyle="round")
        ax.scatter([r.odds_ratio], [y], s=40, color=S1, edgecolor=SURFACE, linewidth=1.5, zorder=3)
        ax.text(r.or_hi * 1.04, y, f"{r.odds_ratio:.2f}", va="center", fontsize=7, color=INK2)
        ys.append(y)
        labels.append(f"{LABELS[r.feature]}: {pretty_level(r.feature, r.level)} ({REF_TEXT[r.feature]})")
        y += 1
    ax.set_xscale("log")
    ax.set_xlim(0.25, 4.5)
    ax.set_xticks([0.25, 0.5, 1, 2, 4], ["0.25", "0.5", "1", "2", "4"])
    ax.xaxis.set_minor_locator(matplotlib.ticker.NullLocator())
    ax.set_yticks(ys, labels, fontsize=7.5, color=INK)
    ax.invert_yaxis()
    ax.tick_params(axis="y", length=0)
    ax.tick_params(axis="x", colors=INK2, labelsize=8)
    ax.xaxis.grid(True, color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_xlabel("Odds ratio (log scale), 95% CI, cluster-robust. Right of 1 = higher risk.", fontsize=8, color=INK2)
    fig.suptitle(f"What is associated with {OUTCOMES[outcome].lower()}?", fontsize=11, color=INK, x=0.02, ha="left")
    fig.tight_layout(rect=(0, 0, 1, 0.96))
    fig.text(0.02, 0.945, "Weighted logistic regression, DHS 2019-20 + 2025 pooled; all factors adjusted for each other.",
             fontsize=7.5, color=INK2)
    fig.savefig(path, facecolor=SURFACE)
    plt.close(fig)


def plot_calibration(tables, outcome, path):
    fig, ax = plt.subplots(figsize=(5, 4.6), dpi=150)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)
    hi = max(t[["pred_pct", "obs_pct"]].max().max() for t in tables.values()) * 1.1
    ax.plot([0, hi], [0, hi], color=MUTED, lw=1, ls=(0, (3, 3)))
    for (name, t), c in zip(tables.items(), [S1, S2]):
        ax.plot(t.pred_pct, t.obs_pct, color=c, lw=2, marker="o", ms=5, mec=SURFACE, label=name)
    ax.set_xlim(0, hi)
    ax.set_ylim(0, hi)
    ax.set_xlabel("Predicted % (out-of-fold, by decile)", fontsize=8, color=INK2)
    ax.set_ylabel("Observed %", fontsize=8, color=INK2)
    ax.tick_params(colors=INK2, labelsize=8)
    ax.grid(True, color=GRID, lw=0.8)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.legend(frameon=False, fontsize=8, labelcolor=INK)
    fig.suptitle(f"Calibration: {OUTCOMES[outcome]}", fontsize=10, color=INK, x=0.03, ha="left")
    ax.set_title("Dashed line = perfect calibration", fontsize=7.5, color=INK2, loc="left")
    fig.tight_layout()
    fig.savefig(path, facecolor=SURFACE)
    plt.close(fig)


def shap_importance(df, X, outcome, lr_res):
    y, w = df[outcome].to_numpy(), df.w.to_numpy()
    # Linear SHAP for the logistic model: beta_j * (x_ij - mean_j), in log-odds.
    Xn = X.drop(columns="const")
    beta = lr_res.params.drop("const")
    contrib_lr = (Xn - np.average(Xn, axis=0, weights=w)) * beta.values
    model = fit_xgb(X, y, w)
    sv = shap.TreeExplainer(model).shap_values(Xn.to_numpy())
    contrib_xgb = pd.DataFrame(sv, columns=Xn.columns)
    out = []
    for name, c in [("logistic", contrib_lr), ("xgboost", contrib_xgb)]:
        g = c.T.groupby(c.columns.map(feature_of)).sum().T.abs()
        imp = pd.Series(np.average(g, axis=0, weights=w), index=g.columns)
        out.append(pd.DataFrame({"outcome": outcome, "model": name, "feature": imp.index,
                                 "label": imp.index.map(LABELS), "mean_abs_shap": imp.values}))
    return pd.concat(out).sort_values(["model", "mean_abs_shap"], ascending=[True, False])


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    FIG.mkdir(parents=True, exist_ok=True)
    df = prepare(pd.read_parquet(PROCESSED / "dhs_children.parquet")).reset_index(drop=True)
    X = design(df)
    summary = {}
    all_or, all_cv, all_imp = [], [], []
    for outcome in OUTCOMES:
        y, w = df[outcome].to_numpy(), df.w.to_numpy()
        res = fit_logit(X, y, w, groups=df.cluster)
        ors = odds_ratios(res).assign(outcome=outcome)
        all_or.append(ors)
        plot_or(ors, outcome, FIG / f"model_odds_ratios_{outcome}.png")

        cv, oof = cross_validate(df, X, outcome)
        all_cv.append(cv)
        agg = cv.groupby("model")[["auc", "brier", "calib_intercept", "calib_slope"]].agg(["mean", "std"])
        dec = {"Logistic regression": decile_table(y, oof["logistic"], w),
               "XGBoost (depth 3)": decile_table(y, oof["xgboost"], w)}
        for name, t in dec.items():
            t.assign(model=name, outcome=outcome).to_csv(OUT / f"calibration_deciles_{outcome}_{name.split()[0].lower()}.csv")
        plot_calibration(dec, outcome, FIG / f"model_calibration_{outcome}.png")

        auc_lr, auc_xgb = agg.loc["logistic", ("auc", "mean")], agg.loc["xgboost", ("auc", "mean")]
        br_lr, br_xgb = agg.loc["logistic", ("brier", "mean")], agg.loc["xgboost", ("brier", "mean")]
        chosen = "xgboost" if (auc_xgb - auc_lr > 0.01 and br_xgb < br_lr) else "logistic"
        imp = shap_importance(df, X, outcome, res)
        all_imp.append(imp)

        fuel_or = ors.set_index("term").loc[["fuel[wood/straw/biomass]", "fuel[charcoal]", "place[in the house]"]]
        summary[outcome] = {
            "label": OUTCOMES[outcome], "n_children": int(len(df)), "n_events": int(y.sum()),
            "weighted_prevalence_pct": round(100 * np.average(y, weights=w), 2),
            "cv": {m: {k: round(float(agg.loc[m, (k, "mean")]), 4) for k in ["auc", "brier", "calib_intercept", "calib_slope"]}
                   for m in ["logistic", "xgboost", "province_only"]},
            "chosen_model": chosen,
            "sign_check": {t: {"or": round(float(r.odds_ratio), 3), "lo": round(float(r.or_lo), 3),
                               "hi": round(float(r.or_hi), 3), "p": round(float(r.p_value), 4)}
                           for t, r in fuel_or.iterrows()},
        }
        print(f"\n================ {outcome}: n={len(df):,}, events={int(y.sum())}")
        print(ors[["term", "odds_ratio", "or_lo", "or_hi", "p_value"]].round(3).to_string(index=False))
        print(agg.round(4).to_string())
        print("chosen:", chosen)
        print(imp.round(4).to_string(index=False))

    pd.concat(all_or).round(4).to_csv(OUT / "odds_ratios.csv", index=False)
    pd.concat(all_cv).round(4).to_csv(OUT / "cv_metrics.csv", index=False)
    pd.concat(all_imp).round(5).to_csv(OUT / "feature_importance.csv", index=False)
    (OUT / "model_summary.json").write_text(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()
