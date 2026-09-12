"""Agents. Owners: Aditya (compliance.py, portfolio_agent.py), Zhiyuan (chat_agent.py).

Compliance reads the tape through Mongo, not through Nico's code, so there is
no coupling to the engine. Rules run first with no LLM; Grok and K2 then review
the same packet independently and disagreement marks the flag `disputed`
(Plan.md section 9.4).
"""
