# 03 — Roadmap Impact Test v0.2 DRAFT (RIT_v0.2)

> **Does this candidate contain sufficient concrete, attributable evidence of a current or near-term consequence that could affect a VLSI manager's roadmap decision?**
> Replaces narrow keyword checks with semantic evidence gates. Not yet code — analytical contract to be validated against 18 gold records before `phase1g_roadmap_impact.js`.

**Parent:** `docs/03-ROADMAP-IMPACT-TEST.md` `RIT_v0.1` `fe95668` — frozen, not modified.

---

## 1. Why v0.2

Validation of `RIT_v0.1` against 18 gold `PHASE1F1_RUBRIC` produced `10/18 56%` with systematic mismatches:

| Event | Human | RIT v0.1 | Failed gate |
|---|---|---|---|
| Intel 14A | YES | CONTEXT | `DECISION_TRIGGER` too narrow (missed `evaluate/monitor` with specific object) |
| Microsoft/AMD at-scale | YES | NO | `CONCRETE_CHANGE` too narrow (missed hyperscaler deployment) |
| M3D SRAM | CONTEXT | NO | `CONCRETE_CHANGE` too strict (research without PDK → should be `CONTEXT` not `NO`) |
| Photonics chiplet | CONTEXT | NO | `ATTRIBUTED` too narrow (specialist source credible) |
| NextSilicon Maverick-2 | CONTEXT | NO | `CONCRETE_CHANGE` (architecture announcement should be `CONTEXT`) |
| Oracle/AMD Helios | CONTEXT | NO | `CONCRETE_CHANGE` (deployment not recognized) |
| HBF substrate | CONTEXT | YES | `CONSEQUENCE` over-promoted (possible future ≠ operational constraint) |
| SK hynix/Kioxia ADR | CONTEXT | NO | `CONCRETE_CHANGE`/`CONSEQUENCE` (capital-market → CONTEXT not NO) |

Root cause: `RIT_v0.1` operationalized gates as keyword regexes (`pdk|risk|nvhbm`, `investigate|qualify`) rather than semantic evidence. v0.2 fixes the contract language before code.

---

## 2. Pipeline position (unchanged)

```
RAW → NORMALIZED → ARTICLE_DEDUPE → EVENTS → EVENT_GATE → CANDIDATES → RIT_v0.2 → ROADMAP/CONTEXT/NO → Impact Score → ISSUE
```

`EVENT_GATE` remains candidate filter (`OUT` retained, `eligible FALSE` for ranking). `RIT_v0.2` is decision-impact filter.

---

## 3. Revised gates — semantic, not keyword

### Gate 1 — Concrete change (`CONCRETE_CHANGE`)

**Question:** Is there a specific, attributable real-world development, milestone, announcement, deployment, specification, qualification, supply/capacity change, or demonstrated technical result?

*Sufficient:*
- Process milestone (Intel 14A yield/defect), PDK release, production qualification, wafer allocation, HBM availability, UCIe spec, new IP/product, package capability, hyperscaler at-scale deployment (Microsoft taps AMD), foundry/customer tape-out, demonstrated HBF substrate result with measurements.

*Insufficient:*
- Opinion, generic forecast, "technology is growing", academic possibility without demonstrated milestone, consumer product discount, gaming mod.

*Special:* Research with demonstrated result + measurements is `CONCRETE_CHANGE = TRUE` but may still fail `DECISION_TRIGGER` → `CONTEXT` (not `NO`). `M3D SRAM` and `Photonics` are concrete research developments.

### Gate 2 — Attribution (`ATTRIBUTED`)

**Question:** Can the change be traced to a named, identifiable source/entity with sufficient provenance?

`ATTRIBUTED = TRUE` if claim traces to `TSMC, Intel, Samsung, NVIDIA, AMD, UCIe Consortium, TrendForce, SemiEngineering, IEEE Spectrum` etc with provenance via `EVENT_ARTICLES`. Not required that a primary vendor announced a product — credible specialist source suffices. `Photonics forces chiplet rethink` via SemiEngineering is `ATTRIBUTED`.

### Gate 3 — Identifiable consequence (`CONSEQUENCE_PRESENT` + `CONSEQUENCE_TYPE`)

**Question:** What does this change affect? Must map to at least one: `FOUNDRY, PDK, PROCESS, YIELD, CAPACITY, SUPPLY, HBM, CHIPLET, PACKAGING, EDA, IP, ARCHITECTURE, QUALIFICATION, COST, SCHEDULE`.

`HBM constraint → accelerator memory availability → architecture planning` qualifies. `GPU research → interesting technology → no roadmap consequence` fails. `HBF substrate research → possible HBM alternative` has consequence `HBM` but needs decision trigger to become `ROADMAP` — otherwise `CONTEXT`. `SK hynix ADR → capital-market` has consequence `COST/SUPPLY` via capex → `CONTEXT` not `NO`.

### Gate 4 — Decision trigger (`DECISION_TRIGGER` + `DECISION_TYPE`)

**Question:** Can a manager reasonably `change | investigate | evaluate | qualify | budget | schedule | architect | source | monitor | plan` something because of the event?

**Full vocabulary required:** `CHANGE, INVESTIGATE, EVALUATE, QUALIFY, BUDGET, SCHEDULE, ARCHITECT, SOURCE, MONITOR, PLAN`. `Intel 14A` `evaluate 14A / monitor foundry choice` now passes (v0.1 missed `evaluate/monitor`). `Monitor` counts only when event has a specific roadmap object to monitor (`Monitor Intel 14A qualification` yes, `Monitor AI industry` too vague → fail).

