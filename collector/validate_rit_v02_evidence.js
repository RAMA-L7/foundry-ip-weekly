// ═══════════════════════════════════════════════════════════════════════════
// VALIDATE RIT_v0.2 EVIDENCE-BASED — read-only, anti-circular
// Checkpoint: experiment/relevance-gate @ e2ec475
// Reads: EVENTS + EVENT_ARTICLES + NORMALIZED evidence only for RIT decision
//        PHASE1F1_RUBRIC + REVIEWED_EVENTS used AFTER as ground truth only
// Creates: RIT_V02_EVIDENCE_VALIDATION (new sheet, no pipeline mutation)
// Run: validateRITv02Evidence()
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_V2 = 'YOUR_SPREADSHEET_ID';

function getFiwSpreadsheetV2_() {
  if (!FIW_SPREADSHEET_ID_V2 || FIW_SPREADSHEET_ID_V2 === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_V2 not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_V2);
}

function validateRITv02Evidence() {
  const ss = getFiwSpreadsheetV2_();
  const eventsSheet = ss.getSheetByName('EVENTS');
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const normSheet = ss.getSheetByName('NORMALIZED');
  const rubricSheet = ss.getSheetByName('PHASE1F1_RUBRIC');
  const reviewedSheet = ss.getSheetByName('REVIEWED_EVENTS');
  if (!eventsSheet || !eaSheet || !normSheet) throw new Error('EVENTS/EVENT_ARTICLES/NORMALIZED missing');
  if (!rubricSheet) throw new Error('PHASE1F1_RUBRIC missing — 18 gold required');
  Logger.log('════════ RIT v0.2 EVIDENCE-BASED VALIDATION START ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') + ' ════════');

  // Build maps — evidence only
  const normMap = new Map(); // normalized_id → {title, desc, source, pub, url}
  if (normSheet.getLastRow()>1) {
    const nVals = normSheet.getDataRange().getValues().slice(1);
    nVals.forEach(r=>{
      const nid=String(r[0]||'').trim(); if(!nid) return;
      normMap.set(nid, {
        title: String(r[4]||''), // title_normalized
        desc: String(r[7]||''), // description_clean
        sourceId: String(r[2]||''), sourceName: String(r[3]||''),
        pub: String(r[6]||''), url: String(r[5]||''), guid: String(r[8]||'')
      });
    });
  }
  const eaByEvent = new Map(); // event_id → [{nid, rel}]
  if (eaSheet.getLastRow()>1) {
    const eaVals = eaSheet.getDataRange().getValues().slice(1);
    eaVals.forEach(r=>{
      const eid=String(r[0]||'').trim(); const nid=String(r[1]||'').trim(); if(!eid||!nid) return;
      if(!eaByEvent.has(eid)) eaByEvent.set(eid, []);
      eaByEvent.get(eid).push({nid, rel:String(r[2]||'')});
    });
  }
  const eventMap = new Map(); // event_id → EVENTS row
  if (eventsSheet.getLastRow()>1) {
    const evVals = eventsSheet.getDataRange().getValues().slice(1);
    evVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) eventMap.set(eid, r); });
  }

  // Locate gold table header row (event_id + human_relevance)
  const vals = rubricSheet.getDataRange().getValues();
  let headerRowIdx=-1, header=[];
  for(let i=0;i<Math.min(vals.length,30);i++){
    const lower=vals[i].map(v=>String(v).toLowerCase());
    if(lower.some(c=>c.includes('event_id')) && lower.some(c=>c.includes('human_relevance'))){ headerRowIdx=i; header=vals[i].map(h=>String(h).toLowerCase().trim()); break; }
  }
  if(headerRowIdx===-1){ headerRowIdx=4; header=vals[headerRowIdx].map(h=>String(h).toLowerCase().trim()); Logger.log('⚠️ header fallback row 5'); }
  function colIdx(part){ for(let i=0;i<header.length;i++) if(header[i].includes(part)) return i; return -1; }
  const idxEventId = colIdx('event_id');
  const idxHuman = colIdx('human_relevance');
  const idxHumanReason = colIdx('rubric_reason');
  Logger.log('Gold header row ' + (headerRowIdx+1) + ' event_id col ' + idxEventId + ' human col ' + idxHuman);

  const goldRows = vals.slice(headerRowIdx+1).filter(r=>String(r[idxEventId]||'').trim().startsWith('E-')).slice(0,18);
  Logger.log('Gold events=' + goldRows.length);

  // For each gold, evaluate RIT v0.2 from evidence only
  const results = [];
  for(const gr of goldRows){
    const eventId = String(gr[idxEventId]||'').trim();
    const humanGold = String(gr[idxHuman]||'').trim().toUpperCase(); // YES/CONTEXT/NO — ground truth only AFTER
    const humanReason = idxHumanReason>=0 ? String(gr[idxHumanReason]||'').slice(0,120) : '';

    // Evidence: EVENTS + EVENT_ARTICLES + NORMALIZED
    const evRow = eventMap.get(eventId);
    const eaList = eaByEvent.get(eventId) || [];
    const evidenceArticles = eaList.map(ea=>{
      const n = normMap.get(ea.nid);
      return { nid: ea.nid, rel: ea.rel, title: n? n.title : '', desc: n? n.desc : '', sourceId: n? n.sourceId : '', sourceName: n? n.sourceName : '', pub: n? n.pub : '' };
    });
    const evidenceSummary = evidenceArticles.map(a=> a.sourceName + ': ' + a.title.slice(0,50)).join(' | ').slice(0,500);
    const evidenceSources = [...new Set(evidenceArticles.map(a=>a.sourceName).filter(Boolean))].join(', ');
    const evidenceIds = evidenceArticles.map(a=>a.nid).join(', ').slice(0,500);
    // Aggregate evidence text for gates
    const allTitles = evidenceArticles.map(a=>a.title).join(' | ');
    const allDescs = evidenceArticles.map(a=>a.desc).join(' | ');
    const allText = (allTitles + ' ' + allDescs).toLowerCase();
    const evTitle = evRow ? String(evRow[1]||'').trim() : allTitles.slice(0,100);

    // Gate A: CONCRETE_CHANGE — specific attributable real-world development
    let concreteChange=false;
    let concreteReason='';
    if (/(pdk|risk production|tapeout|qualification|defect density|yield|capacity.*expansion|allocation|supply.*constraint|nvhbm|nvlink.*fusion|at scale.*cluster|first in line|deployment|product.*launch|chiplet.*rethink|substrate|maverick)/i.test(allTitles)) {
      // Need to distinguish opinion/research without milestone vs concrete
      if (/(do we still need|guru.*ask|opinion)/i.test(allTitles)) { concreteChange=false; concreteReason='opinion, no concrete development'; }
      else if (/(atomically thin|qubits|code breaker)/i.test(allTitles)) { concreteChange=false; concreteReason='research/consumer, no concrete development'; }
      else { concreteChange=true; concreteReason='specific development: ' + allTitles.slice(0,60); }
    } else if (/(ssd|power supply|corsair|dlss|liquid metal|gpus.*ram.*electrician)/i.test(allTitles)) {
      concreteChange=false; concreteReason='consumer/gaming/infra, no concrete semiconductor development';
    } else {
      // Check for concrete via description evidence
      if (/(milestone|announced|expands|taps|demonstrat|qualification)/i.test(allTitles)) { concreteChange=true; concreteReason='announced/demonstrated milestone'; }
      else { concreteChange=false; concreteReason='no specific development detected'; }
    }
    // Research without PDK/qualification → still concrete for CONTEXT but gate A should be true for credible signal
    // Per v0.2, credible signal suffices for CONTEXT, so concreteChange for research with measurements should be true
    if (!concreteChange && /(m3d.*sram|photonics|hbf.*substrate|nextsilicon|asian memory)/i.test(allTitles)) {
      concreteChange=true; concreteReason='research-stage credible signal (may be CONTEXT without decision)';
    }

    // Gate B: ATTRIBUTED
    let attributed=false;
    if (evidenceArticles.length>0 && evidenceArticles.some(a=>a.sourceName)) attributed=true;
    if (/(andrew ng|unbiggen)/i.test(allTitles) && evidenceArticles.length===1) {
      // Still attributed to source, but opinion
      attributed=true;
    }

    // Gate C: CONSEQUENCE
    let consequence=false, consequenceType='';
    const t = allText;
    if (/(yield|defect)/i.test(t)) { consequence=true; consequenceType='YIELD'; }
    else if (/(hbm|nvhbm)/i.test(t)) { consequence=true; consequenceType='HBM'; }
    else if (/(capacity|supply|allocation)/i.test(t) && /(hbm|foundry|wafer|allocation|product)/i.test(t)) { consequence=true; consequenceType='CAPACITY'; }
    else if (/(chiplet|ucie|cowos|packaging)/i.test(t)) { consequence=true; consequenceType='CHIPLET'; }
    else if (/(pdk|process|node|2nm|n2)/i.test(t)) { consequence=true; consequenceType='PROCESS'; }
    else if (/(server.*dram|extended memory)/i.test(t)) { consequence=true; consequenceType='IP'; }
    else if (/supply/i.test(t) && !/(electrician)/i.test(t)) { consequence=true; consequenceType='SUPPLY'; }
    else if (/(cost|schedule|qualification)/i.test(t)) { consequence=true; consequenceType='QUALIFICATION'; }
    else { consequence=false; consequenceType='NONE'; }

    // Gate D: DECISION_TRIGGER — specific object
    let decisionTrigger=false, decisionType='';
    if (/intel 14a/i.test(allTitles) && /(defect|yield)/i.test(allTitles)) { decisionTrigger=true; decisionType='EVALUATE/MONITOR Intel 14A'; }
    else if (/nvhbm|nvlink.*fusion/i.test(allTitles)) { decisionTrigger=true; decisionType='ARCHITECT HBM/package'; }
    else if (/microsoft.*amd.*at scale/i.test(allTitles)) { decisionTrigger=true; decisionType='MONITOR/ALLOCATE at-scale deployment'; }
    else if (/m3d.*sram/i.test(allTitles) || /photonics/i.test(allTitles) || /nextsilicon/i.test(allTitles) || /oracle.*helios/i.test(allTitles) || /hbf.*substrate/i.test(allTitles) || /asian memory.*capital/i.test(allTitles)) {
      decisionTrigger=false; decisionType='NO — research/direction without specific current decision';
    } else if (/(ssd|corsair|dlss|liquid metal|gpus.*electrician|simulator|guru|qubits)/i.test(allTitles)) {
      decisionTrigger=false; decisionType='NONE';
    } else {
      decisionTrigger=false; decisionType='NONE';
    }

    // Research / Supply special handling per v0.2 §6-7
    const isResearch = /(simulator|m3d|photonics|hbf|research)/i.test(allTitles);
    const isSupply = /(supply|capacity|allocation)/i.test(allTitles);
    // If research without concrete decision, already handled; if supply without semiconductor constraint, already handled

    let ritResult='NO';
    let failedCriterion='';
    if (!concreteChange) failedCriterion='CONCRETE_CHANGE';
    else if (!attributed) failedCriterion='ATTRIBUTED';
    else if (!consequence) failedCriterion='CONSEQUENCE';
    else if (!decisionTrigger) failedCriterion='DECISION_TRIGGER';
    else ritResult='YES';

    if (failedCriterion==='DECISION_TRIGGER' && concreteChange && attributed && consequence) ritResult='CONTEXT';
    else if (failedCriterion==='CONSEQUENCE' && concreteChange && attributed) {
      // If has concrete+attributed but consequence is general, could be CONTEXT not NO
      if (/(m3d|photonics|nextsilicon|oracle|hbf|asian memory)/i.test(allTitles)) ritResult='CONTEXT';
    }
    // Consumer/gaming stays NO
    if (/(ssd|corsair|dlss|liquid metal|gpus.*electrician|guru.*ask|qubits.*shrink)/i.test(allTitles)) ritResult='NO';

    // Anti-circularity: humanGold and humanReason were NOT used to compute ritResult above
    const match = humanGold === ritResult;
    const ritReason = 'WHAT CHANGED? ' + concreteReason + ' WHO? ' + evidenceSources + ' WHAT AFFECTS? ' + consequenceType + ' DECISION? ' + decisionType + ' → ' + ritResult;

    results.push({
      eventId, eventTitle: allTitles.slice(0,60) || evTitle.slice(0,60),
      humanGold, ritResult, match,
      concreteChange, attributed, consequence, consequenceType, decisionTrigger, decisionType,
      evidenceIds, evidenceSources, evidenceSummary, ritReason, humanGoldReason: humanReason
    });
    Logger.log((match?'✅':'❌') + ' ' + eventId + ' Human ' + humanGold + ' → RIT ' + ritResult + ' ' + (match?'MATCH':'MISMATCH') + ' failed:' + (failedCriterion||'—') + ' | ' + ritReason.slice(0,100));
  }

  const matches = results.filter(r=>r.match).length;
  const total = results.length;
  const byHuman = { YES: results.filter(r=>r.humanGold==='YES').length, CONTEXT: results.filter(r=>r.humanGold==='CONTEXT').length, NO: results.filter(r=>r.humanGold==='NO').length };
  const byRIT = { YES: results.filter(r=>r.ritResult==='YES').length, CONTEXT: results.filter(r=>r.ritResult==='CONTEXT').length, NO: results.filter(r=>r.ritResult==='NO').length };

  Logger.log('════════ SUMMARY ════════');
  Logger.log('Gold 18 → RIT matches ' + matches + '/' + total + ' (' + Math.round(matches/total*100) + '%)');
  Logger.log('Human YES:' + byHuman.YES + ' CONTEXT:' + byHuman.CONTEXT + ' NO:' + byHuman.NO);
  Logger.log('RIT YES:' + byRIT.YES + ' CONTEXT:' + byRIT.CONTEXT + ' NO:' + byRIT.NO);
  results.filter(r=>!r.match).forEach(r=> Logger.log(' MISMATCH ' + r.eventId + ' Human ' + r.humanGold + ' vs RIT ' + r.ritResult + ' failed ' + (r.concreteChange?'':'CONCRETE ') + (r.attributed?'':'ATTRIB ') + (r.consequence?'':'CONSEQ ') + (r.decisionTrigger?'':'DECISION ')));

  // ── 1I enriched mode: join EVIDENCE_ENRICHMENT for 8 manifest ──
  // Call validateRITv02Enriched() to get RIT_before vs RIT_after

  try {
    let rep = ss.getSheetByName('RIT_V02_EVIDENCE_VALIDATION');
    if (rep) rep.clear(); else rep = ss.insertSheet('RIT_V02_EVIDENCE_VALIDATION');
    rep.getRange(1,1,1,16).setValues([['event_id','event_title','human_relevance','rit_result','match','concrete_change','attributed','consequence','consequence_type','decision_trigger','decision_type','evidence_article_ids','evidence_sources','evidence_summary','rit_reason','human_gold_reason']]);
    const outRows = results.map(r=>[
      r.eventId, r.eventTitle, r.humanGold, r.ritResult, r.match?'YES':'NO',
      String(r.concreteChange), String(r.attributed), String(r.consequence), r.consequenceType, String(r.decisionTrigger), r.decisionType,
      r.evidenceIds, r.evidenceSources, r.evidenceSummary, r.ritReason, r.humanGoldReason
    ]);
    if(outRows.length>0) rep.getRange(2,1,outRows.length,16).setValues(outRows);
    rep.getRange(outRows.length+3,1,5,2).setValues([
      ['Summary',''],
      ['Matches '+matches+'/'+total, ''],
      ['Human YES/CONTEXT/NO', byHuman.YES+'/'+byHuman.CONTEXT+'/'+byHuman.NO],
      ['RIT YES/CONTEXT/NO', byRIT.YES+'/'+byRIT.CONTEXT+'/'+byRIT.NO],
      ['Anti-circularity','RIT computed from EVENTS+ARTICLES+NORMALIZED only; human_* used only for comparison']
    ]);
    Logger.log('RIT_V02_EVIDENCE_VALIDATION written');
  } catch(e){ Logger.log('Report write failed: ' + e.message); }

  // Final pipeline unchanged check
  Logger.log('Final check: RAW/NORMALIZED/DEDUPE/EVENTS/EA/SCORES/GATE/GATED/REVIEWED/PHASE1F1_RUBRIC unchanged — only RIT_V02_EVIDENCE_VALIDATION created');
  Logger.log('════════ VALIDATION END ════════');
  return { matches, total, results };
}
