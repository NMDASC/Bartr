"""Initial pricing: a Bayesian ensemble of independent estimators in log space.

Why an ensemble and not "multiple x SDE":
  * For most businesses we will not find SDE. A single formula either fails or hides
    a guess inside a confident looking number.
  * Different evidence has different reliability. A listing with stated cash flow is
    worth far more than a review count. Precision weighting encodes that.
  * The spread between estimators is itself information. If four independent methods
    disagree by 2x, the posterior must be wide. We inflate sigma when they disagree.
  * The posterior (mu, sigma) is exactly what the rest of the system needs: the
    Treasury quotes from its quantiles, Kelly uses its sigma, the belief update in the
    market treats it as the prior.

Each estimator returns (mu, sigma) for ln(V) or None if it has nothing to say.
Combine with precision weights: mu = sum(mu_i / s_i^2) / sum(1 / s_i^2),
sigma^2 = 1 / sum(1 / s_i^2), then inflate sigma if the estimators disagree more than
their stated sigmas explain.

Sigmas below are priors. Role B calibrates them on scraped listings (see calibrate()).
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field

from . import benchmarks as bm

SIGMA_FLOOR = 0.12   # never claim better than +/-12%
SIGMA_CEIL = 0.90


@dataclass
class Observables:
    category: str = "default"
    state: str | None = None
    revenue: float | None = None          # annual, USD, from a source
    sde: float | None = None              # seller's discretionary earnings, from a source
    asking_price: float | None = None     # if the business is actually listed for sale
    employees: int | None = None
    rating: float | None = None           # 0..5
    review_count: int | None = None
    years_operating: int | None = None
    owner_operated: bool | None = None
    llm_estimate: float | None = None     # Grok's direct value opinion (with web_search), USD
    llm_confidence: float | None = None   # 0..1 self reported
    llm2_estimate: float | None = None    # K2 second opinion, USD
    machines: int | None = None           # laundromat specific: washers + dryers
    sources: list[str] = field(default_factory=list)


@dataclass
class Estimate:
    name: str
    mu: float
    sigma: float
    note: str

    @property
    def value(self) -> float:
        return math.exp(self.mu)


@dataclass
class Valuation:
    v0: float                 # posterior median, USD
    sigma: float              # posterior log sigma
    low: float                # 20th percentile
    high: float               # 80th percentile
    estimates: list[Estimate]
    disagreement: float       # sample std of estimator mus, for display
    method: str

    def quantile(self, q: float) -> float:
        return math.exp(self.mu + self.sigma * _z(q))

    @property
    def mu(self) -> float:
        return math.log(self.v0)


def _z(q: float) -> float:
    """Inverse normal CDF, Acklam approximation (stdlib only)."""
    a = [-3.969683028665376e+01, 2.209460984245205e+02, -2.759285104469687e+02,
         1.383577518672690e+02, -3.066479806614716e+01, 2.506628277459239e+00]
    b = [-5.447609879822406e+01, 1.615858368580409e+02, -1.556989798598866e+02,
         6.680131188771972e+01, -1.328068155288572e+01]
    c = [-7.784894002430293e-03, -3.223964580411365e-01, -2.400758277161838e+00,
         -2.549732539343734e+00, 4.374664141464968e+00, 2.938163982698783e+00]
    d = [7.784695709041462e-03, 3.224671290700398e-01, 2.445134137142996e+00,
         3.754408661907416e+00]
    plow, phigh = 0.02425, 1 - 0.02425
    if q < plow:
        t = math.sqrt(-2 * math.log(q))
        return (((((c[0]*t+c[1])*t+c[2])*t+c[3])*t+c[4])*t+c[5]) / ((((d[0]*t+d[1])*t+d[2])*t+d[3])*t+1)
    if q > phigh:
        t = math.sqrt(-2 * math.log(1 - q))
        return -(((((c[0]*t+c[1])*t+c[2])*t+c[3])*t+c[4])*t+c[5]) / ((((d[0]*t+d[1])*t+d[2])*t+d[3])*t+1)
    t = q - 0.5
    r = t * t
    return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*t / (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1)


# ---------- quality adjustment shared by income and base rate estimators ----------

def _quality_multiplier(o: Observables) -> tuple[float, str]:
    """Multiplicative nudge on value from soft signals. Small on purpose."""
    m, notes = 1.0, []
    if o.rating is not None and o.review_count:
        if o.rating >= 4.5 and o.review_count >= 100:
            m *= 1.10; notes.append("strong reviews +10%")
        elif o.rating < 3.5 and o.review_count >= 30:
            m *= 0.90; notes.append("weak reviews -10%")
    if o.owner_operated:
        m *= 0.92; notes.append("owner operated -8%")
    if o.years_operating is not None:
        if o.years_operating >= 15:
            m *= 1.05; notes.append("15+ years +5%")
        elif o.years_operating < 3:
            m *= 0.90; notes.append("under 3 years -10%")
    return m, ", ".join(notes)


# ---------- estimators ----------

def est_income(o: Observables) -> Estimate | None:
    """multiple x SDE, the broker method. Sold basis (asking multiple x haircut)."""
    mult, _, _, margin, _ = bm.get(o.category)
    q, qn = _quality_multiplier(o)
    if o.sde:
        v = mult * bm.ASK_TO_SOLD * o.sde * q
        return Estimate("income", math.log(v), 0.25, f"{mult}x asking multiple x {bm.ASK_TO_SOLD} sold haircut x SDE {o.sde:,.0f}; {qn}")
    if o.revenue:
        sde = o.revenue * margin
        v = mult * bm.ASK_TO_SOLD * sde * q
        return Estimate("income", math.log(v), 0.40, f"SDE from revenue {o.revenue:,.0f} x {margin:.0%} margin, then {mult}x x haircut; {qn}")
    return None


def est_listing(o: Observables) -> Estimate | None:
    """If the business is actually listed, asking price is the strongest single signal."""
    if o.asking_price:
        return Estimate("listing", math.log(o.asking_price * bm.ASK_TO_SOLD), 0.15, f"asking {o.asking_price:,.0f} x {bm.ASK_TO_SOLD} sold haircut")
    return None


def est_base_rate(o: Observables) -> Estimate | None:
    """Category median sold price in this state. The shrinkage anchor when we know little."""
    _, med_ask, _, _, _ = bm.get(o.category)
    q, qn = _quality_multiplier(o)
    v = med_ask * bm.ASK_TO_SOLD * bm.state_index(o.state) * q
    return Estimate("base_rate", math.log(v), 0.70, f"category median asking {med_ask:,.0f} x haircut x state index {bm.state_index(o.state):.2f}; {qn}")


def est_proxy(o: Observables) -> Estimate | None:
    """Revenue from observables when no financials exist. Wide sigma by construction.
    Skipped entirely when revenue or SDE is known: a fallback must not dilute real data."""
    if o.revenue or o.sde:
        return None
    mult, _, _, margin, rev_per_emp = bm.get(o.category)
    parts, notes = [], []
    if o.employees:
        parts.append(o.employees * rev_per_emp); notes.append(f"{o.employees} employees x {rev_per_emp:,.0f}")
    if o.category == "laundromat" and o.machines:
        parts.append(o.machines * 5_500); notes.append(f"{o.machines} machines x 5,500")
    if o.review_count and not parts:
        # reviews accumulate roughly with foot traffic; crude: ~$2,500 of annual revenue per review, clamped
        parts.append(min(max(o.review_count * 2_500.0, 80_000), 3_000_000)); notes.append(f"{o.review_count} reviews x 2,500")
    if not parts:
        return None
    rev = sum(parts) / len(parts)
    v = mult * bm.ASK_TO_SOLD * rev * margin
    return Estimate("proxy", math.log(v), 0.60, "revenue proxy from " + " / ".join(notes))


def est_llm(o: Observables) -> Estimate | None:
    """Grok's direct opinion (with web search), optionally averaged with K2."""
    vals = [v for v in (o.llm_estimate, o.llm2_estimate) if v]
    if not vals:
        return None
    mu = sum(math.log(v) for v in vals) / len(vals)
    conf = o.llm_confidence if o.llm_confidence is not None else 0.5
    sigma = 0.35 + 0.35 * (1 - conf)
    if len(vals) == 2:
        gap = abs(math.log(vals[0]) - math.log(vals[1]))
        sigma = max(sigma, gap / 2)  # two models disagreeing widens it
    return Estimate("llm", mu, sigma, f"model opinion(s) {', '.join(f'{v:,.0f}' for v in vals)}, conf {conf:.2f}")


