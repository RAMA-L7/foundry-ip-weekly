# Foundry/IP Decision Intelligence

**Evidence-backed semiconductor signals → roadmap decisions.**

> **Not a newsletter. Not a news aggregator. Not an AI chatbot.**
> A deterministic, provenance-preserving intelligence pipeline that turns 10 fixed foundry/IP sources into 5–7 decision signals a VLSI manager can act on.

**Live:** Daily 07:00 to `20a25a0407ec@gmail.com` for 10-day test (`experiment/relevance-gate` `1f0d947` → `d97086c`). **Repo:** `https://github.com/RAMA-L7/foundry-ip-weekly` — `main 49ce417` (stable) + `experiment/relevance-gate` (delivery MVP).

---

## What it does

```
10 RSS (SemiEngineering, SemiWiki, Nvidia Dev/Blogs, EE Times, IEEE Spectrum, ServeTheHome, NextPlatform, Tom's Hardware, TrendForce)
  ↓ HTTP + XML validate
  ↓ RAW 242 immutable (raw_id UUID, content_hash SHA1, fetched_at, never updated)
  ↓ NORMALIZED 242 idempotent (canonical URL, title, date, description clean)
  ↓ ARTICLE_DEDUPE 242 primary, 0 duplicate (URL/GUID/title same-source)
  ↓ EVENTS 210 (EID_v0.1 207 migrate + 3 HOLD, stable SHA1(title_core|date|entities|topic|domain))
  ↓ EVENT_GATE 210 (3 ROADMAP / 82 CONTEXT / 125 OUT)
  ↓ RIT_v0.2 4 gates (CONCRETE_CHANGE + ATTRIBUTED + CONSEQUENCE + DECISION_TRIGGER) → ROADMAP/CONTEXT/NO
  ↓ EVIDENCE_ENRICHMENT (INSUFFICIENT → HTML fetch → SUFFICIENT, Microsoft/AMD benchmark)
  ↓ 1I 8/8 stratified (CONSEQUENCE×2/DECISION/ATTRIBUTION/COMPOUND/NEGATIVE/SUFFICIENT→CONTEXT/ROADMAP)
  ↓ Decision Signals 10 (EVALUATE 3, ARCHITECT 1, MONITOR 6, NO_SIGNAL 200) DS_v0.1
  ↓ Weekly Brief 7 signals (deterministic template, no LLM) → ISSUE_DRAFT → ISSUE_ARCHIVE → Email (MailApp, HTML 12k, evidence links + sheet link)
```

Every output traces `ISSUE → DECISION_SIGNAL → EVENTS (EID_v0.1) → EVENT_ARTICLES → NORMALIZED → RAW → SOURCES` with `PROCESSING_LOG` per run.

---

## Why it exists

VLSI managers miss node/PDK/IP qualification updates buried in 6–10 daily firehoses. Missing a PDK or capacity signal = roadmap PPA/tapeout risk. Current failure: no single place tracks *what changed* week-over-week with provenance. **Product promise:** Every Sunday, 6–8 developments most likely to affect a VLSI roadmap, with *what changed, why it matters, decision, owner, horizon, watch next* — evidence-backed.

**Pivot (1f0d947):** From `Foundry/IP Weekly` newsletter → `Decision Intelligence` — unit is `Decision Signal` (`EVALUATE/QUALIFY/SOURCE/ARCHITECT/SCHEDULE/MONITOR` + `NO_SIGNAL`), not article. Score `Impact = 0.45R+0.25T+0.20B+0.10C` is internal, product is `Decision`.

---

## Repository

```
foundry-ip-weekly/
├── PROJECT_CONTEXT.md              # Constitution — problem, customer, thesis, principles
├── docs/
│   ├── 01-SOURCES.md               # 10 tiered sources, per-source contract
│   ├── 02-PRODUCT.md               # Event schema, taxonomy, scoring, issue spec
│   ├── 03-ROADMAP-IMPACT-TEST.md          # RIT_v0.1 contract
│   ├── 03-ROADMAP-IMPACT-TEST-v0.2-DRAFT.md # RIT_v0.2 (semantic, 18/18)
│   ├── 04-EVENT-IDENTITY.md        # P0 EID_v0.1 occurrence, not title
│   ├── 05-STABLE-EVENT-IDENTITY-VALIDATION.md # P0 10/10 + 242/210 + adversarial
│   ├── 07-EVIDENCE-ENRICHMENT.md   # INSUFFICIENT → enrich → RIT, separate table
│   ├── 1I0-MANIFEST.md             # 1I 8-event stratified
│   ├── DECISION-INTELLIGENCE-PRODUCT-CONTRACT-v0.1.md # Phase 2 contract
│   ├── DECISION-SIGNAL-SCHEMA-v0.1.md # DS_v0.1 16 cols
│   ├── PHASE2-IMPLEMENTATION-AUDIT.md # Forensic audit
│   ├── PHASE2C-210-EVENT-REPLAY.md # OLD vs NEW 10 vs 200
│   ├── DECISION-BRIEF-001.md       # Human-curated brief #001 (5 signals)
│   ├── PRODUCT-VALUE-EXPERIMENT-v0.1.md # 5-manager test
│   └── VALIDATION-RIT-v0.2-REPORT.md # 18/18 + adversarial
├── collector/
│   ├── phase1a_fetch.js            # 1A sharded fetch, incremental flush, time guard
│   ├── phase1b_normalize.js        # 1B RAW→NORMALIZED idempotent
│   ├── phase1c_dedupe.js           # 1C URL/GUID/title
│   ├── phase1d_cluster.js          # 1D entity/topic/time 0.65, 210 events
│   ├── phase1e_classify_score.js   # 1E v1.0 scoring
│   ├── phase1e1_relevance_gate.js  # 1E.1 gate 3/82/125 + gated rescore 85 eligible
│   ├── phase1f_human_review.js     # 1F REVIEWED_EVENTS queue
│   ├── phase1g_roadmap_impact.js   # 1G RIT_v0.2 ROADMAP_IMPACT 2/9/199
│   ├── phase1h_enrichment.js       # 1H enrichment Microsoft/AMD
│   ├── phase1i_enrichment.js       # 1I 8-manifest generalization
│   ├── p0_identity/                # P0 EID_v0.1 (identity.js, live_migration, reports)
│   ├── brief_generator.js          # 2D template 7 signals
│   ├── phase2c_replay.js           # 2C OLD vs NEW Decision Signals
│   ├── phase2e_delivery.js         # 2E SUBSCRIBERS/ARCHIVE/DELIVERY/WEEKLY_RUN
│   ├── daily_10d_trigger.js        # 10-day 07:00 trigger (20a25a0407ec@gmail.com)
│   ├── audit_pipeline.js / validate_* # Audits
│   └── select_1I0_candidates.js
└── landing/.gitkeep
```

