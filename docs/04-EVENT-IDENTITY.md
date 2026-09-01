# 04 — Stable EVENT Identity Contract (DRAFT)

> **An EVENT is a real-world occurrence, not a title string.** Its ID must be stable across deterministic rebuilds, preserve human review provenance, and handle split/merge without destroying evidence.

**Status:** Analytical contract, no code. Branch `experiment/relevance-gate` `c564a2d` frozen, not modified. Next code only after this contract is reviewed.

---

## 1. What constitutes the identity of an event?

An `event_id` identifies a **canonical occurrence**, not a single article's wording. Example `E-8EB0A153` is not `"TSMC expands N2 capacity"` — it is the occurrence *TSMC N2 capacity expansion announced Aug 30* with provenance `A001 + A017`. Identity is the occurrence; title is descriptive.

## 2. Which fields are identity-bearing?

**Bearing (must affect ID):**
- Normalized canonical occurrence key: `normalized canonical title core` (stemmed, lowercased, without publisher prefix), `event_date` (precision-aware), `primary entities` (sorted, e.g. `TSMC`), `primary topic` (e.g. `Capacity`), `domain` (e.g. `Foundry`).

**Not bearing alone (tweak should not fork ID):**
- Punctuation, `announces` vs `announcement`, publisher phrasing, article URL, description, `cluster_confidence`.

**Caution from user example:**
- `SHA1(title+date+entities)` is good hypothesis but brittle: `"TSMC expands N2 capacity"` vs `"TSMC increases 2nm capacity"` could be same event with different wording, while `"expansion announced"` vs `"expansion delayed"` could be different events with same keywords. Identity should be `core occurrence fingerprint`, not raw title.

Proposed v0.1 candidate (not yet locked):
```
event_identity_key = SHA1(
  lower(stem(title_core)) + '|' +
  event_date (YYYY-MM-DD, UNKNOWN→'') + '|' +
  sorted(entities).join(',').lower + '|' +
  topic.lower + '|' +
  domain.lower
)
event_id = 'E-' + first8(identity_key) // deterministic, not getUuid()
```
`title_core` = title lowercased, publisher prefix stripped (`SemiEngineering:`, `TrendForce:`), stopwords normalized, `2nm`→`n2` canonicalized. This is draft, not locked.

## 3. Which fields are descriptive only?

`canonical_title` (human readable, may evolve), `article_count`, `cluster_confidence`, `status` (`candidate→reviewed`), `created_at`, `category` display, `EVENT_ARTICLES` membership beyond primary. Changing these must not change `event_id`.

## 4. How does the same event retain its ID after a rebuild?

Deterministic rebuild: `clusterFiWPhase1D` sorts `NORMALIZED` by `pub` then recomputes `identity_key` per cluster. If same `title_core+date+entities+topic` and same member `NORMALIZED` set (or superset with same core), `SHA1` yields same `event_id`. `EVENTS` sheet is truncated and rebuilt with same IDs, not new `getUuid()`. Idempotency: `Run1 → E-A123`, `Run2 → E-A123` if occurrence unchanged.

## 5. What happens when an event gains a second article?

Event `E-A123` had `A001`. Later `A034` (same occurrence, within 7d, entity+topic overlap) is assigned to same cluster. `E-A123` **retains ID**, `article_count 1→2`, `EVENT_ARTICLES` adds `E-A123 → A034` as `corroborating`, `evidence_confidence` may increase, but `event_id` unchanged. Review in `REVIEWED_EVENTS` stays attached.

## 6. What happens when an event's title changes?

Canonical title is descriptive. If clustering re-selects representative title (`A034` title becomes canonical because earlier pub or better), `event_id` stays `E-A123` because identity key uses `title_core` stem, not exact string. If title change reflects genuinely different occurrence (e.g., `announced` vs `delayed`), that is different `consequence` and should be different event per RIT — then new `event_id` is correct.

## 7. What happens when two previously separate events become clustered?

`E-A123` (TSMC N2 Aug 30) and `E-B456` (TSMC N2 Aug 31) were separate. With more evidence or looser window, they now meet `ENTITY_TOPIC_TIME` ≥0.65 and merge. **Merge rule:** survivor is earliest `event_id` (`E-A123` by `pub`), `E-B456` is retired, its `EVENT_ARTICLES` rows repoint to `E-A123`, `canonical_title` may update, `article_count` sums. `REVIEWED_EVENTS` for `E-B456` is migrated: `review_status` moved to `E-A123` as `merged_from E-B456`, human `why_it_matters` preserved with provenance note, not deleted.

## 8. What happens when one event is later split?

`E-A123` with 6 articles is discovered to be two distinct occurrences (e.g., `capacity expansion announced` vs `capacity expansion delayed` were conflated). **Split rule:** `E-A123` retains the larger sub-cluster (or earliest), new `E-C789` gets new deterministic ID from its sub-cluster's identity key. `EVENT_ARTICLES` repartitioned, `REVIEWED_EVENTS` for `E-A123` stays, new `REVIEWED_EVENTS` row for `E-C789` is created as `PENDING` (not auto-copied), with `split_from E-A123` note. Human must re-review split.

## 9. How are existing REVIEWED_EVENTS preserved?

`REVIEWED_EVENTS` is keyed by `event_id`. With stable IDs, rebuild does not orphan reviews. Implementation must **upsert, not truncate** `REVIEWED_EVENTS` on rebuild: for each rebuilt `EVENTS` ID, if `REVIEWED_EVENTS` already has that `event_id`, preserve `human_impact, relevance, why_it_matters, watch_next, reviewer, reviewed_at, review_status`. If event is new, insert `PENDING`. If event retired (merged), migrate as in §7. Never clear `REVIEWED_EVENTS` wholesale like `EVENTS` is cleared.

## 10. How is the identity migration handled from existing random E-UUID events?

Current `210` events have random `E- + getUuid()` `collector/phase1d_cluster.js:113`. Migration:

- **Freeze:** Current `EVENTS 210` and `REVIEWED_EVENTS 18` remain as generation `gen0` with random IDs, preserved in sheet history and Git `51a9f8b`.
- **Map:** On first stable-ID rebuild, compute deterministic `event_id` for each `gen0` event via `identity_key`. Build `migration_map: old_random_id → new_stable_id`.
- **Carry:** `REVIEWED_EVENTS` 18 rows are rewritten with `new_stable_id` where 1:1, `human_*` fields copied, `reviewed_at` preserved, with column `migrated_from_old_id` for audit.
- **Archive:** Old `EVENTS` snapshot retained as `EVENTS_GEN0_ARCHIVE` sheet (or Git export) for forensic traceability. No `RAW` mutation.
- **Version:** New IDs carry `identity_version = v1` (hash algo). Future identity algo changes create `v2` with new migration, not in-place mutation.

---

## Invariant

> **Stable identity enables provenance-preserving intelligence. Rebuilds may change descriptive fields or membership, but must not silently rekey human-reviewed events.**

This contract is analytical only — no `phase1d_cluster.js` change, no new IDs, no rebuild until reviewed. Next step is RIT validation against actual `EVENT_ARTICLES→NORMALIZED` evidence, not rubric.
