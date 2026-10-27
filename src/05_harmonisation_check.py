"""Step 5: compare candidate shared predictors between DHS (2025, 2019-20) and EICV7,
weighted to children under 5, using the proposed harmonised categories.

Output: outputs/harmonisation_comparison.csv (aggregate shares only)
"""
import numpy as np
import pandas as pd

from common import OUTPUTS, read

# Proposed shared categories ------------------------------------------------------------
EICV_FUEL = {1: "wood", 13: "straw/shrubs/grass", 2: "charcoal", 8: "other biomass", 9: "other biomass",
             10: "other biomass", 11: "other biomass", 12: "other biomass", 3: "clean", 4: "clean",
             5: "clean", 6: "clean", 7: "kerosene/other", 14: "kerosene/other"}
DHS_FUEL = {
    "2025": {11: "wood", 12: "straw/shrubs/grass", 10: "charcoal", 9: "other biomass", 13: "other biomass",
             14: "other biomass", 15: "other biomass", 16: "other biomass", 17: "other biomass",
             1: "clean", 2: "clean", 3: "clean", 4: "clean", 5: "clean", 6: "clean",
             7: "kerosene/other", 8: "kerosene/other", 96: "kerosene/other"},
    "2019": {8: "wood", 9: "straw/shrubs/grass", 7: "charcoal", 6: "other biomass", 10: "other biomass",
             11: "other biomass", 12: "other biomass", 13: "other biomass",
             1: "clean", 2: "clean", 3: "clean", 4: "clean", 5: "kerosene/other", 96: "kerosene/other"},
}
EICV_PLACE = {1: "in the house", 2: "in the house", 3: "separate building", 4: "outdoors (incl. veranda)",
              5: "outdoors (incl. veranda)", 6: "other"}
DHS_PLACE = {1: "in the house", 2: "separate building", 3: "outdoors (incl. veranda)", 6: "other"}


def hhsize_group(n):
    return pd.cut(n, [0, 3, 5, 7, 99], labels=["1-3", "4-5", "6-7", "8+"])


def shares(df, col, w):
    s = df.groupby(col, observed=True, dropna=False)[w].sum()
    return (100 * s / s.sum()).round(1)


def eicv7_children():
    h, _ = read("eicv7_household", ["hhid", "s5cq22a", "s5cq23", "weight"])
    p, _ = read("eicv7_poverty", ["hhid", "ur", "quintile", "member", "province"])
    per, _ = read("eicv7_person", ["hhid", "s1q3y"])
    kids = per[per.s1q3y.between(0, 4)].merge(h, on="hhid").merge(p, on="hhid")
    kids["fuel"] = kids.s5cq22a.map(EICV_FUEL).fillna("no cooking/missing")
    kids["place"] = kids.s5cq23.map(EICV_PLACE).fillna("no cooking/missing")
    kids["urban"] = kids.ur.map({1: "urban", 2: "rural"})
    kids["wealth_q"] = kids.quintile.astype(int).astype(str)
    kids["age"] = pd.cut(kids.s1q3y, [-1, 0, 1, 4], labels=["<1y", "1y", "2-4y"])
    kids["hhsize"] = hhsize_group(kids.member)
    kids["province"] = kids.province.astype(int).astype(str)
    return kids.rename(columns={"weight": "w"})


def dhs_children(year):
    k, _ = read(f"dhs{year}_kr", ["v001", "v002", "v005", "v024", "v025", "v136", "v190", "b5", "b19"])
    h, _ = read(f"dhs{year}_hr", ["hv001", "hv002", "hv226", "hv241"])
    k = k[(k.b5 == 1) & (k.b19 < 60)].merge(h, left_on=["v001", "v002"], right_on=["hv001", "hv002"])
    k["w"] = k.v005 / 1e6
    k["fuel"] = k.hv226.map(DHS_FUEL[year]).fillna("no cooking/missing")
    k["place"] = k.hv241.map(DHS_PLACE).fillna("no cooking/missing")
    k["urban"] = k.v025.map({1: "urban", 2: "rural"})
    k["wealth_q"] = k.v190.astype(int).astype(str)
    k["age"] = pd.cut(k.b19, [-1, 11, 23, 59], labels=["<1y", "1y", "2-4y"])
    k["hhsize"] = hhsize_group(k.v136)
    k["province"] = k.v024.astype(int).astype(str)
    return k


def main():
    data = {"EICV7 2023/24": eicv7_children(), "DHS 2025": dhs_children("2025"), "DHS 2019-20": dhs_children("2019")}
    rows = []
    for var in ["fuel", "place", "urban", "wealth_q", "age", "hhsize", "province"]:
        t = pd.concat({k: shares(v, var, "w") for k, v in data.items()}, axis=1)
        t.index = pd.MultiIndex.from_product([[var], t.index.astype(str)], names=["variable", "category"])
        rows.append(t)
    out = pd.concat(rows)
    out.to_csv(OUTPUTS / "harmonisation_comparison.csv")
    print("Child-weighted % of children under 5 in each category\n", out.to_string())
    for k, v in data.items():
        print(f"{k}: children n={len(v):,}, mean hh size={np.average(v['member' if 'member' in v else 'v136'], weights=v.w):.2f}")


if __name__ == "__main__":
    main()
