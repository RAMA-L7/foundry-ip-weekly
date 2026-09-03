# Product-Value Experiment v0.1 — Pilot Brief #001 Internal Evaluation

> **Does the output produced by 210 → 85 eligible → RIT → enrichment give a semiconductor professional information they would actually use, and would they pay for it?**
> No dashboard, subscription, payment, or automated newsletter yet. One manually assembled pilot briefing from frozen system.

**Frozen boundary:** `920e932` (`P0 EID_v0.1` `207+3` + `1E.1b` `1G RIT_v0.2 2/9/199` + `1H/1I 8/8` + `scoring v1.0` `EID_v0.1/RIT_v0.2` frozen). `RAW/NORMALIZED/ARTICLE_DEDUPE/EVENTS` immutable, `main 49ce417` untouched. No LLM editorial generation, no `Issue #001` publication, no production claims.

---

## 1. Hypothesis

**Primary:** 5 VLSI managers/architecture/IP leads will find a weekly 5–7 event briefing (2 ROADMAP + 2–3 CONTEXT + 1–2 control) from the frozen pipeline sufficiently roadmap-relevant to save meaningful time and consider paying.

**Null:** Interesting but not actionable; managers already get this elsewhere or need internal info before value.

---

## 2. Target user (v0.1)

Primary: VLSI engineering managers / IP leads / architecture heads at fabless/design-services (India + global) who own roadmap/tapeout decisions. Non-customer: students, traders, general tech enthusiasts.

Ideal 5 participants mix of VLSI/PD, architecture, IP, foundry, packaging, EDA, engineering management.

---

## 3. Frozen-system boundary

```
RAW 242 → NORMALIZED 242 → ARTICLE_DEDUPE 242 primary → EVENTS 210 (EID_v0.1) → EVENT_GATE 210 (3 ROADMAP/82 CONTEXT/125 OUT) → ROADMAP_IMPACT 210 (2 YES/9 CONTEXT/199 NO/1 INSUFFICIENT→SUFFICIENT via 1H) → EVENT_SCORES 210 → REVIEWED 18 → 1I 8/8
```

No collector, scoring, RIT, EID modifications during experiment.

---

## 4. Selection methodology — Pilot Brief #001 Internal Evaluation (5–7 events)

Not highest scores. Manual curation from frozen `210`:

- **2 potential ROADMAP** — existing `RIT YES` population (e.g., Intel 14A, NVHBM)
- **2–3 strong CONTEXT** — genuinely useful without immediate decision trigger (e.g., photonics, HBF substrate)
- **1–2 interesting but rejected** — internal controls (e.g., consumer SSD, gaming) not shown to customer but kept for analysis

Exact counts from frozen sheets at composition time, preserving layer boundaries `210 → eligible → RIT → ROADMAP/CONTEXT/NO/INSUFFICIENT`.

---

## 5. Pilot Brief format (per event)

```
EVENT
What changed?
Why does it matter? (human editorial)
What decision could this affect? (human editorial)
What should I watch next? (human editorial)
Evidence (source names + URLs, provenance)
Confidence / evidence status (SUFFICIENT/INSUFFICIENT, RIT version)
```

`why_it_matters` / `watch_next` human/editorial, not LLM, per `02-PRODUCT.md:35`.

---

## 6. Human editorial process

Analyst selects 5–7 from `85 eligible` via `RIT` + `EVENT_GATE`, writes `why/watch` with provenance, records `human_relevance` vs `machine_relevance` delta for calibration. No LLM generation.

---

## 7. Manager interview protocol (5 participants, no pricing initially)

1. Which item, if any, would you actually act on?
2. Which item was noise or not useful?
3. What information would you need before making a decision?
4. Would receiving something like this every week save you meaningful time?
5. If consistently useful, would you pay for it? (Don't reveal $29/$49 until after Q4)

Don't pitch product initially; give briefing.

---

## 8. Behavioral metrics (not compliments)

Count: `READ → SAVE → SHARE → INVESTIGATE → CONTACT/QUALIFY/EVALUATE/CHANGE PLAN`

Strongest signal: `Because of this item, I did X.`

Ignore: `Looks interesting.`

---

## 9. Success criteria

**Strong:** ≥2/5 independently `I would want this every week` + ≥1–2 concrete action/investigation triggered by an item.

**Weak:** `Interesting` but no behavior change.

**Failure:** `I already get this elsewhere` / `Not specific enough` / `Need internal info` → stop building current product, investigate failure.

**Kill criterion established before user contact.**

---

## 10. Results

*To be filled after 5 interviews.*

| Manager | Act on? | Noise? | Need? | Save time? | Pay? | Notes |
|---|---|---|---|---|---|---|
|1| | | | | | |
|2| | | | | | |
|3| | | | | | |
|4| | | | | | |
|5| | | | | | |

---

## 11. Decision

- **A Strong validation:** Evidence pipeline → useful briefing → manager action → willingness to pay → Build product.
- **B Interesting but not valuable:** Technically impressive → enjoyed → no behavior → no pay → Keep as research/portfolio or pivot.
- **C Wrong problem:** Managers don't need public signals in this form → Kill.

**No Issue #001 as product publication until pilot decision is A.** Pilot remains `Product Value Pilot — Internal Evaluation #001`, distinct from commercial `Issue #001`.

*Next artifact after decision: Pilot Brief #001 manual assembly from frozen 210, not code.*
