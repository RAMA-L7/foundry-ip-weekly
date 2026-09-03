// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1F — HUMAN REVIEW: EVENT_SCORES → REVIEWED_EVENTS
// Invariant: human review adds/overrides interpretation, never destroys
// deterministic result. algorithm_impact 72 vs human_impact 80 delta is gold.
// Boundaries: no LLM, no auto why_it_matters/watch_next, no mutation of 1A-1E.
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_F = 'YOUR_SPREADSHEET_ID';
const REVIEW_SCORING_VERSION = 'v1.0';

// ── Setup ────────────────────────────────────────────────────────────────

function setupFiwPhase1F() {
  const ss = getFiwSpreadsheetF_();
  let rev = ss.getSheetByName('REVIEWED_EVENTS') || ss.insertSheet('REVIEWED_EVENTS');
  rev.getRange(1, 1, 1, 18).setValues([[
    'event_id','canonical_title','category','entities','topic','event_date',
    'algorithm_roadmap','algorithm_technical','algorithm_business','algorithm_confidence','algorithm_impact',
    'human_impact_score','review_status','reviewer','reviewed_at','relevance_decision','why_it_matters','watch_next'
  ]]);
  // Optional extended columns for editorial priority/notes (cols 19-20) — keep 18 core for now, add if needed
  // Ensure header authoritative
  Logger.log('✅ Phase 1F REVIEWED_EVENTS ready — 18 cols, 1E untouched');
}

function getFiwSpreadsheetF_() {
  if (!FIW_SPREADSHEET_ID_F || FIW_SPREADSHEET_ID_F === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_F not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_F);
}

// ── Create review queue (idempotent) ───────────────────────────────────

function createReviewQueueFiWPhase1F() {
  const ss = getFiwSpreadsheetF_();
  const scoresSheet = ss.getSheetByName('EVENT_SCORES');
  const revSheet = ss.getSheetByName('REVIEWED_EVENTS');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!scoresSheet) throw new Error('EVENT_SCORES missing — run 1E first');
  if (!revSheet) throw new Error('REVIEWED_EVENTS missing — run setupFiwPhase1F()');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
              + '-' + Utilities.getUuid().slice(0, 4);
  const RUN_START = Date.now();

  // Idempotence: existing event_ids in REVIEWED_EVENTS
  const existing = new Set(
    revSheet.getLastRow() > 1
      ? revSheet.getRange(2, 1, revSheet.getLastRow()-1, 1).getValues().map(r=>String(r[0]||'').trim()).filter(Boolean)
      : []
  );

  const scoresValues = scoresSheet.getDataRange().getValues();
  const header = scoresValues[0];
  const rows = scoresValues.slice(1).filter(r=>String(r[0]||'').trim());
  // EVENT_SCORES cols: event_id(0),canonical_title(1),category(2),entities(3),topic(4),roadmap(5),technical(6),business(7),confidence(8),impact(9),reason(10),version(11),rank(12),scored_at(13)
  // Join event_date from EVENTS for prioritization
  const eventsSheet = ss.getSheetByName('EVENTS');
  const evDateMap = new Map();
  if (eventsSheet) {
    const evVals = eventsSheet.getDataRange().getValues().slice(1);
    evVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) evDateMap.set(eid, String(r[2]||'')); });
  }

  // Prioritize: HIGH impact first, then low confidence ambiguous, then rest — deterministic rank already in EVENT_SCORES
  // Sort by rank asc (already), to keep review queue prioritized
  rows.sort((a,b)=> parseInt(String(a[12]||'999'),10) - parseInt(String(b[12]||'999'),10));

  const toAdd = rows.filter(r=> !existing.has(String(r[0]||'').trim()));
  Logger.log('Review queue run ' + runId + ' — EVENT_SCORES=' + rows.length + ' already reviewed=' + existing.size + ' to_add=' + toAdd.length);

  const outRows = toAdd.map(r=>{
    const eventId = String(r[0]||'').trim();
    const title = String(r[1]||'');
    const cat = String(r[2]||'');
    const entities = String(r[3]||'');
    const topic = String(r[4]||'');
    const roadmap = String(r[5]||'');
    const technical = String(r[6]||'');
    const business = String(r[7]||'');
    const confidence = String(r[8]||'');
    const impact = String(r[9]||'');
    const eventDate = evDateMap.get(eventId) || '';
    // New rows: human fields blank, status PENDING, relevance undecided
    return [eventId, title.slice(0,300), cat, entities.slice(0,500), topic, eventDate,
            roadmap, technical, business, confidence, impact,
            '', 'PENDING', '', '', '', '', ''];
  });

  if (outRows.length>0) {
    revSheet.getRange(revSheet.getLastRow()+1, 1, outRows.length, 18).setValues(outRows);
  }

  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'review_queue',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,toAdd.length+existing.size,toAdd.length,0,
      'review_queue: +' + outRows.length + ' new, ' + existing.size + ' already queued'
    ]]);
  }
  Logger.log('✅ Review queue ' + runId + ' — +' + outRows.length + ' new, total queued=' + (existing.size+outRows.length) + ' in ' + Math.round((Date.now()-RUN_START)/1000)+'s');
  Logger.log('Prioritized: HIGH (impact≥70) first — review top of sheet first');
  return { runId, added: outRows.length, total: existing.size+outRows.length };
}

