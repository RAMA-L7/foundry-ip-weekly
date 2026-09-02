# 07 — Evidence Enrichment Contract (DRAFT)

> **Enrichment proves a consequence; it does not manufacture relevance.** It fills the `INSUFFICIENT` gap between candidate and roadmap-impact, preserving `NORMALIZED` as immutable RSS evidence.

**Status:** Analytical contract, no code. Branch `experiment/relevance-gate` `e206104` frozen, `P0 EID_v0.1` stable. Next code only after this contract is reviewed.

**Canonical example:** `E-EEC5521B Microsoft Taps AMD For At Scale AI CPU And GPU Clusters` — `CONCRETE_CHANGE TRUE, ATTRIBUTED TRUE, CONSEQUENCE INSUFFICIENT (blank NextPlatform desc), DECISION_TRIGGER cannot prove → INSUFFICIENT` per `ROADMAP_IMPACT` `RIT_v0.2`. Enrichment must prove `CAPACITY/SUPPLY/ARCHITECTURE` consequence without changing `RIT` rules.

---

## 1. When is enrichment triggered?

- **Primary:** `ROADMAP_IMPACT.roadmap_result = INSUFFICIENT` (evidence gap, not `NO`).
- **Secondary (candidate):** `CONTEXT` with `RIT confidence medium` where additional provenance could promote to `ROADMAP`, or `human review` disagreement `machine CONTEXT → human YES`.
- **Never:** `NO` (consumer/gaming/opinion) — no enrichment; `OUT_OF_SCOPE` remains excluded.

Enrichment is bounded: at most one retry per `INSUFFICIENT` event per `RIT` version to avoid loops.

---

## 2. What evidence is missing?

Per `RIT_v0.2` four gates, enrichment targets the failing gate:

| Missing | Example for Microsoft/AMD |
|---|---|
| `consequence` | `CAPACITY/SUPPLY/ARCHITECTURE` — does at-scale deployment imply allocation, HBM availability, sourcing constraint? |
| `decision_trigger` | `MONITOR/ALLOCATE at-scale deployment` — needs specific roadmap object to act on |
| `attribution` | Rarely missing (already `The Next Platform`), but could add primary AMD/Microsoft announcement |

For `E-EEC5521B`, RSS `NORMALIZED.description` is blank (NextPlatform 82/83). Missing is `consequence` evidence, not `concrete change`.

---

## 3. Where can evidence come from?

In priority order, deterministic first:

1. **Original article HTML** — fetch `NORMALIZED.url` (`https://www.nextplatform.com/...`), extract `<article>` text, `description` fallback.
2. **Primary-source announcement** — linked press release (AMD/Microsoft newsroom) if referenced in article HTML.
3. **Additional specialist article** — existing `EVENT_ARTICLES` corroborating source already in `NORMALIZED` (e.g., second article `The Money AMD Is Chasing With Its Rackscale AI` already attached to same `EVENT`).

Not allowed at this stage: LLM summarization, external search beyond `feed_url` + HTML fallback per `docs/01-SOURCES.md:27`.

---

## 4. What gets stored?

New derived layer `EVIDENCE_ENRICHMENT`, not a rewrite of `NORMALIZED`:

| Field | Type | Meaning |
|---|---|---|
| `evidence_id` | string | UUID |
| `event_id` | string | FK → `EVENTS.event_id` (stable `EID_v0.1`) |
| `source_id` | string | `NORMALIZED.source_id` or `html` |
| `source_url` | string | `NORMALIZED.url` or HTML URL |
| `evidence_type` | enum | `rss_description | html_article | primary_announcement | corroborating_article` |
| `retrieved_at` | datetime | fetch time |
| `evidence_text` | string | extracted text, max 2000, deterministic clean |
| `evidence_hash` | string | `SHA1(source_id|url|evidence_text)` |
| `evidence_sufficiency` | enum | `SUFFICIENT | INSUFFICIENT` post-retrieval |
| `candidate_status` | enum | from `EVENT_GATE` |

`NORMALIZED` remains immutable (`fetched_at` vs `retrieved_at` distinct). Enrichment is additive.

---

## 5. Does enrichment modify NORMALIZED?

**No.** `NORMALIZED.description` stays blank as originally ingested. `EVIDENCE_ENRICHMENT` is separate table joined at `RIT` re-evaluation:

```
NORMALIZED (immutable)
    ↓
EVIDENCE_ENRICHMENT (new evidence_text)
    ↓
RIT_v0.2 again (same rules, richer evidence)
    ↓
ROADMAP / CONTEXT / NO (now with sufficient evidence, Microsoft → ROADMAP)
```

`RIT` rules unchanged; only `evidence_text` input expands. The `RIT` run records `rule_version = RIT_v0.2` plus `enrichment_version`.

---

## 6. Flow

```
EVENT (stable EID_v0.1)
  ↓
Candidate Gate (ROADMAP_RELEVANT / CONTEXT / OUT)
  ↓
RIT_v0.2 → INSUFFICIENT
  ↓
identify missing evidence (consequence)
  ↓
enrich: fetch HTML for E-EEC5521B (2 article URLs)
  ↓
EVIDENCE_ENRICHMENT rows
  ↓
RIT_v0.2 re-evaluate with enriched evidence
  ↓
CONSEQUENCE = CAPACITY/ARCHITECTURE → ROADMAP
  ↓
ROADMAP_IMPACT update (new row, versioned, old INSUFFICIENT retained as history)
```

If still `INSUFFICIENT` after one enrichment, remains `INSUFFICIENT` for human review — do not loop.

---

## 7. Microsoft/AMD canonical trace

- **Before:** `CONCRETE_CHANGE TRUE (at-scale deployment), ATTRIBUTED TRUE (AMD/Microsoft), CONSEQUENCE INSUFFICIENT (blank desc, no HBM/capacity keyword), → INSUFFICIENT`
- **After enrichment:** HTML contains `AMD rackscale AI system, at-scale deployment, HBM capacity` → `CONSEQUENCE = CAPACITY/SUPPLY + ARCHITECTURE`, `DECISION_TRIGGER = MONITOR/ALLOCATE at-scale deployment` → `ROADMAP` with `evidence_sufficiency SUFFICIENT`.

This will be the first enrichment benchmark: `INSUFFICIENT → enrich → ROADMAP` without rule change.

---

## 8. Invariants

- `RAW/NORMALIZED/ARTICLE_DEDUPE/EVENTS/EVENT_GATE` never modified.
- `ROADMAP_IMPACT` history retained; new `ROADMAP_IMPACT` row versioned, not overwrite.
- `EVIDENCE_ENRICHMENT` idempotent: `event_id + source_url + evidence_hash` unique.
- One enrichment per event per `RIT` version.

*Not yet code — contract to be validated against 18 gold + adversarial before `collector/enrichment/` implementation.*
