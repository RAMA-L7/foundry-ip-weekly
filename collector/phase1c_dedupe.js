// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1C — DEDUPE: NORMALIZED → ARTICLE_DEDUPE (article identity)
// Scope ONLY: duplicate *representations* of same article, NOT same event.
// Hierarchy:
//   1) exact canonical URL      → DUPLICATE
//   2) exact normalized GUID    → DUPLICATE
//   3) exact normalized title + same source + close time → DUPLICATE
//   else → primary (keep separate). Cross-source same title is NOT duplicate.
// Invariants:
//   - RAW / NORMALIZED never modified (read-only)
//   - ARTICLE_DEDUPE records interpretation, never deletes A002
//   - Idempotent: dedupe() × N → same keys, same duplicate_of
//   - Manual review bucket for ambiguous (not forced)
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_C = 'YOUR_SPREADSHEET_ID';
const DEDUPE_TITLE_WINDOW_HOURS = 48; // same-source title match within ±48h → duplicate

// ── Setup ────────────────────────────────────────────────────────────────

function setupFiwPhase1C() {
  const ss = getFiwSpreadsheetC_();
  let dedupe = ss.getSheetByName('ARTICLE_DEDUPE') || ss.insertSheet('ARTICLE_DEDUPE');
  dedupe.getRange(1, 1, 1, 8).setValues([[
    'normalized_id','article_key','is_duplicate','duplicate_of','dedupe_method','dedupe_confidence','dedupe_at','raw_id'
  ]]);
  Logger.log('✅ Phase 1C ARTICLE_DEDUPE sheet ready — 8 cols, NORMALIZED/RAW untouched');
}

function getFiwSpreadsheetC_() {
  if (!FIW_SPREADSHEET_ID_C || FIW_SPREADSHEET_ID_C === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_C not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_C);
}

// ── Dedupe (idempotent) ────────────────────────────────────────────────

