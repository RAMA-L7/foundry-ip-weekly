// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1B — NORMALIZE: RAW → NORMALIZED (structurally consistent)
// Scope ONLY: canonical URL, title, date, description, GUID, source identity,
//            deterministic normalized_hash, raw_id FK, status/error/at
// Invariants:
//   - RAW is NEVER modified (read-only)
//   - RAW.raw_id ──► NORMALIZED.raw_id (FK, 1:1)
//   - Idempotent: normalize() × N → same NORMALIZED, no duplicates
//   - No semantic dedup / clustering / entities / taxonomy / scoring / LLM
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_B = 'YOUR_SPREADSHEET_ID';

// ── Setup (run once, idempotent) ───────────────────────────────────────

function setupFiwPhase1B() {
  const ss = getFiwSpreadsheetB_();
  let norm = ss.getSheetByName('NORMALIZED') || ss.insertSheet('NORMALIZED');
  if (norm.getLastRow() === 0) {
    norm.getRange(1, 1, 1, 14).setValues([[
      'normalized_id','raw_id','source_id','source_name',
      'title_normalized','url_canonical','published_at_normalized','description_clean',
      'guid_normalized','normalized_hash',
      'normalization_status','normalization_error','normalized_at','feed_url'
    ]]);
  } else {
    // Ensure header is authoritative if sheet already existed
    norm.getRange(1, 1, 1, 14).setValues([[
      'normalized_id','raw_id','source_id','source_name',
      'title_normalized','url_canonical','published_at_normalized','description_clean',
      'guid_normalized','normalized_hash',
      'normalization_status','normalization_error','normalized_at','feed_url'
    ]]);
  }
  Logger.log('✅ Phase 1B NORMALIZED sheet ready — 14 cols, RAW untouched');
}

function getFiwSpreadsheetB_() {
  if (!FIW_SPREADSHEET_ID_B || FIW_SPREADSHEET_ID_B === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_B not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_B);
}

// ── Normalize (idempotent) ─────────────────────────────────────────────

