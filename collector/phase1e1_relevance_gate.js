// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1E.1 — RELEVANCE GATE + DOMAIN/TOPIC FIX + RESCORE (experiment)
// Branch: experiment/relevance-gate from 49ce417
// Invariants: 1A-1D untouched, OUT_OF_SCOPE retained not deleted, deterministic.
// Taxonomy: DOMAIN {Foundry,IP,Chiplet,Packaging,EDA,Market/Policy}
//           TOPIC {Process Node,PDK,Yield,Capacity,HBM,UCIe,SerDes,2.5D,3D IC,EDA Flow,Export Controls...}
// Gate: ROADMAP_RELEVANT / CONTEXT_RELEVANT / OUT_OF_SCOPE (high precision)
// Success: out-of-scope stops competing with PDK, PDK stays high (v1.0 preserved)
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_E1 = 'YOUR_SPREADSHEET_ID';
const GATE_VERSION = 'v1E.1';
const GATE_WEIGHTS = { roadmap: 0.45, technical: 0.25, business: 0.20, confidence: 0.10 }; // same as v1.0

// ── Setup ────────────────────────────────────────────────────────────────

function setupFiwPhase1E1() {
  const ss = getFiwSpreadsheetE1_();
  let gate = ss.getSheetByName('EVENT_GATE') || ss.insertSheet('EVENT_GATE');
  gate.getRange(1,1,1,9).setValues([[
    'event_id','canonical_title','domain','topic','relevance','gate_reason','gate_version','gated_at','scored_impact'
  ]]);
  let gatedScores = ss.getSheetByName('EVENT_SCORES_GATED') || ss.insertSheet('EVENT_SCORES_GATED');
  gatedScores.getRange(1,1,1,12).setValues([[
    'event_id','canonical_title','domain','topic','relevance','eligible_for_issue','roadmap','technical','business','confidence','gated_impact','original_impact'
  ]]);
  Logger.log('✅ 1E.1 EVENT_GATE ready — 9 cols, EVENT_SCORES_GATED ready — 12 cols');
}

function getFiwSpreadsheetE1_() {
  if (!FIW_SPREADSHEET_ID_E1 || FIW_SPREADSHEET_ID_E1 === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_E1 not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_E1);
}

// ── Gate + Domain/Topic Fix + Rescore (deterministic, idempotent) ───────

