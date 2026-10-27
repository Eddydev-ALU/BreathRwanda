"""Step 3: Census 2022 (PHC5 public 10% microdata) -> population and children under 5
by district, plus household cooking fuel by district.

Child exposure: share of children aged 0-4 whose household's main cooking fuel is polluting,
with a design-based 90% interval (households as clusters). The Census samples 4,000-11,700
children per district, so this is far more precise than EICV7 (~200-300) and it covers
groups EICV7 may not sample (e.g. the Mahama refugee camp in Kirehe).

Outputs (aggregate only):
  outputs/census/district_population.csv
  outputs/census/fuel_national.csv
"""
import pandas as pd

from common import OUTPUTS, meta, read, value_labels, wshare
from survey_stats import weighted_mean_ci

OUT = OUTPUTS / "census"
POLLUTING = {1, 2, 8, 9, 10, 11, 12, 13}
CLEAN = {3, 4, 6, 7}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    m = meta("census2022")
    df, _ = read("census2022", ["ml01", "ml02", "ml07", "hhid", "p01", "p02", "p04", "p07a",
                                "h16", "h18", "HH_weight", "Pop_weight"])
    print(f"rows {len(df):,}  households {df.hhid.nunique():,}")
    print("p04 age: min", df.p04.min(), "max", df.p04.max(), "missing", df.p04.isna().sum())
    print("p07a residence status:", df.p07a.value_counts(dropna=False).to_dict())
    print("p02 relationship (codes):", df.p02.value_counts(dropna=False).head(12).to_dict())
    print("Pop_weight: min/mean/max", df.Pop_weight.min(), round(df.Pop_weight.mean(), 2), df.Pop_weight.max(),
          "missing", df.Pop_weight.isna().sum())
    print("HH_weight constant within household:", bool(df.groupby("hhid").HH_weight.nunique().le(1).all()))

    total = df.Pop_weight.sum()
    print(f"\nWeighted population (all rows): {total:,.0f}")
    print(f"Weighted population (usual residents p07a==1): {df.Pop_weight[df.p07a == 1].sum():,.0f}")

    df["u5"] = df.p04.between(0, 4)
    hh = df.drop_duplicates("hhid")
    print(f"Weighted households: {hh.HH_weight.sum():,.0f}  (rows with missing HH_weight: {hh.HH_weight.isna().sum()})")

    d = df.groupby("ml02").apply(lambda g: pd.Series({
        "province": int(g.ml01.iloc[0]),
        "sample_persons": len(g),
        "population": g.Pop_weight.sum(),
        "sample_u5": int(g.u5.sum()),
        "children_u5": g.Pop_weight[g.u5].sum(),
    }), include_groups=False)
    hd = hh.groupby("ml02").apply(lambda g: pd.Series({
        "households": g.HH_weight.sum(),
        "pct_hh_polluting": 100 * g.HH_weight[g.h16.isin(POLLUTING)].sum() / g.HH_weight.sum(),
        "pct_hh_clean": 100 * g.HH_weight[g.h16.isin(CLEAN)].sum() / g.HH_weight.sum(),
        "pct_hh_saving_stove": 100 * g.HH_weight[g.h18 == 1].sum() / g.HH_weight[g.h18.isin([1, 2])].sum(),
    }), include_groups=False)
    kids = df[df.u5].assign(polluting=lambda x: x.h16.isin(POLLUTING).astype(int), stratum=1)
    cd = {}
    for dist, g in kids.groupby("ml02"):
        r = weighted_mean_ci(g, "polluting", w="Pop_weight", cluster="hhid", strata="stratum", z=1.645)
        cd[dist] = {"pct_u5_polluting": 100 * r["mean"], "pct_u5_polluting_lo": 100 * r["lo"],
                    "pct_u5_polluting_hi": 100 * min(r["hi"], 1.0)}
    d = d.join(hd).join(pd.DataFrame(cd).T).reset_index().rename(columns={"ml02": "district"})
    d.insert(1, "district_name", d.district.map(value_labels(m, "ml02")))
    d["pct_u5"] = 100 * d.children_u5 / d.population
    d = d.round(2)
    d.to_csv(OUT / "district_population.csv", index=False)
    print(d.to_string(index=False))
    print(f"\nTOTAL population {d.population.sum():,.0f}  children under 5 {d.children_u5.sum():,.0f} "
          f"({100 * d.children_u5.sum() / d.population.sum():.1f}%)  households {d.households.sum():,.0f}")
    print(f"children <5 in polluting-fuel households: {(d.children_u5 * d.pct_u5_polluting / 100).sum():,.0f}; "
          f"polluting households: {(d.households * d.pct_hh_polluting / 100).sum():,.0f}")

    lab = value_labels(m, "h16")
    f = hh.assign(cat=hh.h16.map(lambda v: f"{int(v)} {lab.get(v, '?')}" if pd.notna(v) else "missing (collective/NA)")) \
          .pipe(wshare, "cat", "HH_weight")
    f.to_csv(OUT / "fuel_national.csv")
    print("\nCooking fuel h16 (household weighted):\n", f.to_string())


if __name__ == "__main__":
    main()
