# PROJECT CONTEXT — Foundry / IP Weekly
> **Constitution of the project.** This document defines what we are building, why, and the architectural principles that every other doc and every line of code must respect. Update only by deliberate decision, not by drift.
>
> **Last updated:** 2026-08-31 · **Status:** Phase 0 — architecture locked, docs being rewritten to v0.1 event-radar contract
> **Location:** `port_new/foundry-ip-weekly/` (sibling to `TAAFT/`, independent)
> **Owner background:** VLSI

---

## 1. Problem

VLSI engineering managers and IP/architecture leads face information overload across foundry, IP, chiplet, packaging, and policy developments. Missing a node, PDK, IP qualification, or standards update can affect roadmap, PPA, and tapeout planning — but reading 6–10 sites daily is not feasible.

**Current failure modes:**
- Critical updates are missed because they are buried in daily firehoses
- Secondary media is read without checking primary evidence
- No single place tracks *what changed* week-over-week for a roadmap

## 2. Customer

**Primary (v0.1):** VLSI engineering managers / IP leads / architecture heads at fabless and design-services companies (India + global) who own roadmap or tapeout decisions.

Narrow enough to start, high-value enough to pay. Not "anyone interested in semiconductors."

**Explicit non-customer for v0.1:** students seeking general news, traders seeking stock tips, general tech enthusiasts.

## 3. Product thesis

> **Foundry & IP Weekly is not a semiconductor news newsletter. It is a roadmap-impact intelligence product.**

**Promise:** Every Sunday, the 6–8 foundry/IP/packaging developments **most likely to affect a VLSI roadmap**, each explained with *what changed, why it matters, who is affected, and what to watch next* — with traceable provenance.

**Differentiation:** Primary-evidence preference, event deduplication, semiconductor taxonomy, impact scoring weighted toward roadmap relevance, and human-validated editorial fields — not raw RSS aggregation.

## 4. Architectural principles (non-negotiable)

1. **RAW is immutable evidence; EVENTS are canonical intelligence; ISSUE is a generated weekly view.**
   - `RAW ARTICLES` are never edited after ingestion.
   - `EVENTS` are the only objects that carry taxonomy, scores, and editorial fields.
   - `ISSUE` is a deterministic selection of EVENTS.

2. **Deterministic first, optional LLM later.**
   - v0.1 is fully deterministic: RSS → normalize → dedupe → cluster → classify → score → human review → brief.
   - LLM analysis, if added later, sits *beside* deterministic extraction, not instead of it. The human-validated dataset from v0.1 becomes the benchmark for any LLM layer.

3. **Event-vs-article distinction.**
   - Five articles reporting "TSMC announces X" = **one Event**, with 5 provenance links. We rank and deliver events, not articles.

4. **Roadmap relevance is the highest-weighted signal.** Technical, business, and confidence are supporting signals.

5. **Provenance is mandatory.** Every claim is traceable to its sources. Trust > summarization.

6. **Boring collector, strong contracts.** Once specs are locked, implementation is straightforward. Premature AI, dashboards, and subscription platforms are non-goals for v0.1.

## 5. System contract (v0.1)

```
SOURCES (tiered, RSS preferred)
   ↓
RAW ARTICLES (immutable: id, source, title, url, date, raw description)
   ↓
NORMALIZED ARTICLES (clean title/url, deduped)
   ↓
EVENT CLUSTERING / DEDUP (5 articles → 1 event)
   ↓
EVENTS (canonical)
   ├── taxonomy (foundry/IP/chiplet/packaging/EDA/policy)
   ├── entities (TSMC, N2, UCIe, HBM, etc.)
   ├── impact score (roadmap × technical × business × confidence, roadmap-weighted)
   ├── confidence (evidence strength)
   ├── provenance (source IDs + URLs)
   └── editorial fields (why_it_matters, watch_next) — HUMAN-REVIEWED in v0.1
   ↓
WEEKLY ISSUE (generated view)
   ├── 6–8 highest-impact events (dynamic, not fixed quotas)
   ├── "nothing important" signals per domain when applicable
   ├── Semiconductor Radar (domain activity)
   └── source provenance per event
```

**Scoring contract:** see `02-PRODUCT.md` — four 0–5 components (Roadmap Relevance, Technical Significance, Business Significance, Evidence Confidence), weighted combination with Roadmap highest weight. Each component is independently explainable.

**Editorial contract:** `why_it_matters` and `watch_next` are **not auto-generated in v0.1**. They are manually reviewed/entered during validation, producing a human-validated intelligence dataset for future benchmarking.

## 6. v0.1 boundaries (what we WILL and WON'T build)

**Will build:**
- 10 tiered RSS sources → RAW
- Normalization → dedupe → event clustering (keyword/taxonomy-based)
- Taxonomy classification + impact scoring
- Human QA (Rank + editorial fields in sheet)
- Weekly issue composition (6–8 events, radar, provenance)
- Daily fetch trigger + weekly send

**Will NOT build in v0.1:**
- LLM summarization or analysis
- Self-serve dashboard or multi-tenant auth
- Personalized watchlists (roadmap: v0.3)
- Change detection across weeks (roadmap: v0.4)
- Subscription/payment automation (manual onboarding)

## 7. Success gate

**5 paying VLSI managers** at $29–49/mo who, after 2–4 free issues, say:
1. "I would have wanted to know this."
2. "I don't want to spend an hour finding this myself."
3. "I'll pay for this."

No infrastructure spend or pricing optimization before this gate.

## 8. Non-goals

- Becoming a general semiconductor news aggregator
- Covering consumer electronics or general AI news
- Optimizing for article count or recency alone

## 9. Roadmap

- **v0.1 — RSS Intelligence:** deterministic event radar → weekly brief → 5 paying managers
- **v0.2 — Event Database:** articles → events → entities → relationships (historical intelligence)
- **v0.3 — Roadmap Watchlists:** customer selects foundry/nodes/IP/packaging interests → personalized radar
- **v0.4 — Change Detection:** "what's changed since last week?" as the primary value prop

## 10. How to use this document

- Every decision in `01-SOURCES.md` and `02-PRODUCT.md` must be consistent with §4–§6.
- Code in `collector/` and `composer/` implements the contract in §5, not the other way around.
- Update this file only when intentionally changing product thesis or architectural principles.
