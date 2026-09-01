# 03 — Roadmap Impact Test v0.1 (RIT_v0.1)

> **Does this candidate contain sufficient concrete, attributable evidence of a current or near-term consequence that could affect a VLSI manager's roadmap decision?**
> Does not answer whether the article is interesting. Does not replace `EVENT_GATE`. Does not calculate Impact Score.

---

## 1. Pipeline position

```
RAW
 ↓
NORMALIZED
 ↓
ARTICLE_DEDUPE
 ↓
EVENTS
 ↓
EVENT_GATE (candidate filter) — 1E.1b
 ↓
CANDIDATES
 ↓
┌──────────────────────────────┐
│ ROADMAP IMPACT TEST RIT_v0.1 │ ← NEW
└──────────────────────────────┘
 ↓
ROADMAP / CONTEXT / NO
 ↓
existing Impact Score (0.45R+0.25T+0.20B+0.10C) v1.0
 ↓
ISSUE
```

`EVENT_GATE` remains candidate filter (`ROADMAP_RELEVANT / CONTEXT_RELEVANT / OUT_OF_SCOPE`). `RIT_v0.1` is decision-impact filter. No mutation of `RAW`–`EVENT_SCORES`.

---

## 2. Inputs

Event-level, not raw articles independently.

Required: `EVENT`, `EVENT_ARTICLES`, `NORMALIZED`, `EVENT_GATE`

Useful fields: `event_id, event_date, title, domain, topic, entities, sources, cluster/provenance, machine relevance`, plus `EVENT_ARTICLES{article_id, source_id, source_name, match_score, match_method}`. Every `ROADMAP` decision must trace back to supporting `NORMALIZED.raw_id`.

---

## 3. Four mandatory evidence gates

`ROADMAP` requires all four `TRUE`. Otherwise `CONTEXT` or `NO`.

### Gate 1 — Concrete change
Did something actually change? `CONCRETE_CHANGE = TRUE/FALSE`

Sufficient: new process milestone, PDK release/change, production qualification, capacity constraint, HBM availability, UCIe spec, new IP/product, package capability, architecture deployment.

Insufficient: opinion, generic forecast, "technology is growing", academic possibility without actionable milestone.

### Gate 2 — Attribution
Can the change be attributed to a credible source/entity? `ATTRIBUTED = TRUE/FALSE`

Examples: `TSMC announced...`, `Intel reported...`, `UCIe Consortium specification...`, `NVIDIA introduced...`, `TrendForce reports...`. Provenance required, no anonymous inference.

### Gate 3 — Identifiable consequence
What does this change affect? Must map to at least one:

`FOUNDRY, PDK, PROCESS, YIELD, CAPACITY, SUPPLY, HBM, CHIPLET, PACKAGING, EDA, IP, ARCHITECTURE, QUALIFICATION, COST, SCHEDULE`

`HBM constraint → accelerator memory availability → architecture planning` qualifies. `GPU research → interesting technology → no roadmap consequence` fails.

### Gate 4 — Decision trigger
Can a manager reasonably `change | investigate | qualify | budget | schedule | architect | source | monitor` something? `DECISION_TRIGGER = TRUE/FALSE`. No plausible action → not `ROADMAP`.

---

## 4. Deterministic decision rule

```
ROADMAP = CANDIDATE
          AND CONCRETE_CHANGE
          AND ATTRIBUTED
          AND IDENTIFIABLE_CONSEQUENCE
          AND DECISION_TRIGGER
```

Else `CONTEXT` if credible semiconductor intelligence without current/near-term decision, else `NO` (consumer, opinion, unrelated research, gaming).

---

## 5. CONTEXT vs NO

After failing `ROADMAP`:

- **CONTEXT**: credible semiconductor intelligence, no current decision. e.g., Photonics chiplet research `change=YES, attribution=YES, consequence=potential, decision=NO → CONTEXT`.
- **NO**: no meaningful semiconductor roadmap intelligence. e.g., consumer laptop issue, gaming feature, opinion, unrelated quantum.

---

## 6. Research special rule

Do not `RESEARCH → NO` automatically.

```
RESEARCH
 ├── PDK/foundry adoption? productization? qualification? production? concrete deployment? → YES → eligible for ROADMAP test
 └── otherwise → CONTEXT/NO
```

---

## 7. Supply/capacity special rule

Do not `SUPPLY → ROADMAP` automatically.

```
Supply change
  → Does it affect semiconductor availability, allocation, cost, architecture, qualification, or schedule?
    YES → ROADMAP candidate
    NO  → CONTEXT
```

Correctly separates `HBM constraint → YES` from `electrician shortage → NO` and `Oracle demand signal → CONTEXT` without constraint.

---

## 8. Output schema — ROADMAP_IMPACT

