"""Step 11: clean EICV7 tables for prediction and district aggregation.

Outputs (row-level, git-ignored):
  data/processed/eicv7_children.parquet    one row per child under 5 with harmonised predictors
  data/processed/eicv7_households.parquet  one row per household (fuel, place, weight, n_u5)
Aggregate log: outputs/cleaning_log_eicv7.csv
"""
import pandas as pd

from common import OUTPUTS, PROCESSED, read
from harmonise import EICV_FUEL, EICV_PLACE, FUEL_LEVELS, PLACE_LEVELS, age_group_years, cat, hhsize_group


def main():
    PROCESSED.mkdir(parents=True, exist_ok=True)
    h, _ = read("eicv7_household", ["hhid", "clust", "strata_id", "district", "province", "s5cq21",
                                     "s5cq22a", "s5cq23", "weight"])
    p, _ = read("eicv7_poverty", ["hhid", "ur", "member", "quintile", "poverty"])
    per, _ = read("eicv7_person", ["hhid", "pid", "s1q1", "s1q3y"])
    log = [("households", len(h)), ("persons", len(per))]

    hh = h.merge(p, on="hhid", validate="1:1")
    hh["n_u5"] = hh.hhid.map(per[per.s1q3y.between(0, 4)].groupby("hhid").size()).fillna(0).astype(int)
    households = pd.DataFrame({
        "hhid": hh.hhid, "cluster": hh.clust.astype(int), "strata": hh.strata_id.astype(int),
        "district": hh.district.astype(int), "province": hh.province.astype(int), "w": hh.weight,
        "n_u5": hh.n_u5, "member": hh.member, "urban": (hh.ur == 1).astype(int),
        "wealth_q": hh.quintile.astype(int), "poor": hh.poverty.isin([1, 2]).astype(int),
        "fuel": cat(hh.s5cq22a.map(EICV_FUEL), FUEL_LEVELS),
        "place": cat(hh.s5cq23.map(EICV_PLACE), PLACE_LEVELS),
        "stove": hh.s5cq21,
    })
    households["polluting"] = households.fuel.isin(["charcoal", "wood/straw/biomass"]).astype(int)
    households["cooks_in_house"] = (households.place == "in the house").astype(int)
    households.to_parquet(PROCESSED / "eicv7_households.parquet", index=False)

    kids = per[per.s1q3y.between(0, 4)].merge(households, on="hhid", validate="m:1")
    log.append(("children under 5", len(kids)))
    c = pd.DataFrame({
        "hhid": kids.hhid, "pid": kids.pid, "cluster": kids.cluster, "strata": kids.strata,
        "district": kids.district, "province": kids.province, "w": kids.w,
        "urban": kids.urban, "wealth_q": kids.wealth_q, "poor": kids.poor,
        "sex_female": (kids.s1q1 == 2).astype(int),
        "age_group": age_group_years(kids.s1q3y),
        "hhsize": hhsize_group(kids.member),
        "fuel": kids.fuel, "place": kids.place, "polluting": kids.polluting,
        "cooks_in_house": kids.cooks_in_house, "survey": 2025,
    })
    c = c.dropna(subset=["fuel"])
    log.append(("children with harmonised fuel", len(c)))
    c = c.dropna(subset=["place"])
    log.append(("children with harmonised cooking place", len(c)))
    c.to_parquet(PROCESSED / "eicv7_children.parquet", index=False)

    log = pd.DataFrame(log, columns=["step", "records"])
    log.to_csv(OUTPUTS / "cleaning_log_eicv7.csv", index=False)
    print(log.to_string(index=False))
    print(f"weighted children: {c.w.sum():,.0f}; polluting share {100 * (c.w * c.polluting).sum() / c.w.sum():.1f}%; "
          f"cook in house {100 * (c.w * c.cooks_in_house).sum() / c.w.sum():.1f}%")
    print("households with missing fuel/place:", int(households.fuel.isna().sum()), int(households.place.isna().sum()))


if __name__ == "__main__":
    main()
