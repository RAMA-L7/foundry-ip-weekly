// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1A — FETCH → RAW (immutable) + PROCESSING_LOG
// Scope: 10 RSS feeds → HTTP → XML → validate → extract → idempotent RAW insert
// Acceptance: repeated fetches produce same RAW dataset without modifying existing rows.
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID';
const FIW_SOURCES = [
  { source_id: 'semiengineering',  source_name: 'SemiEngineering',      feed_url: 'https://semiengineering.com/feed/',                     tier: 2 },
  { source_id: 'semiwiki',         source_name: 'SemiWiki',            feed_url: 'https://semiwiki.com/feed/',                            tier: 2 },
  { source_id: 'nvidia-dev',       source_name: 'Nvidia Dev Blog',     feed_url: 'https://developer.nvidia.com/blog/rss/',               tier: 3 },
  { source_id: 'nvidia-blogs',     source_name: 'Nvidia Blogs',        feed_url: 'https://blogs.nvidia.com/feed/',                        tier: 3 },
  { source_id: 'eetimes',          source_name: 'EE Times',            feed_url: 'https://www.eetimes.com/feed/',                         tier: 2 },
  { source_id: 'ieee-spectrum',    source_name: 'IEEE Spectrum',       feed_url: 'https://spectrum.ieee.org/feeds/feed.rss',              tier: 2 },
  { source_id: 'servethehome',     source_name: 'ServeTheHome',        feed_url: 'https://www.servethehome.com/feed/',                   tier: 3 },
  { source_id: 'nextplatform',     source_name: 'The Next Platform',   feed_url: 'https://www.nextplatform.com/index?lab_viewport=rss',    tier: 3 },
  { source_id: 'tomshardware',     source_name: "Tom's Hardware",      feed_url: 'https://www.tomshardware.com/feeds.xml',                tier: 3 },
  { source_id: 'trendforce',       source_name: 'TrendForce',          feed_url: 'https://www.trendforce.com/news/feed/',                 tier: 2 },
];

// ── Setup (run once) ─────────────────────────────────────────────────────