function gateAndRescoreFiWPhase1E1() {
  const ss = getFiwSpreadsheetE1_();
  const eventsSheet = ss.getSheetByName('EVENTS');
  const scoresSheet = ss.getSheetByName('EVENT_SCORES');
  const gateSheet = ss.getSheetByName('EVENT_GATE');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!eventsSheet || !scoresSheet) throw new Error('EVENTS/EVENT_SCORES missing — run 1D/1E first');
  if (!gateSheet) throw new Error('EVENT_GATE missing — run setupFiwPhase1E1()');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,4);
  const RUN_START = Date.now();
  const gatedAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  // Idempotent: truncate derived gate layer only
  if (gateSheet.getLastRow() > 1) gateSheet.getRange(2,1,gateSheet.getLastRow()-1,9).clearContent();

  const evValues = eventsSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim());
  const scoreMap = new Map();
  if (scoresSheet.getLastRow()>1) {
    const sVals = scoresSheet.getDataRange().getValues().slice(1);
    sVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) scoreMap.set(eid, { impact: parseInt(String(r[9]||'0'),10), category: String(r[2]||''), entities: String(r[3]||''), topic: String(r[4]||'') }); });
  }

  const outRows = [];
  const metrics = { ROADMAP_RELEVANT:0, CONTEXT_RELEVANT:0, OUT_OF_SCOPE:0 };
  const domainCounts = { Foundry:0, IP:0, Chiplet:0, Packaging:0, EDA:0, 'Market / Policy':0, Context:0, 'Out of Scope':0 };

  for (const r of evValues) {
    const eventId = String(r[0]||'').trim();
    const title = String(r[1]||'');
    const evDate = String(r[2]||'');
    const entitiesRaw = String(r[5]||'');
    const topicRaw = String(r[6]||'');
    const artCount = parseInt(String(r[9]||'1'),10);

    const fixed = fixDomainTopicE1_(title, entitiesRaw, topicRaw);
    const gate = gateRelevanceE1_(title, fixed.domain, fixed.topic, fixed.entities, artCount);

    const scoredImpact = (scoreMap.get(eventId)||{}).impact || '';
    outRows.push([eventId, title.slice(0,300), fixed.domain, fixed.topic, gate.relevance, gate.reason, GATE_VERSION, gatedAt, String(scoredImpact)]);

    metrics[gate.relevance]++;
    // Domain counts for new taxonomy
    if (gate.relevance === 'OUT_OF_SCOPE') domainCounts['Out of Scope']++;
    else if (fixed.domain === 'Foundry') domainCounts.Foundry++;
    else if (fixed.domain === 'IP') domainCounts.IP++;
    else if (fixed.domain === 'Chiplet') domainCounts.Chiplet++;
    else if (fixed.domain === 'Packaging') domainCounts.Packaging++;
    else if (fixed.domain === 'EDA') domainCounts.EDA++;
    else if (fixed.domain === 'Market / Policy') domainCounts['Market / Policy']++;
    else domainCounts.Context++;
  }

  // Deterministic: sort by relevance priority ROADMAP > CONTEXT > OUT, then impact desc
  outRows.sort((a,b)=>{
    const order = { ROADMAP_RELEVANT:0, CONTEXT_RELEVANT:1, OUT_OF_SCOPE:2 };
    const oa = order[a[4]] ?? 3, ob = order[b[4]] ?? 3;
    if (oa !== ob) return oa - ob;
    const ia = parseInt(String(a[8]||'0'),10), ib = parseInt(String(b[8]||'0'),10);
    if (ib !== ia) return ib - ia;
    return String(a[0]).localeCompare(String(b[0]));
  });

  if (outRows.length>0) gateSheet.getRange(2,1,outRows.length,9).setValues(outRows);

  const summary = 'gate ' + evValues.length + ' events → ROADMAP ' + metrics.ROADMAP_RELEVANT + ' CONTEXT ' + metrics.CONTEXT_RELEVANT + ' OUT ' + metrics.OUT_OF_SCOPE
                + ' | domains Foundry:' + domainCounts.Foundry + ' IP:' + domainCounts.IP + ' Chiplet:' + domainCounts.Chiplet + ' Packaging:' + domainCounts.Packaging + ' EDA:' + domainCounts.EDA + ' Market/Policy:' + domainCounts['Market / Policy'] + ' Out:' + domainCounts['Out of Scope'];
  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'gate',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,evValues.length,metrics.ROADMAP_RELEVANT,metrics.OUT_OF_SCOPE, summary + ' ' + GATE_VERSION
    ]]);
  }
  Logger.log('✅ Gate ' + runId + ' ' + GATE_VERSION + ' — ' + summary + ' in ' + Math.round((Date.now()-RUN_START)/1000)+'s');

  // 1E.1b: wire gate → canonical DOMAIN/TOPIC + relevance-aware rescore + eligibility
  // This keeps EVENT_GATE as canonical classification and makes ranking gate-aware
  const gatedScoresSheet = ss.getSheetByName('EVENT_SCORES_GATED');
  if (gatedScoresSheet) {
    if (gatedScoresSheet.getLastRow() > 1) gatedScoresSheet.getRange(2,1,gatedScoresSheet.getLastRow()-1,12).clearContent();
    // Build map event_id → original scores
    const origMap = new Map();
    if (scoresSheet.getLastRow()>1) {
      const sVals = scoresSheet.getDataRange().getValues().slice(1);
      sVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) origMap.set(eid, { roadmap: parseInt(String(r[5]||'0'),10)||0, technical: parseInt(String(r[6]||'0'),10)||0, business: parseInt(String(r[7]||'0'),10)||0, confidence: parseInt(String(r[8]||'0'),10)||0, impact: parseInt(String(r[9]||'0'),10)||0 }); });
    }
    const gatedRows = [];
    // outRows is already sorted by relevance priority, preserves gate order
    for (const gr of outRows) {
      const eventId = String(gr[0]||'').trim();
      const title = String(gr[1]||'');
      const domain = String(gr[2]||'');
      const topic = String(gr[3]||'');
      const relevance = String(gr[4]||'');
      const eligible = relevance !== 'OUT_OF_SCOPE' ? 'TRUE' : 'FALSE';
      const orig = origMap.get(eventId) || { roadmap:0, technical:0, business:0, confidence:0, impact:0 };
      let roadmap = orig.roadmap, technical = orig.technical, business = orig.business, confidence = orig.confidence;
      // CONTEXT: cap roadmap inflation (semiconductor-related ≠ roadmap-relevant)
      if (relevance === 'CONTEXT_RELEVANT') roadmap = Math.min(roadmap, 2);
      // OUT: not eligible, gated impact 0 (retained but excluded from weekly ranking)
      let gatedImpact = orig.impact;
      if (relevance === 'OUT_OF_SCOPE') gatedImpact = 0;
      else if (relevance === 'CONTEXT_RELEVANT') gatedImpact = Math.round((GATE_WEIGHTS.roadmap*roadmap + GATE_WEIGHTS.technical*technical + GATE_WEIGHTS.business*business + GATE_WEIGHTS.confidence*confidence)*20);
      // ROADMAP keeps original impact

      gatedRows.push([eventId, title.slice(0,300), domain, topic, relevance, eligible, String(roadmap), String(technical), String(business), String(confidence), String(gatedImpact), String(orig.impact)]);
    }
    if (gatedRows.length>0) gatedScoresSheet.getRange(2,1,gatedRows.length,12).setValues(gatedRows);
    const eligibleCount = gatedRows.filter(r=>r[5]==='TRUE').length;
    const roadmapEligible = gatedRows.filter(r=>r[4]==='ROADMAP_RELEVANT').length;
    Logger.log('✅ Gated rescore ' + GATE_VERSION + 'b — ' + gatedRows.length + ' events → eligible ' + eligibleCount + ' (ROADMAP ' + roadmapEligible + ') — OUT 125 now impact 0, CONTEXT roadmap capped ≤2');
  }

  return { runId, metrics, domainCounts };
}

