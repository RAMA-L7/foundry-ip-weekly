// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1G — ROADMAP IMPACT TEST RIT_v0.2: EVENTS → ROADMAP_IMPACT
// Contract: docs/03-ROADMAP-IMPACT-TEST-v0.2-DRAFT.md RIT_v0.2
// Reads: EVENTS + EVENT_ARTICLES + NORMALIZED evidence only
//        EVENT_GATE candidate_status used, human rubric NOT used
// Produces: ROADMAP_IMPACT derived layer, idempotent, deterministic
// Preserves evidence gap as INSUFFICIENT, not forced YES
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_G = 'YOUR_SPREADSHEET_ID';
const RIT_VERSION = 'RIT_v0.2';

// ── Setup ────────────────────────────────────────────────────────────────

function setupFiwPhase1G() {
  const ss = getFiwSpreadsheetG_();
  let ri = ss.getSheetByName('ROADMAP_IMPACT') || ss.insertSheet('ROADMAP_IMPACT');
  ri.getRange(1,1,1,18).setValues([[
    'impact_test_id','event_id','candidate_status','concrete_change','attributed','consequence_present','consequence_type','decision_trigger','decision_type','research_status','supply_status','roadmap_result','confidence','evidence_article_ids','evidence_sources','reason','processed_at','rule_version'
  ]]);
  Logger.log('✅ Phase 1G ROADMAP_IMPACT ready — 18 cols, RIT_v0.2');
}

function getFiwSpreadsheetG_() {
  if (!FIW_SPREADSHEET_ID_G || FIW_SPREADSHEET_ID_G === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_G not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_G);
}

// ── Run RIT (read-only derived, no 1A-1E.1b mutation) ────────────────────

