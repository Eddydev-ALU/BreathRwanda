"""Step 2: verify DHS 2025 (RW 91) and DHS 2019-20 (RW 81) variables, build the ARI
symptom indicator and compute weighted prevalence.

ARI definition (Guide to DHS Statistics, DHS-7/DHS-8): among living children under 5,
  ari = 1 if cough in last 2 weeks (h31 in 1,2)
          AND short, rapid breaths (h31b == 1)
          AND problem in the chest (h31c in 1 'chest only', 3 'both')
DHS counts "don't know"/missing as "no" (denominator = all living children <5).
We also report a variant that drops children with missing/don't know cough data.

Outputs (aggregate only) in outputs/dhs/.
"""
import sys

import numpy as np
import pandas as pd

from common import OUTPUTS, meta, read, value_labels, wshare

OUT = OUTPUTS / "dhs"

# Fuel codes differ between DHS-7 (RW81) and DHS-8 (RW91) -> map each to a shared group.
FUEL_GROUP = {
    "2025": {1: "clean", 2: "clean", 3: "clean", 4: "clean", 5: "clean", 6: "clean",
             7: "kerosene", 8: "kerosene", 9: "polluting", 10: "polluting", 11: "polluting",
             12: "polluting", 13: "polluting", 14: "polluting", 15: "polluting",
             16: "polluting", 17: "polluting", 95: "no cooking", 96: "other"},
    "2019": {1: "clean", 2: "clean", 3: "clean", 4: "clean", 5: "kerosene", 6: "polluting",
             7: "polluting", 8: "polluting", 9: "polluting", 10: "polluting", 11: "polluting",
             12: "polluting", 13: "polluting", 95: "no cooking", 96: "other"},
}
FUEL_DETAIL = {
    "2025": {10: "charcoal", 11: "wood", 3: "lpg"},
    "2019": {7: "charcoal", 8: "wood", 2: "lpg"},
}

KR_COLS = ["caseid", "v001", "v002", "v003", "v005", "v021", "v022", "v023", "v024", "v025",
           "v136", "v161", "v190", "sdistrict", "b4", "b5", "b8", "b19", "hw1",
           "h31", "h31b", "h31c", "h22", "midx"]
HR_COLS_ALL = ["hv001", "hv002", "hv005", "hv009", "hv024", "hv025", "hv226", "hv222", "hv223",
               "hv239", "hv240", "hv241", "hv242", "hv252", "hv270", "shdistrict"]


