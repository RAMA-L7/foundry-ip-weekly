// ═══════════════════════════════════════════════════════════════════════════
// PHASE 1E — CLASSIFY + SCORE: EVENTS → EVENT_SCORES (deterministic v1.0)
// Contract per docs/02-PRODUCT.md §4:
//   Impact = 0.45*Roadmap + 0.25*Technical + 0.20*Business + 0.10*Confidence
//   each 0-5 → scaled 0-100. Every sub-score explainable, reproducible.
// Boundaries: classify + score only. No LLM, no why_it_matters/watch_next,
// no email/dashboard/personalization, no mutation of 1A-1D.
// ═══════════════════════════════════════════════════════════════════════════

const FIW_SPREADSHEET_ID_E = 'YOUR_SPREADSHEET_ID';
const SCORING_VERSION = 'v1.0';
const SCORING_WEIGHTS = { roadmap: 0.45, technical: 0.25, business: 0.20, confidence: 0.10 };

// ── Setup ────────────────────────────────────────────────────────────────

function setupFiwPhase1E() {
  const ss = getFiwSpreadsheetE_();
  let scores = ss.getSheetByName('EVENT_SCORES') || ss.insertSheet('EVENT_SCORES');
  scores.getRange(1, 1, 1, 14).setValues([[
    'event_id','canonical_title','category','entities','topic',
    'roadmap_relevance','technical_significance','business_significance','evidence_confidence',
    'impact_score','score_reason','scoring_version','rank','scored_at'
  ]]);
  Logger.log('✅ Phase 1E EVENT_SCORES ready — 14 cols, v' + SCORING_VERSION);
}

