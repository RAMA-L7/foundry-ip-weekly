# 1I.0 — Frozen Enrichment Generalization Manifest (8 events)

**Source:** `ROADMAP_IMPACT` 210 + `EVENT_GATE` 210 + `VALIDATION_REPORT` 8 mismatches + `1I.0 CANDIDATE POOL` log 2026-09-01 19:09. No synthetic cases, no score-based selection. Strata per `1I.0 selection design` — 2× CONSEQUENCE from different domains.

| # | Stratum | event_id | missing_evidence_type | reason |
|---|---------|----------|-----------------------|--------|
|1|CONSEQUENCE|E-39BC3992|CONSEQUENCE|Concrete change (Microsoft taps AMD Helios at-scale) + attributed (Microsoft/AMD) are established; available NORMALIZED/RSS evidence does not establish semiconductor capacity/supply/architecture consequence (blank NextPlatform desc) → needed enriched HTML to prove HBM/capacity.|
|2|CONSEQUENCE|E-9A2C403B|CONSEQUENCE|M3D 6T SRAM research-stage 2nm DTCO with credible measurements; attribution yes (Georgia Tech/Synopsys) but no PDK/qualification/production consequence in RSS evidence → needs productization evidence.|
|3|DECISION_TRIGGER|E-0930A477|DECISION_TRIGGER|Intel 14A yield defect milestone + attributed (Intel) + YIELD consequence present; no specific decision object in validator (missed `evaluate/monitor Intel 14A`) → needs decision trigger evidence.|
|4|ATTRIBUTION|E-AF0794FE|ATTRIBUTION|Photonics Forces A Chiplet Rethink — credible specialist source (SemiEngineering) but validator required primary vendor announcement; v0.2 allows specialist attribution → event should be CONTEXT not NO.|
|5|COMPOUND|E-DDC3EED4|CONSEQUENCE + SUPPLY|SK hynix/Kioxia ADR capital-market activity; supply/capacity consequence not semiconductor-specific; needs allocation/supply constraint evidence plus decision trigger.|
|6|NEGATIVE CONTROL|E-002B0B20|NONE (should remain INSUFFICIENT/NO)|Noodling on Nuclear Engines — consumer/research with general domain weak identity; enrichment should reasonably remain INSUFFICIENT/NO → tests anti-cherry-picking.|
|7|SUFFICIENT→CONTEXT|E-CD794C0E|DECISION_TRIGGER|Valid context with credible signal but no current decision trigger; enrichment may establish sufficiency but should still fail decision gate → must remain CONTEXT, not over-promote to ROADMAP.|
|8|ROADMAP CANDIDATE|E-0347F967|CONCRETE_CHANGE + CONSEQUENCE|TSMC-adjacent foundry capacity/PDK-adjacent event where credible enrichment could establish all four gates → positive control, human confirmation required; not selected for high score.|

**Freeze:** No changing event selection after enrichment results visible. This manifest is the 1I validation set for `1I.3` enrichment generalization. `e2ec475`/`51a9f8b`/`c564a2d` frozen, `main 49ce417` untouched.

**Expected transitions (v0.2, not tuned to pass):**
- 1–2: `INSUFFICIENT` + enrichment with `capacity/HBM` → `CONTEXT` or `ROADMAP` if decision proven
- 3: `INSUFFICIENT` + enriched `evaluate/monitor` → `ROADMAP`
- 4: `NO` → `CONTEXT` with correct attribution
- 5: `NO` → `CONTEXT` (compound)
- 6: remains `INSUFFICIENT/NO` — negative control
- 7: `SUFFICIENT` but `CONTEXT` — must not become `ROADMAP`
- 8: `INSUFFICIENT` → potential `ROADMAP` with full evidence

*No score, no gate, no commit change until 1I.3 run and blind human review.*