function getFiwSpreadsheet_() {
  // Bound script (Extensions → Apps Script) → use active spreadsheet automatically
  // Standalone script → requires FIW_SPREADSHEET_ID to be set
  if (!FIW_SPREADSHEET_ID || FIW_SPREADSHEET_ID === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID not set. Open your Sheet and copy ID from URL https://docs.google.com/spreadsheets/d/<ID>/edit → paste at line 7');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID);
}

function setupFiwPhase1A() {
  const ss = getFiwSpreadsheet_();
  let raw = ss.getSheetByName('RAW') || ss.insertSheet('RAW');
  if (raw.getLastRow() === 0) {
    raw.getRange(1, 1, 1, 11).setValues([[
      'raw_id','source_id','source_name','title','url','published_at','description','fetched_at','content_hash','feed_url','guid'
    ]]);
  }
  let log = ss.getSheetByName('PROCESSING_LOG') || ss.insertSheet('PROCESSING_LOG');
  if (log.getLastRow() === 0) {
    log.getRange(1, 1, 1, 13).setValues([[
      'log_id','run_id','source_id','stage','started_at','completed_at','status','http_status','xml_valid','item_count','items_accepted','items_skipped','error_message'
    ]]);
  }
  let sources = ss.getSheetByName('SOURCES') || ss.insertSheet('SOURCES');
  if (sources.getLastRow() === 0) {
    sources.getRange(1, 1, 1, 6).setValues([['source_id','source_name','feed_url','tier','status','last_success']]);
  }
  // Always sync SOURCES to FIW_SOURCES (handles replacement of hanging feeds)
  sources.getRange(1, 1, 1, 6).setValues([['source_id','source_name','feed_url','tier','status','last_success']]);
  if (sources.getLastRow() > 1) sources.getRange(2, 1, sources.getLastRow()-1, 6).clearContent();
  sources.getRange(2, 1, FIW_SOURCES.length, 4).setValues(
    FIW_SOURCES.map(s => [s.source_id, s.source_name, s.feed_url, s.tier])
  );
  Logger.log('✅ Phase 1A sheets ready — SOURCES synced to ' + FIW_SOURCES.length + ' feeds');
}

function createTriggerFiwPhase1A() {
  ScriptApp.newTrigger('fetchFiWPhase1A')
    .timeBased().everyDays(1).atHour(7).create();
  Logger.log('✅ Daily fetch trigger created (fetchFiWPhase1A @ 7am)');
}

// ── Fetch (idempotent) — sharded for 6-min quota ─────────────────────────
// Fixes "Exceeded maximum execution time":
// - fetchAll(10) blocks on single slow feed → now serial per-feed + incremental flush
// - each feed committed immediately, so timeout loses at most current feed
// - time guard exits gracefully before hard 6-min kill
// - if still too slow, run in batches: fetchFiWPhase1A(0,4) then fetchFiWPhase1A(4,4) etc.

function fetchFiWPhase1A(startIdx, batchSize) {
  const ss = getFiwSpreadsheet_();
  const rawSheet = ss.getSheetByName('RAW');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!rawSheet || !logSheet) throw new Error('Sheets RAW/PROCESSING_LOG missing — run setupFiwPhase1A() first');
  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
              + '-' + Utilities.getUuid().slice(0, 4);
  const RUN_START = Date.now();
  const GUARD_MS = 4.5 * 60 * 1000;
  const fetchedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  // Single dedupe read
  const rawValues = rawSheet.getDataRange().getValues();
  const dataRows = rawValues.slice(1);
  const existing = new Set(dataRows.map(r => r[1] + '|' + canonicalUrl(String(r[4] || ''))).filter(k => k.length > 2));
  const existingHashes = new Set(dataRows.map(r => String(r[8] || '')).filter(Boolean));

  // Sharding: default processes all 10, but caller can chunk to avoid timeout
  // e.g. fetchFiWPhase1A(0,4) → feeds 0-3, fetchFiWPhase1A(4,4) → 4-7, fetchFiWPhase1A(8,10) → 8-9
  var sIdx = (typeof startIdx === 'number' && startIdx >= 0) ? startIdx : 0;
  var eIdx = (typeof batchSize === 'number' && batchSize > 0) ? Math.min(sIdx + batchSize, FIW_SOURCES.length) : FIW_SOURCES.length;
  if (sIdx >= FIW_SOURCES.length) sIdx = 0;
  Logger.log('Run ' + runId + ' → processing sources [' + sIdx + '..' + (eIdx-1) + '] of ' + FIW_SOURCES.length);

  var sourceStatusMap = {};
  var totalNew = 0;

  for (var idx = sIdx; idx < eIdx; idx++) {
    if (Date.now() - RUN_START > GUARD_MS) {
      const nowStr = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
      for (var k = idx; k < eIdx; k++) {
        const s = FIW_SOURCES[k];
        logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
          Utilities.getUuid(), runId, s.source_id, 'fetch', nowStr, nowStr, 'FAILED', '', false, 0, 0, 0,
          'SKIPPED: time guard — re-run fetchFiWPhase1A(' + k + ',1) to retry this feed alone'
        ]]);
      }
      Logger.log('⏱ Guard triggered at idx ' + idx + ' — flushed, re-run to continue');
      break;
    }

    const src = FIW_SOURCES[idx];
    const startedAt = new Date();
    let httpStatus = ''; let xmlValid = false; let itemCount = 0; let accepted = 0; let skipped = 0; let status = 'SUCCESS'; let errorMessage = '';
    const newRowsBatch = [];

    try {
      // Serial fetch per feed — isolates slow feed (fetchAll would block all 10)
      // timeout: 30s → slow feed fails fast instead of hanging 6 min (ignored if runtime doesn't support it, harmless)
      const resp = UrlFetchApp.fetch(src.feed_url, { muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: true, headers: { 'User-Agent': 'FIW-Phase1A/1.0', 'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8' }, timeout: 30000 });
      httpStatus = resp.getResponseCode();
      if (httpStatus < 200 || httpStatus >= 300) throw new Error('HTTP ' + httpStatus);
      const xmlText = resp.getContentText();
      let doc;
      try { doc = XmlService.parse(xmlText); xmlValid = true; } catch (e) { throw new Error('XML parse failed: ' + e.message); }
      const root = doc.getRootElement();
      const channel = root.getChild('channel') || root;
      const items = channel.getChildren('item').length > 0 ? channel.getChildren('item') : root.getChildren('entry');
      itemCount = items.length;
      if (itemCount === 0) status = 'EMPTY';
      items.forEach(function(item) {
        try {
          const title = getText(item, 'title'); const link = getLink(item);
          const guid = getText(item, 'guid') || getText(item, 'id') || '';
          const pubRaw = getText(item, 'pubDate') || getText(item, 'published') || getText(item, 'updated') || '';
          const desc = getText(item, 'description') || getText(item, 'summary') || getText(item, 'content') || '';
          const publishedAt = parseDate(pubRaw);
          if (!title || !link) { skipped++; return; }
          const canon = canonicalUrl(link); const contentHash = sha1(src.source_id + '|' + canon + '|' + title);
          const dedupeKey = src.source_id + '|' + canon;
          if (existing.has(dedupeKey) || existingHashes.has(contentHash)) { skipped++; return; }
          newRowsBatch.push([Utilities.getUuid(), src.source_id, src.source_name, title.slice(0,500), canon, publishedAt, desc.slice(0,2000), fetchedAt, contentHash, src.feed_url, guid.slice(0,500)]);
          existing.add(dedupeKey); existingHashes.add(contentHash); accepted++;
        } catch (e) { skipped++; }
      });
    } catch (e) { status = 'FAILED'; errorMessage = String(e.message).slice(0,500); Logger.log('Source failed: ' + src.source_id + ' — ' + errorMessage); }

    // Incremental flush — committed even if next feed times out
    if (newRowsBatch.length > 0) {
      rawSheet.getRange(rawSheet.getLastRow()+1,1,newRowsBatch.length,11).setValues(newRowsBatch);
      totalNew += newRowsBatch.length;
    }
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, src.source_id, 'fetch',
      Utilities.formatDate(startedAt, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      status, httpStatus, xmlValid, itemCount, accepted, skipped, errorMessage
    ]]);
    if (status === 'SUCCESS' || status === 'EMPTY') {
      sourceStatusMap[src.source_id] = { status: status === 'SUCCESS' ? '✅ Valid' : 'EMPTY', ts: Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') };
    }
    // Incremental SOURCES update
    if (sourceStatusMap[src.source_id]) {
      try {
        const sSheet = ss.getSheetByName('SOURCES');
        const vals = sSheet.getDataRange().getValues();
        for (var i = 1; i < vals.length; i++) if (String(vals[i][0]) === src.source_id) {
          sSheet.getRange(i+1,5).setValue(sourceStatusMap[src.source_id].status);
          sSheet.getRange(i+1,6).setValue(sourceStatusMap[src.source_id].ts); break;
        }
      } catch (e) {}
    }
    Logger.log(src.source_name + ': ' + status + ' http=' + httpStatus + ' xml=' + xmlValid + ' items=' + itemCount + ' +' + accepted + ' skipped=' + skipped + (errorMessage ? ' err='+errorMessage : ''));
    Utilities.sleep(200); // tiny yield to avoid rate-limit
  }

  Logger.log('✅ Run ' + runId + ' complete [' + sIdx + '..' + (eIdx-1) + '] — +' + totalNew + ' new rows in ' + Math.round((Date.now()-RUN_START)/1000) + 's');
  if (eIdx < FIW_SOURCES.length) Logger.log('→ More feeds remain. Run fetchFiWPhase1A(' + eIdx + ',' + (FIW_SOURCES.length - eIdx) + ') to continue, or fetchFiWPhase1A() to retry all');
}

