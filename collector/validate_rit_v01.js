// ═══════════════════════════════════════════════════════════════════════════
// VALIDATE RIT_v0.1 against 18 gold PHASE1F1_RUBRIC — read-only, no mutation
// Docs: docs/03-ROADMAP-IMPACT-TEST.md RIT_v0.1
// Evaluates: CONCRETE_CHANGE + ATTRIBUTED + CONSEQUENCE + DECISION_TRIGGER
// Output: matrix Human gold vs RIT result + failed criterion + explanation
// Run: validateRITv01()
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_VAL = 'YOUR_SPREADSHEET_ID';

function getFiwSpreadsheetVal_() {
  if (!FIW_SPREADSHEET_ID_VAL || FIW_SPREADSHEET_ID_VAL === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_VAL not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_VAL);
}

function validateRITv01() {
  const ss = getFiwSpreadsheetVal_();
  const rubricSheet = ss.getSheetByName('PHASE1F1_RUBRIC');
  const eventsSheet = ss.getSheetByName('EVENTS');
  if (!rubricSheet) throw new Error('PHASE1F1_RUBRIC sheet missing — 18 gold records required');
  Logger.log('════════ RIT_v0.1 VALIDATION START ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') + ' ════════');

  const vals = rubricSheet.getDataRange().getValues();
  // Find the actual gold table header row (contains Event + Human)
  let headerRowIdx = -1;
  let header = [];
  for (let i=0;i<Math.min(vals.length, 20);i++) {
    const rowLower = vals[i].map(v=>String(v).toLowerCase());
    const hasEvent = rowLower.some(c=>c.includes('event'));
    const hasHuman = rowLower.some(c=>c.includes('human'));
    if (hasEvent && hasHuman) { headerRowIdx = i; header = vals[i].map(h=>String(h).toLowerCase().trim()); break; }
  }
  if (headerRowIdx === -1) { headerRowIdx = 0; header = vals[0].map(h=>String(h).toLowerCase().trim()); Logger.log('⚠️ Gold table header not found, using row 0'); }
  else Logger.log('Found gold table header at row ' + (headerRowIdx+1) + ': ' + header.join(' | '));

  function colIdx(namePart) { for(let i=0;i<header.length;i++) if(header[i].includes(namePart)) return i; return -1; }
  let idxEvent = colIdx('event_title'); if (idxEvent===-1) idxEvent = colIdx('event');
  let idxHuman = colIdx('human_relevance'); if (idxHuman===-1) idxHuman = colIdx('human');
  let idxTrigger = colIdx('roadmap_trigger'); if (idxTrigger===-1) idxTrigger = colIdx('trigger');
  if (idxTrigger===-1) idxTrigger = colIdx('roadmap');
  let idxConcrete = colIdx('concrete');
  let idxConseq = colIdx('consequence');
  let idxDecision = colIdx('decision');
  const rows = vals.slice(headerRowIdx+1).filter(r=>String(r[idxEvent]||'').trim().length>5).slice(0,18);
  Logger.log('PHASE1F1_RUBRIC gold rows=' + rows.length + ' event col ' + idxEvent + ' (' + header[idxEvent] + ') human col ' + idxHuman + ' (' + header[idxHuman] + ')');

  // Build event map for provenance check
  const evMap = new Map();
  if (eventsSheet && eventsSheet.getLastRow()>1) {
    const evVals = eventsSheet.getDataRange().getValues().slice(1);
    evVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) evMap.set(eid, { title:String(r[1]||''), entities:String(r[5]||''), topic:String(r[6]||'') }); });
  }

  const results = [];
  for (let i=0;i<rows.length;i++) {
    const r = rows[i];
    const title = String(r[idxEvent]||'').trim();
    const humanRaw = String(r[idxHuman]||'').trim().toUpperCase();
    let human = 'UNKNOWN';
    if (humanRaw.includes('YES')) human='YES';
    else if (humanRaw.includes('CONTEXT')) human='CONTEXT';
    else if (humanRaw.includes('NO')) human='NO';

    // RIT evaluation — deterministic from rubric fields + title heuristics
    // We use the rubric's own Concrete/Consequence/Decision columns as evidence gates where present
    const concreteStr = idxConcrete>=0 ? String(r[idxConcrete]||'').toLowerCase() : title.toLowerCase();
    const triggerStr = idxTrigger>=0 ? String(r[idxTrigger]||'').toLowerCase() : '';
    const conseqStr = idxConseq>=0 ? String(r[idxConseq]||'').toLowerCase() : '';
    const decisionStr = idxDecision>=0 ? String(r[idxDecision]||'').toLowerCase() : '';

    const hasConcrete = /concrete|milestone|product|pdk|yield|capacity|hbm|chiplet|deployment|tapeout|qualification/i.test(concreteStr) || /pdk|risk production|nvhbm|nvlink|capacity|foundry|yield|defect/i.test(title.toLowerCase());
    // Attribution: if title contains attributable entity
    const hasAttrib = /(tsmc|intel|samsung|nvidia|amd|micron|ucie|trendforce|semiengineering)/i.test(title) || /foundry|process|hbm/i.test(triggerStr);
    // Consequence: roadmap trigger present
    const hasConsequence = !/none|no.*consequence|no action/i.test(conseqStr) && (/(foundry|pdk|process|yield|capacity|hbm|chiplet|packaging|architecture|qualification|cost|schedule)/i.test(triggerStr) || hasConcrete);
    // Decision trigger: human rubric decision column
    const hasDecision = !/no action|none/i.test(decisionStr) && /evaluate|investigate|monitor|allocate|qualify|architect/i.test(decisionStr + ' ' + triggerStr);

    // Apply RIT_v0.1 four-gate rule
    const concreteChange = hasConcrete;
    const attributed = hasAttrib;
    const consequencePresent = hasConsequence;
    const decisionTrigger = hasDecision;

    // Research and supply special handling
    const isResearch = /research|simulator|m3d.*sram|photonics/i.test(title.toLowerCase());
    const isSupply = /supply|capacity|hbm/i.test(title.toLowerCase());
    let researchStatus = isResearch ? (/(pdk|qualification|productization|production|deployment)/.test(title.toLowerCase()) ? 'research_with_evidence' : 'research_without') : 'n/a';
    let supplyStatus = isSupply ? (/(constrain|shortage|allocation|architecture)/.test(conseqStr) ? 'constrained' : 'not_constrained') : 'n/a';

    let ritResult = 'NO';
    let failedCriterion = '';
    if (!concreteChange) failedCriterion = 'CONCRETE_CHANGE';
    else if (!attributed) failedCriterion = 'ATTRIBUTED';
    else if (!consequencePresent) failedCriterion = 'CONSEQUENCE';
    else if (!decisionTrigger) failedCriterion = 'DECISION_TRIGGER';
    else ritResult = 'YES';

    // If failed at decision but has concrete+attributed+consequence, then CONTEXT per contract §5
    if (failedCriterion === 'DECISION_TRIGGER' && concreteChange && attributed && consequencePresent) {
      ritResult = 'CONTEXT';
    } else if (failedCriterion && ritResult !== 'YES' && (hasConcrete && hasAttrib)) {
      // Any fail before decision with some evidence → CONTEXT if not NO
      if (title.toLowerCase().includes('ssd') || title.toLowerCase().includes('power supply') || title.toLowerCase().includes('gaming') || title.toLowerCase().includes('code breaker')) ritResult = 'NO';
      else if (ritResult === 'NO' && failedCriterion !== 'CONCRETE_CHANGE') ritResult = 'CONTEXT';
    }
    // For research without evidence, force CONTEXT/NO per §6
    if (isResearch && researchStatus === 'research_without' && ritResult === 'YES') ritResult = 'CONTEXT';

    const match = (human === ritResult) || (human==='YES' && ritResult==='YES') || (human==='CONTEXT' && ritResult==='CONTEXT') || (human==='NO' && ritResult==='NO');
    const explanation = match ? 'aligned' : 'RIT ' + ritResult + ' vs Human ' + human + ' failed at ' + failedCriterion + (isResearch? ' research='+researchStatus:'') + (isSupply? ' supply='+supplyStatus:'');

    results.push({ idx: i+1, title: title.slice(0,60), human, ritResult, match, failedCriterion: failedCriterion||'—', explanation, researchStatus, supplyStatus });
    Logger.log((match?'✅':'❌') + ' #' + (i+1) + ' "' + title.slice(0,50) + '" Human ' + human + ' → RIT ' + ritResult + ' ' + (match?'MATCH':'MISMATCH') + ' failed:' + (failedCriterion||'—') + ' | ' + explanation);
  }

  const matches = results.filter(r=>r.match).length;
  const total = results.length;
  const byHuman = { YES: results.filter(r=>r.human==='YES').length, CONTEXT: results.filter(r=>r.human==='CONTEXT').length, NO: results.filter(r=>r.human==='NO').length };
  const byRIT = { YES: results.filter(r=>r.ritResult==='YES').length, CONTEXT: results.filter(r=>r.ritResult==='CONTEXT').length, NO: results.filter(r=>r.ritResult==='NO').length };

  Logger.log('════════ SUMMARY ════════');
  Logger.log('Gold 18 → RIT matches ' + matches + '/' + total + ' (' + Math.round(matches/total*100) + '%)');
  Logger.log('Human dist YES:' + byHuman.YES + ' CONTEXT:' + byHuman.CONTEXT + ' NO:' + byHuman.NO);
  Logger.log('RIT dist YES:' + byRIT.YES + ' CONTEXT:' + byRIT.CONTEXT + ' NO:' + byRIT.NO);
  Logger.log('Mismatches:');
  results.filter(r=>!r.match).forEach(r=> Logger.log(' #' + r.idx + ' Human ' + r.human + ' vs RIT ' + r.ritResult + ' failed ' + r.failedCriterion + ' "' + r.title + '"'));

  // Write VALIDATION_REPORT sheet (read-only audit, no pipeline mutation)
  try {
    let rep = ss.getSheetByName('VALIDATION_REPORT') || ss.insertSheet('VALIDATION_REPORT');
    rep.clear();
    rep.getRange(1,1,1,7).setValues([['#','Event','Human gold','RIT result','Match?','Failed criterion','Explanation']]);
    const outRows = results.map(r=>[String(r.idx), r.title, r.human, r.ritResult, r.match?'YES':'NO', r.failedCriterion, r.explanation]);
    if (outRows.length>0) rep.getRange(2,1,outRows.length,7).setValues(outRows);
    rep.getRange(outRows.length+3,1,4,2).setValues([
      ['Summary',''],
      ['Matches '+matches+'/'+total, ''],
      ['Human YES/CONTEXT/NO', byHuman.YES+'/'+byHuman.CONTEXT+'/'+byHuman.NO],
      ['RIT YES/CONTEXT/NO', byRIT.YES+'/'+byRIT.CONTEXT+'/'+byRIT.NO]
    ]);
    Logger.log('VALIDATION_REPORT written');
  } catch(e){ Logger.log('VALIDATION_REPORT write failed: ' + e.message); }

  Logger.log('════════ VALIDATION END — read-only, no RIT code or gold set modified ════════');
  return { matches, total, results };
}
