"""Step 1: verify EICV7 variables and compute descriptive aggregates.

Outputs (aggregate only) in outputs/eicv7/.
"""
import pandas as pd

from common import OUTPUTS, meta, read, value_labels, wshare

OUT = OUTPUTS / "eicv7"
POLLUTING = {1, 2, 8, 9, 10, 11, 12, 13}   # firewood, charcoal, crop waste, dung, briquette, peat, sawdust, straw
CLEAN = {3, 4, 5, 6}                        # gas, biogas, solar, electricity
# 7 kerosene: WHO counts it as polluting, kept separate here; 14 other


def labelled(s, m, var):
    lab = value_labels(m, var)
    return s.map(lambda v: f"{int(v)} {lab.get(v, '?')}" if pd.notna(v) else "missing")


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    hm = meta("eicv7_household")
    h, _ = read("eicv7_household", ["hhid", "clust", "strata_id", "province", "district",
                                     "ur", "s5cq21", "s5cq22a", "s5cq23", "weight"])
    pov, _ = read("eicv7_poverty", ["hhid", "ur", "member", "quintile", "poverty", "pop_wt"])
    per, _ = read("eicv7_person", ["hhid", "pid", "s1q3y"])

    per["u5"] = per["s1q3y"].between(0, 4)
    u5 = per.groupby("hhid")["u5"].sum().rename("n_u5")
    df = h.merge(pov.rename(columns={"ur": "ur2"}), on="hhid", validate="1:1").merge(u5, on="hhid", how="left")
    df["n_u5"] = df["n_u5"].fillna(0)
    df["w_child"] = df["weight"] * df["n_u5"]

    print(f"Households: {len(df):,}  persons: {len(per):,}  age missing/998: {(~per.s1q3y.between(0, 120)).sum()}")
    print(f"Children under 5 (unweighted): {int(df.n_u5.sum()):,}  in {int((df.n_u5 > 0).sum()):,} households")
    print(f"Children under 5 (weighted): {df.w_child.sum():,.0f}")
    print(f"Weighted households: {df.weight.sum():,.0f}  weighted population: {df.pop_wt.sum():,.0f}")

    tables = {
        "fuel_primary_s5cq22a": ("s5cq22a", "weight"),
        "fuel_primary_child_weighted": ("s5cq22a", "w_child"),
        "cook_place_s5cq23": ("s5cq23", "weight"),
        "cook_place_child_weighted": ("s5cq23", "w_child"),
        "stove_type_s5cq21": ("s5cq21", "weight"),
        "ur_household_file_4cat": ("ur", "weight"),
        "ur_poverty_file_2cat": ("ur2", "weight"),
        "quintile": ("quintile", "weight"),
    }
    for name, (var, w) in tables.items():
        lab_var = {"ur2": "ur", "quintile": "s5cq21"}.get(var, var)
        t = df.assign(cat=labelled(df[var], hm, lab_var) if var not in ("ur2", "quintile") else df[var]) \
              .pipe(wshare, "cat", w)
        t.to_csv(OUT / f"{name}.csv")
        print(f"\n== {name} (weight={w})\n{t.to_string()}")

    df["fuel_group"] = df["s5cq22a"].map(lambda v: "polluting" if v in POLLUTING else
                                         "clean" if v in CLEAN else "kerosene" if v == 7 else "other/missing")
    print("\n== fuel group (hh weighted)\n", wshare(df, "fuel_group", "weight").to_string())
    print("\n== fuel group (child weighted)\n", wshare(df, "fuel_group", "w_child").to_string())

    # Stove type x fuel (unweighted): shows how many 'improved' stoves still burn biomass
    xt = pd.crosstab(labelled(df.s5cq21, hm, "s5cq21"), df.fuel_group)
    xt.to_csv(OUT / "stove_by_fuelgroup_unweighted.csv")
    print("\n== stove x fuel group (unweighted)\n", xt.to_string())

    dist_lab = value_labels(hm, "district")
    d = df.groupby("district").apply(lambda g: pd.Series({
        "province": int(g.province.iloc[0]),
        "n_households": len(g), "n_clusters": g.clust.nunique(),
        "n_children_u5_sample": int(g.n_u5.sum()),
        "households_weighted": g.weight.sum(),
        "children_u5_weighted": g.w_child.sum(),
        "pct_hh_polluting_w": 100 * g.weight[g.fuel_group == "polluting"].sum() / g.weight.sum(),
        "pct_u5_polluting_w": 100 * g.w_child[g.fuel_group == "polluting"].sum() / g.w_child.sum(),
        "pct_u5_cook_in_dwelling_w": 100 * g.w_child[g.s5cq23.isin([1, 2])].sum() / g.w_child.sum(),
    }), include_groups=False).reset_index()
    d.insert(1, "district_name", d.district.map(dist_lab))
    d.round(1).to_csv(OUT / "district_summary.csv", index=False)
    print("\n== district summary\n", d.round(1).to_string(index=False))


if __name__ == "__main__":
    main()