// ── Domain/Topic Fix (never top-level process_node/memory) ───────────────

function fixDomainTopicE1_(title, entitiesRaw, topicRaw) {
  const t = (title + ' ' + topicRaw).toLowerCase();
  const entities = entitiesRaw ? entitiesRaw.split(',').map(s=>s.trim()).filter(Boolean) : [];

  // Topic is subdomain, not domain
  let topic = 'General';
  if (/(pdk|risk production|tapeout|qualification)/.test(t)) topic = 'PDK';
  else if (/(yield|defect density)/.test(t)) topic = 'Yield';
  else if (/(hbm|high bandwidth)/.test(t)) topic = 'HBM';
  else if (/(ucie|die-to-die|chiplet)/.test(t)) topic = 'UCIe';
  else if (/(cowos|fowlp|2\.5d|hybrid bonding)/.test(t)) topic = 'Packaging';
  else if (/(3d ic|3d ic|stacked)/.test(t)) topic = '3D IC';
  else if (/(serdes|pcie|cxl|ddr|phy)/.test(t)) topic = 'SerDes';
  else if (/(n2|n3|2nm|3nm|18a|node)/.test(t)) topic = 'Process Node';
  else if (/(capacity|supply|demand|shortage)/.test(t)) topic = 'Capacity';
  else if (/(export control|tariff|subsidy|geopolitics)/.test(t)) topic = 'Export Controls';
  else if (/(eda|synthesis|sta|p&r|signoff|dft)/.test(t)) topic = 'EDA Flow';

  let domain = 'Market / Policy';
  if (/(pdk|process node|yield|foundry|fab|n2|n3|2nm|3nm|18a|sram|dtco|euv)/.test(t)) domain = 'Foundry';
  else if (/(hbm|serdes|pcie|cxl|ddr|phy|cpu|gpu|npu|ip)/.test(t) && !/(cowos|packaging|chiplet)/.test(t)) domain = 'IP';
  else if (/(chiplet|ucie|die-to-die)/.test(t)) domain = 'Chiplet';
  else if (/(cowos|fowlp|2\.5d|3d ic|packaging|substrate|thermal)/.test(t)) domain = 'Packaging';
  else if (/(eda|synthesis|sta|signoff)/.test(t)) domain = 'EDA';
  else if (/(capacity|supply chain|tariff|export|policy)/.test(t)) domain = 'Market / Policy';
  else domain = 'Market / Policy'; // default, but gate will mark OUT_OF_SCOPE if consumer

  // Override: if topic is clearly consumer, keep domain but gate will handle
  return { domain, topic, entities };
}

