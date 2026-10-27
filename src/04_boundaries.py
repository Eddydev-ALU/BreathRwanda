"""Step 4: download district boundaries (RBC ArcGIS service), build the district lookup
table, check the match with NISR codes and write a simplified GeoJSON for the website.

Outputs:
  data/reference/districts_rbc_full.geojson   full-resolution download (EPSG:4326)
  data/reference/district_lookup.csv          code, name, province
  site/data/districts.geojson                 simplified, code + name only
"""
import json
import sys

import geopandas as gpd
import pandas as pd
import requests

from common import REFERENCE, ROOT, meta, value_labels

SERVICES = [
    "https://gis.rbc.gov.rw/server/rest/services/Full_District_boundary_2022/MapServer/0",
    "https://gis.rema.gov.rw/server/rest/services/pollution/District/MapServer/0",
]
SIMPLIFY_DEG = 0.001   # ~110 m


def fetch_layer(url):
    info = requests.get(url, params={"f": "pjson"}, timeout=60).json()
    page = info.get("maxRecordCount", 1000)
    feats, offset = [], 0
    while True:
        r = requests.get(f"{url}/query", timeout=120, params={
            "where": "1=1", "outFields": "*", "outSR": 4326, "f": "geojson",
            "resultOffset": offset, "resultRecordCount": page, "returnGeometry": "true"})
        r.raise_for_status()
        batch = r.json().get("features", [])
        feats += batch
        if len(batch) < page:
            break
        offset += page
    return gpd.GeoDataFrame.from_features(feats, crs="EPSG:4326")


def norm(s):
    return str(s).strip().lower().replace(" ", "")


def main():
    REFERENCE.mkdir(parents=True, exist_ok=True)
    # Lookup from EICV7 value labels (same codes/names as Census ml02 and DHS sdistrict).
    m = meta("eicv7_poverty")
    dist, prov = value_labels(m, "district"), value_labels(meta("eicv7_household"), "province")
    lookup = pd.DataFrame({"district_code": list(dist), "district_name": list(dist.values())})
    lookup["province_code"] = lookup.district_code // 10
    lookup["province_name"] = lookup.province_code.map(prov)
    lookup.to_csv(REFERENCE / "district_lookup.csv", index=False)
    print(lookup.to_string(index=False))

    gdf, used = None, None
    for url in SERVICES:
        try:
            g = fetch_layer(url)
            print(f"\n{url}: {len(g)} features, CRS {g.crs}, fields {list(g.columns)}")
            if len(g) == 30:
                gdf, used = g, url
                break
        except Exception as e:  # noqa: BLE001
            print(f"{url} failed: {e}")
    if gdf is None:
        sys.exit("No service returned 30 districts")

    print("invalid geometries:", int((~gdf.is_valid).sum()), "| geometry types:", gdf.geom_type.value_counts().to_dict())
    print("bounds (lon/lat):", [round(x, 3) for x in gdf.total_bounds])
    gdf.to_file(REFERENCE / "districts_rbc_full.geojson", driver="GeoJSON")

    gdf["district_code"] = pd.to_numeric(gdf["district_id"], errors="coerce").astype("Int64")
    merged = lookup.merge(gdf[["district_code", "district", "province"]], on="district_code", how="outer", indicator=True)
    print("\ncode match:", merged["_merge"].value_counts().to_dict())
    merged["name_match"] = merged.district_name.map(norm) == merged.district.map(norm)
    bad = merged[(merged["_merge"] != "both") | ~merged.name_match]
    print("name mismatches:\n", bad[["district_code", "district_name", "district", "province"]].to_string(index=False)
          if len(bad) else "none")

    out = gdf[["district_code", "geometry"]].merge(lookup[["district_code", "district_name"]], on="district_code")
    out["geometry"] = out.geometry.make_valid().simplify(SIMPLIFY_DEG, preserve_topology=True)
    out["district_code"] = out.district_code.astype(int)
    site = ROOT / "site" / "data"
    site.mkdir(parents=True, exist_ok=True)
    path = site / "districts.geojson"
    # Round coordinates to 5 dp (~1 m) to keep the file small.
    gj = json.loads(out[["district_code", "district_name", "geometry"]].to_json(to_wgs84=True))
    def rnd(c):
        return [rnd(x) for x in c] if isinstance(c[0], list) else [round(c[0], 5), round(c[1], 5)]
    for f in gj["features"]:
        f["geometry"]["coordinates"] = rnd(f["geometry"]["coordinates"])
        f.pop("id", None)
    path.write_text(json.dumps(gj, separators=(",", ":")))
    print(f"\nsource used: {used}")
    print(f"full file: {(REFERENCE / 'districts_rbc_full.geojson').stat().st_size / 1e6:.2f} MB; "
          f"simplified: {path.stat().st_size / 1e3:.0f} KB, {len(out)} districts, all valid: {bool(out.is_valid.all())}")


if __name__ == "__main__":
    main()
