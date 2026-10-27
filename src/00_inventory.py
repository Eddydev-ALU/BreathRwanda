"""Step 0: inventory every raw file (metadata only) and dump variable dictionaries.

Outputs (metadata only, no row-level data):
  outputs/inventory.csv
  docs/variables/<key>.csv   variable name, label, value-label set
"""
from common import DOCS, FILES, OUTPUTS, meta
import pandas as pd

ID_CANDIDATES = ["hhid", "pid", "clust", "cluster", "v001", "v002", "v003", "hv001",
                 "hv002", "hvidx", "caseid", "hhid_hr", "province", "district"]


def main():
    (DOCS / "variables").mkdir(parents=True, exist_ok=True)
    OUTPUTS.mkdir(exist_ok=True)
    rows = []
    for key, path in FILES.items():
        m = meta(key)
        cols = list(m.column_names)
        rows.append({
            "key": key, "file": path.name, "format": "Stata .dta",
            "size_mb": round(path.stat().st_size / 1e6, 1),
            "rows": m.number_rows, "cols": m.number_columns,
            "id_vars_present": ", ".join(c for c in cols if c.lower() in ID_CANDIDATES),
        })
        pd.DataFrame({
            "variable": cols,
            "label": [m.column_names_to_labels.get(c) for c in cols],
            "value_label_set": [m.variable_to_label.get(c, "") for c in cols],
        }).to_csv(DOCS / "variables" / f"{key}.csv", index=False)
    inv = pd.DataFrame(rows)
    inv.to_csv(OUTPUTS / "inventory.csv", index=False)
    print(inv.to_string(index=False))


if __name__ == "__main__":
    main()