function getFiwSpreadsheetE_() {
  if (!FIW_SPREADSHEET_ID_E || FIW_SPREADSHEET_ID_E === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_E not set — set to Sheet ID or run as bound script');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_E);
}

// ── Classify + Score (deterministic, idempotent) ───────────────────────

function classifyAndScoreFiWPhase1E() {
  const ss = getFiwSpreadsheetE_();
  const eventsSheet = ss.getSheetByName('EVENTS');
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const scoresSheet = ss.getSheetByName('EVENT_SCORES');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!eventsSheet || !eaSheet) throw new Error('EVENTS/EVENT_ARTICLES missing — run 1D first');
  if (!scoresSheet) throw new Error('EVENT_SCORES missing — run setupFiwPhase1E()');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')
              + '-' + Utilities.getUuid().slice(0, 4);
  const RUN_START = Date.now();
  const scoredAt = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

  // Idempotent: truncate derived layer (deterministic rebuild) — 1A-1D untouched
  if (scoresSheet.getLastRow() > 1) scoresSheet.getRange(2, 1, scoresSheet.getLastRow()-1, 14).clearContent();

  // Read EVENTS
  const evValues = eventsSheet.getDataRange().getValues();
  const evRows = evValues.slice(1).filter(r => String(r[0]||'').trim());
  // Read EVENT_ARTICLES for confidence (article_count, source diversity)
  const eaValues = eaSheet.getDataRange().getValues().slice(1);
  const eaByEvent = new Map();
  for (const r of eaValues) {
    const eid = String(r[0]||'').trim(); if (!eid) continue;
    if (!eaByEvent.has(eid)) eaByEvent.set(eid, []);
    eaByEvent.get(eid).push({ nid: String(r[1]||''), rel: String(r[2]||''), score: String(r[3]||'') });
  }
  // Read NORMALIZED for source tier lookup (for confidence)
  const normSheet = ss.getSheetByName('NORMALIZED');
  const normMap = new Map();
  if (normSheet) {
    const nVals = normSheet.getDataRange().getValues().slice(1);
    nVals.forEach(r => { const nid = String(r[0]||'').trim(); if (nid) normMap.set(nid, { sourceId: String(r[2]||'') }); });
  }
  const sourceTier = { 'semiengineering':2,'semiwiki':2,'eetimes':2,'trendforce':2,'ieee-spectrum':3,'nvidia-dev':3,'servethehome':3,'nextplatform':3,'tomshardware':3,'arstechnica':3,'anandtech':3 };

  Logger.log('Score run ' + runId + ' v' + SCORING_VERSION + ' — EVENTS=' + evRows.length);

  const scored = [];
  for (const r of evRows) {
    // EVENTS cols: event_id(0),canonical_title(1),event_date(2),precision(3),category(4),entities(5),topic(6),cluster_confidence(7),status(8),article_count(9),created_at(10)
    const eventId = String(r[0]||'').trim();
    const canonicalTitle = String(r[1]||'');
    const categoryRaw = String(r[4]||'');
    const entitiesRaw = String(r[5]||'');
    const topicRaw = String(r[6]||'');
    const clusterConf = parseFloat(String(r[7]||'1')) || 1.0;
    const articleCount = parseInt(String(r[9]||'1'),10) || 1;

    // Deterministic classify (explicit rules, no LLM)
    const entities = entitiesRaw ? entitiesRaw.split(',').map(s=>s.trim()).filter(Boolean) : extractEntitiesE_(canonicalTitle);
    const topic = topicRaw ? topicRaw.split(',')[0].trim() : 'general';
    const category = categoryRaw || inferCategoryE_(topic, entities);

    // Scores 0-5 each
    const roadmap = scoreRoadmapE_(canonicalTitle, topic, entities, category);
    const technical = scoreTechnicalE_(canonicalTitle, topic, entities);
    const business = scoreBusinessE_(canonicalTitle, topic, entities, evRows.length);
    const confidence = scoreConfidenceE_(eventId, eaByEvent, normMap, sourceTier, clusterConf);

    const impact = Math.round((SCORING_WEIGHTS.roadmap*roadmap + SCORING_WEIGHTS.technical*technical + SCORING_WEIGHTS.business*business + SCORING_WEIGHTS.confidence*confidence) * 20); // *20 to scale 0-5→0-100
    const reason = 'R' + roadmap + ':roadmap(' + reasonRoadmapE_(canonicalTitle, topic, entities) + ') '
                 + 'T' + technical + ':tech(' + reasonTechnicalE_(topic) + ') '
                 + 'B' + business + ':biz(' + reasonBusinessE_(entities) + ') '
                 + 'C' + confidence + ':conf(' + reasonConfidenceE_(eaByEvent.get(eventId)||[]) + ') '
                 + '→ Impact=' + impact + ' [0.45R+0.25T+0.20B+0.10C] ' + SCORING_VERSION;

    scored.push({
      eventId, canonicalTitle, category, entities: entities.join(', '), topic,
      roadmap, technical, business, confidence, impact, reason
    });
  }

  // Deterministic ranking: impact desc → confidence desc → event_date desc → event_id asc
  // Need event_date for tie-break; build map
  const evDateMap = new Map(evRows.map(r => [String(r[0]||'').trim(), String(r[2]||'')]));
  scored.sort((a,b) => {
    if (b.impact !== a.impact) return b.impact - a.impact;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    const da = evDateMap.get(a.eventId) || ''; const db = evDateMap.get(b.eventId) || '';
    if (db.localeCompare(da) !== 0) return db.localeCompare(da);
    return a.eventId.localeCompare(b.eventId);
  });
  scored.forEach((s, idx) => s.rank = idx + 1);

  const outRows = scored.map(s => [
    s.eventId, s.canonicalTitle.slice(0,300), s.category, s.entities.slice(0,500), s.topic,
    String(s.roadmap), String(s.technical), String(s.business), String(s.confidence),
    String(s.impact), s.reason.slice(0,1000), SCORING_VERSION, String(s.rank), scoredAt
  ]);
  if (outRows.length > 0) scoresSheet.getRange(2, 1, outRows.length, 14).setValues(outRows);

  // Metrics
  const dist = { high: scored.filter(s=>s.impact>=70).length, mid: scored.filter(s=>s.impact>=40 && s.impact<70).length, low: scored.filter(s=>s.impact<40).length };
  const summary = 'scored ' + scored.length + ' events — high≥70:' + dist.high + ' mid40-69:' + dist.mid + ' low<40:' + dist.low + ' avgImpact=' + (scored.length? Math.round(scored.reduce((a,s)=>a+s.impact,0)/scored.length):0);

  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'score',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS', '', true, evRows.length, scored.length, 0, summary + ' ' + SCORING_VERSION
    ]]);
  }
  Logger.log('✅ Score ' + runId + ' ' + SCORING_VERSION + ' complete — ' + summary + ' in ' + Math.round((Date.now()-RUN_START)/1000) + 's');
  return { runId, scored, dist };
}