def run(year):
    kr_key, hr_key = f"dhs{year}_kr", f"dhs{year}_hr"
    km, hm = meta(kr_key), meta(hr_key)
    kr, _ = read(kr_key, [c for c in KR_COLS if c in km.column_names])
    hr, _ = read(hr_key, [c for c in HR_COLS_ALL if c in hm.column_names])
    out = OUT / year
    out.mkdir(parents=True, exist_ok=True)
    print(f"\n################ DHS {year}  KR rows={len(kr):,}  HR rows={len(hr):,}")

    # --- merge keys
    assert not hr.duplicated(["hv001", "hv002"]).any()
    df = kr.merge(hr, left_on=["v001", "v002"], right_on=["hv001", "hv002"], how="left",
                  validate="m:1", indicator=True)
    print("merge KR->HR on (v001,v002)=(hv001,hv002):", df["_merge"].value_counts().to_dict())
    print("v161 == hv226 for all rows:", bool((df.v161 == df.hv226).all()),
          "| v024==hv024:", bool((df.v024 == df.hv024).all()),
          "| v025==hv025:", bool((df.v025 == df.hv025).all()),
          "| sdistrict==shdistrict:", bool((df.sdistrict == df.shdistrict).all()),
          "| v190==hv270:", bool((df.v190 == df.hv270).all()),
          "| v136==hv009:", bool((df.v136 == df.hv009).all()))

    # --- fill rates of HR cooking vars among KR children
    fill = {c: f"{100 * df[c].notna().mean():.1f}%" for c in
            ["hv226", "hv222", "hv223", "hv239", "hv240", "hv241", "hv242", "hv252"] if c in df}
    print("non-missing among children:", fill)

    # --- population: living children under 5
    df["w"] = df["v005"] / 1e6
    n_all = len(df)
    alive = df[df.b5 == 1].copy()
    print(f"children in KR: {n_all:,}; alive: {len(alive):,}; dead: {n_all - len(alive):,}; "
          f"alive with b19<60: {(alive.b19 < 60).sum():,}")
    alive = alive[alive.b19 < 60]

    cough_known = alive.h31.isin([0, 1, 2])
    print("h31 distribution (alive <5):", alive.h31.value_counts(dropna=False).sort_index().to_dict())
    print("h31b distribution:", alive.h31b.value_counts(dropna=False).sort_index().to_dict())
    print("h31c distribution:", alive.h31c.value_counts(dropna=False).sort_index().to_dict())
    print(f"missing/don't-know cough: {(~cough_known).sum()} ({100 * (~cough_known).mean():.2f}%)")

    alive["cough"] = alive.h31.isin([1, 2]).astype(int)
    alive["cough_fast"] = (alive.cough.eq(1) & alive.h31b.eq(1)).astype(int)
    alive["ari"] = (alive.cough_fast.eq(1) & alive.h31c.isin([1, 3])).astype(int)

    def wrate(g, col):
        return 100 * np.average(g[col], weights=g["w"])

    summary = {
        "year": year,
        "children_alive_u5": len(alive),
        "missing_or_dk_cough": int((~cough_known).sum()),
        "n_cough": int(alive.cough.sum()), "pct_cough_w": wrate(alive, "cough"),
        "n_cough_fast": int(alive.cough_fast.sum()), "pct_cough_fast_w": wrate(alive, "cough_fast"),
        "n_ari": int(alive.ari.sum()), "pct_ari_w": wrate(alive, "ari"),
        "pct_ari_w_excl_missing": wrate(alive[cough_known], "ari"),
        "n_clusters": alive.v001.nunique(), "n_strata": alive.v022.nunique(),
        "n_districts": alive.sdistrict.nunique(),
    }
    for k, v in summary.items():
        print(f"  {k}: {v:.2f}" if isinstance(v, float) else f"  {k}: {v}")

    # --- recodes for breakdowns
    alive["fuel_group"] = alive.hv226.map(FUEL_GROUP[year]).fillna("missing")
    alive["fuel_detail"] = alive.hv226.map(FUEL_DETAIL[year]).fillna("other")
    alive.loc[alive.fuel_group != "polluting", "fuel_detail"] = alive.fuel_group
    alive.loc[(alive.fuel_group == "clean") & (alive.fuel_detail == "clean"), "fuel_detail"] = "clean"
    place_lab = value_labels(hm, "hv241")
    alive["cook_place"] = alive.hv241.map(place_lab).fillna("missing / no cooking")
    alive["polluting_indoor"] = np.where(
        (alive.fuel_group == "polluting") & (alive.hv241 == 1), "polluting + in the house",
        np.where(alive.fuel_group == "polluting", "polluting, not in house", "clean/other"))
    alive["age_group"] = pd.cut(alive.b19, [-1, 11, 23, 59], labels=["0-11m", "12-23m", "24-59m"])
    alive["age_group_eicv"] = pd.cut(alive.b19, [-1, 11, 23, 59], labels=["<1y", "1y", "2-4y"])

    rows = []
    for var in ["fuel_group", "fuel_detail", "cook_place", "polluting_indoor", "v025", "v190",
                "v024", "age_group", "hv242"]:
        if var not in alive:
            continue
        lab = value_labels(km, var) or value_labels(hm, var)
        for cat, g in alive.groupby(var, observed=True, dropna=False):
            rows.append({"variable": var, "category": lab.get(cat, cat) if lab else cat,
                         "n_children": len(g), "n_ari": int(g.ari.sum()),
                         "pct_children_w": 100 * g.w.sum() / alive.w.sum(),
                         "pct_ari_w": wrate(g, "ari"), "pct_cough_w": wrate(g, "cough")})
    br = pd.DataFrame(rows).round(2)
    br.to_csv(out / "ari_breakdowns.csv", index=False)
    print(br.to_string(index=False))

    # fuel distributions (household-weighted, from HR) for harmonisation checks
    hr["hw"] = hr.hv005 / 1e6
    hf = hr.assign(cat=hr.hv226.map(lambda v: f"{int(v)} {value_labels(hm, 'hv226').get(v, '?')}"
                                    if pd.notna(v) else "missing")).pipe(wshare, "cat", "hw")
    hf.to_csv(out / "hh_fuel_hv226.csv")
    hp = hr.assign(cat=hr.hv241.map(value_labels(hm, "hv241")).fillna("missing")).pipe(wshare, "cat", "hw")
    hp.to_csv(out / "hh_cook_place_hv241.csv")
    print("\nHousehold fuel (hv226, HH-weighted):\n", hf.to_string())
    print("\nHousehold cooking place (hv241, HH-weighted):\n", hp.to_string())
    for v in ["hv222", "hv223", "hv239", "hv240", "hv242"]:
        if v in hr and hr[v].notna().any():
            t = hr.assign(cat=hr[v].map(lambda x: f"{x:g} {value_labels(hm, v).get(x, '?')}" if pd.notna(x) else "missing")).pipe(wshare, "cat", "hw")
            t.to_csv(out / f"hh_{v}.csv")
            print(f"\n{v} {hm.column_names_to_labels[v]}:\n", t.to_string())

    # children per district (sample size)
    dsz = alive.groupby("sdistrict").agg(n_children=("ari", "size"), n_ari=("ari", "sum"),
                                         n_clusters=("v001", "nunique"))
    dsz.to_csv(out / "district_sample_sizes.csv")
    print("\nchildren per district: min", dsz.n_children.min(), "max", dsz.n_children.max(),
          "| ARI cases per district: min", dsz.n_ari.min(), "max", dsz.n_ari.max())
    return summary


if __name__ == "__main__":
    years = sys.argv[1:] or ["2025", "2019"]
    s = pd.DataFrame([run(y) for y in years]).round(2)
    s.to_csv(OUT / "ari_summary.csv", index=False)
    print("\n", s.T.to_string())
