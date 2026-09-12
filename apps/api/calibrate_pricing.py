"""Fit a category-specific sale-basis profile and report untouched holdout metrics.

Run from apps/api: uv run python calibrate_pricing.py cases.json --version v1 --output profile.json
Input rows: {company_id, split: train|test, sale_price, observables: {...}}.
Training/test assignment is explicit so duplicate companies cannot leak across splits.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
from statistics import median

from app.services.discovery.benchmark_catalog import CATALOG
from app.services.discovery.models import CalibrationProfile
from app.services.discovery.valuation import Observables, fit_calibration, value


def blinded(raw: dict) -> Observables:
    return Observables(**{**raw, "asking_price": None, "llm_estimate": None, "llm2_estimate": None})


def build_profile(rows: list[dict], version: str) -> dict:
    seen, categories = set(), set()
    splits: dict[str, list] = {"train": [], "test": []}
    for row in rows:
        cid = row["company_id"]
        if not isinstance(cid, str) or not cid.strip() or cid in seen:
            raise ValueError("Each business must have a unique nonempty company_id across both splits")
        seen.add(cid)
        if row["split"] not in splits:
            raise ValueError("split must be train or test")
        actual = row["sale_price"]
        if isinstance(actual, bool) or not math.isfinite(actual) or actual <= 0:
            raise ValueError("sale_price must be finite and positive")
        obs = blinded(row["observables"])
        categories.add(obs.category)
        splits[row["split"]].append((obs, actual))
    if len(categories) != 1:
        raise ValueError("Fit one category per profile")
    if len(splits["train"]) < 2 or not splits["test"]:
        raise ValueError("At least two training businesses and one held-out business are required")
    category = next(iter(categories))
    benchmark = CATALOG.get(category)
    fitted = fit_calibration(splits["train"], version=version, target="sale", benchmark=benchmark)
    profile = CalibrationProfile.model_validate({**fitted, "category": category}).model_dump()

    def metrics(calibration):
        predictions = [(value(obs, benchmark=benchmark, calibration=calibration), actual) for obs, actual in splits["test"]]
        return {
            "count": len(predictions),
            "median_absolute_percentage_error": median(abs(v.v0 / actual - 1) for v, actual in predictions),
            "log_rmse": math.sqrt(sum(math.log(v.v0 / actual) ** 2 for v, actual in predictions) / len(predictions)),
            "p20_p80_coverage": sum(v.low <= actual <= v.high for v, actual in predictions) / len(predictions),
        }

    return {**profile, "evaluation": {"uncalibrated": metrics(None), "calibrated": metrics(profile["estimators"]),
            "training_count": len(splits["train"]), "note": "Holdout metrics, not a deployment approval. P20-P80 nominal coverage is 0.60. Review sample size, source leakage, category and deal scope before activation."}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("cases", type=Path)
    parser.add_argument("--version", required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    profile = build_profile(json.loads(args.cases.read_text()), args.version)
    # Do not overwrite a versioned profile that may already back market snapshots.
    with args.output.open("x") as out:
        json.dump(profile, out, indent=2, allow_nan=False)
        out.write("\n")
    print(json.dumps(profile["evaluation"], indent=2))


if __name__ == "__main__":
    main()