// ── Human review helpers (sheet-based, preserves algorithm) ─────────────

function setReviewFiWPhase1F(eventId, fields) {
  // fields: {humanImpactScore, relevanceDecision, whyItMatters, watchNext, reviewer, reviewStatus, editorialPriority, reviewNotes}
  // Preserves algorithm_* — never overwrites algorithm_impact
  const ss = getFiwSpreadsheetF_();
  const revSheet = ss.getSheetByName('REVIEWED_EVENTS');
  if (!revSheet) throw new Error('REVIEWED_EVENTS missing');
  const vals = revSheet.getDataRange().getValues();
  let rowIdx = -1;
  for (let i=1;i<vals.length;i++) if(String(vals[i][0]||'').trim()===String(eventId||'').trim()) { rowIdx=i+1; break; }
  if (rowIdx===-1) throw new Error('event_id not found: ' + eventId);
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  // Cols: 12 human_impact_score, 13 review_status, 14 reviewer, 15 reviewed_at, 16 relevance, 17 why, 18 watch
  if (fields.humanImpactScore!==undefined) revSheet.getRange(rowIdx,12).setValue(String(fields.humanImpactScore).slice(0,10));
  if (fields.reviewStatus!==undefined) revSheet.getRange(rowIdx,13).setValue(String(fields.reviewStatus).slice(0,20));
  else revSheet.getRange(rowIdx,13).setValue('REVIEWED');
  if (fields.reviewer!==undefined) revSheet.getRange(rowIdx,14).setValue(String(fields.reviewer).slice(0,100));
  revSheet.getRange(rowIdx,15).setValue(now);
  if (fields.relevanceDecision!==undefined) revSheet.getRange(rowIdx,16).setValue(String(fields.relevanceDecision).slice(0,20));
  if (fields.whyItMatters!==undefined) revSheet.getRange(rowIdx,17).setValue(String(fields.whyItMatters).slice(0,1000));
  if (fields.watchNext!==undefined) revSheet.getRange(rowIdx,18).setValue(String(fields.watchNext).slice(0,1000));
  Logger.log('✅ Reviewed ' + eventId + ' human=' + fields.humanImpactScore + ' relevance=' + fields.relevanceDecision);
}

function getReviewMetricsFiWPhase1F() {
  const ss = getFiwSpreadsheetF_();
  const revSheet = ss.getSheetByName('REVIEWED_EVENTS');
  const scoresSheet = ss.getSheetByName('EVENT_SCORES');
  if (!revSheet) throw new Error('REVIEWED_EVENTS missing');
  const revVals = revSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim());
  const total = revVals.length;
  const pending = revVals.filter(r=>String(r[12]||'').trim()==='PENDING').length;
  const reviewed = total - pending;
  const relevant = revVals.filter(r=>String(r[15]||'').trim().toUpperCase()==='YES').length;
  // Delta where human_impact differs from algorithm_impact
  let deltas = [];
  for (const r of revVals) {
    const algo = parseInt(String(r[10]||'0'),10);
    const human = parseInt(String(r[11]||'').trim(),10);
    if (!isNaN(algo) && !isNaN(human) && String(r[11]||'').trim()!=='') {
      deltas.push(human - algo);
    }
  }
  const avgDelta = deltas.length? (deltas.reduce((a,b)=>a+b,0)/deltas.length).toFixed(2): 'n/a';
  // Distribution from EVENT_SCORES for context
  let high=0,mid=0,low=0;
  if (scoresSheet) {
    const sVals = scoresSheet.getDataRange().getValues().slice(1);
    for (const r of sVals) { const imp=parseInt(String(r[9]||'0'),10); if(imp>=70) high++; else if(imp>=40) mid++; else low++; }
  }
  Logger.log('Review metrics — total=' + total + ' reviewed=' + reviewed + ' pending=' + pending + ' relevant=' + relevant + ' avgDelta(human-algo)=' + avgDelta);
  Logger.log('Score dist high≥70:' + high + ' mid40-69:' + mid + ' low<40:' + low);
  return { total, reviewed, pending, relevant, avgDelta, high, mid, low };
}