New derived sheet `ROADMAP_IMPACT` (rebuildable, versioned):

| Field | Type | Meaning |
|---|---|---|
| `impact_test_id` | string | UUID |
| `event_id` | string | FK → `EVENTS.event_id` |
| `candidate_status` | enum | `EVENT_GATE.relevance` |
| `concrete_change` | boolean | Gate 1 |
| `attributed` | boolean | Gate 2 |
| `consequence_present` | boolean | Gate 3 |
| `consequence_type` | enum | `FOUNDRY/.../SCHEDULE` |
| `decision_trigger` | boolean | Gate 4 |
| `decision_type` | enum | `change/investigate/qualify/.../monitor` |
| `research_status` | enum | `research_with_evidence / research_without` |
| `supply_status` | enum | `constrained / not_constrained` |
| `roadmap_result` | enum | `ROADMAP / CONTEXT / NO` |
| `confidence` | enum | `high/medium/low` |
| `evidence_article_ids` | string | `NORMALIZED.raw_id` list |
| `evidence_sources` | string | source names |
| `reason` | string | `WHAT CHANGED? WHO CONFIRMED? WHAT AFFECTS? WHAT DECISION?` |
| `processed_at` | datetime | run time |
| `rule_version` | string | `RIT_v0.1` |

`rule_version = RIT_v0.1` enables regeneration without touching `RAW`.

---

## 9. Explainability requirement

Every `ROADMAP` must answer:

```
WHAT CHANGED?         — NVIDIA introduced NVHBM integration.
WHO/WHAT CONFIRMED IT? — NVIDIA / cited source.
WHAT DOES IT AFFECT?  — HBM + interconnect/package architecture.
WHAT DECISION COULD CHANGE? — Investigate memory/package architecture and IP implications.
Result: ROADMAP
```

vs `NO`:

```
What changed: No concrete engineering change. Attribution: Opinion sources. Consequence: None. Decision: None. Result: NO
```

---

## 10. No numerical score in v0.1

Do not create `Roadmap Impact Score = 73` in `RIT_v0.1`. Establish `evidence → decision` first, then existing `Impact Score` `0.45R+0.25T+0.20B+0.10C` handles ranking after classification.

---

## 11. Tests required (12 deterministic)

**Positive ROADMAP:**
1. Intel 14A `→ ROADMAP` (process/yield trigger)
2. NVHBM `→ ROADMAP` (HBM/packaging)
3. HBM supply constraint `→ ROADMAP` (capacity)
4. UCIe concrete spec/product `→ ROADMAP` (chiplet)
5. Foundry capacity constraint `→ ROADMAP` (capacity)

**Negative/Context:**
6. M3D SRAM research without adoption `→ CONTEXT`
7. Photonics chiplet research without qualification `→ CONTEXT`
8. HPC opinion article `→ NO`
9. Consumer SSD/gaming `→ NO`
10. Generic PSU/electrician shortage `→ NO`

**Boundary (must remain ROADMAP):**
11. Research + concrete PDK/qualification evidence `→ ROADMAP`
12. Supply constraint + identifiable semiconductor consequence `→ ROADMAP`

Idempotency: `Run1 EVENTS→ROADMAP_IMPACT` identical to `Run2`.

---

## 12. Idempotency contract

`RAW, NORMALIZED, ARTICLE_DEDUPE, EVENTS, EVENT_ARTICLES, EVENT_SCORES, EVENT_GATE` never modified. Only `ROADMAP_IMPACT` rebuildable. `RIT_v0.1` deterministic.

---

## 13. Versioning

`RIT_v0.1` not `v1.1`. History:

```
Phase 1A RAW
Phase 1B NORMALIZED
Phase 1C ARTICLE_DEDUPE
Phase 1D EVENTS
Phase 1E EVENT_SCORES
Phase 1E.1b EVENT_GATE
Phase 1F HUMAN GOLD SET (18)
Phase 1F.1 HUMAN ROADMAP RUBRIC
RIT_v0.1 ROADMAP IMPACT TEST
```

---

## 14. Invariant

> **ROADMAP requires a concrete, attributable change with an identifiable semiconductor engineering/business consequence and a plausible current or near-term decision trigger.**
> Technical novelty, market importance, research significance, or industry attention alone is insufficient.

Architecture:

```
EVENT → Candidate Gate → Candidate → Roadmap Impact Test {Change? Attribution? Consequence? Decision trigger?} → ROADMAP/CONTEXT/NO → Impact Score → ISSUE
```

*Reject:* `IF title contains "HBM" → ROADMAP` or `IF source=TSMC → ROADMAP` or `IF technical_score > X → ROADMAP`. Unit of reasoning is `Change → consequence → decision`, not keywords. Not a code instruction — design contract to be validated against 18 gold records before `phase1g_roadmap_impact.js`.