ESTIMATORS = (est_listing, est_income, est_proxy, est_llm, est_base_rate)


def value(o: Observables) -> Valuation:
    ests = [e for e in (f(o) for f in ESTIMATORS) if e is not None]
    if not ests:
        raise ValueError("no estimator could run")
    prec = [1 / e.sigma ** 2 for e in ests]
    mu = sum(p * e.mu for p, e in zip(prec, ests)) / sum(prec)
    sigma = math.sqrt(1 / sum(prec))
    # disagreement inflation: weighted std of estimator means around the posterior
    if len(ests) > 1:
        wvar = sum(p * (e.mu - mu) ** 2 for p, e in zip(prec, ests)) / sum(prec)
        disagreement = math.sqrt(wvar)
        sigma = math.sqrt(sigma ** 2 + disagreement ** 2)
    else:
        disagreement = 0.0
    sigma = min(max(sigma, SIGMA_FLOOR), SIGMA_CEIL)
    v0 = math.exp(mu)
    method = "+".join(e.name for e in ests)
    return Valuation(v0=v0, sigma=sigma,
                     low=math.exp(mu + sigma * _z(0.20)),
                     high=math.exp(mu + sigma * _z(0.80)),
                     estimates=ests, disagreement=disagreement, method=method)


def calibrate(cases: list[tuple[Observables, float]]) -> dict[str, float]:
    """Given (observables, actual asking price) pairs scraped from listings, measure each
    estimator's log error std with the listing estimator removed. Returns suggested sigmas.
    Role B runs this on Saturday morning against 30 to 60 scraped listings."""
    errs: dict[str, list[float]] = {}
    for o, price in cases:
        target = math.log(price * bm.ASK_TO_SOLD)
        o2 = Observables(**{**o.__dict__, "asking_price": None})
        for f in ESTIMATORS:
            e = f(o2)
            if e is not None:
                errs.setdefault(e.name, []).append(e.mu - target)
    out = {}
    for name, es in errs.items():
        m = sum(es) / len(es)
        out[name] = math.sqrt(sum((x - m) ** 2 for x in es) / max(len(es) - 1, 1))
    return out
