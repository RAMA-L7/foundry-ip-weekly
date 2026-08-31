# 02 — Product: Weekly Intelligence Specification

> **Weekly intelligence, not a newsletter.** This document defines the canonical `EVENT` schema, taxonomy, scoring, ranking, and the generated `ISSUE` that a VLSI manager receives every Sunday.

---

## 1. Core distinction

- **RAW ARTICLES** = immutable evidence (what a source published)
- **EVENTS** = canonical intelligence objects (what actually happened in the semiconductor world)
- **ISSUE** = generated weekly view of EVENTS (what a manager needs to know this week)

We **rank EVENTS**, not articles. Five articles reporting "TSMC announces X" = one Event E-001 with 5 provenance links.

## 2. Event schema (canonical)

| Field | Type | Meaning | Source |
|---|---|---|---|
| `event_id` | string | Stable ID, e.g. `E-2026-08-31-001` | Generated |
| `title` | string | Concise event title, e.g. `TSMC 2nm PDK update — risk production` | Derived |
| `category` | enum | Primary taxonomy domain | Classified |
| `entities` | string[] | Affected entities: companies, nodes, IP, standards | Classified |
| `what_changed` | string | Detected facts (1–2 lines) | Extracted |
| `roadmap_relevance` | 0–5 | See §4 | Scored |
| `technical_significance` | 0–5 | See §4 | Scored |
| `business_significance` | 0–5 | See §4 | Scored |
| `evidence_confidence` | 0–5 | See §4 | Scored |
| `impact_score` | 0–100 | Weighted combination, see §4 | Computed |
| `provenance` | article_id[] + URLs | Evidence articles + source tier | Linked |
| `why_it_matters` | string | **Editorial — human-reviewed in v0.1** | Editorial |
| `watch_next` | string | **Editorial — human-reviewed in v0.1** | Editorial |
| `first_seen` | date | Earliest evidence date | Derived |
| `status` | enum | `new` / `update` / `no-change` | Derived |

**Editorial fields are NOT auto-generated in v0.1.** During the 5-customer validation period they are manually reviewed/entered. The resulting human-validated dataset becomes the benchmark for any future optional LLM layer.

## 3. Semiconductor taxonomy

Every EVENT gets one primary `category` and relevant `entities`.

**Foundry**
- process node, PDK, SRAM, DTCO, yield, capacity, fab expansion, transistor (GAA, nanosheet), EUV, backside power, specialty processes

**IP**
- CPU, GPU, NPU, SerDes, PCIe, CXL, DDR, HBM, Ethernet, PHY, security, interface IP

**Chiplet**
- UCIe, die-to-die, chiplet architecture, interoperability, 2.5D, 3D, hybrid bonding

**Packaging**
- CoWoS, FOWLP, 2.5D, 3D IC, HBM integration, thermal, substrate

**EDA** (v0.1: collect, classify lightly; deep EDA scoring in v0.2)
- synthesis, STA, P&R, signoff, DFT, physical verification, EM/IR, AI EDA

**Market / Policy**
- export controls, tariffs, subsidies, capacity, geopolitics, supply chain

## 4. Scoring contract (precise, explainable)

Four independent 0–5 components. Each is scored separately and is auditable.

**Roadmap Relevance** (highest weight — this is the product promise)
- 0 = no identifiable roadmap implication
- 1 = peripheral
- 2 = potentially relevant
- 3 = relevant
- 4 = significant
- 5 = direct roadmap implication (e.g. new PDK, node qualification, IP release that gates tapeout)

**Technical Significance**
- 0 = trivial
- 5 = major architectural or process advance

**Business Significance**
- 0 = no business impact
- 5 = major market/capacity/competitive shift

**Evidence Confidence**
- 0 = single, weak source
- 5 = multiple sources including Tier 1 primary, or Tier 2 with strong provenance

**Impact Score (0–100):**

```
Impact = 0.45 × Roadmap + 0.25 × Technical + 0.20 × Business + 0.10 × Confidence
         (each 0–5, weighted, then scaled to 0–100)
```

Roadmap Relevance dominates by design. Example:

