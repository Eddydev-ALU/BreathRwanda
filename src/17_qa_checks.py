"""Step 17: automated QA of the exported website data (guide sections 7.5 and 11).

Exits non-zero if any check fails.
"""
import json
import sys

import pandas as pd

from common import OUTPUTS, ROOT

SITE = ROOT / "website" / "data"


def main():
    d = pd.DataFrame(json.loads((SITE / "districts.json").read_text()))
    geo = json.loads((SITE / "districts.geojson").read_text())
    census = pd.read_csv(OUTPUTS / "census" / "district_population.csv")
    nat = json.loads((OUTPUTS / "district" / "national_checks.json").read_text())
    a = json.loads((SITE / "assumptions.json").read_text())
    checks = {
        "every stove assumption has a source": all(st.get(k) for st in a["stoves"]
                                                   for k in ["costSource", "usageSource", "effectSource"]),
        "30 districts": len(d) == 30 and d.code.is_unique,
        "codes match boundary file": set(d.code) == {f["properties"]["district_code"] for f in geo["features"]},
        "names match boundary file": set(d.name) == {f["properties"]["district_name"] for f in geo["features"]},
        "children <5 total = Census": abs(d.childrenU5.sum() - census.children_u5.sum()) < 30,
        "population total = Census (~13.2M)": abs(d.population.sum() - 13_245_753) < 30,
        "shares within [0,1]": all(d[c].between(0, 1).all() for c in ["exposureShare", "indoorSmokeShare", "risk", "riskExposed"]),
        "indoor <= exposure": (d.indoorSmokeShare <= d.exposureShare + 1e-9).all(),
        "risk interval contains estimate": ((d.riskLo <= d.risk) & (d.risk <= d.riskHi)).all(),
        "exposure interval contains estimate": ((d.exposureShareLo <= d.exposureShare + 1e-9) & (d.exposureShare <= d.exposureShareHi + 1e-9)).all(),
        "priority ranks 1..30": sorted(d.priorityRank) == list(range(1, 31)),
        "rank interval contains rank": ((d.priorityRankLo <= d.priorityRank) & (d.priorityRank <= d.priorityRankHi)).all(),
        "childrenExposed = C_d x E_d": ((d.childrenExposed - d.childrenU5 * d.exposureShare).abs() < 5).all(),
        "polluting HH <= households": (d.pollutingHH <= d.households).all(),
        "national predicted risk within 1pp of DHS 2025": abs(nat["eicv7_mean_predicted_risk_pct"] - nat["dhs2025_observed_pct"]) < 1,
        "site data < 1 MB": sum(p.stat().st_size for p in SITE.iterdir()) < 1_000_000,
        "no row-level files in website/data": all(p.suffix in {".json", ".geojson", ".csv"} for p in SITE.iterdir())
        and len(pd.read_csv(SITE / "ranking_default.csv")) == 30,
    }
    for k, v in checks.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    sys.exit(0 if all(checks.values()) else 1)


if __name__ == "__main__":
    main()