// ── Scoring rules v1.0 (explicit, versioned) ───────────────────────────

function scoreRoadmapE_(title, topic, entities, category) {
  const t = (title + ' ' + topic).toLowerCase();
  if (/(pdk|risk production|tapeout|qualification|ip.*release|n2.*pdk|2nm.*pdk)/.test(t)) return 5;
  if (/(n2|n3|2nm|3nm).*(production|ramp|yield|roadmap)/.test(t)) return 4;
  if (/(chiplet|ucie|cowos|hbm).* (roadmap|spec|capacity|supply)/.test(t)) return 3;
  if (/(gpu|npu|ai accelerator)/.test(t)) return 3;
  if (category === 'process_node' || category === 'packaging') return 3;
  if (/(foundry|fab|capacity|supply)/.test(t)) return 2;
  if (/(server|benchmark|consumer|laptop)/.test(t)) return 1;
  return 2;
}

function scoreTechnicalE_(title, topic, entities) {
  const t = (title + ' ' + topic).toLowerCase();
  if (/(pdk|risk production)/.test(t)) return 5;
  if (/(gpu|npu).*announcement/.test(t)) return 4;
  if (/(2nm|3nm|gaa|nanosheet|backside power|euv).*(advance|breakthrough|major)/.test(t)) return 5;
  if (/(n2|n3|chiplet|hbm|cowos|gpu|npu)/.test(t)) return 4;
  if (/(process|node|packaging|interconnect|phy)/.test(t)) return 3;
  if (/(benchmark|test|sample)/.test(t)) return 2;
  return 2;
}

function scoreBusinessE_(title, topic, entities, totalEvents) {
  const t = title.toLowerCase();
  if (/(pdk|tapeout|supply chain|shortage|market share|tariff|export control|geopolitics)/.test(t)) return 5;
  if (/(trendforce|market|demand|supply)/.test(t) || topic === 'capacity' || /(capacity)/.test(t)) return 4;
  if (/(gpu|npu)/.test(t)) return 4;
  if (entities.includes('TSMC') || entities.includes('Intel') || entities.includes('Samsung')) return 3;
  if (/(announces|launches|reports)/.test(t)) return 2;
  return 2;
}

function scoreConfidenceE_(eventId, eaByEvent, normMap, sourceTier, clusterConf) {
  const members = eaByEvent.get(eventId) || [];
  const n = members.length;
  if (n >= 3) return 5;
  if (n === 2) {
    // 2 sources, check tier diversity
    const tiers = members.map(m => sourceTier[(normMap.get(m.nid)||{}).sourceId] || 3);
    if (tiers.includes(2) && tiers.includes(3)) return 4;
    return 4;
  }
  // singleton: cluster confidence contributes
  if (clusterConf >= 0.90) return 3;
  if (clusterConf >= 0.65) return 2;
  return 2; // default weak single-source
}