| Event | Roadmap | Technical | Business | Confidence | Impact |
|---|---|---|---|---|---|
| New 2nm PDK | 5 | 5 | 5 | 5 | **100** |
| New GPU announcement | 3 | 4 | 4 | 4 | **70** |
| New server benchmark | 2 | 3 | 3 | 4 | **53** |
| Consumer laptop launch | 1 | 2 | 1 | 4 | **30** |

All four sub-scores are stored alongside Impact for explainability.

## 5. Ranking and weekly selection

**No fixed quotas.** Each Sunday, rank all EVENTS from the last 7 days by `impact_score` descending and select **6–8 highest-impact events**.

Why dynamic? One week may have huge foundry developments and almost nothing in IP — quotas would force filler. Dynamic selection respects reality.

**"Nothing important" signal:** If a domain has no event above a threshold (e.g. Impact < 40), the issue explicitly states:

> **Foundry — No major roadmap changes detected this week.**

This delivers *permission to stop looking* — valuable for a manager.

## 6. Editorial QA (v0.1: human in the loop)

After deterministic scoring, a human reviews the top candidates and fills:

- `why_it_matters` — 1–2 lines: who is affected and why
- `watch_next` — 1 line: what concrete milestone to watch (e.g. "PDK release → IP qualification → library maturity → yield")

In the sheet, these are columns the human edits before `composeIssue` runs. Unreviewed events are not sent.

## 7. Provenance

Every event in the issue shows:

> **Sources: 3** — SemiEngineering · TSMC announcement · TrendForce

Clicking expands to underlying article links. Confidence and tier are visible on hover/detail. Trust > summarization.

## 8. Weekly issue specification

**Header:** `Foundry & IP Weekly — Week of Aug 31 · 7 events · 5 min read`

**Body (6–8 events, ranked):**

```
1. [HIGH] TSMC 2nm update — risk production
   What changed: ...
   Why it matters: HPC/AI SoC teams targeting N2 ...
   Watch next: PDK availability, qualification, ramp
   Confidence: High · Sources: 3
```

**Sections are implicit by rank, not forced:** top events naturally cluster by category, but we do not force "Foundry 3 + IP 3" quotas.

**Dashboard — Semiconductor Radar (weekly, evidence-based):**

```
                 THIS WEEK
FOUNDRY          █████████░  HIGH
CHIPLET          ███████░░░  MEDIUM
PACKAGING        █████████░  HIGH
IP               ██████░░░░  MEDIUM
POLICY           ██████████  VERY HIGH

Top movements: TSMC — 2nm · UCIe — spec · HBM — capacity
Emerging: 3 sources mentioned advanced packaging capacity
```

Plus: per-source item counts and **Top movements / Emerging signals** derived from entity frequencies.

**Footer:** `Open Google Sheet →` + provenance links

## 9. Personalization (not in v0.1, roadmap)

- **v0.3 — Roadmap Watchlists:** Customer selects foundry/nodes/IP/packaging interests → personalized radar
- **Premium "Roadmap Watch":** Customer enters `Foundry: TSMC, Nodes: N3/N2, Packaging: CoWoS, Memory: HBM3E/HBM4, Chiplet: UCIe` → "5 changes relevant to your roadmap" every Sunday

Keep v0.1 generic; personalization is a post-validation upsell that makes $49/mo easy to justify.

## 10. Pricing and validation

- **Founding:** $29/mo (first 15), **Standard:** $49/mo, **Annual:** $399/yr
- **Gate:** 5 paying managers. Manual onboarding, free 2–4 issues, then ask "Would you pay $29/mo?" → take payment before automating subscriptions.
- No pricing optimization before the gate.

## 11. Sheet contracts for v0.1

| Sheet | Purpose | Key columns |
|---|---|---|
| `RAW` | Immutable evidence | id, source, title, url, date, raw_description |
| `EVENTS` | Canonical intelligence | event_id, title, category, entities, why_it_matters, watch_next, roadmap, technical, business, confidence, impact, provenance, first_seen, status |
| `ISSUE` | Weekly view (generated) | rank, event_id, title, impact, why_it_matters, watch_next, provenance |
| `SOURCES` | Evidence registry | source, url, feed_type, tier, domains, reliability, status, fallback |

Collector implements `SOURCES → RAW`; a second stage (classify → score → cluster) produces `EVENTS`; `ISSUE` is the Sunday selection.