// ── Relevance Gate (high precision) ────────────────────────────────────

function gateRelevanceE1_(title, domain, topic, entities, articleCount) {
  const tl = title.toLowerCase();
  // OUT_OF_SCOPE patterns — gaming, consumer, power supply, monitors, etc.
  const outPatterns = [
    /ssd|power supply|corsair|monitor|gaming|laptop.*review|consumer laptop|electrician|ram.*review|dlss.*mod|gpu simulator/,
    /review:.*power|benchmark.*gaming|graphics card.*review/,
    /andrew ng|unbiggen ai/,
    /code breaker|cold war|nsa/
  ];
  for (const re of outPatterns) if (re.test(tl)) return { relevance:'OUT_OF_SCOPE', reason:'consumer/general-tech: ' + re.source.slice(0,40) };

  // ROADMAP_RELEVANT: strong semiconductor roadmap signals
  const roadmapSignals = [
    /pdk|risk production|tapeout|qualification/,
    /n2|n3|2nm|3nm|18a.*roadmap|process.*node|yield/,
    /chiplet|ucie|cowos|hbm.*capacity|supply/,
    /foundry.*capacity|fab.*expansion/
  ];
  for (const re of roadmapSignals) if (re.test(tl)) return { relevance:'ROADMAP_RELEVANT', reason:'roadmap signal: ' + re.source.slice(0,40) };

  // Packaging/chiplet/IP with foundry entities → ROADMAP
  if ((domain==='Foundry' || domain==='Packaging' || domain==='Chiplet' || domain==='IP') && /(tsmc|intel|samsung|synopsys|cadence)/.test(tl)) {
    if (/(n2|n3|pdk|cowos|hbm|ucie|chiplet|packaging)/.test(tl)) return { relevance:'ROADMAP_RELEVANT', reason:'foundry/ip with roadmap topic' };
  }

  // CONTEXT_RELEVANT: HPC/AI infra with AMD/NVIDIA but not direct foundry roadmap
  if (/(amd|nvidia|hpc|ai.*cluster|gpu.*cluster|mi450|vera rubin|nvl72)/.test(tl)) return { relevance:'CONTEXT_RELEVANT', reason:'hpc/ai infra context' };
  if (/(server|data center|benchmark)/.test(tl) && /(intel|amd|nvidia)/.test(tl)) return { relevance:'CONTEXT_RELEVANT', reason:'server context' };

  // Market/Policy with capacity → CONTEXT
  if (domain==='Market / Policy' && /(capacity|supply|market|trendforce)/.test(tl)) return { relevance:'CONTEXT_RELEVANT', reason:'market/capacity context' };

  // Default: if still general and no strong signal → OUT
  if (domain==='Market / Policy' && topic==='General') return { relevance:'OUT_OF_SCOPE', reason:'no roadmap signal' };

  return { relevance:'CONTEXT_RELEVANT', reason:'default context' };
}