function normalizeFiWPhase1B() {
  const ss = getFiwSpreadsheetB_();
  const rawSheet = ss.getSheetByName('RAW');
  const normSheet = ss.getSheetByName('NORMALIZED');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!rawSheet) throw new Error('RAW sheet missing — run Phase 1A setup first');
  if (!normSheet) throw new Error('NORMALIZED sheet missing — run setupFiwPhase1B() first');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
              + '-' + Utilities.getUuid().slice(0, 4);
  const RUN_START = Date.now();
  const GUARD_MS = 4.5 * 60 * 1000;
  const normalizedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  // Build idempotence set from NORMALIZED.raw_id (col 2)
  const normValues = normSheet.getLastRow() > 1 ? normSheet.getRange(2, 2, normSheet.getLastRow()-1, 1).getValues() : [];
  const existingRawIds = new Set(normValues.map(r => String(r[0] || '')).filter(Boolean));

  // Read RAW (read-only — never write to RAW)
  const rawValues = rawSheet.getDataRange().getValues();
  const rawHeader = rawValues[0];
  // RAW cols: raw_id(0),source_id(1),source_name(2),title(3),url(4),published_at(5),description(6),fetched_at(7),content_hash(8),feed_url(9),guid(10)
  const rawRows = rawValues.slice(1);
  Logger.log('Normalize run ' + runId + ' — RAW rows=' + rawRows.length + ' already normalized=' + existingRawIds.size);

  const outRows = [];
  const logRows = [];
  let accepted = 0;
  let skippedExisting = 0;
  let failed = 0;

  for (var i = 0; i < rawRows.length; i++) {
    if (Date.now() - RUN_START > GUARD_MS) {
      Logger.log('⏱ Guard triggered at RAW row ' + i + ' — flushing ' + outRows.length + ' rows, re-run to continue');
      break;
    }
    const r = rawRows[i];
    const rawId = String(r[0] || '').trim();
    if (!rawId) { failed++; continue; }
    if (existingRawIds.has(rawId)) { skippedExisting++; continue; }

    const sourceId = String(r[1] || '').trim();
    const sourceName = String(r[2] || '').trim();
    const titleRaw = String(r[3] || '');
    const urlRaw = String(r[4] || '');
    const publishedRaw = String(r[5] || '');
    const descRaw = String(r[6] || '');
    const feedUrl = String(r[9] || '');
    const guidRaw = String(r[10] || '');

    let titleNorm = ''; let urlCanon = ''; let pubNorm = ''; let descClean = ''; let guidNorm = '';
    let status = 'SUCCESS'; let errMsg = ''; let normHash = '';

    try {
      titleNorm = normalizeTitle_(titleRaw);
      urlCanon = canonicalUrlB_(urlRaw);
      pubNorm = normalizeDate_(publishedRaw);
      descClean = cleanDescription_(descRaw);
      guidNorm = normalizeGuid_(guidRaw);

      if (!titleNorm) throw new Error('title empty after normalization');
      if (!urlCanon) throw new Error('url empty after normalization');

      // Deterministic hash: source|url_canonical|title_normalized|published_at_normalized
      // Lowercased title/url for stability; pubNorm already normalized
      normHash = sha1B_(sourceId + '|' + urlCanon.toLowerCase() + '|' + titleNorm.toLowerCase() + '|' + pubNorm);
    } catch (e) {
      status = 'FAILED';
      errMsg = String(e.message).slice(0, 500);
      failed++;
      // Still emit a row for traceability with hash of raw fallback
      try { normHash = sha1B_('failed|' + rawId + '|' + urlRaw + '|' + titleRaw.slice(0,100)); } catch (ee) { normHash = ''; }
    }

    const normalizedId = Utilities.getUuid();
    outRows.push([
      normalizedId, rawId, sourceId, sourceName,
      titleNorm.slice(0, 500), urlCanon, pubNorm, descClean.slice(0, 2000),
      guidNorm.slice(0, 500), normHash,
      status, errMsg, normalizedAt, feedUrl
    ]);
    existingRawIds.add(rawId); // prevent dup within same run if RAW has dup raw_id
    if (status === 'SUCCESS') accepted++;
  }

  // Incremental flush — RAW never touched
  if (outRows.length > 0) {
    normSheet.getRange(normSheet.getLastRow() + 1, 1, outRows.length, 14).setValues(outRows);
  }

  // PROCESSING_LOG: stage=normalize, one row per run (not per source)
  if (logSheet) {
    const succ = accepted;
    const fail = failed;
    const skip = skippedExisting;
    const total = rawRows.length;
    const status = fail > 0 && succ === 0 ? 'FAILED' : 'SUCCESS';
    logSheet.getRange(logSheet.getLastRow()+1, 1, 1, 13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'normalize',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      status, '', true, total, succ, skip + fail,
      'normalize: +' + succ + ' new, ' + skip + ' already normalized, ' + fail + ' failed'
    ]]);
  }

  Logger.log('✅ Normalize ' + runId + ' complete — +' + accepted + ' new, ' + skippedExisting + ' already normalized, ' + failed + ' failed in ' + Math.round((Date.now()-RUN_START)/1000) + 's (RAW untouched)');
  if (rawRows.length > existingRawIds.size) {
    // Should not happen; guard
  }
  return { runId: runId, added: accepted, skippedExisting: skippedExisting, failed: failed };
}

// ── Normalization helpers (deterministic, no RAW mutation) ──────────────

function normalizeTitle_(s) {
  if (!s) return '';
  let t = String(s).trim();
  // Decode common entities before collapsing
  t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function canonicalUrlB_(u) {
  // Same as Phase 1A canonicalUrl — preserved for structural consistency
  try {
    let c = String(u).trim().replace(/[),.]+$/, '');
    c = c.replace(/([?&])(utm_[^&]*|fbclid|gclid|ref|ref_src)=[^&]*/g, '$1');
    c = c.replace(/[?&]+$/, '').replace(/\?&/, '?');
    if (c.endsWith('?')) c = c.slice(0, -1);
    return c;
  } catch (e) { return String(u).trim(); }
}

function normalizeDate_(raw) {
  if (!raw) return '';
  const s = String(raw).trim();
  // Already normalized yyyy-MM-dd HH:mm:ss from Phase 1A — keep as-is if matches
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)) return s;
  try {
    const d = new Date(s);
    if (!isNaN(d.getTime())) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {}
  // Unparseable — return trimmed raw (status still SUCCESS if title+url present; error only if required fields empty)
  return s.slice(0, 50);
}

function cleanDescription_(s) {
  if (!s) return '';
  let t = String(s);
  // Strip HTML tags
  t = t.replace(/<[^>]*>/g, ' ');
  // Decode entities
  t = t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'").replace(/&nbsp;/g, ' ');
  t = t.replace(/\s+/g, ' ').trim();
  return t;
}

function normalizeGuid_(s) {
  if (!s) return '';
  return String(s).trim().slice(0, 500);
}

function sha1B_(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, String(s))
    .map(function(b){ const v = b < 0 ? b + 256 : b; const h = v.toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}
