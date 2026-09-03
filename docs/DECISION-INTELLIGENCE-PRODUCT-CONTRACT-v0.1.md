# Decision Intelligence Product Contract v0.1

> **A Decision Signal is not an important event. It is an evidence-backed external development that creates a plausible semiconductor decision or monitoring obligation for a defined decision owner within a defined horizon.**

**Status:** Analytical contract, no code. `main 49ce417` + `experiment/relevance-gate 430d795` frozen, `P0 EID_v0.1` + `RIT_v0.2` + `scoring v1.0` preserved as evidence engine. Next code only after this contract is reviewed.

**Frozen baseline for replay:** `experiment/relevance-gate` `920e932` `210 EVENTS` `EID_v0.1` — old `ROADMAP/CONTEXT` labels are replay baseline, not ground truth for Decision Signal.

---

## 1. Purpose & product thesis

**From:** Find important semiconductor events and summarize into weekly briefing (information aggregation).
**To:** External semiconductor signals → roadmap decisions (decision intelligence).

The canonical product unit is **Decision Signal**, not article or event.

Pivot from `interesting ≠ useful` to `evidence-backed decision or monitoring obligation`.

---

## 2. Target decision-maker

Primary: Semiconductor engineering / architecture / technology-planning manager responsible for roadmap.

- SoC architecture manager
- AI accelerator architecture lead
- Physical design / implementation manager
- Semiconductor product engineering manager
- Platform architecture lead
- Technology planning manager

Secondary: sourcing / supply-chain engineering, CTO office, semiconductor strategy teams.

**Explicit non-target:** general tech enthusiasts, traders, students, consumer audience.

**Decision responsibilities:** process/node/foundry choice, PDK, packaging/chiplet architecture, HBM/memory, IP/EDA, supply/capacity, schedule, cost, sourcing.

---

## 3. Decision taxonomy

| Decision | Meaning | Example |
|---|---|---|
| `EVALUATE` | Investigate technology/vendor/process | Should we evaluate Samsung 1.4nm? |
| `QUALIFY` | Qualify alternative | Qualify second foundry for N2? |
| `SOURCE` | Secure supply / second-source | Secure HBM allocation? |
| `ARCHITECT` | Change architecture | Re-architect for UCIe? |
| `SCHEDULE` | Affect roadmap timing | Slip tapeout due to yield? |
| `MONITOR` | Not actionable yet, worth tracking | Monitor advanced packaging capacity? |

One signal has one primary `decision_type`, may have secondary.

---

## 4. Impact taxonomy

| Impact | Example |
|---|---|
| Supply / capacity | wafer allocation, advanced packaging capacity tightness |
| Architecture | chiplet, UCIe, CoWoS, 2.5D/3D, rackscale AI |
| Technology / process | N2, N3, 18A, yield, PDK |
| Packaging / memory | CoWoS, HBM, HBF, substrate |
| IP / EDA | SerDes, CXL, PDK/EDA interoperability |
| Cost / economics | pricing, capex, equipment spending $165.9B→$229.5B |
| Schedule / execution | qualification, ramp, production readiness |
| Strategic / ecosystem | foundry/customer allocation, geography (SK hynix Indiana HBM) |

One signal has one primary `impact_type`, may have secondary.

---

## 5. Decision Signal schema

| Field | Type | Meaning |
|---|---|---|
| `signal_id` | string | Stable `S- + EID_v0.1` + version |
| `event_id` | string | FK → `EVENTS.event_id` `EID_v0.1` stable |
| `what_changed` | string | Concrete change (1–2 lines) |
| `evidence_graph` | `article_id[]+URL` | `EVENT_ARTICLES` + `EVIDENCE_ENRICHMENT` + `NORMALIZED` provenance |
| `impact_type` | enum | §4 primary |
| `impact_description` | string | What part of roadmap could it affect? |
| `decision_type` | enum | §3 primary |
| `decision_object` | string | Specific object: `TSMC N2`, `HBM allocation`, `CoWoS capacity` |
| `decision_owner` | enum | `Architecture / Product / Supply Chain / Technology Planning / CTO` |
| `horizon` | enum | `Now / 6–12m / 12–36m` |
| `confidence` | enum | `HIGH / MEDIUM / LOW` from evidence sufficiency + source tier |
| `evidence_gaps` | string[] | Missing evidence for full decision |
| `why_it_matters` | string | Human editorial, why this decision matters |
| `recommended_investigation` | string | Human editorial, what to investigate before acting |
| `watch_next_trigger` | string | Concrete trigger: `PDK release, allocation announcement, alternative architecture` |
| `provenance` | `source_id[]` | Source tier + URLs + `EID_v0.1` |
| `signal_version` | string | `DS_v0.1` |

