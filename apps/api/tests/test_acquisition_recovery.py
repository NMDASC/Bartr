"""Recovery and edit preservation for acquisition jobs, with no external calls."""
import asyncio
from copy import deepcopy

import pytest
from fastapi import HTTPException

from app.routers import acquire
from app.services.agents import acquire_agent, grok
from app.services.market.engine import Engine
from app.store import MemoryStore


CID, UID = "co_recovery", "recovery-buyer"


@pytest.fixture
def workspace(monkeypatch, tmp_path):
    store = MemoryStore(str(tmp_path / "acquisition-state.json"))
    Engine(store).create_company({"id": CID, "name": "Recovery Laundry", "category": "laundromat",
                                 "city": "Recovery City", "state": "PA", "sde": 140000})
    monkeypatch.setattr(acquire, "store", store)
    monkeypatch.setattr(acquire, "CHECKLISTS", {})
    monkeypatch.setattr(acquire, "_start_locks", {})
    monkeypatch.setattr(acquire, "_research_tasks", set())
    monkeypatch.setattr(acquire, "_research_jobs", {})

    async def template_loi(*args):
        return None

    monkeypatch.setattr(acquire_agent, "loi", template_loi)
    return store


def persisted_draft(store, *, status="researching"):
    result = {"acquisition_id": "acq_recovery", "market_id": CID, "status": "draft",
              "loi_md": "# My personally edited letter", "loi_source": "template",
              "checklist": [{"item": "My specific requirement", "why": "Buyer priority", "citation": None, "done": True}],
              "checklist_source": "template", "checklist_status": status}
    store.put_draft(UID, CID, result)
    store.save()
    return result


@pytest.mark.parametrize("started", [False, True])
def test_cancelled_research_persists_unavailable_even_before_first_execution(workspace, monkeypatch, started):
    async def scenario():
        entered = asyncio.Event()

        async def blocked(*args):
            entered.set()
            await asyncio.Event().wait()

        monkeypatch.setattr(acquire_agent, "checklist", blocked)
        initial = await acquire.start(CID, UID)
        task = next(iter(acquire._research_tasks))
        if started:
            await entered.wait()
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        await asyncio.sleep(0)
        saved = workspace.get_draft(UID, CID)
        assert saved == {**initial, "checklist_status": "unavailable"}
        assert MemoryStore(workspace.state_file).get_draft(UID, CID) == saved
        assert not acquire._research_tasks and not acquire._research_jobs

    asyncio.run(scenario())


@pytest.mark.parametrize("entry", ["company", "acquisition", "start", "save"])
def test_restart_recovery_preserves_saved_content_and_ownership(workspace, monkeypatch, entry):
    original = persisted_draft(workspace)
    restarted = MemoryStore(workspace.state_file)
    monkeypatch.setattr(acquire, "store", restarted)

    async def unexpected(*args):
        pytest.fail("Opening an orphaned draft must not initiate an unrequested model call")

    monkeypatch.setattr(acquire_agent, "loi", unexpected)
    monkeypatch.setattr(acquire_agent, "checklist", unexpected)
    if entry == "company":
        result = acquire.draft(CID, UID)
    elif entry == "acquisition":
        result = acquire.get(original["acquisition_id"], UID)
    elif entry == "start":
        result = asyncio.run(acquire.start(CID, UID))
    else:
        result = acquire.save_draft(CID, acquire.DraftIn(loi_md=original["loi_md"], checklist=original["checklist"]), UID)
    assert result == {**original, "checklist_status": "unavailable"}
    assert MemoryStore(workspace.state_file).get_draft(UID, CID) == result
    assert acquire.draft(CID, "another-buyer") is None
    with pytest.raises(HTTPException) as error:
        acquire.get(original["acquisition_id"], "another-buyer")
    assert error.value.status_code == 404
    assert not acquire._research_tasks


