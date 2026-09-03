// ═══════════════════════════════════════════════════════════════════════════
// AUDIT — read-only pipeline consistency check
// RAW → NORMALIZED → ARTICLE_DEDUPE → EVENTS → EVENT_ARTICLES → EVENT_SCORES → REVIEWED_EVENTS
// Does NOT modify any sheet except optionally writing AUDIT_REPORT for visibility.
// Run: auditFiWConsistency()
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_AUDIT = 'YOUR_SPREADSHEET_ID';

function getFiwSpreadsheetAudit_() {
  if (!FIW_SPREADSHEET_ID_AUDIT || FIW_SPREADSHEET_ID_AUDIT === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_AUDIT not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_AUDIT);
}

function auditFiWConsistency() {
  const ss = getFiwSpreadsheetAudit_();
  const names = ['RAW','NORMALIZED','ARTICLE_DEDUPE','EVENTS','EVENT_ARTICLES','EVENT_SCORES','REVIEWED_EVENTS','SOURCES','PROCESSING_LOG'];
  const sheets = {};
  names.forEach(n => sheets[n] = ss.getSheetByName(n));

  Logger.log('════════ AUDIT START ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') + ' ════════');

  // 1) Row counts (incl header)
  const counts = {};
  names.forEach(n => {
    const sh = sheets[n];
    if (!sh) { counts[n] = 'MISSING SHEET'; Logger.log('❌ ' + n + ': MISSING SHEET'); }
    else { counts[n] = sh.getLastRow(); Logger.log(n + ': ' + sh.getLastRow() + ' rows incl header → ' + Math.max(0, sh.getLastRow()-1) + ' data rows'); }
  });

  // Helper to read col
  function colValues(sheetName, colIdx) {
    const sh = sheets[sheetName];
    if (!sh || sh.getLastRow() < 2) return [];
    return sh.getRange(2, colIdx, sh.getLastRow()-1, 1).getValues().map(r=>String(r[0]||'').trim()).filter(Boolean);
  }
  function uniqueCount(arr) { return new Set(arr).size; }
  function findDupes(arr) {
    const seen = new Set(); const dupes = new Set();
    for (const v of arr) { if (seen.has(v)) dupes.add(v); else seen.add(v); }
    return Array.from(dupes);
  }

  // 2) Unique IDs at every boundary
  const rawIds = colValues('RAW', 1);
  const normIds = colValues('NORMALIZED', 1); // normalized_id col1
  const normRawIds = colValues('NORMALIZED', 2); // raw_id col2
  const dedupeNids = colValues('ARTICLE_DEDUPE', 1); // normalized_id
  const dedupeRawIds = colValues('ARTICLE_DEDUPE', 8); // raw_id col8
  const eventIds = colValues('EVENTS', 1);
  const eaEventIds = colValues('EVENT_ARTICLES', 1);
  const eaNids = colValues('EVENT_ARTICLES', 2);
  const scoreEventIds = colValues('EVENT_SCORES', 1);
  const revEventIds = colValues('REVIEWED_EVENTS', 1);

  Logger.log('── Unique IDs ──');
  Logger.log('RAW raw_id: ' + rawIds.length + ' total, ' + uniqueCount(rawIds) + ' unique, dupes=' + findDupes(rawIds).length);
  Logger.log('NORMALIZED normalized_id: ' + normIds.length + ' unique=' + uniqueCount(normIds) + ' dupes=' + findDupes(normIds).length);
  Logger.log('NORMALIZED raw_id FK: ' + normRawIds.length + ' unique=' + uniqueCount(normRawIds));
  Logger.log('ARTICLE_DEDUPE normalized_id: ' + dedupeNids.length + ' unique=' + uniqueCount(dedupeNids));
  Logger.log('EVENTS event_id: ' + eventIds.length + ' unique=' + uniqueCount(eventIds) + ' dupes=' + findDupes(eventIds).length);
  Logger.log('EVENT_ARTICLES event_id refs: ' + eaEventIds.length + ' unique events=' + uniqueCount(eaEventIds));
  Logger.log('EVENT_ARTICLES normalized_id refs: ' + eaNids.length + ' unique=' + uniqueCount(eaNids));
  Logger.log('EVENT_SCORES event_id: ' + scoreEventIds.length + ' unique=' + uniqueCount(scoreEventIds));
  Logger.log('REVIEWED_EVENTS event_id: ' + revEventIds.length + ' unique=' + uniqueCount(revEventIds));

  // 3) Orphan / missing references
  Logger.log('── Orphan checks (FK integrity) ──');
  function checkOrphans(name, childArr, parentSet, parentName) {
    const orphans = childArr.filter(id => !parentSet.has(id));
    const uniqOrphans = [...new Set(orphans)];
    Logger.log(name + ' → ' + parentName + ': ' + orphans.length + ' orphan refs, ' + uniqOrphans.length + ' unique orphans' + (uniqOrphans.length? ' e.g. ' + uniqOrphans.slice(0,3).join(', ') : ''));
    return uniqOrphans;
  }
  const rawSet = new Set(rawIds);
  const normSet = new Set(normIds);
  const eventSet = new Set(eventIds);
  const scoreSet = new Set(scoreEventIds);

  checkOrphans('NORMALIZED.raw_id', normRawIds, rawSet, 'RAW.raw_id');
  checkOrphans('ARTICLE_DEDUPE.normalized_id', dedupeNids, normSet, 'NORMALIZED.normalized_id');
  checkOrphans('EVENT_ARTICLES.normalized_id', eaNids, normSet, 'NORMALIZED.normalized_id');
  checkOrphans('EVENT_ARTICLES.event_id', eaEventIds, eventSet, 'EVENTS.event_id');
  checkOrphans('EVENT_SCORES.event_id', scoreEventIds, eventSet, 'EVENTS.event_id');
  checkOrphans('REVIEWED_EVENTS.event_id', revEventIds, scoreSet, 'EVENT_SCORES.event_id');
  // Reverse: events without scores, scores without review
  const eventsWithoutScores = eventIds.filter(id => !scoreSet.has(id));
  Logger.log('EVENTS without EVENT_SCORES: ' + eventsWithoutScores.length + (eventsWithoutScores.length? ' e.g. ' + eventsWithoutScores.slice(0,3).join(', ') : ''));
  const scoresWithoutReview = scoreEventIds.filter(id => !new Set(revEventIds).has(id));
  Logger.log('EVENT_SCORES without REVIEWED_EVENTS: ' + scoresWithoutReview.length);

  // 4) Generation timestamps (last PROCESSING_LOG per stage)
  Logger.log('── Generation timestamps ──');
  const logSheet = sheets['PROCESSING_LOG'];
  if (logSheet && logSheet.getLastRow() > 1) {
    const logVals = logSheet.getDataRange().getValues().slice(1);
    const byStage = {};
    for (const r of logVals) {
      const stage = String(r[3]||'').trim(); // stage col4
      const completed = String(r[5]||''); // completed_at col6
      const runId = String(r[1]||'');
      if (!byStage[stage] || completed > byStage[stage].completed) byStage[stage] = { runId, completed, row: r };
    }
    Object.keys(byStage).forEach(s => Logger.log(s + ': last run ' + byStage[s].runId + ' completed ' + byStage[s].completed));
    // Detect mismatch: EVENTS generation vs EVENT_SCORES generation
    const evGen = byStage['cluster'] ? byStage['cluster'].completed : 'unknown';
    const scoreGen = byStage['score'] ? byStage['score'].completed : 'unknown';
    Logger.log('EVENTS generation (cluster): ' + evGen);
    Logger.log('EVENT_SCORES generation (score): ' + scoreGen);
    if (evGen > scoreGen) Logger.log('⚠️ EVENTS rebuilt AFTER scores — indicates generation mismatch (scores stale)');
  } else {
    Logger.log('PROCESSING_LOG missing or empty');
  }

  // 5) Source universe mismatches
  Logger.log('── Source universe ──');
  const sourcesSheet = sheets['SOURCES'];
  let sourceIds = [];
  if (sourcesSheet && sourcesSheet.getLastRow() > 1) {
    sourceIds = sourcesSheet.getRange(2, 1, sourcesSheet.getLastRow()-1, 1).getValues().map(r=>String(r[0]||'').trim()).filter(Boolean);
    Logger.log('SOURCES sheet: ' + sourceIds.join(', '));
  }
  const rawSourceIds = sheets['RAW'] && sheets['RAW'].getLastRow()>1 ? [...new Set(sheets['RAW'].getRange(2,2,sheets['RAW'].getLastRow()-1,1).getValues().map(r=>String(r[0]||'').trim()).filter(Boolean))] : [];
  Logger.log('RAW distinct source_ids: ' + rawSourceIds.join(', '));
  const orphanSources = rawSourceIds.filter(id => !sourceIds.includes(id));
  Logger.log('RAW source_ids NOT in SOURCES (historical/outside universe): ' + (orphanSources.length? orphanSources.join(', ') : 'none'));
  const unusedSources = sourceIds.filter(id => !rawSourceIds.includes(id));
  Logger.log('SOURCES with 0 RAW rows (untested/disabled): ' + (unusedSources.length? unusedSources.join(', ') : 'none'));

  // 6) Specific user-reported counts
  Logger.log('── User-reported expectation ──');
  Logger.log('Expected: RAW242 NORMALIZED242 DEDUPE242 EVENTS210 EA242 SCORES210 REVIEWED210');
  Logger.log('Actual: RAW' + (counts['RAW']-1) + ' NORM' + (counts['NORMALIZED']-1) + ' DEDUPE' + (counts['ARTICLE_DEDUPE']-1) + ' EVENTS' + (counts['EVENTS']-1) + ' EA' + (counts['EVENT_ARTICLES']-1) + ' SCORES' + (counts['EVENT_SCORES']-1) + ' REVIEWED' + (counts['REVIEWED_EVENTS']-1));

  // Optional write to AUDIT_REPORT sheet (read-only otherwise — does not touch pipeline sheets)
  try {
    let audit = ss.getSheetByName('AUDIT_REPORT') || ss.insertSheet('AUDIT_REPORT');
    audit.clear();
    audit.getRange(1,1,1,3).setValues([['check','value','detail']]);
    const rows = [
      ['RAW data rows', String(counts['RAW']-1), ''],
      ['NORMALIZED data rows', String(counts['NORMALIZED']-1), ''],
      ['ARTICLE_DEDUPE data rows', String(counts['ARTICLE_DEDUPE']-1), ''],
      ['EVENTS data rows', String(counts['EVENTS']-1), ''],
      ['EVENT_ARTICLES data rows', String(counts['EVENT_ARTICLES']-1), ''],
      ['EVENT_SCORES data rows', String(counts['EVENT_SCORES']-1), ''],
      ['REVIEWED_EVENTS data rows', String(counts['REVIEWED_EVENTS']-1), ''],
      ['EVENTS without SCORES', String(eventsWithoutScores.length), eventsWithoutScores.slice(0,5).join(', ')],
      ['SCORES without REVIEW', String(scoresWithoutReview.length), ''],
      ['RAW orphan sources', orphanSources.join(', '), 'historical/outside universe'],
      ['SOURCES unused', unusedSources.join(', '), 'untested'],
      ['AUDIT timestamp', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), '']
    ];
    audit.getRange(2,1,rows.length,3).setValues(rows);
    Logger.log('AUDIT_REPORT sheet written (read-only audit, no pipeline data modified)');
  } catch (e) { Logger.log('AUDIT_REPORT write failed: ' + e.message); }

  Logger.log('════════ AUDIT END — read-only, no pipeline mutation ════════');
}
