"""Step 6: one aggregate table per district combining Census, EICV7 and DHS sample sizes.

Requires steps 1-3 to have run. Output: outputs/district_overview.csv
"""
import pandas as pd

from common import OUTPUTS, REFERENCE


def main():
    lk = pd.read_csv(REFERENCE / "district_lookup.csv")
    c = pd.read_csv(OUTPUTS / "census" / "district_population.csv")
    e = pd.read_csv(OUTPUTS / "eicv7" / "district_summary.csv")
    d25 = pd.read_csv(OUTPUTS / "dhs" / "2025" / "district_sample_sizes.csv")
    d19 = pd.read_csv(OUTPUTS / "dhs" / "2019" / "district_sample_sizes.csv")
    t = (lk[["district_code", "district_name", "province_name"]]
         .merge(c[["district", "population", "children_u5", "households", "pct_hh_polluting", "pct_hh_saving_stove"]]
                .rename(columns={"district": "district_code", "pct_hh_polluting": "census_pct_hh_polluting",
                                 "pct_hh_saving_stove": "census_pct_hh_saving_stove"}), on="district_code")
         .merge(e[["district", "n_households", "n_clusters", "n_children_u5_sample", "pct_u5_polluting_w",
                   "pct_u5_cook_in_dwelling_w"]].rename(columns={"district": "district_code",
                   "n_households": "eicv7_hh", "n_clusters": "eicv7_clusters", "n_children_u5_sample": "eicv7_u5"}),
                on="district_code")
         .merge(d25.rename(columns={"sdistrict": "district_code", "n_children": "dhs25_u5", "n_ari": "dhs25_ari",
                                    "n_clusters": "dhs25_clusters"}), on="district_code")
         .merge(d19.rename(columns={"sdistrict": "district_code", "n_children": "dhs19_u5", "n_ari": "dhs19_ari",
                                    "n_clusters": "dhs19_clusters"}), on="district_code"))
    t.to_csv(OUTPUTS / "district_overview.csv", index=False)
    print(len(t), "districts")
    print(t.to_markdown(index=False, floatfmt=",.1f"))


if __name__ == "__main__":
    main()
