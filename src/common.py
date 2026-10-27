"""Shared paths and helpers for the Clean Air, Healthy Children pipeline."""
from pathlib import Path

import numpy as np
import pandas as pd
import pyreadstat

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "data" / "raw"
PROCESSED = ROOT / "data" / "processed"
REFERENCE = ROOT / "data" / "reference"
OUTPUTS = ROOT / "outputs"
DOCS = ROOT / "docs"

FILES = {
    "eicv7_household": RAW / "eicv7" / "CS_S01_S5_S7_Household.dta",
    "eicv7_person": RAW / "eicv7" / "CS_S0_S1_S2_S3_S4_S6A_S6B_S6C_Person.dta",
    "eicv7_poverty": RAW / "eicv7" / "CS_EICV7_poverty_file.dta",
    "eicv7_services": RAW / "eicv7" / "CS_S5F_access_to_services.dta",
    "dhs2025_kr": RAW / "dhs2025" / "RWKR91FL.dta",
    "dhs2025_hr": RAW / "dhs2025" / "RWHR91FL.dta",
    "dhs2025_pr": RAW / "dhs2025" / "RWPR91FL.dta",
    "dhs2019_kr": RAW / "dhs2019" / "RWKR81FL.DTA",
    "dhs2019_hr": RAW / "dhs2019" / "RWHR81FL.DTA",
    "dhs2019_pr": RAW / "dhs2019" / "RWPR81FL.DTA",
    "census2022": RAW / "census2022" / "PHC5_Public_microdata.dta",
}


def _read_dta(key, **kw):
    # Older Stata files (e.g. DHS-8) are not UTF-8; fall back to latin-1.
    try:
        return pyreadstat.read_dta(FILES[key], **kw)
    except UnicodeDecodeError:
        return pyreadstat.read_dta(FILES[key], encoding="latin1", **kw)


def meta(key):
    """Read only the metadata (labels, row count) of a raw file."""
    return _read_dta(key, metadataonly=True)[1]


def read(key, cols=None):
    """Read raw codes (no categorical conversion) plus metadata."""
    return _read_dta(key, usecols=cols, apply_value_formats=False)


def value_labels(m, var):
    """Value-label dict for a variable, or {} if none."""
    lbl = m.variable_to_label.get(var)
    return m.value_labels.get(lbl, {}) if lbl else {}


def wshare(df, col, w):
    """Unweighted n, unweighted % and weighted % of each category of `col`."""
    g = df.groupby(col, dropna=False)
    out = pd.DataFrame({"n": g.size(), "w": g[w].sum()})
    out["pct_unw"] = 100 * out["n"] / out["n"].sum()
    out["pct_w"] = 100 * out["w"] / out["w"].sum()
    return out.drop(columns="w").round(1)


def wmean(x, w):
    m = x.notna() & w.notna()
    return float(np.average(x[m], weights=w[m]))