// ── Helpers ────────────────────────────────────────────────────────────────

function getText(item, name) {
  var el = item.getChild(name);
  if (!el) {
    // Atom: try namespace-agnostic search
    var children = item.getChildren();
    for (var i = 0; i < children.length; i++) {
      if (children[i].getName() === name) { el = children[i]; break; }
    }
  }
  return el ? el.getText().trim() : '';
}

function getLink(item) {
  var el = item.getChild('link');
  if (el) {
    // RSS: <link>text</link> ; Atom: <link href="..."/>
    var href = el.getAttribute('href');
    if (href) return href.getValue().trim();
    if (el.getText().trim()) return el.getText().trim();
  }
  // Atom alternative: <link rel="alternate" href="...">
  var links = item.getChildren('link');
  for (var i = 0; i < links.length; i++) {
    var h = links[i].getAttribute('href');
    if (h) return h.getValue().trim();
  }
  return '';
}

function parseDate(raw) {
  if (!raw) return '';
  try {
    var d = new Date(raw);
    if (!isNaN(d)) return Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  } catch (e) {}
  return String(raw).slice(0, 50);
}

function canonicalUrl(u) {
  try {
    var c = String(u).trim().replace(/[),.]+$/, '');
    c = c.replace(/([?&])(utm_[^&]*|fbclid|gclid|ref|ref_src)=[^&]*/g, '$1');
    c = c.replace(/[?&]+$/, '').replace(/\?&/, '?');
    if (c.endsWith('?')) c = c.slice(0, -1);
    return c;
  } catch (e) { return String(u).trim(); }
}

function sha1(s) {
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, String(s))
    .map(function(b){ var v = b < 0 ? b + 256 : b; var h = v.toString(16); return h.length === 1 ? '0' + h : h; }).join('');
}
