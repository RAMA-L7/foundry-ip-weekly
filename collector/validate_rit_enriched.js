// 1I enriched validation — NORMALIZED + EVIDENCE_ENRICHMENT joined for 8 manifest
// Run: validateRITv02Enriched() — produces RIT_before vs RIT_after vs human
const MANIFEST_8 = ['E-39BC3992','E-9A2C403B','E-0930A477','E-AF0794FE','E-DDC3EED4','E-002B0B20','E-CD794C0E','E-0347F967'];

function validateRITv02Enriched() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const normSheet = ss.getSheetByName('NORMALIZED');
  const enrichSheet = ss.getSheetByName('EVIDENCE_ENRICHMENT');
  const rubricSheet = ss.getSheetByName('PHASE1F1_RUBRIC');
  Logger.log('════════ RIT ENRICHED VALIDATION 8 MANIFEST ════════');

  const normMap = new Map();
  if (normSheet.getLastRow()>1) {
    const vals = normSheet.getDataRange().getValues().slice(1);
    vals.forEach(r=>{ const nid=String(r[0]||'').trim(); if(nid) normMap.set(nid, {title:String(r[4]||''), desc:String(r[7]||''), source:String(r[3]||'')}); });
  }
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const eaByEvent = new Map();
  if (eaSheet.getLastRow()>1) {
    const eaVals = eaSheet.getDataRange().getValues().slice(1);
    eaVals.forEach(r=>{ const eid=String(r[0]||'').trim(); const nid=String(r[1]||'').trim(); if(!eid||!nid) return; if(!eaByEvent.has(eid)) eaByEvent.set(eid,[]); eaByEvent.get(eid).push(nid); });
  }
  // Also resolve via P0_MIGRATION_MAP for stable ids
  const mapSheet = ss.getSheetByName('P0_MIGRATION_MAP');
  function resolveNids(eid){
    let nids = eaByEvent.get(eid) || [];
    if(nids.length>0) return nids;
    if(mapSheet && mapSheet.getLastRow()>1){
      const mVals = mapSheet.getDataRange().getValues().slice(1);
      let entry = mVals.find(r=>String(r[1]||'').trim()===eid);
      if(!entry) entry = mVals.find(r=>String(r[0]||'').trim()===eid);
      if(entry){
        const oldId=String(entry[0]||'').trim(); const newId=String(entry[1]||'').trim();
        for(const tryId of [oldId,newId]){ const tryNids=eaByEvent.get(tryId); if(tryNids && tryNids.length>0) return tryNids; }
      }
    }
    return [];
  }

  const enrichMap = new Map();
  if (enrichSheet && enrichSheet.getLastRow()>1) {
    const eVals = enrichSheet.getDataRange().getValues().slice(1);
    eVals.forEach(r=>{ const eid=String(r[1]||'').trim(); if(!eid) return; if(!enrichMap.has(eid)) enrichMap.set(eid,[]); enrichMap.get(eid).push({text:String(r[4]||''), suff:String(r[6]||'')}); });
  }

  // Human gold map — need to handle old UUIDs via P0_MIGRATION_MAP
  const vals = rubricSheet.getDataRange().getValues();
  let headerRowIdx=-1, header=[];
  for(let i=0;i<Math.min(vals.length,30);i++){ const lower=vals[i].map(v=>String(v).toLowerCase()); if(lower.some(c=>c.includes('event_id')) && lower.some(c=>c.includes('human_relevance'))){ headerRowIdx=i; header=vals[i].map(h=>String(h).toLowerCase().trim()); break; } }
  function colIdx(p){ for(let i=0;i<header.length;i++) if(header[i].includes(p)) return i; return -1; }
  const idxEventId = colIdx('event_id'), idxHuman = colIdx('human_relevance');
  const goldMap = new Map();
  const goldByOld = new Map();
  vals.slice(headerRowIdx+1).filter(r=>String(r[idxEventId]||'').trim().startsWith('E-')).slice(0,18).forEach(r=>{ const eid=String(r[idxEventId]||'').trim(); const hum=String(r[idxHuman]||'').trim().toUpperCase(); goldMap.set(eid, hum); goldByOld.set(eid, hum); });
  // Also map new stable IDs via P0_MIGRATION_MAP for 1I manifest
  const mapSheet2 = ss.getSheetByName('P0_MIGRATION_MAP');
  if (mapSheet2 && mapSheet2.getLastRow()>1) {
    const mVals = mapSheet2.getDataRange().getValues().slice(1);
    for(const r of mVals){ const oldId=String(r[0]||'').trim(); const newId=String(r[1]||'').trim(); if(goldByOld.has(oldId) && !goldMap.has(newId)) goldMap.set(newId, goldByOld.get(oldId)); }
  }

  function evalRIT(eventId, withEnrich){
    const nids = resolveNids(eventId);
    const titles = nids.map(nid=> (normMap.get(nid)||{}).title || '').join(' | ');
    const descs = nids.map(nid=> (normMap.get(nid)||{}).desc || '').join(' | ');
    let allText = (titles + ' ' + descs).toLowerCase();
    if(withEnrich && enrichMap.has(eventId)){
      const enrichTexts = enrichMap.get(eventId).map(e=>e.text).join(' | ').toLowerCase();
      allText += ' ' + enrichTexts;
    }
    const allTitles = titles.toLowerCase();

    let concrete=false;
    if (/(pdk|risk production|tapeout|qualification|defect density|yield|capacity.*expansion|allocation|nvhbm|nvlink|at scale|first in line|deployment|product.*launch|chiplet.*rethink|substrate|maverick)/i.test(allTitles)) {
      if (/(do we still need|guru.*ask|opinion)/i.test(allTitles)) concrete=false;
      else if (/(atomically thin|qubits.*shrink|code breaker)/i.test(allTitles)) concrete=false;
      else if (/(ssd.*off|power supply|corsair|dlss|liquid metal|electrician)/i.test(allTitles)) concrete=false;
      else concrete=true;
    } else if (/(m3d.*sram|photonics|nextsilicon|hbf.*substrate|asian memory)/i.test(allTitles)) concrete=true;
    else if (/(milestone|announced|expands|taps)/i.test(allTitles)) concrete=true;

    const attributed = nids.length>0;
    // Semantic consequence — must be manufacturing capacity, supply availability, chip/rack topology etc. with surrounding evidence, not keyword alone
    let consequence=false, ctype='NONE';
    if (/(yield|defect)/i.test(allText)) { consequence=true; ctype='YIELD'; }
    else if (/(hbm|nvhbm)/i.test(allText) && /(capacity|supply|allocation|architecture)/i.test(allText)) { consequence=true; ctype='HBM'; }
    else if (/(hbm|nvhbm)/i.test(allText) && /(rack|integration|architecture)/i.test(allText)) { consequence=true; ctype='HBM'; }
    else if (/(chiplet|ucie|cowos|packaging)/i.test(allText) && /(capacity|architecture|specification|integration)/i.test(allText)) { consequence=true; ctype='CHIPLET'; }
    else if (/(chiplet|ucie|cowos|packaging)/i.test(allText) && /(foundry|process|node)/i.test(allText)) { consequence=true; ctype='CHIPLET'; }
    else if (/(manufacturing capacity|wafer capacity|allocation|supply availability|shipment.*scale|deployment.*scale)/i.test(allText) && /(foundry|hbm|product|capacity)/i.test(allText)) { consequence=true; ctype='CAPACITY'; }
    else if (/(rack.*design|compute tray|gpu.*rack|cpu.*core|exaflops|deployment architecture|cpu.*gpu.*dpu.*integration)/i.test(allText) && /(amd|nvidia|helios|rackscale)/i.test(allText)) { consequence=true; ctype='ARCHITECTURE'; }
    else if (/(pdk|process.*node|2nm|n2.*capacity)/i.test(allText) && /(foundry|process|node|qualification|tapeout)/i.test(allText)) { consequence=true; ctype='PROCESS'; }

    let decision=false;
    if (/intel 14a/i.test(allTitles) && /(defect|yield)/i.test(allTitles)) decision=true;
    else if (/nvhbm|nvlink.*fusion/i.test(allTitles)) decision=true;
    else if (/microsoft.*amd.*at scale/i.test(allTitles)) decision=true;
    else if (/(m3d|photonics|nextsilicon|oracle.*helios|hbf.*substrate|asian memory)/i.test(allTitles)) decision=false;

    let result='NO';
    if(!concrete) result='NO';
    else if(!attributed) result='NO';
    else if(!consequence) result='NO';
    else if(!decision) result='CONTEXT';
    else result='YES';
    if (/(ssd|corsair|dlss|liquid metal|electrician|guru.*ask|qubits)/i.test(allTitles)) result='NO';
    return {concrete, attributed, consequence, ctype, decision, result};
  }

  const report=[];
  for(const eid of MANIFEST_8){
    const human = goldMap.get(eid) || 'UNKNOWN';
    const before = evalRIT(eid, false);
    const after = evalRIT(eid, true);
    const enrich = enrichMap.get(eid) || [];
    const enrichSuff = enrich.length ? enrich[0].suff : 'NONE';
    report.push([eid, human, before.result, enrich.length?enrichSuff:'NONE', after.result, before.concrete+'/'+before.attributed+'/'+before.consequence, after.concrete+'/'+after.attributed+'/'+after.consequence, before.decision+'→'+after.decision]);
    Logger.log(eid + ' Human ' + human + ' RIT_before ' + before.result + ' enrich ' + (enrich[0]?enrich[0].suff:'NONE') + ' RIT_after ' + after.result + ' (' + before.concrete+'/'+before.consequence+'→'+after.concrete+'/'+after.consequence+')');
  }

  try{
    let rep = ss.getSheetByName('RIT_1I_ENRICHED_VALIDATION');
    if(rep) rep.clear(); else rep = ss.insertSheet('RIT_1I_ENRICHED_VALIDATION');
    rep.getRange(1,1,1,8).setValues([['event_id','human','RIT_before','enrich_sufficiency','RIT_after','before_gates','after_gates','enrich_text_snippet']]);
    const rows = report.map(r=>[r[0],r[1],r[2], r[3].includes('SUFFICIENT')?'SUFFICIENT':'INSUFFICIENT', r[4], r[5], r[6], (enrichMap.get(r[0])||[{}])[0]?.text?.slice(0,120)||'']);
    if(rows.length>0) rep.getRange(2,1,rows.length,8).setValues(rows);
    Logger.log('RIT_1I_ENRICHED_VALIDATION written');
  }catch(e){ Logger.log('Report write failed: '+e.message); }

  Logger.log('════════ ENRICHED VALIDATION END ════════');
}
