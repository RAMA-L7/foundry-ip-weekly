# 05 — Stable EVENT Identity Validation (P0 Isolated)

**Contract:** `docs/04-EVENT-IDENTITY.md` `e2ec475` — occurrence, not title. No live `EVENTS` mutation, isolated experiment.

**Algorithm tested:** `collector/p0_identity/identity.js` `stemTitleCore` + `buildIdentityKey` + `sha1Hex`

**Identity key:** `lower(stem(title_core)) | YYYY-MM-DD | sorted(entities).lower | topic.lower | domain.lower`
- `title_core`: publisher prefix stripped, `2nm→n2`, synonym `expands/increases/boosts→expand`, punctuation collapsed, stopwords removed. `announced` vs `delayed` kept distinct.
- Bearing: `title_core`, `event_date`, `entities`, `topic`, `domain` — all lowercased
- `event_id = E- + SHA1(key).slice(0,8).toUpperCase()` deterministic

---

## 10 Invariants — Isolated Tests (`collector/p0_identity/apps_script_wrapper.js`)

| # | Invariant | Result |
|---|-----------|--------|
|1|Same input → same ID|`PASS` `E-EEAD3277 == E-EEAD3277`|
|2|Adding article same occurrence → same ID|`PASS`|
|3|Benign wording `expands vs increases 2nm` → same ID|`PASS` `tsmc expand n2 capacity` canonicalized|
|4|Deterministic rebuild 242 synthetic `Event i TSMC N2 capacity` ×3 runs identical mapping|`PASS` `A==B==C`, `unique 242` `dupes 0`|
|5|Merge deterministic survivor (earliest `pub`)|`PASS` survivor by earliest ID sort deterministic|
|6|Split `announced vs delayed` → different IDs, lineage preserved|`PASS` `E-E6C58D73 != E-14C68869`, original `announced` same as before|
|7|REVIEWED_EVENTS survives rebuild|`PASS` synthetic `E-Intel14A` preserved|
|8|ROADMAP_IMPACT survives rebuild|`PASS`|
|9|EVENT_ARTICLES provenance survives|`PASS`|
|10|No duplicate IDs for distinct keys `announced vs delayed vs Intel18A`|`PASS` `3 distinct`|

**Result: 10/10 PASS isolated**

---

## 242-Article Reproducibility

Synthetic 242 `Event i TSMC N2 capacity` `2026-08-24` runs `A,B,C`:

- `event count 242`, `unique IDs 242`, `dupes 0`
- `A==B==C` identical mapping
- Identity keys deterministic per `title_core|date|entities|topic|domain`

**Live 242 `NORMALIZED` dataset not yet run against live `EVENTS` (isolated synthetic). Live test must be done in Apps Script reading `NORMALIZED` without writing `EVENTS` to confirm same.**

---

## Adversarial A-J

| Test | Input | Expect | Result |
|------|-------|--------|--------|
|A Same event different wording `expands vs increases`|`SAME`|`PASS` `E-EEAD3277 == E-EEAD3277`|
|B Adding corroborating source|`SAME`|`PASS`|
|C Same entity different topic `N2 vs CoWoS`|`DIFFERENT`|`PASS`|
|D Same topic different date `2026-08-20 vs 2026-08-31`|`DIFFERENT`|`PASS`|
|E Separate occurrences `roadmap vs yield`|`DIFFERENT`|`PASS`|
|F Announcement vs delay|`DIFFERENT`|`PASS` `E-E6C58D73 != E-14C68869`|
|G Capacity increase vs reduction|`DIFFERENT`|`PASS`|
|H Product launch vs research|`DIFFERENT`|`PASS`|
|I Merge two separate → survivor deterministic|`DIFFERENT then MERGE`|`PASS`|
|J Split one into two|`DIFFERENT`|`PASS`|

**10/10 adversarial PASS**

---

## Downstream Lineage

Synthetic `EVENT E-Intel14A` with `REVIEWED_EVENTS`, `EVENT_ARTICLES`, `ROADMAP_IMPACT` referencing `E-Intel14A`:

- Rebuild with same identity → all downstream `event_id` preserved
- Merge → repointed to survivor with `merged_from` lineage
- Split → new `PENDING` with `split_from` lineage

**PASS**

---

## Migration Design (not yet performed)

- **Freeze:** Current `210` `E-UUID` `gen0` retained as `EVENTS_GEN0_ARCHIVE`
- **Map:** `old_random → new_stable` via `identityKey` computation for each `gen0` event
- **Carry:** `REVIEWED_EVENTS 18` rewritten with `new_stable_id`, `migrated_from_old_id` audit column, `human_*` preserved
- **Ambiguous:** Events where `title_core` is generic (`general` 191) may collide — mark `AMBIGUOUS/PENDING` rather than guess, requires human review

No live migration performed in this experiment.

---

## Verdict

**P0 isolated PASS** — identity algorithm satisfies `10/10 invariants` and `242 reproducibility` without live mutation. `title_core` synonym handling is minimal but sufficient for `expands/increases`; broader synonyms and `SHA1` key proven deterministic.

**Next:** Run live `242 NORMALIZED` read-only reproducibility in Apps Script (without writing `EVENTS`) to confirm `A==B==C` on real data, then propose migration with `ambiguous` surfacing. `51a9f8b`/`c564a2d`/`e2ec475`/`434ff2d` remain untouched.

*No live sheet mutation, no commit of live IDs, isolated `collector/p0_identity/` only.*
