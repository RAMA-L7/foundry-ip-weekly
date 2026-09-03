// PHASE 2C — 210 EVENT REPLAY: OLD ROADMAP/CONTEXT/OUT vs NEW Decision Signal
// Reads: EVENTS 210 + ROADMAP_IMPACT + EVENT_GATE (old) → produces DECISION_SIGNALS replay
// New: EVALUATE/QUALIFY/SOURCE/ARCHITECT/SCHEDULE/MONITOR/NO_SIGNAL per DS_v0.1
// No mutation of old labels, deterministic, idempotent

const FIW_SPREADSHEET_ID_2C = 'YOUR_SPREADSHEET_ID';

function getFiwSpreadsheet2C_() {
  if (!FIW_SPREADSHEET_ID_2C || FIW_SPREADSHEET_ID_2C === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_2C not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_2C);
}

function setupFiwPhase2C() {
  const ss = getFiwSpreadsheet2C_();
  let ds = ss.getSheetByName('DECISION_SIGNALS') || ss.insertSheet('DECISION_SIGNALS');
  ds.getRange(1,1,1,16).setValues([[
    'signal_id','event_id','signal_version','event_title','what_changed','impact','primary_decision','secondary_decisions','decision_object','owner','horizon','confidence','evidence_sufficiency','why_it_matters','watch_next','created_at'
  ]]);
  Logger.log('✅ Phase 2C DECISION_SIGNALS ready — 16 cols DS_v0.1');
}

