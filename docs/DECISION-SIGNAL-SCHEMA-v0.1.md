# Decision Signal Schema v0.1

**Version:** `DS_v0.1` | **Parent:** `docs/DECISION-INTELLIGENCE-PRODUCT-CONTRACT-v0.1.md` `e947628` | **Branch:** `experiment/relevance-gate` | **Status:** Frozen before `Phase 2C` replay.

---

## 1. Purpose

`Decision Signal` is the canonical product unit — deterministic, evidence-backed, `EID_v0.1` stable, `RIT_v0.2` derived. One `EVENTS` occurrence → 0..1 `Decision Signal` (or `NO_SIGNAL`).

---

## 2. Fields

| Field | Type | Required | Enum / Meaning |
|---|---|---|---|
| `signal_id` | string | Yes | `S-` + `event_id` + `-v1` — stable per `event_id` + `signal_version` |
| `event_id` | string | Yes | FK → `EVENTS.event_id` `EID_v0.1` |
| `signal_version` | string | Yes | `DS_v0.1` |
| `event_title` | string | Yes | `EVENTS.canonical_title` snapshot, max 300 |
| `what_changed` | string | Yes | Concrete change 1–2 lines, from `NORMALIZED` + `EVIDENCE_ENRICHMENT`, max 500 |
| `evidence_graph` | `string[]` | Yes | `EVENT_ARTICLES.normalized_id[]` + `source_url[]` + `EVIDENCE_ENRICHMENT.evidence_id[]`, min 1 |
| `impact` | enum | Yes | `Supply / Architecture / Technology / Packaging / Memory / IP / Cost / Schedule / Strategic` (`docs/DECISION-INTELLIGENCE...:40`) |
| `primary_decision` | enum | Yes | `EVALUATE / QUALIFY / SOURCE / ARCHITECT / SCHEDULE / MONITOR` |
| `secondary_decisions` | `enum[]` | No | 0..N of same 6, distinct from primary |
| `decision_object` | string | Yes | Specific object `TSMC N2`, `HBM allocation` — max 200, `UNKNOWN` not allowed for `ROADMAP` |
| `owner` | enum | Yes | `Architecture / Product / Supply Chain / Technology Planning / CTO` |
| `horizon` | enum | Yes | `Now / 0–6m / 6–18m / 18m+` |
| `confidence` | enum | Yes | `HIGH / MEDIUM / LOW` from `evidence_sufficiency` + source tier + `RIT` |
| `evidence_sufficiency` | enum | Yes | `SUFFICIENT / INSUFFICIENT` per `RIT_v0.2` + `EVIDENCE_ENRICHMENT` |
| `why_it_matters` | string | Yes for `ROADMAP/CONTEXT` | Human editorial 1–2 lines, max 500, `UNKNOWN` not allowed for `ROADMAP` |
| `watch_next` | string | Yes for `ROADMAP/CONTEXT` | Concrete trigger, max 500 |
| `source_evidence` | `object[]` | Yes | `{source_id, source_name, url, tier, evidence_type}` min 1 |
| `created_at` | datetime | Yes | `yyyy-MM-dd HH:mm:ss` creation |
| `updated_at` | datetime | Yes | last deterministic regeneration |
| `status` | enum | Yes | `DRAFT / REVIEW / APPROVED / PUBLISHED` — `MONITOR` starts `DRAFT` |

`NO_SIGNAL` outcome: no `Decision Signal` row created; event remains in `EVENT_GATE` as `OUT`/`NO` with `RIT` reason.

---

## 3. Validation rules

- `signal_id` matches `^S-E-[0-9A-F]{8}-v1$`
- `event_id` matches `^E-[0-9A-F]{8}$` and exists in `EVENTS` `EID_v0.1`
- `primary_decision` ∈ 6, `secondary_decisions` distinct, none equals primary
- `impact` single primary, distinct from `primary_decision` (separation)
- `decision_object` non-empty, not `UNKNOWN` for `EVALUATE/QUALIFY/SOURCE/ARCHITECT/SCHEDULE`
- `why_it_matters` / `watch_next` non-empty for `ROADMAP/CONTEXT`, max 500, no LLM placeholder
- `evidence_graph` min 1, all `normalized_id` exist in `NORMALIZED`, all URLs exist in `EVENT_ARTICLES` or `EVIDENCE_ENRICHMENT`
- `confidence` `HIGH` requires `SUFFICIENT` + ≥1 Tier2 or 2 sources; `LOW` for `INSUFFICIENT`
- `horizon` required, `Now` only for `SCHEDULE/COST` imminent
- `created_at` ≤ `updated_at`, deterministic `updated_at` on rebuild

---

## 4. Null/unknown semantics

- Use `UNKNOWN` string literal for optional text only where contract allows; `why_it_matters`/`watch_next` for `NO_SIGNAL` not created.
- `secondary_decisions` empty array `[]` if none.
- `evidence_sufficiency INSUFFICIENT` → `status` must be `DRAFT`, never `APPROVED`.

---

## 5. Provenance & versioning

- `signal_version DS_v0.1` + `event_identity_version EID_v0.1` + `rit_version RIT_v0.2` recorded per signal.
- Regeneration is idempotent: same `event_id` + same evidence → same `signal_id` and `updated_at` only if content changed.

---

## 6. Immutability & update rules

- `signal_id` / `event_id` immutable after creation.
- `what_changed` / `evidence_graph` immutable unless new `EVIDENCE_ENRICHMENT` arrives → new `updated_at`, `signal_version` bump to `v0.2` if schema changes.
- Human `why_it_matters` / `watch_next` editable via `REVIEWED_EVENTS` style `review_status`, but `algorithm_*` fields never overwritten.

---

## 7. Tests required before implementation

- Schema validation `S-E-...-v1` pattern, required fields
- `NO_SIGNAL` → no row
- Action precedence `EVALUATE vs QUALIFY` distinct
- `Impact != Decision` separation
- `SUFFICIENT` vs `INSUFFICIENT` gating
- Missing `decision_object` → fail
- Empty `evidence_graph` → fail
- Stable `EID` preservation across rebuild
- Idempotent rerun → same `signal_id`
- `MONITOR` with `INSUFFICIENT` → `DRAFT` not `APPROVED`

*No code until this schema is reviewed.*
