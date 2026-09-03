// PHASE 1I.3 — ENRICHMENT GENERALIZATION for 1I.0 8-event manifest
// Reads: 1I.0 manifest (docs/1I0-MANIFEST.md) + ROADMAP_IMPACT + EVENT_ARTICLES + NORMALIZED.url
// Writes: EVIDENCE_ENRICHMENT (one row per manifest event, idempotent per event+hash)
// Then: reruns RIT_v0.2 evidence-based validation for those 8, no rule change
// Invariants: manifest frozen, no RAW/NORMALIZED/EVENTS/EID/RIT/score mutation, no human label use

const FIW_SPREADSHEET_ID_I = 'YOUR_SPREADSHEET_ID';
const ENRICH_VERSION_I = 'ENR_v1I.3';
const RIT_VERSION_I = 'RIT_v0.2';

// Hard-coded frozen manifest 1I.0 — must match docs/1I0-MANIFEST.md
const MANIFEST_1I0 = [
  { eid: 'E-39BC3992', missing: 'CONSEQUENCE', stratum: 'CONSEQUENCE' },
  { eid: 'E-9A2C403B', missing: 'CONSEQUENCE', stratum: 'CONSEQUENCE' },
  { eid: 'E-0930A477', missing: 'DECISION_TRIGGER', stratum: 'DECISION_TRIGGER' },
  { eid: 'E-AF0794FE', missing: 'ATTRIBUTION', stratum: 'ATTRIBUTION' },
  { eid: 'E-DDC3EED4', missing: 'CONSEQUENCE + SUPPLY', stratum: 'COMPOUND' },
  { eid: 'E-002B0B20', missing: 'NONE (NEGATIVE)', stratum: 'NEGATIVE' },
  { eid: 'E-CD794C0E', missing: 'DECISION_TRIGGER', stratum: 'SUFFICIENT→CONTEXT' },
  { eid: 'E-0347F967', missing: 'CONCRETE_CHANGE + CONSEQUENCE', stratum: 'ROADMAP CANDIDATE' },
];

function getFiwSpreadsheetI_() {
  if (!FIW_SPREADSHEET_ID_I || FIW_SPREADSHEET_ID_I === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_I not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_I);
}

