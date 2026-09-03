// 1I.0 — Select 8 real events for enrichment generalization validation (read-only)
// Reads ROADMAP_IMPACT + EVENT_GATE + EVENTS to list candidates per stratum
// Run: list1I0Candidates()

function list1I0Candidates() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ri = ss.getSheetByName('ROADMAP_IMPACT');
  const gate = ss.getSheetByName('EVENT_GATE');
  const ev = ss.getSheetByName('EVENTS');
  if (!ri || !gate || !ev) throw new Error('ROADMAP_IMPACT/EVENT_GATE/EVENTS missing');

  const riVals = ri.getDataRange().getValues().slice(1);
  const gateMap = new Map();
  if (gate.getLastRow()>1) {
    const gVals = gate.getDataRange().getValues().slice(1);
    gVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) gateMap.set(eid, {relevance:String(r[4]||''), domain:String(r[2]||''), topic:String(r[3]||'')}); });
  }

  Logger.log('════════ 1I.0 CANDIDATE POOL (210 events) ════════');
  Logger.log('event_id | ROADMAP_IMPACT roadmap_result | EVENT_GATE relevance | title');
  for(const r of riVals.slice(0,210)){
    const eid=String(r[1]||'').trim();
    const title=String(r[2]||'').slice(0,70);
    const roadmapResult=String(r[11]||'').trim();
    const g = gateMap.get(eid) || {};
    Logger.log(eid + ' | ' + roadmapResult + ' | ' + (g.relevance||'') + ' | ' + title);
  }

  // Also list INSUFFICIENT specifically
  const insuff = riVals.filter(r=>String(r[15]||'').includes('EVIDENCE_GAP') || String(r[11]||'').trim()==='NO' && String(r[15]||'').includes('INSUFFICIENT'));
  Logger.log('── INSUFFICIENT pool: ' + insuff.length + ' events');
  insuff.slice(0,10).forEach(r=> Logger.log(String(r[1]||'').trim() + ' | ' + String(r[2]||'').slice(0,60)));

  // List CONTEXT for sufficient-but-context stratum
  const ctx = riVals.filter(r=>String(r[11]||'').trim()==='CONTEXT').slice(0,10);
  Logger.log('── CONTEXT sample (for #7):');
  ctx.forEach(r=> Logger.log(String(r[1]||'').trim() + ' | ' + String(r[2]||'').slice(0,60)));

  Logger.log('Select 8 per table: 1-2 CONSEQUENCE, 3 DECISION, 4 ATTRIBUTION, 5 COMPOUND, 6 NEGATIVE, 7 SUFFICIENT→CONTEXT, 8 ROADMAP CANDIDATE');
  Logger.log('Freeze as: event_id | missing_evidence_type | reason');
}
