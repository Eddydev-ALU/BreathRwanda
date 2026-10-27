#!/usr/bin/env bash
# Rebuild every output from the raw survey files (see README for where to get them).
# Usage: ./run_pipeline.sh            (assumes .venv exists: uv venv --python 3.12 .venv && uv pip install -r requirements.txt)
set -euo pipefail
cd "$(dirname "$0")"
PY=.venv/bin/python
for step in 00_inventory 01_explore_eicv7 02_explore_dhs 03_census_districts 04_boundaries \
            05_harmonisation_check 06_district_overview 10_clean_dhs 11_clean_eicv7 12_descriptives \
            13_model 14_district_index 15_robustness 16_export_site_data 17_qa_checks; do
  echo "=== $step"
  (cd src && ../$PY "$step.py")
done
