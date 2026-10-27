"""Model specification shared by validation (13_) and district estimation/bootstrap (14_).

Predictors exist in both DHS and EICV7 with harmonised categories (see harmonise.py).
Reference levels are chosen so odds ratios read as "compared with the lowest-risk situation":
clean fuel, cooking outdoors, richest quintile, urban, age 2-4y, household of 4-5, Kigali, male, DHS 2019-20.
"""
import warnings

import numpy as np
import pandas as pd
import statsmodels.api as sm
import xgboost as xgb

from harmonise import AGE_LEVELS, FUEL_LEVELS, HHSIZE_LEVELS, PLACE_LEVELS

FEATURES = {  # feature -> (levels in order, reference level)
    "fuel": (FUEL_LEVELS, "clean"),
    "place": (PLACE_LEVELS, "outdoors"),
    "wealth_q": ([1, 2, 3, 4, 5], 5),
    "rural": ([0, 1], 0),
    "age_group": (AGE_LEVELS, "2-4y"),
    "hhsize": (HHSIZE_LEVELS, "4-5"),
    "province": ([1, 2, 3, 4, 5], 1),
    "sex_female": ([0, 1], 0),
    "survey2025": ([0, 1], 0),
}
LABELS = {
    "fuel": "Cooking fuel", "place": "Where food is cooked", "wealth_q": "Household wealth",
    "rural": "Rural residence", "age_group": "Child age", "hhsize": "Household size",
    "province": "Province", "sex_female": "Child sex", "survey2025": "Survey round",
}
PROVINCES = {1: "Kigali City", 2: "Southern", 3: "Western", 4: "Northern", 5: "Eastern"}
XGB_PARAMS = dict(max_depth=3, n_estimators=300, learning_rate=0.03, subsample=0.8, colsample_bytree=0.8,
                  min_child_weight=10, reg_lambda=1.0, objective="binary:logistic", eval_metric="logloss",
                  tree_method="hist", n_jobs=4)


def prepare(df):
    """Add derived columns used by the design matrix."""
    df = df.copy()
    df["rural"] = 1 - df["urban"]
    df["survey2025"] = (df["survey"] == 2025).astype(int)
    return df


def design(df, intercept=True):
    """Dummy-coded design matrix with fixed columns (identical for DHS and EICV7)."""
    cols = {}
    for f, (levels, ref) in FEATURES.items():
        v = df[f].astype(object)
        for lv in levels:
            if lv != ref:
                cols[f"{f}[{lv}]"] = (v == lv).astype(float).to_numpy()
    X = pd.DataFrame(cols, index=df.index)
    if intercept:
        X.insert(0, "const", 1.0)
    return X


def feature_of(col):
    return col.split("[")[0]


def fit_logit(X, y, w, groups=None):
    """Survey-weighted logistic regression; cluster-robust SEs when groups are given."""
    m = sm.GLM(y, X, family=sm.families.Binomial(), var_weights=w)
    if groups is None:
        return m.fit()
    # statsmodels warns that cluster SEs are "not fully supported" with var_weights; we checked them
    # against a hand-computed sandwich (bread^-1 meat bread^-1, G/(G-1) correction): equal to 3 dp.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=sm.tools.sm_exceptions.SpecificationWarning)
        return m.fit(cov_type="cluster", cov_kwds={"groups": pd.factorize(groups)[0]})


def predict_logit(beta, X):
    return 1 / (1 + np.exp(-(X.to_numpy() @ np.asarray(beta))))


def fit_xgb(X, y, w, seed=0, **overrides):
    params = {**XGB_PARAMS, **overrides}
    m = xgb.XGBClassifier(random_state=seed, **params)
    m.fit(X.drop(columns="const", errors="ignore").to_numpy(), y, sample_weight=w)
    return m


def predict_xgb(model, X):
    return model.predict_proba(X.drop(columns="const", errors="ignore").to_numpy())[:, 1]