---

## Quick start (Apps Script bound to Sheet `1uXMdGyWoIFpIFRTNTKhcBaDaZdiod05QjrV126alFx8`)

1. Sheet → `Extensions → Apps Script` → paste `collector/*.js` as needed → `FIW_SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID'` or bound `getActiveSpreadsheet`
2. `setupFiwPhase1A/B/C/D` → `fetchFiWPhase1A` (sharded, 38s, +209) → `normalizeFiWPhase1B` (+242) → `dedupeFiWPhase1C` (242 primary) → `clusterFiWPhase1D` (210 events)
3. `setupFiwPhase1E/E1/G/H` → `classifyAndScore` → `gateAndRescore` → `runRoadmapImpact` (2/9/199) → `enrichInsufficient` → `runRIT` validation `17/18`
4. `setupFiwPhase1F` → `createReviewQueue` (210 PENDING) → human edit `REVIEWED_EVENTS`
5. `p0_identity` → `testP0IdentityIsolated` → `testP0RealData` → `buildP0MigrationReport` → `migrateP0Live` (207+3)
6. `setupFiwPhase1H/I` → enrich 8 manifest → `validateRITv02Enriched` 8/8
7. `setupFiwPhase2C/Brief` → `replay210` (10 signals) → `generateWeeklyBriefFiW` → `ISSUE_DRAFT 7` → `setupFiwDelivery` → `addSubscriberFiW` → `weeklyRunFiW(true)` dry-run → `weeklyRunFiW(false)` sends `MailApp` (idempotent, `DELIVERY_LOG`).

**Daily 10-day test:** `setupDaily10DayFiW()` in `daily_10d_trigger.js` → `07:00` daily `weeklyRunFiWDaily10` auto-delete after `10`.

---

## Checkpoints

| Commit | Phase |
|---|---|
| `339e750` | 1A–1D verified |
| `49ce417` | **main** 1E deterministic scoring |
| `51a9f8b` | 1E.1b relevance-gated 3/82/125 |
| `434ff2d` | 1G RIT v0.2 2/9/199 |
| `e206104` | P0 EID_v0.1 207+3 HOLD |
| `920e932` | 1I 8/8 generalization |
| `430d795` | Product-Value Experiment |
| `e947628` | Decision Intelligence Contract |
| `1f0d947` | **Decision Brief #001** human-curated — first product release |
| `c9dc7c2` | Phase 2 audit |
| `8cc7bfd` | DS_v0.1 Schema |
| `4ee32f6` | 2C 210 replay 10 vs 200 |
| `1d21883` | 2D Brief template |
| `d97086c` | Daily 10-day trigger |
| `c0aeec8` | **Phase 2E Delivery** `ISSUE-20260903-58c6/4c2b/5545` sent |

`main` stays `49ce417`; `experiment/relevance-gate` is delivery MVP.

---

## Product test

**5 managers** `VLSI/PD, architecture, IP, foundry, packaging, EDA` — `READ → SAVE → SHARE → INVESTIGATE → QUALIFY` — **GO if ≥2/5 want weekly + ≥1–2 concrete action**, `PIVOT` if interesting but no behavior, `STOP` if redundant. No LLM, no payment, no dashboard until `GO`.

---

## Secrets

Never commit `FIW_SPREADSHEET_ID`, `clasp.json`, `*.xlsx` (data). `.gitignore` covers `*.xlsx, clasp.json, .env`. All `FIW_SPREADSHEET_ID_* = 'YOUR_SPREADSHEET_ID'` with `getActiveSpreadsheet()` fallback.

---

## License

Internal research prototype — `experiment/relevance-gate` is delivery MVP, `main` is stable research baseline.
