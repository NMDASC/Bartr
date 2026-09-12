"""Discovery pipeline. Owner: Zhiyuan.

Expected modules: querit.py, places.py, extract.py, valuation.py

Cross-pair contract (Plan.md section 10): valuation.py exposes

    def value(profile: CompanyProfile) -> Belief   # {v0, sigma}

Aditya's mm.py consumes that as the market maker's prior. Do not change its
shape without a docs/DECISIONS.md entry.
"""
