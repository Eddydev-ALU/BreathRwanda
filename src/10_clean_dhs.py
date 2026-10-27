"""Step 10: clean, pooled DHS child table (2019-20 + 2025) for model training.

One row per living child under 5 with harmonised predictors and two outcomes:
  cough_fast  cough in last 2 weeks AND short, rapid breaths (main outcome)
  ari         cough_fast AND problem in the chest (strict DHS ARI; sensitivity)

Output: data/processed/dhs_children.parquet (row-level, git-ignored)
        outputs/cleaning_log_dhs.csv (record counts per step)
"""
import pandas as pd

from common import OUTPUTS, PROCESSED, read
from harmonise import DHS_FUEL, DHS_PLACE, FUEL_LEVELS, PLACE_LEVELS, age_group_months, cat, hhsize_group


def build(year):
    log = []
    k, _ = read(f"dhs{year}_kr", ["v001", "v002", "v005", "v021", "v022", "v024", "v025", "v136",
                                  "v190", "sdistrict", "b4", "b5", "b19", "h31", "h31b", "h31c"])
    h, _ = read(f"dhs{year}_hr", ["hv001", "hv002", "hv226", "hv241"])
    log.append(("children in KR", len(k)))
    k = k[k.b5 == 1]
    log.append(("alive", len(k)))
    k = k[k.b19 < 60]
    log.append(("alive and under 5 (b19<60)", len(k)))
    k = k.merge(h, left_on=["v001", "v002"], right_on=["hv001", "hv002"], how="inner", validate="m:1")
    log.append(("matched to household recode", len(k)))

    d = pd.DataFrame({
        "survey": int(year),
        "cluster": f"{year}_" + k.v001.astype(int).astype(str),
        "strata": f"{year}_" + k.v022.astype(int).astype(str),
        "w": k.v005 / 1e6,
        "district": k.sdistrict.astype(int),
        "province": k.v024.astype(int),
        "urban": (k.v025 == 1).astype(int),
        "wealth_q": k.v190.astype(int),
        "sex_female": (k.b4 == 2).astype(int),
        "age_group": age_group_months(k.b19),
        "hhsize": hhsize_group(k.v136),
        "fuel": cat(k.hv226.map(DHS_FUEL[year]), FUEL_LEVELS),
        "place": cat(k.hv241.map(DHS_PLACE), PLACE_LEVELS),
        "cough_known": k.h31.isin([0, 1, 2]).astype(int),
        "cough_fast": (k.h31.isin([1, 2]) & (k.h31b == 1)).astype(int),
        "ari": (k.h31.isin([1, 2]) & (k.h31b == 1) & k.h31c.isin([1, 3])).astype(int),
    })
    n = len(d)
    d = d[d.cough_known == 1]
    log.append(("cough question answered (drop don't know)", len(d)))
    d = d.dropna(subset=["fuel"])
    log.append(("fuel in harmonised set (drop kerosene/other/no cooking)", len(d)))
    d = d.dropna(subset=["place"])
    log.append(("cooking place in/separate/outdoors (drop other/missing)", len(d)))
    print(f"DHS {year}: kept {len(d):,} of {n:,} living children <5")
    return d.drop(columns="cough_known"), [(year, s, c) for s, c in log]


def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    parts, logs = zip(*(build(y) for y in ["2019", "2025"]))
    df = pd.concat(parts, ignore_index=True)
    for c, lv in [("fuel", FUEL_LEVELS), ("place", PLACE_LEVELS)]:
        df[c] = cat(df[c], lv)
    df["polluting"] = (df.fuel != "clean").astype(int)
    df.to_parquet(PROCESSED / "dhs_children.parquet", index=False)
    log = pd.DataFrame([r for lg in logs for r in lg], columns=["survey", "step", "records"])
    log.to_csv(OUTPUTS / "cleaning_log_dhs.csv", index=False)
    print(log.to_string(index=False))
    print(df.groupby("survey")[["cough_fast", "ari"]].agg(["sum", "mean"]).round(4))
    print(df.isna().sum()[lambda s: s > 0])


if __name__ == "__main__":
    main()