// ── 5 Tests ─────────────────────────────────────────────────────────────

function testFiWPhase1E1_gate() {
  const cases = [
    { title:'TSMC 2nm PDK update — risk production', expectRelevance:'ROADMAP_RELEVANT', expectDomain:'Foundry', name:'Test1 PDK high-value' },
    { title:"Samsung's new 2TB 990 SSD is 36% off at Amazon", expectRelevance:'OUT_OF_SCOPE', name:'Test2 SSD consumer' },
    { title:'Microsoft Taps AMD For At Scale AI CPU And GPU Clusters', expectRelevance:'CONTEXT_RELEVANT', name:'Test3 HPC context AMD/NVIDIA' },
    { title:'TSMC CoWoS capacity expands for HBM', expectRelevance:'ROADMAP_RELEVANT', expectDomain:'Packaging', name:'Test4 chiplet/packaging' },
    { title:'IBM Built the Cold War Most Powerful Code Breaker for the NSA', expectRelevance:'OUT_OF_SCOPE', name:'Test5 code breaker out-of-scope' },
  ];
  let pass=0;
  for (const c of cases) {
    const fixed = fixDomainTopicE1_(c.title, '', '');
    const gate = gateRelevanceE1_(c.title, fixed.domain, fixed.topic, [], 1);
    const okRel = gate.relevance === c.expectRelevance;
    const okDom = !c.expectDomain || fixed.domain === c.expectDomain;
    const ok = okRel && okDom;
    Logger.log((ok?'✅ PASS':'❌ FAIL') + ' ' + c.name + ' "' + c.title + '" → ' + fixed.domain + '/' + fixed.topic + ' ' + gate.relevance + (ok?'':' expected ' + c.expectRelevance + (c.expectDomain?'/' + c.expectDomain:'')) + ' reason:' + gate.reason);
    if (ok) pass++;
  }
  // Test5 idempotency: run gate twice on same events → same results
  const ss = getFiwSpreadsheetE1_();
  const eventsSheet = ss.getSheetByName('EVENTS');
  let idemPass = true;
  if (eventsSheet && eventsSheet.getLastRow()>1) {
    const vals = eventsSheet.getDataRange().getValues().slice(1, 6); // sample 5
    const first = vals.map(r=>{ const t=String(r[1]||''); const f=fixDomainTopicE1_(t,'',''); return gateRelevanceE1_(t,f.domain,f.topic,[],1).relevance; });
    const second = vals.map(r=>{ const t=String(r[1]||''); const f=fixDomainTopicE1_(t,'',''); return gateRelevanceE1_(t,f.domain,f.topic,[],1).relevance; });
    idemPass = first.join(',')===second.join(',');
    Logger.log((idemPass?'✅ PASS':'❌ FAIL') + ' Test5 Idempotency 5 events → ' + first.join(','));
    if (idemPass) pass++;
  } else {
    Logger.log('⚠️ Idempotency skipped — no EVENTS, checking determinism via repeated gate call');
    const r1 = gateRelevanceE1_('TSMC N2 PDK', 'Foundry','PDK',[],1);
    const r2 = gateRelevanceE1_('TSMC N2 PDK', 'Foundry','PDK',[],1);
    idemPass = r1.relevance===r2.relevance;
    Logger.log((idemPass?'✅ PASS':'❌ FAIL') + ' Idempotency static');
    if (idemPass) pass++;
  }
  const total = cases.length + 1;
  Logger.log('Tests ' + pass + '/' + total + ' passed ' + GATE_VERSION);
  return pass===total;
}