`why_it_matters` / `recommended_investigation` / `watch_next_trigger` human-reviewed in v0.1, not LLM.

---

## 6. Evidence requirements

Per `RIT_v0.2` four gates, applied at Decision Signal level:

- **Concrete change:** specific attributable real-world development, not keyword.
- **Attribution:** named source/entity with provenance via `EVENT_ARTICLES`.
- **Consequence:** identifiable effect on §4 impact type.
- **Decision relevance:** plausible `§3` decision on specific `decision_object` within `horizon`.
- **Evidence sufficiency:** `SUFFICIENT` per `EVIDENCE_ENRICHMENT` or `INSUFFICIENT` remains `MONITOR` not `ARCHITECT`.

Primary vs corroborating evidence distinguished via `EVENT_ARTICLES` `primary/corroborating` and source tier.

---

## 7. Decision workflow

```
Evidence (NORMALIZED + EVIDENCE_ENRICHMENT, stable EID_v0.1)
   ↓
Event (occurrence, not title)
   ↓
Impact assessment (§4)
   ↓
Decision relevance (§3 + horizon + owner)
   ↓
Decision Signal (§5)
   ↓
EVALUATE / QUALIFY / SOURCE / ARCHITECT / SCHEDULE / MONITOR
   ↓
Manager action
   ↓
Watch / reassess (watch_next_trigger)
```

Evidence → Event → Impact → Decision Signal is deterministic; editorial `why/watch` is human.

---

## 8. 210-event replay protocol

- Frozen baseline: `experiment/relevance-gate` `920e932` `210` `EID_v0.1` `ROADMAP/CONTEXT/NO` labels from `RIT_v0.2` + `EVENT_GATE`.
- No mutation of `RAW/NORMALIZED/ARTICLE_DEDUPE/EVENTS` or historical `ROADMAP/CONTEXT` labels.
- Every replay `Decision Signal` traceable to original `event_id` `EID_v0.1` via `P0_MIGRATION_MAP`.
- Compare old `ROADMAP/CONTEXT` against new `Decision Signal` `MONITOR/EVALUATE/...` — record disagreements, don't force equivalence.
- `EVIDENCE_ENRICHMENT` from `1H/1I` remains separate, not merged into `NORMALIZED`.

---

## 9. Product output contract

Manager-readable signal, evidence-backed, decision-oriented. Not `7 things that happened`.

Per signal shows: `what_changed, why_it_matters, decision_type + decision_object + owner + horizon, recommended_investigation, watch_next_trigger, confidence, evidence_graph` with tier. `Issue` is generated weekly view of `Decision Signals` ranked by `decision urgency + confidence`, not `Impact 73`.

---

## 10. Success criteria

- **Signal usefulness:** ≥2/5 managers would act on at least one signal.
- **Decision clarity:** Each signal maps to single `§3` decision with specific object.
- **Evidence trust:** Every signal traceable to `NORMALIZED` + `EVIDENCE_ENRICHMENT` with `evidence_sufficiency`.
- **Actionability:** At least one `EVALUATE/QUALIFY/SOURCE/ARCHITECT/SCHEDULE` per brief, not only `MONITOR`.
- **Repeatability:** `Decision Signal` deterministic from `EID_v0.1` + `RIT_v0.2` + `enrichment`.
- Later: `GO/PIVOT/STOP` per `PRODUCT-VALUE-EXPERIMENT-v0.1.md` behavioral `READ→QUALIFY`.

---

## 11. Phase gates

- **2A:** taxonomy frozen (§3-4)
- **2B:** schema frozen (§5)
- **2C:** 210 replay (compare old ROADMAP/CONTEXT vs new Decision Signals)
- **2D:** manual Decision Brief 5–7 signals (2 ROADMAP-candidate + 2-3 CONTEXT + 1-2 control) human `why/watch`
- **2E:** automation only after 2C/2D demonstrate decision abstraction works

*No code until this contract is reviewed. Next artifact after review is 2A taxonomy freeze, not production code.*
