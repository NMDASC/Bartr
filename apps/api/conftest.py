"""Tests never touch a real database or the network.

`app/deps.py` loads the repo root `.env` so that setting `MONGODB_URI` there
actually reaches the API. That would otherwise point the suite at whatever
cluster the developer has configured, which makes tests slow, order dependent
and unrunnable on a plane. Forcing the variables here wins, because `load_env`
uses `setdefault` and pytest imports conftest before any test module.
"""

import os

os.environ["MONGODB_URI"] = ""  # empty selects MemoryStore in app/deps.py
os.environ["STATE_FILE"] = ""  # no snapshot file
for _k in ("XAI_API_KEY", "IFM_API_KEY", "QUERIT_API_KEY", "GOOGLE_PLACES_API_KEY"):
    os.environ[_k] = ""  # tests fake the model; never bill or wait on the network
os.environ.setdefault("DEMO_AUTH", "1")
os.environ.setdefault("SEED", "0")
os.environ.setdefault("BOTS", "0")
