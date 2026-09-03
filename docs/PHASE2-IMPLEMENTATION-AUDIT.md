# Phase 2 Implementation Audit — Delivery MVP

**Branch:** `experiment/relevance-gate` `1f0d947` | **Main:** `49ce417` untouched | **Date:** 2026-09-02
**Scope:** Repository forensic audit before `Phase 2B` Decision Signal schema.

---

## 1. Current Architecture

**Runtime:** Hybrid Google Sheets + Apps Script (pipeline) `collector/*.js` via `SpreadsheetApp/UrlFetchApp/XmlService`, no `package.json`, no Node production, no `appsscript.json` committed. Sheets `RAW/NORMALIZED/ARTICLE_DEDUPE/EVENTS/EVENT_ARTICLES/EVENT_SCORES/EVENT_GATE/ROADMAP_IMPACT/EVIDENCE_ENRICHMENT/REVIEWED_EVENTS` are operational DB.

**Pipeline (frozen):**
```
SOURCES (10, tiered docs/01-SOURCES.md) → RAW (242 immutable) → NORMALIZED (242 idempotent) → ARTICLE_DEDUPE (242→242 primary) → EVENTS 210 (EID_v0.1 207+3 HOLD, stable) → EVENT_GATE 210 (3 ROADMAP/82 CONTEXT/125 OUT) → RIT_v0.2 → ROADMAP_IMPACT 210 (2 YES/9 CONTEXT/199 NO) → EVIDENCE_ENRICHMENT (1 INSUFFICIENT→SUFFICIENT Microsoft/AMD) → 1I 8/8 generalization → REVIEWED 18 → human-curated DECISION-BRIEF-001 (5 signals, human editorial)
```

**Branch history:** `339e750 (1A-1D) → 49ce417 (1E) → 51a9f8b (1E.1b) → 434ff2d (1G RIT) → e206104 (P0 EID) → c564a2d→fe95668(RIT) → 920e932(1I) → f710b0e(1H) → 430d795(product-value) → e947628(Decision Intelligence Contract) → 1f0d947(Brief #001)` — `main` clean at `49ce417`.

**Docs:** `PROJECT_CONTEXT.md`, `01-SOURCES.md` (10, tiered), `02-PRODUCT.md` (EVENT schema, scoring 0.45/0.25/0.20/0.10, 6-8 weekly), `03-ROADMAP-...`, `04-EVENT-IDENTITY`, `05-VALIDATION`, `07-ENRICHMENT`, `PRODUCT-VALUE-EXPERIMENT`, `DECISION-BRIEF-001`, `DECISION-INTELLIGENCE-PRODUCT-CONTRACT-v0.1`.

**Missing:** No `README.md`, no `package.json`, no `appsscript.json`, no `composer/` or `delivery/` code, no subscriber/email/archive/scheduler implementation, no `tests/` directory, no `docs/DECISION-SIGNAL-SCHEMA`.

---

## 2. Existing Components (Reusable)

- **Collector 1A-1G, P0, 1H, 1I:** `phase1a_fetch.js` (sharded fetch, incremental flush, time guard), `phase1b_normalize.js` (idempotent, forensic chain), `phase1c_dedupe.js` (URL/GUID/title same-source), `phase1d_cluster.js` (entity/topic/time 0.65, 210→199/11), `phase1e_classify_score.js` v1.0 (weights frozen), `phase1e1_relevance_gate.js` + `phase1g_roadmap_impact.js` (RIT_v0.2 4 gates, EID_v0.1), `p0_identity/identity.js` (stable SHA1), `phase1h_enrichment.js` (INSUFFICIENT→SUFFICIENT, separate table), `validate_*`, `audit_pipeline.js`.
- **Sheets:** All 8 layers plus `SOURCES/PROCESSING_LOG/P0_MIGRATION_MAP/EVENT_GEN0_ARCHIVE` exist.
- **Contracts:** All frozen docs above.

---

## 3. Missing Components for Delivery MVP

- **Phase 2B:** `docs/DECISION-SIGNAL-SCHEMA-v0.1.md` + schema tests
- **Phase 2C:** 210-event replay artifact (old vs new Decision Signal)
- **Phase 2D:** Weekly brief generator (template, deterministic)
- **Phase 2E:** Orchestration `weekly_run()` (collect→brief), scheduler (daily/weekly triggers)
- **Delivery:** `collector/subscribers` model, `email` rendering (HTML), `email delivery` (SMTP provider via env), `issue archive` (static), `admin` DRAFT/REVIEW/APPROVED/SENT, `config` centralization, `observability` processing report
- **Tests:** Schema, signal generation, NO_SIGNAL, idempotency, unsubscribe, empty week, failure modes, e2e fixture

---

## 4. Risks

1. **Google Quota:** 6-min execution, `UrlFetch` 403 (AnandTech), blank descriptions (NextPlatform 82/83) — mitigated by sharding, incremental flush, time guard, enrichment separate layer.
2. **Event ID stability:** Fixed by `P0 EID_v0.1 207+3 HOLD`, but `phase1d_cluster.js` still uses `getUuid` in live `EVENTS` until migration is replayed — must not regenerate live `EVENTS` without stable IDs.
3. **Source health:** `TrendForce` July 1 stale but HTTP 200 — needs `feed populated + recent content + domain signal` vs just HTTP healthy.
4. **Taxonomy drift:** `EVENTS general 191/210` vs `EVENT_GATE Foundry/IP` vs `02-PRODUCT.md` six-domain — `1E.1` fixed via `EVENT_GATE` canonical, but `2B` must lock one schema.
5. **No secrets in repo:** `FIW_SPREADSHEET_ID` placeholder `YOUR_SPREADSHEET_ID` + fallback `getActiveSpreadsheet()` — must keep `.gitignore` `*.xlsx, clasp.json`.
6. **No Node package:** No `npm test` harness — need lightweight `tests/` with `node` pure functions where possible.

---

## 5. Proposed Implementation Order (per master prompt 26)

- **Phase 0 (done):** This audit
- **Phase 2B:** Decision Signal schema + tests
- **Phase 2C:** 210-event replay
- **Phase 2D:** Brief generation
- **Phase 2E:** Orchestration
- **Phase 3A:** Subscriber model
- **Phase 3B:** Email rendering
- **Phase 3C:** Email delivery
- **Phase 3D:** Issue archive
- **Phase 3E:** E2E fixture + dry run + delivery test

---

## 6. Files Likely to Change

- **New:** `docs/DECISION-SIGNAL-SCHEMA-v0.1.md`, `collector/decision_signal.js`, `collector/weekly_selection.js`, `collector/brief_generator.js`, `collector/subscribers.js`, `collector/email_delivery.js`, `collector/weekly_run.js`, `docs/PHASE2C-210-EVENT-REPLAY.md`, `tests/**`, `config.example.json`, `README.md`
- **Modified:** `collector/phase1a_fetch.js` (add `appsscript.json` + `clasp` config, not logic), `docs/README` updates
- **Untouched:** `RAW/NORMALIZED/ARTICLE_DEDUPE/EVENTS_Gen0` history, `P0 EID_v0.1` contract, `RIT_v0.2` contract

*Audit complete — no code modified, ready for Phase 2B.*
