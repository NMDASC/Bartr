from app.services.discovery.intent import parse_intent
from app.services.discovery.querit import public_url
from app.services.discovery.ranking import rank_companies


def test_pittsburgh_intent():
    intent = parse_intent("laundromat in Pittsburgh under 700k")
    assert intent["category"] == "laundromat"
    assert intent["city"] == "Pittsburgh" and intent["state"] == "PA"
    assert intent["max_value"] == 700000.0


def test_rank_prefers_named_match():
    companies = [
        {"id": "co_bloomfield_coin", "name": "Bloomfield Coin Laundry", "category": "laundromat",
         "city": "Pittsburgh", "state": "PA", "description": "Unattended card laundry",
         "valuation": {"v0": 380000}, "evidence": [], "observables": {}},
        {"id": "co_squirrel_hill_wash", "name": "Squirrel Hill Wash and Fold", "category": "laundromat",
         "city": "Pittsburgh", "state": "PA", "description": "Attended wash and fold on Murray Avenue",
         "valuation": {"v0": 558000}, "evidence": [], "observables": {}},
    ]
    ranked = rank_companies("squirrel hill wash and fold", parse_intent("laundromat in Pittsburgh"), companies)
    assert ranked[0][0]["id"] == "co_squirrel_hill_wash"
    assert ranked[0][1]["score"] >= ranked[1][1]["score"]


def test_public_url_rejects_localhost():
    assert public_url("https://bizbuysell.com/listing")
    assert public_url("http://127.0.0.1/secret") is None
    assert public_url("https://localhost/x") is None
