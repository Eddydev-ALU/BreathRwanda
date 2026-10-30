"""Step 17: automated QA of the exported website data (guide sections 7.5 and 11).

Covers: district completeness and codes, Census totals, value ranges, intervals, formulas,
consistency between site files, documented numbers vs data, sources for assumptions,
geometry validity, and guards against row-level data in the repository outputs.
Exits non-zero if any check fails.
"""
import json
import re
import sys

import geopandas as gpd
import nbformat
import pandas as pd

from common import DOCS, OUTPUTS, ROOT

SITE = ROOT / "website" / "data"
REQUIRED = ["code", "name", "province", "childrenU5", "households", "exposureShare", "exposureShareLo",
            "exposureShareHi", "indoorSmokeShare", "risk", "riskLo", "riskHi", "riskExposed", "pollutingHH",
            "childrenPerHH", "priorityScore", "priorityRank", "priorityRankLo", "priorityRankHi", "priorityTier",
            "sampleHouseholds", "sampleClusters", "sampleChildren", "lowConfidence", "whyFactors"]
ID_COLUMNS = {"hhid", "pid", "caseid", "v001", "hv001", "clust", "cluster"}


def row_level_files():
    """CSV outputs that look row-level: identifier columns or more rows than districts x bootstrap rounds."""
    bad = []
    for p in list(OUTPUTS.rglob("*.csv")) + list(OUTPUTS.rglob("*.csv.gz")) + list(SITE.glob("*.csv")):
        df = pd.read_csv(p)
        if ID_COLUMNS & {c.lower() for c in df.columns} or len(df) > 30 * 500:
            bad.append(str(p.relative_to(ROOT)))
    return bad


def notebook_tables_small():
    """No notebook output table longer than 30 rows (districts are the finest level shown)."""
    for p in (ROOT / "notebooks").glob("*.ipynb"):
        for c in nbformat.read(p, 4).cells:
            for o in c.get("outputs", []):
                if o.get("data", {}).get("text/html", "").count("<tr>") - 1 > 30:
                    return False
    return True


def numbers_in_docs(nat):
    """Key national figures quoted in the methods document must equal the pipeline outputs."""
    text = (DOCS / "methods_and_results.md").read_text()
    keys = ["census_children_u5", "national_children_exposed", "national_children_indoor_smoke",
            "national_children_with_symptoms", "national_polluting_hh"]
    missing = [k for k in keys if f"{nat[k]:,}" not in text]
    for k in missing:
        print(f"      docs do not quote {k} = {nat[k]:,}")
    return not missing


def main():
    d = pd.DataFrame(json.loads((SITE / "districts.json").read_text()))
    geo = json.loads((SITE / "districts.geojson").read_text())
    census = pd.read_csv(OUTPUTS / "census" / "district_population.csv")
    nat = json.loads((OUTPUTS / "district" / "national_checks.json").read_text())
    a = json.loads((SITE / "assumptions.json").read_text())
    rank = pd.read_csv(SITE / "ranking_default.csv")
    merged = rank.merge(d, left_on="district_code", right_on="code")
    bad_rows = row_level_files()
    def strict_json(path):
        try:
            json.loads(path.read_text(), parse_constant=lambda c: (_ for _ in ()).throw(ValueError(c)))
            return True
        except ValueError:
            return False

    checks = {
        "site JSON is strict (no NaN/Infinity)": all(strict_json(p) for p in SITE.glob("*.json*")),
        "every stove assumption has a source": all(st.get(k) for st in a["stoves"]
                                                   for k in ["costSource", "usageSource", "effectSource"]),
        "assumptions identical in data/reference and website/data":
            (ROOT / "data" / "reference" / "assumptions.json").read_text() == (SITE / "assumptions.json").read_text(),
        "30 districts": len(d) == 30 and d.code.is_unique,
        "required fields present and non-null": all(c in d and d[c].notna().all() for c in REQUIRED),
        "codes match boundary file": set(d.code) == {f["properties"]["district_code"] for f in geo["features"]},
        "names match boundary file": set(d.name) == {f["properties"]["district_name"] for f in geo["features"]},
        "boundary geometries valid": bool(gpd.read_file(SITE / "districts.geojson").is_valid.all()),
        "children <5 total = Census": abs(d.childrenU5.sum() - census.children_u5.sum()) < 30,
        "population total = Census (~13.2M)": abs(d.population.sum() - 13_245_753) < 30,
        "shares within [0,1]": all(d[c].between(0, 1).all() for c in ["exposureShare", "indoorSmokeShare", "risk", "riskExposed"]),
        "indoor <= exposure": (d.indoorSmokeShare <= d.exposureShare + 1e-9).all(),
        "risk interval contains estimate": ((d.riskLo <= d.risk) & (d.risk <= d.riskHi)).all(),
        "exposure interval contains estimate": ((d.exposureShareLo <= d.exposureShare + 1e-9) & (d.exposureShare <= d.exposureShareHi + 1e-9)).all(),
        "exposure intervals not stuck at a boundary": (d.exposureShareHi > d.exposureShareLo).all(),
        "priority ranks 1..30": sorted(d.priorityRank) == list(range(1, 31)),
        "rank interval contains rank": ((d.priorityRankLo <= d.priorityRank) & (d.priorityRank <= d.priorityRankHi)).all(),
        "childrenExposed = C_d x E_d": ((d.childrenExposed - d.childrenU5 * d.exposureShare).abs() < 5).all(),
        "polluting HH <= households": (d.pollutingHH <= d.households).all(),
        "ranking CSV agrees with districts.json": len(merged) == 30
            and (merged.priority_rank == merged.priorityRank).all()
            and (merged.district_name == merged.name).all()
            and ((merged.children_u5 - merged.childrenU5).abs() < 1).all(),
        "national predicted risk within 1pp of DHS 2025": abs(nat["eicv7_mean_predicted_risk_pct"] - nat["dhs2025_observed_pct"]) < 1,
        "national figures in methods doc match outputs": numbers_in_docs(nat),
        "site data < 1 MB": sum(p.stat().st_size for p in SITE.iterdir()) < 1_000_000,
        "only JSON/GeoJSON/CSV in website/data": all(p.suffix in {".json", ".geojson", ".csv"} for p in SITE.iterdir()),
        "no row-level CSV in outputs/ or website/data": not bad_rows,
        "notebook output tables are aggregate (<= 30 rows)": notebook_tables_small(),
    }
    if bad_rows:
        print("      row-level looking files:", bad_rows)
    for k, v in checks.items():
        print(f"{'PASS' if v else 'FAIL'}  {k}")
    sys.exit(0 if all(checks.values()) else 1)


if __name__ == "__main__":
    main()