function reasonRoadmapE_(title, topic, entities) {
  if (/(pdk|tapeout)/.test(title.toLowerCase())) return 'pdk/tapeout gating';
  if (/(n2|n3)/.test(topic)) return topic + ' node';
  if (entities[0]) return entities[0];
  return 'general';
}
function reasonTechnicalE_(topic) { return topic || 'general'; }
function reasonBusinessE_(entities) { return entities[0] || 'general'; }
function reasonConfidenceE_(members) {
  if (!members || members.length===0) return 'no provenance';
  if (members.length>=2) return members.length + ' sources';
  return 'singleton';
}

// ── Helpers ─────────────────────────────────────────────────────────────

function extractEntitiesE_(text) {
  const t = String(text);
  const dict = ['TSMC','Intel','Samsung','Synopsys','Cadence','Arm','Nvidia','AMD','Micron','SK Hynix','GlobalFoundries','UMC','Rapidus','ASE','Amkor','JEDEC','UCIe','SEMI'];
  const found = [];
  for (const e of dict) {
    const re = new RegExp('\\b' + e.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&') + '\\b', 'i');
    if (re.test(t)) found.push(e);
  }
  return found.length? found : ['Unknown'];
}

function inferCategoryE_(topic, entities) {
  if (['n2','n3','18a'].includes(topic)) return 'process_node';
  if (['cowos','packaging'].includes(topic)) return 'packaging';
  if (topic==='hbm') return 'memory';
  if (entities.includes('TSMC')||entities.includes('Intel')) return 'foundry';
  return 'general';
}

// ── Deterministic test suite ───────────────────────────────────────────

function testFiWPhase1E_scoring() {
  const cases = [
    { title:'TSMC 2nm PDK update — risk production', topic:'n2', entities:['TSMC'], category:'process_node', members:[{},{},{}], expectImpact:100, expectRoadmap:5 },
    { title:'New GPU announcement', topic:'general', entities:['Nvidia'], category:'general', members:[{},{}], expectRoadmap:3 },
    { title:'New server benchmark — ServeTheHome', topic:'general', entities:['Unknown'], category:'general', members:[{}], expectRoadmap:1 },
    { title:'TrendForce reports foundry capacity tight', topic:'capacity', entities:['TSMC'], category:'general', members:[{}], expectBusiness:4 },
  ];
  let pass=0;
  for (const c of cases) {
    const r = scoreRoadmapE_(c.title, c.topic, c.entities, c.category);
    const t = scoreTechnicalE_(c.title, c.topic, c.entities);
    const b = scoreBusinessE_(c.title, c.topic, c.entities, 10);
    const conf = scoreConfidenceE_('E-TEST', new Map([['E-TEST', c.members]]), new Map(), {}, 1.0);
    const impact = Math.round((0.45*r + 0.25*t + 0.20*b + 0.10*conf)*20);
    const ok = (c.expectImpact!==undefined ? impact===c.expectImpact : true) && (c.expectRoadmap!==undefined ? r===c.expectRoadmap : true) && (c.expectBusiness!==undefined ? b===c.expectBusiness : true);
    Logger.log((ok?'✅ PASS':'❌ FAIL') + ' "' + c.title + '" → R'+r+' T'+t+' B'+b+' C'+conf+' Impact'+impact + (ok?'':' expected ' + JSON.stringify(c)));
    if (ok) pass++;
  }
  // Ranking determinism: same impact → stable by event_id
  const a = {eventId:'E-A', impact:70, confidence:4, date:'2026-08-31'};
  const b = {eventId:'E-B', impact:70, confidence:4, date:'2026-08-31'};
  const sorted = [b,a].sort((x,y)=> y.impact - x.impact || y.confidence - x.confidence || y.date.localeCompare(x.date) || x.eventId.localeCompare(y.eventId));
  const rankOk = sorted[0].eventId==='E-A';
  Logger.log((rankOk?'✅ PASS':'❌ FAIL') + ' ranking determinism E-A before E-B');
  if (rankOk) pass++;

  const total = cases.length+1;
  Logger.log('Tests ' + pass + '/' + total + ' passed ' + SCORING_VERSION + ' [0.45R+0.25T+0.20B+0.10C]');
  return pass===total;
}
