"""Design-based estimates for complex surveys (Taylor linearisation, clusters within strata)."""
import numpy as np
import pandas as pd


def weighted_mean_ci(df, y, w="w", cluster="cluster", strata="strata", domain=None, z=1.96):
    """Weighted mean of `y` (optionally within a boolean `domain` mask) with a
    design-based SE: linearised residuals summed by PSU, variance between PSUs within strata."""
    d = pd.Series(True, index=df.index) if domain is None else domain.astype(bool)
    wd = df[w] * d
    tot = wd.sum()
    if tot == 0:
        return dict(mean=np.nan, se=np.nan, lo=np.nan, hi=np.nan, n=0, n_events=0)
    mean = (wd * df[y]).sum() / tot
    resid = wd * (df[y] - mean) / tot
    psu = pd.DataFrame({"s": df[strata], "c": df[cluster], "r": resid}).groupby(["s", "c"])["r"].sum()
    var = 0.0
    for _, g in psu.groupby(level=0):
        n_h = len(g)
        if n_h > 1:
            var += n_h / (n_h - 1) * ((g - g.mean()) ** 2).sum()
    se = np.sqrt(var)
    return dict(mean=mean, se=se, lo=max(mean - z * se, 0), hi=mean + z * se,
                n=int(d.sum()), n_events=int((df[y] * d).sum()))
