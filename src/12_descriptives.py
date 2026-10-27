"""Step 12: weighted symptom rates by household characteristics (guide section 6.2).

Both outcomes (cough_fast = main, ari = strict sensitivity), pooled DHS 2019-20 + 2025
and per survey, with design-based 95% CIs.

Outputs: outputs/descriptives/rates_<outcome>.csv, outputs/figures/rates_<outcome>.png
"""
import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

from common import OUTPUTS, PROCESSED  # noqa: E402
from survey_stats import weighted_mean_ci  # noqa: E402

OUTCOMES = {"cough_fast": "Cough with short, rapid breathing (last 2 weeks)",
            "ari": "ARI symptoms: cough + rapid breathing + chest problem"}
PROVINCES = {1: "Kigali City", 2: "Southern", 3: "Western", 4: "Northern", 5: "Eastern"}
WEALTH = {1: "Poorest", 2: "Poorer", 3: "Middle", 4: "Richer", 5: "Richest"}

# Chart tokens (dataviz reference palette, light mode; single series -> one hue, no legend)
INK, INK2, MUTED, GRID, SURFACE, SERIES = "#0b0b0b", "#52514e", "#8a8984", "#e6e5e1", "#fcfcfb", "#2a78d6"


def groupings(df):
    combo = pd.Series("Clean fuel", index=df.index)
    combo[(df.polluting == 1) & (df.place != "in the house")] = "Polluting fuel, cooked outside the house"
    combo[(df.polluting == 1) & (df.place == "in the house")] = "Polluting fuel, cooked in the house"
    return {
        "Cooking fuel": df.fuel.astype(str).str.replace("wood/straw/biomass", "Wood, straw or other biomass")
                          .str.replace("charcoal", "Charcoal").str.replace("clean", "Clean (gas, electricity, biogas)"),
        "Where food is cooked": df.place.astype(str).str.capitalize(),
        "Fuel and cooking place": combo,
        "Wealth quintile": df.wealth_q.map(WEALTH),
        "Residence": df.urban.map({1: "Urban", 0: "Rural"}),
        "Province": df.province.map(PROVINCES),
        "Child age": df.age_group.astype(str).map({"<1y": "Under 1 year", "1y": "1 year", "2-4y": "2-4 years"}),
        "Survey": df.survey.map({2019: "DHS 2019-20", 2025: "DHS 2025"}),
    }


ORDER = {"Wealth quintile": list(WEALTH.values()), "Province": list(PROVINCES.values()),
         "Child age": ["Under 1 year", "1 year", "2-4 years"]}


def rate_table(df, outcome, scope):
    rows = [dict(scope=scope, variable="All children", category="All children",
                 **weighted_mean_ci(df, outcome))]
    for var, s in groupings(df).items():
        cats = ORDER.get(var, sorted(s.dropna().unique()))
        for c in cats:
            rows.append(dict(scope=scope, variable=var, category=c, **weighted_mean_ci(df, outcome, domain=s == c)))
    t = pd.DataFrame(rows)
    for c in ["mean", "se", "lo", "hi"]:
        t[c] = (100 * t[c]).round(2)
    return t.rename(columns={"mean": "pct", "lo": "ci_lo", "hi": "ci_hi"})


def plot(t, outcome, path):
    t = t[(t.scope == "pooled") & (t.variable != "Survey")].reset_index(drop=True)
    labels, ys, y, heads = [], [], 0, []
    for var, g in t.groupby("variable", sort=False):
        if var != "All children":
            heads.append((y, var))
            y += 1
        for _, r in g.iterrows():
            labels.append(r)
            ys.append(y)
            y += 1
        y += 0.4
    fig, ax = plt.subplots(figsize=(8, 0.28 * y + 1.2), dpi=150)
    fig.patch.set_facecolor(SURFACE)
    ax.set_facecolor(SURFACE)
    overall = t.loc[t.variable == "All children", "pct"].iloc[0]
    ax.axvline(overall, color=MUTED, lw=1, ls=(0, (3, 3)), zorder=1)
    for r, yy in zip(labels, ys):
        ax.plot([r.ci_lo, r.ci_hi], [yy, yy], color=SERIES, lw=2, solid_capstyle="round", zorder=2)
        ax.scatter([r.pct], [yy], s=40, color=SERIES, edgecolor=SURFACE, linewidth=1.5, zorder=3)
        ax.text(r.ci_hi + 0.15, yy, f"{r.pct:.1f}%  (n={r.n:,})", va="center", fontsize=7, color=INK2,
                bbox=dict(facecolor=SURFACE, edgecolor="none", pad=0.5))
    ax.set_yticks(ys, [r.category for r in labels], fontsize=8, color=INK)
    for yy, var in heads:
        ax.text(-0.01, yy, var, transform=ax.get_yaxis_transform(), ha="right", va="center",
                fontsize=8.5, fontweight="bold", color=INK)
    ax.invert_yaxis()
    ax.tick_params(axis="y", length=0, pad=4)
    ax.tick_params(axis="x", colors=INK2, labelsize=8)
    ax.xaxis.grid(True, color=GRID, lw=0.8)
    ax.set_axisbelow(True)
    for s in ax.spines.values():
        s.set_visible(False)
    ax.set_xlim(0, t.ci_hi.max() * 1.35)
    ax.set_xlabel("% of children under 5 (weighted), with 95% confidence interval", fontsize=8, color=INK2)
    fig.suptitle(OUTCOMES[outcome], fontsize=11, color=INK, x=0.02, ha="left")
    ax.set_title("Rwanda DHS 2019-20 and 2025 pooled. Dashed line = all children.", fontsize=8,
                 color=INK2, loc="left")
    fig.tight_layout()
    fig.savefig(path, facecolor=SURFACE)
    plt.close(fig)


def main():
    (OUTPUTS / "descriptives").mkdir(parents=True, exist_ok=True)
    (OUTPUTS / "figures").mkdir(parents=True, exist_ok=True)
    df = pd.read_parquet(PROCESSED / "dhs_children.parquet")
    for outcome in OUTCOMES:
        t = pd.concat([rate_table(df, outcome, "pooled")] +
                      [rate_table(df[df.survey == y], outcome, str(y)) for y in (2019, 2025)])
        t.to_csv(OUTPUTS / "descriptives" / f"rates_{outcome}.csv", index=False)
        plot(t, outcome, OUTPUTS / "figures" / f"rates_{outcome}.png")
        print(f"\n=== {outcome}")
        print(t[t.scope == "pooled"][["variable", "category", "n", "n_events", "pct", "ci_lo", "ci_hi"]]
              .to_string(index=False))


if __name__ == "__main__":
    main()