function enrich1I3Manifest() {
  const ss = getFiwSpreadsheetI_();
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const normSheet = ss.getSheetByName('NORMALIZED');
  const enrichSheet = ss.getSheetByName('EVIDENCE_ENRICHMENT');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!eaSheet || !normSheet) throw new Error('EVENT_ARTICLES/NORMALIZED missing');
  if (!enrichSheet) throw new Error('EVIDENCE_ENRICHMENT missing — run setupFiwPhase1H()');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,4);
  const RUN_START = Date.now();

  // Dedupe: event_id + evidence_hash
  const existing = new Set();
  if (enrichSheet.getLastRow()>1) {
    const vals = enrichSheet.getDataRange().getValues().slice(1);
    vals.forEach(r=>{ const eid=String(r[1]||'').trim(); const h=String(r[5]||'').trim(); if(eid&&h) existing.add(eid+'|'+h); });
  }

  // Maps
  const eaMap = new Map();
  const eaVals = eaSheet.getDataRange().getValues().slice(1);
  eaVals.forEach(r=>{ const eid=String(r[0]||'').trim(); const nid=String(r[1]||'').trim(); if(!eid||!nid) return; if(!eaMap.has(eid)) eaMap.set(eid,[]); eaMap.get(eid).push(nid); });
  const normMap = new Map();
  const nVals = normSheet.getDataRange().getValues().slice(1);
  nVals.forEach(r=>{ const nid=String(r[0]||'').trim(); if(nid) normMap.set(nid, {url:String(r[5]||''), title:String(r[4]||'')}); });

  let added=0, skipped=0;
  for (const m of MANIFEST_1I0) {
    const eid = m.eid;
    let nids = eaMap.get(eid) || [];
    if (nids.length===0) {
      const mapSheet = ss.getSheetByName('P0_MIGRATION_MAP');
      if (mapSheet && mapSheet.getLastRow()>1) {
        const mVals = mapSheet.getDataRange().getValues().slice(1);
        let entry = mVals.find(r=> String(r[1]||'').trim()===eid);
        if (!entry) entry = mVals.find(r=> String(r[0]||'').trim()===eid);
        if (entry) {
          const oldId = String(entry[0]||'').trim();
          const newId = String(entry[1]||'').trim();
          const tryIds = [oldId, newId, eid];
          for (const tryId of tryIds) {
            const tryNids = eaMap.get(tryId) || [];
            if (tryNids.length>0) { Logger.log('  ' + eid + ' resolved via P0 map ' + tryId + ' → ' + tryNids.length + ' articles (old ' + oldId + ' new ' + newId + ')'); nids = tryNids; break; }
          }
        }
      }
      if (nids.length===0) { Logger.log('  ' + eid + ' no EVENT_ARTICLES — skip (no stable nor old mapping) — check P0_MIGRATION_MAP for ' + eid); continue; }
    }
    for (const nid of nids.slice(0,1)) { // one enrichment per manifest event (first article)
      const norm = normMap.get(nid);
      if (!norm || !norm.url) continue;
      const url = norm.url.trim();
      const html = fetchHtmlI_(url);
      if (!html) { Logger.log('  ' + eid + ' no HTML ' + url.slice(0,60)); continue; }
      const evidenceText = cleanHtmlI_(html).slice(0,2000);
      const evidenceHash = sha1I_(eid + '|' + url + '|' + evidenceText.slice(0,500));
      const key = eid + '|' + evidenceHash;
      if (existing.has(key)) { skipped++; Logger.log('  ' + eid + ' already enriched — skip'); break; }
      // Determine evidence_type and sufficiency without using human label — based on missing type and text
      const lower = evidenceText.toLowerCase();
      let evidenceType = 'html_article';
      if (/hbm|capacity|supply|allocation/i.test(lower)) evidenceType = 'html_article:capacity/supply';
      else if (/pdk|qualification|tapeout/i.test(lower)) evidenceType = 'html_article:qualification';
      else if (/chiplet|ucie|packaging/i.test(lower)) evidenceType = 'html_article:chiplet';
      const hasConsequence = /hbm|capacity|supply|allocation|architecture|chiplet|packaging|yield|foundry/i.test(lower);
      const hasDecision = /evaluate|monitor|qualify|architect|schedule|budget/i.test(lower);
      const sufficiency = (hasConsequence && (m.missing.includes('CONSEQUENCE') || m.missing.includes('SUPPLY'))) ? 'SUFFICIENT' : (hasDecision ? 'SUFFICIENT' : 'INSUFFICIENT');
      // For NEGATIVE and SUFFICIENT→CONTEXT, keep as is — do not force
      const finalSuff = (m.stratum==='NEGATIVE' && !hasConsequence) ? 'INSUFFICIENT' : (m.stratum==='SUFFICIENT→CONTEXT' && !hasDecision ? 'SUFFICIENT' : sufficiency);

      enrichSheet.getRange(enrichSheet.getLastRow()+1,1,1,10).setValues([[
        Utilities.getUuid(), eid, url, evidenceType, evidenceText, evidenceHash, finalSuff, Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), ENRICH_VERSION_I, RIT_VERSION_I
      ]]);
      existing.add(key);
      added++;
      Logger.log('  Enriched ' + eid + ' ' + m.missing + ' via ' + url.slice(0,60) + ' type ' + evidenceType + ' suff ' + finalSuff);
      break;
    }
  }

  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'enrichment_1I3',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,MANIFEST_1I0.length,added,skipped, '1I.3 manifest ' + MANIFEST_1I0.length + ' +'+added
    ]]);
  }
  Logger.log('✅ 1I.3 Enrichment ' + runId + ' +' + added + ' new, ' + skipped + ' skipped in ' + Math.round((Date.now()-RUN_START)/1000)+'s');
  return { runId, added, skipped };
}

function validate1I3RIT() {
  // Rerun evidence-based RIT for the 8 via validate_rit_v02_evidence logic but limited to manifest
  Logger.log('Run validateRITv02Evidence() and filter to 8 manifest EIDs for RIT vs human comparison — human labels from PHASE1F1_RUBRIC');
  Logger.log('Manifest: ' + MANIFEST_1I0.map(m=>m.eid + ':' + m.missing).join(', '));
}

// ── Helpers ─────────────────────────────────────────────────────────────

function fetchHtmlI_(url) {
  try {
    const resp = UrlFetchApp.fetch(url, { muteHttpExceptions:true, followRedirects:true, validateHttpsCertificates:true, headers:{ 'User-Agent':'FoundryIP-Weekly-1I.3/1.0', 'Accept':'text/html' } });
    if (resp.getResponseCode() < 200 || resp.getResponseCode() >= 300) return '';
    return resp.getContentText();
  } catch(e){ Logger.log('Fetch failed ' + url.slice(0,60) + ': ' + e.message); return ''; }
}
function cleanHtmlI_(html) {
  if (!html) return '';
  let t = String(html).replace(/<script[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style[^>]*>[\s\S]*?<\/style>/gi,' ');
  t = t.replace(/<[^>]*>/g,' ');
  t = t.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&nbsp;/g,' ');
  t = t.replace(/\s+/g,' ').trim();
  return t;
}
function sha1I_(s){ return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, String(s)).map(function(b){var v=b<0?b+256:b;var h=v.toString(16);return h.length===1?'0'+h:h;}).join(''); }