function dedupeFiWPhase1C() {
  const ss = getFiwSpreadsheetC_();
  const normSheet = ss.getSheetByName('NORMALIZED');
  const dedupeSheet = ss.getSheetByName('ARTICLE_DEDUPE');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!normSheet) throw new Error('NORMALIZED missing — run Phase 1B first');
  if (!dedupeSheet) throw new Error('ARTICLE_DEDUPE missing — run setupFiwPhase1C() first');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
              + '-' + Utilities.getUuid().slice(0, 4);
  const RUN_START = Date.now();
  const dedupeAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  // Idempotence: already deduped normalized_ids
  const existingIds = new Set(
    dedupeSheet.getLastRow() > 1
      ? dedupeSheet.getRange(2, 1, dedupeSheet.getLastRow()-1, 1).getValues().map(r => String(r[0]||'').trim()).filter(Boolean)
      : []
  );

  // Read NORMALIZED (read-only)
  // Cols: normalized_id(0),raw_id(1),source_id(2),source_name(3),title_normalized(4),url_canonical(5),published_at_normalized(6),description_clean(7),guid_normalized(8),normalized_hash(9),status(10),error(11),normalized_at(12),feed_url(13)
  const normValues = normSheet.getDataRange().getValues();
  const normRows = normValues.slice(1);
  const toProcess = normRows.filter(r => {
    const nid = String(r[0]||'').trim();
    return nid && !existingIds.has(nid);
  });
  Logger.log('Dedupe run ' + runId + ' — NORMALIZED=' + normRows.length + ' already deduped=' + existingIds.size + ' to_process=' + toProcess.length);

  if (toProcess.length === 0) {
    if (logSheet) logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'dedupe',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS', '', true, normRows.length, 0, 0, 'dedupe: 0 new, all already deduped'
    ]]);
    Logger.log('✅ Dedupe ' + runId + ' — nothing to do (idempotent)');
    return { runId: runId, added: 0 };
  }

  // Build lookup maps from *all* NORMALIZED (including already deduped) for deterministic primary selection
  // Primary = earliest published_at_normalized (or earliest row order) for each key
  // We need to consider all rows to ensure duplicate_of points to true primary even across runs

  // For URL_EXACT
  const urlMap = new Map(); // url_lower → { primaryId, pubTime }
  // For GUID_EXACT
  const guidMap = new Map();
  // For TITLE_EXACT same-source window: we need per-source title index
  const titleSourceMap = new Map(); // source_id|title_lower → [{id, pubTime}]

  // First, seed maps from already-deduped rows (read ARTICLE_DEDUPE + NORMALIZED)
  // To keep deterministic, sort all normRows by published_at then row order
  const allSorted = normRows.slice().sort((a,b) => {
    const da = parsePub_(String(a[6]||'')); const db = parsePub_(String(b[6]||''));
    if (da && db) return da - db;
    if (da) return -1; if (db) return 1; return 0;
  });

  // Helper to register primary if not yet present
  function registerUrl(urlLower, nid, pub) {
    if (!urlLower) return;
    if (!urlMap.has(urlLower)) urlMap.set(urlLower, { primaryId: nid, pub: pub });
  }
  function registerGuid(guidLower, nid, pub) {
    if (!guidLower) return;
    if (!guidMap.has(guidLower)) guidMap.set(guidLower, { primaryId: nid, pub: pub });
  }

  // Seed from allRows in sorted order (so earliest becomes primary)
  for (const r of allSorted) {
    const nid = String(r[0]||'').trim();
    const url = String(r[5]||'').trim().toLowerCase();
    const guid = String(r[8]||'').trim().toLowerCase();
    const title = String(r[4]||'').trim().toLowerCase();
    const source = String(r[2]||'').trim();
    const pub = parsePub_(String(r[6]||''));
    if (url) registerUrl(url, nid, pub);
    if (guid) registerGuid(guid, nid, pub);
    if (title && source) {
      const k = source + '|' + title;
      if (!titleSourceMap.has(k)) titleSourceMap.set(k, []);
      titleSourceMap.get(k).push({ id: nid, pub: pub });
    }
  }

  // Now classify toProcess in sorted order for deterministic output
  const procSorted = toProcess.slice().sort((a,b) => {
    const da = parsePub_(String(a[6]||'')); const db = parsePub_(String(b[6]||''));
    if (da && db) return da - db;
    if (da) return -1; if (db) return 1; return 0;
  });

  const outRows = [];
  const methodCounts = { URL_EXACT: 0, GUID_EXACT: 0, TITLE_EXACT_SAME_SOURCE: 0, PRIMARY: 0, MANUAL_REVIEW: 0 };
  // Track which ids we've already emitted as primary in this run to avoid duplicate_of pointing to not-yet-emitted row
  // But maps already point to earliest overall primary, which may be in existingIds (already deduped) — that's correct.

  for (const r of procSorted) {
    const nid = String(r[0]||'').trim();
    const rawId = String(r[1]||'').trim();
    const urlLower = String(r[5]||'').trim().toLowerCase();
    const guidLower = String(r[8]||'').trim().toLowerCase();
    const titleLower = String(r[4]||'').trim().toLowerCase();
    const source = String(r[2]||'').trim();
    const pub = parsePub_(String(r[6]||''));

    let isDup = false; let dupOf = ''; let method = ''; let confidence = ''; let articleKey = '';

    // 1) URL_EXACT
    if (urlLower && urlMap.has(urlLower)) {
      const primary = urlMap.get(urlLower);
      if (primary.primaryId !== nid) {
        isDup = true; dupOf = primary.primaryId; method = 'URL_EXACT'; confidence = '1.00';
        articleKey = 'url|' + urlLower;
        methodCounts.URL_EXACT++;
      } else {
        method = 'PRIMARY'; confidence = '1.00'; articleKey = 'url|' + urlLower;
        methodCounts.PRIMARY++;
      }
    }
    // 2) GUID_EXACT (only if not already decided by URL)
    else if (guidLower && guidMap.has(guidLower)) {
      const primary = guidMap.get(guidLower);
      if (primary.primaryId !== nid) {
        isDup = true; dupOf = primary.primaryId; method = 'GUID_EXACT'; confidence = '1.00';
        articleKey = 'guid|' + guidLower;
        methodCounts.GUID_EXACT++;
      } else {
        method = 'PRIMARY'; confidence = '1.00'; articleKey = 'guid|' + guidLower;
        methodCounts.PRIMARY++;
      }
    }
    // 3) TITLE_EXACT + same source + close time
    else if (titleLower && source) {
      const k = source + '|' + titleLower;
      const group = titleSourceMap.get(k) || [];
      // Find earliest in group
      if (group.length > 1) {
        // Group is already sorted by pub (from seeding), first is primary
        const primary = group[0];
        if (primary.id !== nid) {
          // Check time window
          if (pub && primary.pub) {
            const diffH = Math.abs(pub - primary.pub) / (1000*60*60);
            if (diffH <= DEDUPE_TITLE_WINDOW_HOURS) {
              isDup = true; dupOf = primary.id; method = 'TITLE_EXACT_SAME_SOURCE'; confidence = '0.95';
              articleKey = 'title|' + k;
              methodCounts.TITLE_EXACT_SAME_SOURCE++;
            } else {
              // Same title but far apart in time → keep separate, manual review if needed
              method = 'PRIMARY'; confidence = '1.00'; articleKey = 'title|' + k + '|' + nid.slice(0,8);
              methodCounts.PRIMARY++;
              // Optionally could mark MANUAL_REVIEW but we keep as PRIMARY per spec: don't force
            }
          } else {
            // No pub time to compare → conservative: not duplicate across far time
            method = 'PRIMARY'; confidence = '1.00'; articleKey = 'title|' + k + '|' + nid.slice(0,8);
            methodCounts.PRIMARY++;
          }
        } else {
          method = 'PRIMARY'; confidence = '1.00'; articleKey = 'title|' + k;
          methodCounts.PRIMARY++;
        }
      } else {
        method = 'PRIMARY'; confidence = '1.00'; articleKey = 'title|' + k;
        methodCounts.PRIMARY++;
      }
    } else {
      method = 'PRIMARY'; confidence = '1.00'; articleKey = 'orphan|' + nid.slice(0,8);
      methodCounts.PRIMARY++;
    }

    // Ensure articleKey is set for duplicates too
    if (!articleKey) articleKey = (urlLower ? 'url|'+urlLower : guidLower ? 'guid|'+guidLower : 'title|'+titleLower);

    outRows.push([nid, articleKey.slice(0,500), isDup ? 'TRUE' : 'FALSE', dupOf, method, confidence, dedupeAt, rawId]);
  }

  if (outRows.length > 0) {
    dedupeSheet.getRange(dedupeSheet.getLastRow()+1, 1, outRows.length, 8).setValues(outRows);
  }

  const dupCount = outRows.filter(r => r[2] === 'TRUE').length;
  const primaryCount = outRows.length - dupCount;
  const summary = 'dedupe: +' + outRows.length + ' new (' + primaryCount + ' primary, ' + dupCount + ' duplicate) — URL_EXACT=' + methodCounts.URL_EXACT + ' GUID_EXACT=' + methodCounts.GUID_EXACT + ' TITLE_EXACT_SAME_SOURCE=' + methodCounts.TITLE_EXACT_SAME_SOURCE + ' PRIMARY=' + methodCounts.PRIMARY;

  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'dedupe',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS', '', true, normRows.length, primaryCount, dupCount, summary
    ]]);
  }

  Logger.log('✅ Dedupe ' + runId + ' complete — ' + summary + ' in ' + Math.round((Date.now()-RUN_START)/1000) + 's');
  Logger.log('Methods: ' + JSON.stringify(methodCounts));
  return { runId: runId, added: outRows.length, methodCounts: methodCounts };
}

function parsePub_(s) {
  if (!s) return null;
  try { const d = new Date(s); if (!isNaN(d.getTime())) return d; } catch (e) {}
  return null;
}
