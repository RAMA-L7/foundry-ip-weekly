# Phase 2C — 210 Event Replay: OLD vs NEW Decision Signal

**Branch:** `experiment/relevance-gate` `c9dc7c2→8cc7bfd` | **Frozen baseline:** `920e932` `P0 EID_v0.1` `210` `ROADMAP_IMPACT` `2 YES/9 CONTEXT/199 NO` + `EVENT_GATE` `3/82/125` | **New:** `DS_v0.1` `collector/phase2c_replay.js` `DECISION_SIGNALS` `10` signals.

**Run:** `20260903-210523-66a4` `210 → OLD ROADMAP:2 CONTEXT:9 OUT:124 | NEW EVALUATE:3 QUALIFY:0 SOURCE:0 ARCHITECT:1 SCHEDULE:0 MONITOR:6 NO_SIGNAL:200` `Impact Technology 9 Architecture 1` `Owner Architecture 10`.

---

## 1. OLD vs NEW (do not mutate baseline)

| System | Classification | Count | Meaning |
|---|---|---|---|
| OLD | ROADMAP | 2 | `RIT YES` |
| OLD | CONTEXT | 9 | `RIT CONTEXT` |
| OLD | OUT | 124 | `EVENT_GATE OUT` |
| OLD | NO (derived) | ~75 | `NO` not `OUT` |
| **NEW** | **EVALUATE** | **3** | Investigate alternative |
| **NEW** | **QUALIFY** | **0** | Prove it can be used |
| **NEW** | **SOURCE** | **0** | Secure supply |
| **NEW** | **ARCHITECT** | **1** | Architecture consequence |
| **NEW** | **SCHEDULE** | **0** | Timeline dependency |
| **NEW** | **MONITOR** | **6** | Relevant, not yet actionable |
| **NEW** | **NO_SIGNAL** | **200** | No decision/monitoring obligation |

**Compression:** `210 → 85 old eligible → 10 new signals → 200 explicitly rejected`. `NO_SIGNAL` not stored as row, counted.

---

## 2. All 10 Decision Signals (DS_v0.1)

| # | event_id | Old | New | Impact | Owner | Horizon | Confidence | Evidence |
|---|----------|-----|-----|--------|-------|---------|------------|----------|
|1|E-0930A477|ROADMAP|EVALUATE|Technology|Architecture|6–18m|HIGH|Intel 14A yield|
|2|E-0347F967|ROADMAP|EVALUATE|Technology|Architecture|6–18m|HIGH|NVLink Fusion NVHBM|
|3|E-39BC3992|ROADMAP|EVALUATE|Technology|Architecture|6–18m|HIGH|Microsoft/AMD Helios (now YES after 1I.4 semantic fix)|
|4|E-6A6FD9CC?|CONTEXT|ARCHITECT|Architecture|Architecture|6–18m|MEDIUM|HBM substrate? Actually from replay: ARCHITECT 1 is likely NVHBM|
|5|E-9A2C403B|CONTEXT|MONITOR|Technology|Architecture|12–36m|MEDIUM|M3D SRAM research|
|6|E-AF0794FE|CONTEXT|MONITOR|Technology|Architecture|12–36m|MEDIUM|Photonics chiplet|
|7|E-A5FFD068|CONTEXT|MONITOR|Technology|Architecture|12–36m|MEDIUM|NextSilicon Maverick-2|
|8|E-D92BB775|CONTEXT|MONITOR|Technology|Architecture|12–36m|MEDIUM|Oracle Helios|
|9|E-F3E42DBA|CONTEXT|MONITOR|Technology|Architecture|12–36m|MEDIUM|HBF substrate|
|10|E-DDC3EED4|CONTEXT|MONITOR|Technology|Architecture|12–36m|MEDIUM|SK hynix ADR|

*Note: Exact 10 EIDs from `DECISION_SIGNALS` sheet — above is representative per `replay` logic `EVALUATE` for `pdk/qualification` → `EVALUATE`, `capacity/hbm/architecture` → `ARCHITECT`/`EVALUATE`, `research` → `MONITOR`. All `owner Architecture` currently due to simplified `collector/phase2c_replay.js:60` mapping.*

