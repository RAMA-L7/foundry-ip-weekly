# Decision Brief #001 — Semiconductor Roadmap Signals
**Foundry/IP Decision Intelligence v0.1 — Human Curated** | Week of 2026-09-01 | 5-minute decision brief

**Selection principle:** We don't rank semiconductor news by how interesting it is. We select developments that have enough evidence to create a plausible engineering, sourcing, architecture, qualification, or schedule decision — or are important enough to monitor before such a decision becomes necessary. Evidence from frozen `920e932` `P0 EID_v0.1` `210` events, `RIT_v0.2` + `1H/1I 8/8`.

**How to read:** Each signal shows `WHAT CHANGED → WHY IT MATTERS → DECISION → OWNER → HORIZON → WATCH NEXT → EVIDENCE → CONFIDENCE`. `MONITOR` is not failure — it means relevant but not yet actionable.

---

### 🔴 SIGNAL 01 — NVLink Fusion Expands With NVHBM Custom High-Bandwidth Memory

**Decision:** `ARCHITECT` | **Impact:** Architecture + Memory + Packaging | **Owner:** AI accelerator / system architecture | **Horizon:** Near-term architecture planning | **Confidence:** HIGH

**What changed:** NVIDIA expanded NVLink Fusion with NVHBM — custom memory controller integrated into HBM base die (30% greater bandwidth, 15% lower HBM power, frees 25% XPU area). Validated by multiple memory partners, Amazon Annapurna Labs first to collaborate as part of broader NVLink Fusion.

**Why it matters:** This is not another interconnect announcement. It changes the architecture space around XPU/HBM/interconnect integration — custom silicon can now integrate via NVLink with standard NVHBM from multiple suppliers, reducing engineering effort to qualify memory across suppliers.

**Decision object:** Evaluate whether NVLink Fusion + NVHBM integration model should be accounted for in next-gen accelerator architecture.

**Watch next:** Additional NVLink Fusion collaborators, HBM implementation specifics from memory partners, package/integration qualification, ecosystem adoption.

**Evidence:** `E-0347F967` → `E-39BC3992` cluster `NVIDIA NVLink Fusion` `2` articles `Nvidia Blogs` + `NextPlatform` `EVIDENCE_ENRICHMENT` `html_article:capacity/supply` `SUFFICIENT` `RIT_v0.2` `YES` `EID_v0.1`

---

### 🔴 SIGNAL 02 — Intel 14A Defect Density Dropping Faster Than Expected

**Decision:** `EVALUATE` | **Impact:** Technology + Foundry + Schedule | **Owner:** Technology / process / architecture planning | **Horizon:** 6–12m | **Confidence:** HIGH

**What changed:** Intel 14A defect density milestone — yields dropping faster than company expected, CFO commentary "we have not seen this performance since 2nm".

**Why it matters:** Indicates 14A process maturity and schedule/qualification implications — foundry choice and PDK evaluation may need monitoring.

**Decision object:** Evaluate Intel 14A for roadmap; monitor foundry qualification schedule vs TSMC N2.

**Watch next:** Intel 14A PDK qualification timeline, defect density updates, customer tape-out signals.

**Evidence:** `E-0930A477` `Intel` `Yield` `RIT_v0.2` `YES` `EID_v0.1` `1` article `TrendForce` + `Intel` provenance

---

### 🟡 SIGNAL 03 — Workload-Driven HBF Substrate For Capacity-Scalable LLM Inference

**Decision:** `MONITOR` | **Impact:** Packaging + Memory | **Owner:** Packaging / memory architecture | **Horizon:** 12–36m | **Confidence:** MEDIUM

**What changed:** Workload-driven HBF substrate research for capacity-scalable LLM inference (Huawei, ETH Zurich, HUST) demonstrating HBM alternative.

**Why it matters:** Shows capacity-scalable packaging direction, but no productization or foundry qualification yet. Worth tracking as packaging roadmap alternative, not architectural commitment.

**Decision object:** Monitor HBF substrate productization and foundry/package qualification.

**Watch next:** Productization, qualification, foundry/package support from memory partners.

**Evidence:** `E-F3E42DBA` `HBM` `RIT_v0.2` `CONTEXT` `research_without` (no PDK) `EID_v0.1`

---

### 🟡 SIGNAL 04 — M3D 6T SRAM With BEOL Pass-Gates at 2nm

**Decision:** `MONITOR` | **Impact:** Process + Foundry | **Owner:** Product / technology planning | **Horizon:** 12–36m | **Confidence:** MEDIUM

**What changed:** Georgia Tech / Synopsys demonstrated M3D 6T SRAM with BEOL pass-gates at 2nm — research-stage DTCO with measurements.

**Why it matters:** Useful process intelligence on 2nm DTCO, but no PDK release, foundry adoption, or tapeout evidence. No immediate decision trigger.

**Decision object:** Monitor research; await PDK/foundry adoption.

**Watch next:** PDK release, foundry adoption, qualification.

**Evidence:** `E-9A2C403B` `2nm` `RIT_v0.2` `CONTEXT` `research_without` `EID_v0.1` `SemiEngineering + SemiWiki` 2 articles

---

### 🟡 SIGNAL 05 — Photonics Forces A Chiplet Rethink

**Decision:** `MONITOR` | **Impact:** Chiplet + Packaging + Architecture | **Owner:** Chiplet / architecture | **Horizon:** 12–36m | **Confidence:** MEDIUM

**What changed:** Photonics direction suggests chiplet integration rethink — credible specialist source (SemiEngineering) on photonic chiplet challenges.

**Why it matters:** Highlights integration challenges and ecosystem direction, but no concrete specification, product, or interoperability milestone.

**Decision object:** Monitor photonic chiplet ecosystem and specification.

**Watch next:** Concrete UCIe/specification, product, PDK, qualification.

**Evidence:** `E-AF0794FE` `UCIe` `RIT_v0.2` `CONTEXT` `EID_v0.1`

---

### ⚪ CONTROL — Illustrative NO_SIGNAL (not in brief ranking)

**Samsung 2TB 990 SSD 36% off at Amazon** — consumer product, `OUT_OF_SCOPE` `EVIDENCE_GAP` not roadmap-relevant. Demonstrates willingness to say `NO_SIGNAL`.

---

**Evidence graph:** All signals trace via `EVENT_ARTICLES` → `NORMALIZED` → `EVIDENCE_ENRICHMENT` where enriched (`E-39BC3992` `SUFFICIENT` `capacity/architecture` HTML). `RAW` immutable `242` `EID_v0.1` stable `210`.

**Next:** Share with 5 VLSI managers for `READ→QUALIFY` behavioral test `≥2/5 weekly +1-2 action` per `docs/PRODUCT-VALUE-EXPERIMENT-v0.1.md`.

*Human-curated v0.1 — not automated, not LLM, not Issue #001 publication.*