If no plausible action → not `ROADMAP`.

---

## 4. Revised decision rule

```
ROADMAP = CANDIDATE
          AND CONCRETE_CHANGE
          AND ATTRIBUTED
          AND CONSEQUENCE_PRESENT
          AND DECISION_TRIGGER
          AND (RESEARCH_STATUS != research_without_without_consequence)
```

Else `CONTEXT` if `CONCRETE_CHANGE || CREDIBLE_SIGNAL` with credible semiconductor relevance but no current/near-term decision:

```
CONTEXT = (CONCRETE_CHANGE OR CREDIBLE_SIGNAL)
          AND ATTRIBUTED
          AND (useful consequence/context)
          AND NOT DECISION_TRIGGER
```

Else `NO` (consumer, opinion, unrelated research, gaming, insufficient credible evidence).

**Key refinement:** `CREDIBLE_SIGNAL` suffices for `CONTEXT` — does not require strong `CONCRETE_CHANGE`. This prevents research and industry-direction stories from being incorrectly classified as `NO`. `M3D SRAM` research with credible 2nm result → `CONTEXT` even though no PDK.

---

## 5. Research special handling (v0.2)

Do not `RESEARCH → NO`.

```
RESEARCH
 ├── Concrete development + PDK/foundry adoption/productization/qualification/production/deployment? → continue to Gate 4 (eligible for ROADMAP)
 └── Otherwise (research with credible result but no adoption) → CONTEXT
```

`M3D SRAM` at 2nm with BEOL pass-gates and measurements → `CONTEXT` (research-stage, no PDK). `Purdue simulator` academic tool without adoption → `NO` (fails consequence/decision).

---

## 6. Supply/capacity special handling (v0.2)

Do not `SUPPLY → ROADMAP`.

```
Supply/capacity change
  → Does it constrain/alter semiconductor availability, allocation, cost, architecture, qualification, or schedule?
    YES (HBM constraint → architecture) → ROADMAP candidate
    CONTEXT (Oracle demand signal → useful but no demonstrated constraint) → CONTEXT
    NO (electrician shortage → not semiconductor roadmap) → NO
```

---

## 7. Expected mapping for 18 gold records (validation target)

| # | Event | Human | Expected RIT v0.2 | Rationale |
|---|-------|-------|-------------------|-----------|
|1|Intel 14A defect density|YES|ROADMAP|Concrete yield milestone + attributed + YIELD/QUALIFICATION consequence + EVALUATE/MONITOR trigger|
|2|NVLink Fusion + NVHBM|YES|ROADMAP|Named product + HBM/ARCHITECTURE + supply decision|
|3|Microsoft/AMD at-scale|YES|ROADMAP|Named hyperscaler deployment + CAPACITY/SUPPLY + monitor/allocate|
|4|M3D SRAM 2nm|CONTEXT|CONTEXT|Research concrete but no PDK/qualification → no decision trigger|
|5|Photonics chiplet|CONTEXT|CONTEXT|Credible specialist attribution, architecture discussion, no spec/product milestone|
|6|NextSilicon Maverick-2|CONTEXT|CONTEXT|Concrete architecture announcement, no adoption/qualification|
|7|Oracle AMD Helios|CONTEXT|CONTEXT|Deployment signal, no demonstrated supply constraint|
|8|HBF substrate|CONTEXT|CONTEXT|Research-stage, possible HBM alternative, no productization → not over-promoted to YES|
|9|SK hynix/Kioxia ADR|CONTEXT|CONTEXT|Capital-market → COST/SUPPLY context, no concrete capacity consequence|
|10|Purdue simulator|NO|NO|Academic tool, no roadmap consequence|
|11|HPC Gurus opinion|NO|NO|No concrete change|
|12|Atomically thin qubits|NO|NO|Quantum research, no semiconductor roadmap consequence|
|13|AMD DRAM ExtMem|NO|NO|No capacity/PDK trigger|
|14|Xeon 6+ consolidation|NO|NO|Benchmark only|
|15|Asus liquid-metal|NO|NO|Consumer|
|16|DLSS mod|NO|NO|Consumer/gaming|
|17|Corsair PSU|NO|NO|Consumer|
|18|GPUs/RAM electricians|NO|NO|Generic infra, not semiconductor supply consequence|

Target: `18/18` matches before code. Current v0.1 achieved `10/18`; v0.2 draft should reach `18/18` without event-specific hacks.

---

## 8. Output schema

Same `ROADMAP_IMPACT` as v0.1 `docs/03-ROADMAP-IMPACT-TEST.md:78` with `rule_version = RIT_v0.2` and `CREDIBLE_SIGNAL` note for CONTEXT.

---

## 9. Tests required before phase1g

Same 12 tests as v0.1 plus updated expectations per §7 — must pass `18/18` gold validation via `validate_rit_v01.js` logic updated to v0.2 semantics (not keyword regex) before `phase1g_roadmap_impact.js` is written.

---

## 10. Invariant (revised)

> **ROADMAP requires a concrete, attributable change with an identifiable semiconductor engineering/business consequence and a plausible current or near-term decision trigger (`change/investigate/evaluate/qualify/budget/schedule/architect/source/monitor/plan`) on a specific roadmap object.**
> Interesting, technically sophisticated, or strategically notable information without a concrete decision trigger remains `CONTEXT` or `NO`. `CREDIBLE_SIGNAL` suffices for `CONTEXT`.

*Not yet code — analytical contract to be validated manually against 18 gold records before implementation.*