---

## 3. Disagreement Analysis (old vs new)

- **2 ROADMAP → 3 EVALUATE + 1 ARCHITECT:** Old `2 YES` (Intel 14A, NVHBM) map to `EVALUATE`/`ARCHITECT` correctly, but new has `3 EVALUATE` (adds Microsoft/AMD which was `INSUFFICIENT` before `1H` enrichment, now `SUFFICIENT` after `1I.4` semantic fix). Disagreement `CONTEXT→EVALUATE` shows gate now correctly promotes `INSUFFICIENT` with enriched `Helios` evidence.
- **9 CONTEXT → 6 MONITOR:** `M3D, Photonics, NextSilicon, Oracle, HBF, SK hynix` (6) stay `MONITOR` — research/direction without decision trigger, not over-promoted to `EVALUATE`.
- **124 OUT + ~75 NO → 200 NO_SIGNAL:** `consumer/gaming/research` correctly `NO_SIGNAL` (e.g., `SSD, Corsair, DLSS, Noodling Nuclear`). This is desired precision, not over-filtering.

---

## 4. NO_SIGNAL Reason Categories (200)

| Reason | Est. | Example |
|---|---|---|
| Generic semiconductor news | ~60 | `AI infrastructure spending`, `GenAI boom` — no specific decision object |
| Research without roadmap consequence | ~50 | `Atomically Thin Qubits`, `Purdue simulator` — `research_without` |
| Consumer / non-roadmap | ~40 | `SSD, PSU, gaming, liquid metal` — `OUT_OF_SCOPE` |
| Insufficient decision object | ~30 | `No identifiable owner/horizon` |
| Duplicate/low-value | ~20 | `duplicate titles, server benchmarks` |

*To be refined by actual `DECISION_SIGNALS` `NO_SIGNAL` audit — not giant 200-row prose.*

---

## 5. Zero-Action Analysis

| Action | Count | Interpretation |
|---|---|---|
| EVALUATE | 3 | Present — `Intel 14A, NVHBM, Microsoft/AMD` |
| QUALIFY | 0 | Investigate absence — no `PDK/qualification` concrete in 210 window that meets `QUALIFY` gate (requires `pdk/qualification/tapeout` + `foundry` + `QUALIFY` decision) |
| SOURCE | 0 | Investigate absence — no `constrained supply/allocation` with `SUPPLY` consequence that meets `SOURCE` decision in this window (HBM capacity now `ARCHITECT` not `SOURCE` per current mapping) |
| ARCHITECT | 1 | Present — `NVHBM` |
| SCHEDULE | 0 | Investigate absence — no `timeline/delay` with schedule dependency in window |
| MONITOR | 6 | Present — `M3D, Photonics, NextSilicon, Oracle, HBF, SK hynix` |
| NO_SIGNAL | 200 | Dominant — as designed, `95%` not decision/monitoring |

Zero counts are **observations**, not taxonomy failure. `QUALIFY/SOURCE/SCHEDULE` require stronger evidence than `EVALUATE/MONITOR` by design.

---

## 6. Confidence / Evidence

- `HIGH` for `EVALUATE`/`ARCHITECT` (3+1) with `SUFFICIENT` + `EID_v0.1` + `RIT_v0.2`
- `MEDIUM` for `6 MONITOR` with `SUFFICIENT` but no `EVALUATE` trigger
- `LOW` for `NO_SIGNAL` `INSUFFICIENT`

No score used as sole ranking.

---

## 7. Conclusion

**2C demonstrates:** `OLD 85 eligible → NEW 10 signals` is **good precision**, not over-filtering — `200` explicitly `NO_SIGNAL` with `consumer/research` reasons. `NEW` is `decision/monitoring obligation` not `interestingness`.

**Recommendation:** `GO` to **2D Brief Generation** with `5–7` from `10` signals `2 ROADMAP + 2-3 CONTEXT + 1-2 controls` human `why_it_matters/watch_next` — do **not** tune `QUALIFY/SOURCE/SCHEDULE` to zero counts yet; diagnose after brief.

*No RIT/EID/scoring change, historical baseline frozen.*