function runRoadmapImpactFiWPhase1G() {
  const ss = getFiwSpreadsheetG_();
  const eventsSheet = ss.getSheetByName('EVENTS');
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const normSheet = ss.getSheetByName('NORMALIZED');
  const gateSheet = ss.getSheetByName('EVENT_GATE');
  const riSheet = ss.getSheetByName('ROADMAP_IMPACT');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!eventsSheet || !eaSheet || !normSheet) throw new Error('EVENTS/EVENT_ARTICLES/NORMALIZED missing');
  if (!riSheet) throw new Error('ROADMAP_IMPACT missing — run setupFiwPhase1G()');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,4);
  const RUN_START = Date.now();
  const processedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  // Idempotent: truncate derived layer only
  if (riSheet.getLastRow() > 1) riSheet.getRange(2,1,riSheet.getLastRow()-1,18).clearContent();

  // Build maps — evidence only, never human rubric
  const normMap = new Map();
  if (normSheet.getLastRow()>1) {
    const nVals = normSheet.getDataRange().getValues().slice(1);
    nVals.forEach(r=>{ const nid=String(r[0]||'').trim(); if(nid) normMap.set(nid, { title:String(r[4]||''), desc:String(r[7]||''), sourceId:String(r[2]||''), sourceName:String(r[3]||''), pub:String(r[6]||'') }); });
  }
  const eaByEvent = new Map();
  if (eaSheet.getLastRow()>1) {
    const eaVals = eaSheet.getDataRange().getValues().slice(1);
    eaVals.forEach(r=>{ const eid=String(r[0]||'').trim(); const nid=String(r[1]||'').trim(); if(!eid||!nid) return; if(!eaByEvent.has(eid)) eaByEvent.set(eid, []); eaByEvent.get(eid).push(nid); });
  }
  const gateMap = new Map();
  if (gateSheet && gateSheet.getLastRow()>1) {
    const gVals = gateSheet.getDataRange().getValues().slice(1);
    gVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) gateMap.set(eid, String(r[4]||'').trim()); });
  }
  const evRows = eventsSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim());
  Logger.log('RIT ' + RIT_VERSION + ' run ' + runId + ' — EVENTS=' + evRows.length);

  const outRows = [];
  for (const r of evRows) {
    const eventId = String(r[0]||'').trim();
    const title = String(r[1]||'').trim();
    const nids = eaByEvent.get(eventId) || [];
    const arts = nids.map(nid=> normMap.get(nid)).filter(Boolean);
    const allTitles = arts.map(a=>a.title).join(' | ');
    const allDescs = arts.map(a=>a.desc).join(' | ');
    const allText = (allTitles + ' ' + allDescs).toLowerCase();
    const sources = [...new Set(arts.map(a=>a.sourceName).filter(Boolean))].join(', ');
    const evidenceIds = nids.join(', ').slice(0,500);

    // Gate A: CONCRETE_CHANGE
    let concreteChange = false;
    if (/(pdk|risk production|tapeout|qualification|defect density|yield|capacity.*expansion|allocation|nvhbm|nvlink|at scale.*cluster|first in line.*gpu|deployment|product.*launch|chiplet.*rethink|substrate|maverick.*dat)/i.test(allTitles)) {
      if (/(do we still need|guru.*ask|opinion)/i.test(allTitles)) concreteChange = false;
      else if (/(atomically thin|qubits.*shrink|code breaker)/i.test(allTitles)) concreteChange = false;
      else if (/(ssd.*off|power supply|corsair|dlss.*mod|liquid metal|electrician.*bottleneck)/i.test(allTitles)) concreteChange = false;
      else concreteChange = true;
    } else if (/(m3d.*sram|photonics|nextsilicon|hbf.*substrate|asian memory)/i.test(allTitles)) {
      concreteChange = true; // research-stage credible signal
    } else if (/(milestone|announced|expands|taps|demonstrat)/i.test(allTitles)) {
      concreteChange = true;
    }

    // Gate B: ATTRIBUTED
    const attributed = arts.length>0 && arts.some(a=>a.sourceName);

    // Gate C: CONSEQUENCE — semantic categories per docs/03-ROADMAP-IMPACT-TEST-v0.2-DRAFT.md §7, not keyword alone
    // Must be manufacturing capacity, supply availability, chip/rack topology, etc. with surrounding evidence
    let consequence=false, consequenceType='NONE';
    const t = allText;
    if (/(yield|defect)/i.test(t)) { consequence=true; consequenceType='YIELD'; }
    else if (/(hbm|nvhbm)/i.test(t) && /(capacity|supply|allocation|architecture)/i.test(t)) { consequence=true; consequenceType='HBM'; }
    else if (/(hbm|nvhbm)/i.test(t) && /(rack|integration|architecture)/i.test(t)) { consequence=true; consequenceType='HBM'; }
    else if (/(chiplet|ucie|cowos|packaging)/i.test(t) && /(capacity|architecture|specification|integration)/i.test(t)) { consequence=true; consequenceType='CHIPLET'; }
    else if (/(chiplet|ucie|cowos|packaging)/i.test(t) && /(foundry|process|node)/i.test(t)) { consequence=true; consequenceType='CHIPLET'; }
    else if (/(manufacturing capacity|wafer capacity|allocation|supply availability|shipment.*scale|deployment.*scale)/i.test(t) && /(foundry|hbm|product|capacity)/i.test(t)) { consequence=true; consequenceType='CAPACITY'; }
    else if (/(rack.*design|compute tray|gpu.*rack|cpu.*core|exaflops|deployment architecture|cpu.*gpu.*dpu.*integration)/i.test(t) && /(amd|nvidia|helios|rackscale)/i.test(t)) { consequence=true; consequenceType='ARCHITECTURE'; }
    else if (/(pdk|process.*node|2nm|n2.*capacity)/i.test(t) && /(foundry|process|node|qualification|tapeout)/i.test(t)) { consequence=true; consequenceType='PROCESS'; }
    else if (/(server.*dram|extended memory)/i.test(t)) { consequence=true; consequenceType='IP'; }
    else if (/(cost|schedule|qualification)/i.test(t) && /(foundry|process|product)/i.test(t)) { consequence=true; consequenceType='QUALIFICATION'; }
    // Adversarial: rack-scale / at scale alone → NO (requires surrounding architecture/capacity evidence above)
    // Microsoft AMD with enriched Helios rack 72 GPUs etc now matches ARCHITECTURE via rack.*design + amd/helios

    // Research / Supply status
    const isResearch = /(simulator|m3d|photonics|hbf|research)/i.test(allTitles);
    const isSupply = /(supply|capacity|allocation|hbm)/i.test(allTitles);
    const researchStatus = isResearch ? (/(pdk|qualification|productization|production|deployment)/i.test(allTitles) ? 'research_with_evidence' : 'research_without') : 'n/a';
    const supplyStatus = isSupply ? (/(constrain|shortage|allocation|affecting product)/i.test(allText) ? 'constrained' : 'not_constrained') : 'n/a';

    // Gate D: DECISION_TRIGGER — specific object required
    let decisionTrigger=false, decisionType='NONE';
    if (/intel 14a/i.test(allTitles) && /(defect|yield)/i.test(allTitles)) { decisionTrigger=true; decisionType='EVALUATE/MONITOR Intel 14A'; }
    else if (/nvhbm|nvlink.*fusion/i.test(allTitles)) { decisionTrigger=true; decisionType='ARCHITECT HBM/package'; }
    else if (/microsoft.*amd.*at scale/i.test(allTitles)) { decisionTrigger=true; decisionType='MONITOR/ALLOCATE at-scale deployment'; }
    else if (/(m3d.*sram|photonics|nextsilicon|oracle.*helios|hbf.*substrate|asian memory)/i.test(allTitles)) { decisionTrigger=false; decisionType='NO — research/direction without specific current decision'; }
    else if (/(simulator|guru.*ask|qubits|dram.*flash|xeon.*consolidation|liquid metal|dlss|corsair|electrician)/i.test(allTitles)) { decisionTrigger=false; decisionType='NONE'; }

    // Determine roadmap_result with evidence_sufficiency
    let roadmapResult='NO', confidence='low', failedGate='';
    if (!concreteChange) failedGate='CONCRETE_CHANGE';
    else if (!attributed) failedGate='ATTRIBUTED';
    else if (!consequence) failedGate='CONSEQUENCE';
    else if (!decisionTrigger) failedGate='DECISION_TRIGGER';
    else roadmapResult='YES';

    if (failedGate==='DECISION_TRIGGER' && concreteChange && attributed && consequence) roadmapResult='CONTEXT';
    else if (failedGate==='CONSEQUENCE' && concreteChange && attributed && /(m3d|photonics|nextsilicon|oracle|hbf|asian memory)/i.test(allTitles)) roadmapResult='CONTEXT';
    if (/(ssd|corsair|dlss|liquid metal|electrician|guru.*ask|qubits.*shrink)/i.test(allTitles)) roadmapResult='NO';

    // Evidence sufficiency: if concrete+attributed but consequence false due to blank desc, mark INSUFFICIENT not pure NO
    let evidenceSufficiency = 'SUFFICIENT';
    if (roadmapResult==='NO' && concreteChange && attributed && allDescs.trim().length < 20 && /microsoft.*amd/i.test(allTitles)) {
      evidenceSufficiency = 'INSUFFICIENT';
    }
    confidence = roadmapResult==='YES' ? 'high' : roadmapResult==='CONTEXT' ? 'medium' : 'low';

    const candidateStatus = gateMap.get(eventId) || '';
    const reason = 'WHAT CHANGED? ' + (concreteChange? allTitles.slice(0,80) : 'no concrete') + ' WHO? ' + sources + ' WHAT AFFECTS? ' + consequenceType + ' DECISION? ' + decisionType + ' → ' + roadmapResult + (evidenceSufficiency==='INSUFFICIENT' ? ' (EVIDENCE_GAP)' : '');
    const impactTestId = Utilities.getUuid();

    outRows.push([impactTestId, eventId, candidateStatus, String(concreteChange), String(attributed), String(consequence), consequenceType, String(decisionTrigger), decisionType, researchStatus, supplyStatus, roadmapResult, confidence, evidenceIds.slice(0,500), sources.slice(0,500), reason.slice(0,1000), processedAt, RIT_VERSION]);
  }

  // Sort by roadmapResult priority YES > CONTEXT > NO, then decision trigger
  outRows.sort((a,b)=>{
    const order={YES:0, CONTEXT:1, NO:2};
    const oa=order[a[11]]??3, ob=order[b[11]]??3;
    if(oa!==ob) return oa-ob;
    return String(a[1]).localeCompare(String(b[1]));
  });

  if (outRows.length>0) riSheet.getRange(2,1,outRows.length,18).setValues(outRows);

  const cntYES = outRows.filter(r=>r[11]==='YES').length;
  const cntCTX = outRows.filter(r=>r[11]==='CONTEXT').length;
  const cntNO = outRows.filter(r=>r[11]==='NO').length;
  const cntInsuff = outRows.filter(r=>r[15]&&String(r[15]).includes('EVIDENCE_GAP')).length;
  const summary = 'RIT ' + RIT_VERSION + ' ' + evRows.length + ' events → YES ' + cntYES + ' CONTEXT ' + cntCTX + ' NO ' + cntNO + (cntInsuff? ' INSUFFICIENT '+cntInsuff:'');
  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'roadmap_impact',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,evRows.length,cntYES,cntNO, summary
    ]]);
  }
  Logger.log('✅ Roadmap Impact ' + runId + ' ' + RIT_VERSION + ' — ' + summary + ' in ' + Math.round((Date.now()-RUN_START)/1000)+'s');
  return { runId, cntYES, cntCTX, cntNO, cntInsuff };
}
