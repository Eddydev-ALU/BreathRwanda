"""Shared harmonised categories for DHS (2019-20, 2025) and EICV7.

See docs/data_inventory.md section 8 for the evidence behind each mapping.
Wood and straw/shrubs/grass are merged because the two surveys split them inconsistently.
"""
import pandas as pd

FUEL_LEVELS = ["clean", "charcoal", "wood/straw/biomass"]
PLACE_LEVELS = ["outdoors", "separate building", "in the house"]
AGE_LEVELS = ["<1y", "1y", "2-4y"]
HHSIZE_LEVELS = ["1-3", "4-5", "6-7", "8+"]

# Anything not listed (kerosene, other, no cooking, missing) becomes NaN and is dropped.
EICV_FUEL = {1: "wood/straw/biomass", 13: "wood/straw/biomass", 8: "wood/straw/biomass",
             9: "wood/straw/biomass", 10: "wood/straw/biomass", 11: "wood/straw/biomass",
             12: "wood/straw/biomass", 2: "charcoal", 3: "clean", 4: "clean", 5: "clean", 6: "clean"}
DHS_FUEL = {
    "2025": {11: "wood/straw/biomass", 12: "wood/straw/biomass", 9: "wood/straw/biomass",
             13: "wood/straw/biomass", 14: "wood/straw/biomass", 15: "wood/straw/biomass",
             16: "wood/straw/biomass", 17: "wood/straw/biomass", 10: "charcoal",
             1: "clean", 2: "clean", 3: "clean", 4: "clean", 5: "clean", 6: "clean"},
    "2019": {8: "wood/straw/biomass", 9: "wood/straw/biomass", 6: "wood/straw/biomass",
             10: "wood/straw/biomass", 11: "wood/straw/biomass", 12: "wood/straw/biomass",
             13: "wood/straw/biomass", 7: "charcoal", 1: "clean", 2: "clean", 3: "clean", 4: "clean"},
}
# Veranda (EICV7 code 4) is open on two or more sides -> outdoors.
EICV_PLACE = {1: "in the house", 2: "in the house", 3: "separate building", 4: "outdoors", 5: "outdoors"}
DHS_PLACE = {1: "in the house", 2: "separate building", 3: "outdoors"}


def cat(s, levels):
    return pd.Categorical(s, categories=levels)


def age_group_months(m):
    return cat(pd.cut(m, [-1, 11, 23, 59], labels=AGE_LEVELS).astype(object), AGE_LEVELS)


def age_group_years(y):
    return cat(pd.cut(y, [-1, 0, 1, 4], labels=AGE_LEVELS).astype(object), AGE_LEVELS)


def hhsize_group(n):
    return cat(pd.cut(n, [0, 3, 5, 7, 999], labels=HHSIZE_LEVELS).astype(object), HHSIZE_LEVELS)