function replay210FiWPhase2C() {
  const ss = getFiwSpreadsheet2C_();
  const eventsSheet = ss.getSheetByName('EVENTS');
  const gateSheet = ss.getSheetByName('EVENT_GATE');
  const roadmapSheet = ss.getSheetByName('ROADMAP_IMPACT');
  const dsSheet = ss.getSheetByName('DECISION_SIGNALS');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!eventsSheet || !gateSheet || !roadmapSheet) throw new Error('EVENTS/GATE/ROADMAP_IMPACT missing');
  if (!dsSheet) throw new Error('DECISION_SIGNALS missing — run setupFiwPhase2C()');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,4);
  const RUN_START = Date.now();

  // Idempotent: truncate derived
  if (dsSheet.getLastRow()>1) dsSheet.getRange(2,1,dsSheet.getLastRow()-1,16).clearContent();

  const evVals = eventsSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim());
  const gateMap = new Map();
  if (gateSheet.getLastRow()>1) {
    const gVals = gateSheet.getDataRange().getValues().slice(1);
    gVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) gateMap.set(eid, {relevance:String(r[4]||''), domain:String(r[2]||''), topic:String(r[3]||'')}); });
  }
  const riMap = new Map();
  if (roadmapSheet.getLastRow()>1) {
    const riVals = roadmapSheet.getDataRange().getValues().slice(1);
    riVals.forEach(r=>{ const eid=String(r[1]||'').trim(); if(eid) riMap.set(eid, {roadmapResult:String(r[11]||'').trim(), consequenceType:String(r[6]||''), decisionType:String(r[8]||''), confidence:String(r[12]||'').trim()}); });
  }

  const outRows = [];
  const oldDist = { ROADMAP:0, CONTEXT:0, OUT:0, NO:0 };
  const newDist = { EVALUATE:0, QUALIFY:0, SOURCE:0, ARCHITECT:0, SCHEDULE:0, MONITOR:0, NO_SIGNAL:0 };
  const impactDist = {}, ownerDist = {}, horizonDist = {};

  for(const r of evVals){
    const eventId = String(r[0]||'').trim();
    const title = String(r[1]||'').trim();
    const gate = gateMap.get(eventId) || {relevance:'OUT_OF_SCOPE', domain:'Market / Policy', topic:'General'};
    const ri = riMap.get(eventId) || {roadmapResult:'NO', consequenceType:'NONE'};

    // Old classification baseline (do not mutate)
    const oldClass = ri.roadmapResult || gate.relevance; // ROADMAP/CONTEXT/NO
    if (oldClass==='YES' || oldClass==='ROADMAP') oldDist.ROADMAP++;
    else if (oldClass==='CONTEXT') oldDist.CONTEXT++;
    else if (gate.relevance==='OUT_OF_SCOPE') oldDist.OUT++;
    else oldDist.NO++;

    // New Decision Signal generation — deterministic, evidence-backed
    const tl = title.toLowerCase();
    let primary='NO_SIGNAL', secondary=[], impact='Supply', owner='Technology Planning', horizon='6–18m', confidence='MEDIUM', evidenceSuff='SUFFICIENT';
    let decisionObject = title.slice(0,80);
    let whatChanged = title.slice(0,200);
    let whyItMatters = '', watchNext='';

    // Map old RIT + gate to new decision taxonomy
    if (gate.relevance==='OUT_OF_SCOPE' || ri.roadmapResult==='NO') {
      // Check if still MONITOR-eligible (relevant but not decision)
      if (/(hbf|photonics|nextsilicon|oracle|sk hynix)/i.test(tl) && /(research|chiplet|substrate)/i.test(tl)) {
        primary='MONITOR'; impact='Technology'; owner='Architecture'; horizon='12–36m'; confidence='MEDIUM'; whyItMatters='Research-stage but worth tracking'; watchNext='Productization/qualification';
      } else {
        primary='NO_SIGNAL';
      }
    } else if (ri.roadmapResult==='YES' || gate.relevance==='ROADMAP_RELEVANT') {
      // Strong roadmap — map to decision type by topic
      if (/(pdk|qualification|tapeout)/i.test(tl)) { primary='QUALIFY'; impact='Technology'; owner='Product'; horizon='Now'; }
      else if (/(capacity|supply|allocation|hbm)/i.test(tl)) { primary='SOURCE'; impact='Supply'; owner='Supply Chain'; horizon='Now'; }
      else if (/(cowos|chiplet|packaging|hbm|architecture)/i.test(tl)) { primary='ARCHITECT'; impact='Architecture'; owner='Architecture'; horizon='6–18m'; }
      else if (/(schedule|timeline|delay)/i.test(tl)) { primary='SCHEDULE'; impact='Schedule'; owner='Product'; horizon='0–6m'; }
      else { primary='EVALUATE'; impact='Technology'; owner='Architecture'; horizon='6–18m'; }
      confidence='HIGH';
      whyItMatters='Concrete roadmap consequence with decision trigger';
      watchNext='Qualification/production milestone';
    } else if (ri.roadmapResult==='CONTEXT' || gate.relevance==='CONTEXT_RELEVANT') {
      // Context — mostly MONITOR, some EVALUATE
      if (/(intel 14a|yield|defect)/i.test(tl)) { primary='EVALUATE'; impact='Technology'; }
      else if (/(nvhbm|nvlink)/i.test(tl)) { primary='ARCHITECT'; impact='Memory'; }
      else { primary='MONITOR'; impact='Technology'; }
      owner='Architecture'; horizon='12–36m'; confidence='MEDIUM';
      whyItMatters='Useful context, no immediate decision'; watchNext='Monitor for concrete milestone';
    }

    // Ensure NO_SIGNAL has no decision object
    if (primary==='NO_SIGNAL') { decisionObject=''; whyItMatters=''; watchNext=''; confidence='LOW'; evidenceSuff='INSUFFICIENT'; }

    if (primary!=='NO_SIGNAL') {
      newDist[primary] = (newDist[primary]||0)+1;
      impactDist[impact] = (impactDist[impact]||0)+1;
      ownerDist[owner] = (ownerDist[owner]||0)+1;
      horizonDist[horizon] = (horizonDist[horizon]||0)+1;
      const signalId = 'S-' + eventId + '-v1';
      outRows.push([signalId, eventId, 'DS_v0.1', title.slice(0,200), whatChanged, impact, primary, secondary.join(','), decisionObject, owner, horizon, confidence, evidenceSuff, whyItMatters.slice(0,300), watchNext.slice(0,300), Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')]);
    } else {
      newDist.NO_SIGNAL++;
    }
  }

  // Write only signals (NO_SIGNAL not stored as row, counted)
  if (outRows.length>0) dsSheet.getRange(2,1,outRows.length,16).setValues(outRows);

  const summary = 'Replay 210 → OLD ROADMAP:' + oldDist.ROADMAP + ' CONTEXT:' + oldDist.CONTEXT + ' OUT:' + oldDist.OUT + ' | NEW ' + Object.entries(newDist).map(kv=>kv[0]+':'+kv[1]).join(' ');
  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'replay_2C',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,evVals.length,outRows.length, evVals.length-outRows.length, summary
    ]]);
  }
  Logger.log('✅ Replay ' + runId + ' — ' + summary + ' in ' + Math.round((Date.now()-RUN_START)/1000)+'s');
  Logger.log('Impact ' + JSON.stringify(impactDist) + ' Owner ' + JSON.stringify(ownerDist) + ' Horizon ' + JSON.stringify(horizonDist));
  return { runId, oldDist, newDist, impactDist };
}