def test_live_job_remains_researching_and_repeated_start_does_not_duplicate(workspace, monkeypatch):
    async def scenario():
        entered, release = asyncio.Event(), asyncio.Event()
        calls = 0
        researched = [{"item": "Verified permit", "why": "Official requirement", "citation": None, "done": False}]

        async def checklist(*args):
            nonlocal calls
            calls += 1
            entered.set()
            await release.wait()
            return researched

        monkeypatch.setattr(acquire_agent, "checklist", checklist)
        first, duplicate = await asyncio.gather(acquire.start(CID, UID), acquire.start(CID, UID))
        await entered.wait()
        assert first["acquisition_id"] == duplicate["acquisition_id"]
        assert acquire.get(first["acquisition_id"], UID)["checklist_status"] == "researching"
        assert acquire.draft(CID, UID)["checklist_status"] == "researching"
        assert (await acquire.start(CID, UID))["checklist_status"] == "researching"
        assert calls == 1 and len(acquire._research_tasks) == 1
        release.set()
        await asyncio.gather(*list(acquire._research_tasks))
        latest = acquire.draft(CID, UID)
        assert latest["checklist_status"] == "ready" and latest["checklist_source"] == "grok"
        assert latest["checklist"] == researched and latest["loi_md"] == first["loi_md"]
        assert not acquire._research_jobs

    asyncio.run(scenario())


def test_cancel_does_not_overwrite_saved_buyer_edits(workspace, monkeypatch):
    async def scenario():
        entered = asyncio.Event()

        async def blocked(*args):
            entered.set()
            await asyncio.Event().wait()

        monkeypatch.setattr(acquire_agent, "checklist", blocked)
        initial = await acquire.start(CID, UID)
        await entered.wait()
        edited = deepcopy(initial["checklist"])
        edited[0]["done"] = True
        saved = acquire.save_draft(CID, acquire.DraftIn(loi_md="# My revised letter", checklist=edited), UID)
        task = next(iter(acquire._research_tasks))
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        assert acquire.draft(CID, UID) == saved
        assert saved["checklist_status"] == "kept" and saved["loi_md"] == "# My revised letter"
        assert MemoryStore(workspace.state_file).get_draft(UID, CID) == saved

    asyncio.run(scenario())


def test_cancelled_old_job_cannot_change_replacement_draft(workspace, monkeypatch):
    async def scenario():
        entered = asyncio.Event()

        async def blocked(*args):
            entered.set()
            await asyncio.Event().wait()

        monkeypatch.setattr(acquire_agent, "checklist", blocked)
        await acquire.start(CID, UID)
        await entered.wait()
        replacement = persisted_draft(workspace, status="ready")
        task = next(iter(acquire._research_tasks))
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
        assert acquire.draft(CID, UID) == replacement

    asyncio.run(scenario())


@pytest.mark.parametrize("status", ["ready", "kept", "unavailable"])
def test_terminal_drafts_are_not_changed_when_no_job_exists(workspace, status):
    original = persisted_draft(workspace, status=status)
    assert acquire.draft(CID, UID) == original
    assert asyncio.run(acquire.start(CID, UID)) == original


def test_missing_model_configuration_finishes_with_usable_template(workspace, monkeypatch):
    monkeypatch.setattr(grok, "configured", lambda provider="xai": False)

    async def no_network(*args, **kwargs):
        pytest.fail("No model request is allowed without model configuration")

    monkeypatch.setattr(grok.llm, "complete", no_network)

    async def scenario():
        initial = await acquire.start(CID, UID)
        await asyncio.gather(*list(acquire._research_tasks))
        final = acquire.draft(CID, UID)
        assert final["checklist_status"] == "unavailable"
        assert final["checklist_source"] == "template" and final["loi_source"] == "template"
        assert final["checklist"] == initial["checklist"] and final["loi_md"] == initial["loi_md"]
        assert not acquire._research_jobs

    asyncio.run(scenario())


def test_failed_research_stops_polling_without_replacing_template(workspace, monkeypatch):
    async def failing(*args):
        raise RuntimeError("research provider unavailable")

    monkeypatch.setattr(acquire_agent, "checklist", failing)

    async def scenario():
        initial = await acquire.start(CID, UID)
        await asyncio.gather(*list(acquire._research_tasks))
        assert acquire.draft(CID, UID) == {**initial, "checklist_status": "unavailable"}

    asyncio.run(scenario())
