# 01 — Sources: Evidence Layer Specification

> **A source is evidence, not intelligence.** This document defines the evidence layer that feeds `RAW ARTICLES`. Every collector fetch must respect the tier, type, and attribution contract here.

---

## 1. Source tiers

| Tier | Role | Examples | Preference |
|---|---|---|---|
| **Tier 1 — Primary** | Originators: foundries, EDA/IP vendors, standards bodies, government | TSMC, Intel Foundry, Synopsys, Cadence, Arm, JEDEC, UCIe Consortium, SEMI | **Highest** — prefer primary evidence; media discovers, primary confirms |
| **Tier 2 — Specialist media** | Domain experts who contextualize primary events | SemiEngineering, SemiWiki, EE Times, TrendForce | Use to discover + contextualize; not canonical alone |
| **Tier 3 — General tech** | Broader signals, useful but not core | Nvidia blogs, ServeTheHome, The Next Platform, Tom's Hardware, IEEE Spectrum | Supplementary signals only |

**Product rule:** When an event is reported by both Tier 1 and Tier 2/3, provenance lists Tier 1 first and confidence is higher.

---

## 2. Fixed v0.1 source set (10, all live-tested Aug 31, 2026)

| # | Source | URL (RSS) | Tier | Feed type | Domains covered | Reliability | Expected signal | Fallback | Attribution |
|---|---|---|---|---|---|---|---|---|---|
| 1 | SemiEngineering | `https://semiengineering.com/feed/` | 2 | RSS 2.0 | Foundry, IP, chiplet, packaging, EDA | High — hourly, fresh Aug 31 | Specialist analysis, node/IP deep dives | HTML `<article>` parse | Link + publisher |
| 2 | SemiWiki | `https://semiwiki.com/feed/` | 2 | RSS 2.0 | Foundry, EDA, chiplets | High — fresh Aug 31 | Community/industry chatter, PDK, verification | HTML | Link + publisher |
| 3 | Nvidia Dev Blog | `https://developer.nvidia.com/blog/rss/` | 3 | Atom | HBM, NVLink, GPU, foundry-adjacent | High | GPU/chip architecture signals | HTML | Link |
| 4 | Nvidia Blogs | `https://blogs.nvidia.com/feed/` | 3 | RSS 2.0 | Gaming/GPU (filter for foundry/IP relevance) | Medium | Broader Nvidia signals | HTML | Link |
| 5 | EE Times | `https://www.eetimes.com/feed/` | 2 | RSS 2.0 | Foundry, IP, packaging, policy | High — fresh Aug 31 | Industry news | HTML | Link |
| 6 | IEEE Spectrum | `https://spectrum.ieee.org/feeds/feed.rss` | 2/3 | RSS 2.0 | Semiconductor, policy | High | Policy + research signals | HTML | Link |
| 7 | ServeTheHome | `https://www.servethehome.com/feed/` | 3 | RSS 2.0 | Servers, packaging, foundry-adjacent | High | Server/packaging signals | HTML | Link |
| 8 | The Next Platform | `https://www.nextplatform.com/index?lab_viewport=rss` | 2/3 | RSS 2.0 | HPC, foundry, interconnect | High | HPC/foundry signals | HTML | Link |
| 9 | Tom's Hardware | `https://www.tomshardware.com/feeds.xml` | 3 | RSS 2.0 | Consumer + foundry leaks | Medium | Consumer-adjacent signals | HTML | Link |
| 10 | TrendForce | `https://www.trendforce.com/news/feed/` | 2 | RSS 2.0 | Foundry capacity, DRAM, market | Medium — last item July 1 (slow) | Market/capacity signals | HTML | Link |

**Not in fixed set (HTML-only, no stable RSS — candidate for v0.2):** TSMC newsroom, Synopsys blog, Cadence blog, Arm blog, Samsung/Intel foundry newsrooms. These are Tier 1 primary sources; for v0.1 we rely on Tier 2 media to surface their announcements, then add direct primary RSS/HTML in v0.2.

**Dropped as fixed:** UCIe Consortium (no stable RSS found) — chiplet standards are covered via SemiEngineering/SemiWiki in v0.1.

---

## 3. Per-source contract (template for collector)

For each source row in the `Sources` sheet:

| Field | Meaning | Example |
|---|---|---|
| Source name | Human name | SemiEngineering |
| URL | RSS URL (or HTML URL if fallback) | `https://semiengineering.com/feed/` |
| Feed type | RSS / Atom / HTML | RSS |
| Tier | 1/2/3 | 2 |
| Domains covered | Taxonomy domains this source is strong in | Foundry, Packaging, EDA |
| Reliability | High/Medium/Low + freshness check | High — hourly |
| Expected signal type | What kind of events this source tends to surface | Node analysis, IP deep dives |
| Fallback strategy | What to do if RSS fails | Try HTML `<article>` parse; if blocked, skip and alert |
| Attribution requirement | How to credit in provenance | Publisher name + link |

**Collector rule:** Only rows where `Status = ✅ Valid` are fetched. A `Test` action must validate a new custom URL before it becomes trusted (see foundry-ip-weekly collector design).

## 4. Evidence vs intelligence

- **RAW ARTICLES** store exactly what the source published (title, url, date, source). Never edited.
- **EVENTS** are derived by clustering multiple RAW articles that describe the same real-world occurrence. Provenance is the link between an EVENT and its evidence articles.
- Custom user-added sources (beyond the 10 fixed) must pass the same evidence validation (fetch 200, valid RSS/HTML, ≥3 titles with foundry/IP keywords) before being trusted.

## 5. Source health

- Daily collector logs per-source fetch status; 3 consecutive failures → alert.
- Weekly dashboard shows per-source item counts (evidence volume), not intelligence ranking.
- Source additions/removals are deliberate — update this document when the fixed set changes.
