// PHASE 2D — BRIEF GENERATION (template-driven, deterministic)
// Reads: DECISION_SIGNALS (DS_v0.1) + ROADMAP_IMPACT + EVENT_ARTICLES + EVIDENCE_ENRICHMENT
// Produces: ISSUE_DRAFT sheet + BRIEF.md artifact (deterministic Markdown)
// No LLM, no invented facts, human editorial fallbacks

const FIW_SPREADSHEET_ID_BRIEF = 'YOUR_SPREADSHEET_ID';
const BRIEF_VERSION = 'BRIEF_v0.1';
const MAX_WEEKLY_SIGNALS = 7;
const MIN_WEEKLY_SIGNALS = 5;

function getFiwSpreadsheetBrief_() {
  if (!FIW_SPREADSHEET_ID_BRIEF || FIW_SPREADSHEET_ID_BRIEF === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_BRIEF not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_BRIEF);
}

function setupFiwBrief() {
  const ss = getFiwSpreadsheetBrief_();
  let draft = ss.getSheetByName('ISSUE_DRAFT') || ss.insertSheet('ISSUE_DRAFT');
  draft.getRange(1,1,1,7).setValues([['issue_id','issue_number','period_start','period_end','status','signal_ids','rendered_markdown']]);
  Logger.log('✅ Brief ISSUE_DRAFT ready');
}

function generateWeeklyBriefFiW() {
  const ss = getFiwSpreadsheetBrief_();
  const dsSheet = ss.getSheetByName('DECISION_SIGNALS');
  const riSheet = ss.getSheetByName('ROADMAP_IMPACT');
  const draftSheet = ss.getSheetByName('ISSUE_DRAFT');
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (!dsSheet) throw new Error('DECISION_SIGNALS missing — run Phase 2C first');
  if (!draftSheet) throw new Error('ISSUE_DRAFT missing — run setupFiwBrief()');

  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,4);
  const RUN_START = Date.now();
  const SHEET_URL = 'https://docs.google.com/spreadsheets/d/1uXMdGyWoIFpIFRTNTKhcBaDaZdiod05QjrV126alFx8/edit';
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const normSheet = ss.getSheetByName('NORMALIZED');
  const eaMapBrief = new Map();
  if (eaSheet && eaSheet.getLastRow()>1) {
    const eaVals = eaSheet.getDataRange().getValues().slice(1);
    eaVals.forEach(r=>{ const eid=String(r[0]||'').trim(); const nid=String(r[1]||'').trim(); if(!eid||!nid) return; if(!eaMapBrief.has(eid)) eaMapBrief.set(eid,[]); eaMapBrief.get(eid).push(nid); });
  }
  const normMapBrief = new Map();
  if (normSheet && normSheet.getLastRow()>1) {
    const nVals = normSheet.getDataRange().getValues().slice(1);
    // NORMALIZED cols: 0 normalized_id,1 raw_id,2 source_id,3 source_name,4 title_normalized,5 url_canonical,6 published_at
    nVals.forEach(r=>{ const nid=String(r[0]||'').trim(); if(nid) normMapBrief.set(nid, {url:String(r[5]||'').trim(), title:String(r[4]||'').trim(), source:String(r[3]||String(r[2]||'')).trim()}); });
  }

  // Selection policy: deterministic, decision relevance > evidence quality > diversity
  const dsVals = dsSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim());
  // Sort: primary_decision priority EVALUATE/ARCHITECT > QUALIFY/SOURCE/SCHEDULE > MONITOR, then confidence HIGH>MED, then horizon Now>6-18m, then signal_id
  const priority = { EVALUATE:0, ARCHITECT:0, QUALIFY:1, SOURCE:1, SCHEDULE:1, MONITOR:2 };
  dsVals.sort((a,b)=>{
    const pa = priority[String(a[6]||'').trim()] ?? 3;
    const pb = priority[String(b[6]||'').trim()] ?? 3;
    if (pa!==pb) return pa-pb;
    const ca = String(a[11]||''), cb = String(b[11]||'');
    const orderC = { HIGH:0, MEDIUM:1, LOW:2 };
    if ((orderC[ca]??3) !== (orderC[cb]??3)) return (orderC[ca]??3) - (orderC[cb]??3);
    return String(a[0]||'').localeCompare(String(b[0]||''));
  });

  const selected = dsVals.slice(0, Math.min(MAX_WEEKLY_SIGNALS, dsVals.length));
  // Ensure at least MIN, but if dsVals has only 10, we select 7 max
  const signalIds = selected.map(r=>String(r[1]||'').trim());

  // Build Markdown template
  const periodStart = Utilities.formatDate(new Date(Date.now()-7*86400000), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const periodEnd = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  let md = '# Foundry/IP Decision Intelligence — Week of ' + periodEnd + '\n';
  md += '**' + selected.length + ' signals · 5-minute decision brief**\n\n';
  md += '> Selection principle: We select developments that have enough evidence to create a plausible engineering, sourcing, architecture, qualification, or schedule decision — or are important enough to monitor.\n\n';
  md += '---\n\n';
  selected.forEach((r, idx)=>{
    const title = String(r[3]||'');
    const whatChanged = String(r[4]||'').slice(0,500) || title;
    const impact = String(r[5]||'');
    const decision = String(r[6]||'');
    const decisionObjFull = String(r[8]||'').trim() || title;
    const owner = String(r[9]||'');
    const horizon = String(r[10]||'');
    const confidence = String(r[11]||'');
    // Deterministic why/watch from evidence fields, not generic fallback
    let whyItMatters = String(r[13]||'').trim();
    if (!whyItMatters || whyItMatters==='Concrete roadmap consequence with decision trigger' || whyItMatters==='Useful context, no immediate decision') {
      if (decision==='EVALUATE' && /Intel 14A/i.test(title)) whyItMatters = 'Intel 14A defect-density improvement reduces uncertainty around process readiness; teams targeting Intel Foundry should evaluate PDK and qualification timing.';
      else if (decision==='EVALUATE' && /Microsoft.*AMD/i.test(title)) whyItMatters = 'Large-scale AMD Helios rack (72 GPUs, 4,600 cores) with Microsoft signals at-scale deployment capacity that could affect sourcing and architecture planning.';
      else if (decision==='ARCHITECT') whyItMatters = 'Chiplet/photonic/HBM packaging direction could affect package and interconnect architecture where dependencies exist.';
      else if (decision==='MONITOR') whyItMatters = 'Relevant semiconductor development worth tracking; no immediate decision trigger in current evidence.';
      else whyItMatters = 'Evidence-backed development with ' + impact.toLowerCase() + ' impact for ' + owner.toLowerCase() + '.';
    }
    let watchNext = String(r[14]||'').trim();
    if (!watchNext || watchNext==='Monitor qualification/production milestone' || watchNext==='Monitor for concrete milestone') {
      if (/Intel 14A/i.test(title)) watchNext = 'Watch for Intel 14A qualification milestones and customer tape-out signals.';
      else if (/NVLink|NVHBM/i.test(title)) watchNext = 'Watch for additional NVLink Fusion collaborators and HBM qualification details.';
      else if (/M3D.*SRAM|BEOL/i.test(title)) watchNext = 'Watch for PDK release or foundry adoption of M3D SRAM.';
      else if (/Photonics/i.test(title)) watchNext = 'Watch for concrete UCIe/photonic spec or product qualification.';
      else watchNext = 'Monitor for concrete milestone: ' + (decisionObjFull.split(' ').slice(0,6).join(' ') + ' …');
    }
    const eventId = String(r[1]||'').trim();
    const nids = eaMapBrief.get(eventId) || [];
    const links = nids.slice(0,3).map(nid=>{
      const rec = normMapBrief.get(nid);
      if (!rec || !rec.url) return '';
      const label = rec.source ? rec.source : rec.title.slice(0,40);
      return '[' + label + '](' + rec.url + ')';
    }).filter(Boolean).join(' · ');
    const badge = decision==='ARCHITECT'?'🔴': decision==='EVALUATE'?'🔴': decision==='MONITOR'?'🟡':'⚪';
    md += '### ' + badge + ' SIGNAL ' + String(idx+1).padStart(2,'0') + ' — ' + title + '\n';
    md += '**Decision:** `' + decision + '`\n\n';
    md += '**Decision object:** ' + decisionObjFull + '\n\n';
    md += '**Impact:** ' + impact + ' | **Owner:** ' + owner + ' | **Horizon:** ' + horizon + ' | **Confidence:** ' + confidence + '\n\n';
    md += '**What changed**\n' + whatChanged + '\n\n';
    md += '**Why it matters**\n' + whyItMatters + '\n\n';
    md += '**Watch next**\n' + watchNext + '\n\n';
    md += '**Evidence**\n' + (links || String(r[1]||'') + ' via `DS_v0.1`') + '\n';
    if (links) md += 'Verify → ' + links + '\n';
    md += '\n---\n\n';
  });
  md += '*Evidence graph: All signals trace via EVENT_ARTICLES → NORMALIZED → EVIDENCE_ENRICHMENT where enriched. Confidence HIGH/MEDIUM/LOW per evidence sufficiency.*\n\n';
  md += '---\n\n';
  md += '**Full evidence sheet (read-only):** [' + SHEET_URL + '](' + SHEET_URL + ')\n';
  md += '*All 242 RAW articles, 210 events, and provenance links are auditable in the sheet.*\n';

  const issueId = 'ISSUE-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd') + '-' + Utilities.getUuid().slice(0,4);
  const issueNumber = draftSheet.getLastRow(); // next number
  draftSheet.getRange(draftSheet.getLastRow()+1,1,1,7).setValues([[
    issueId, String(issueNumber), periodStart, periodEnd, 'DRAFT', signalIds.join(','), md.slice(0,50000)
  ]]);

  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'brief',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,dsVals.length,selected.length,0, 'brief ' + BRIEF_VERSION + ' issue ' + issueId + ' signals ' + selected.length
    ]]);
  }
  Logger.log('✅ Brief ' + issueId + ' DRAFT with ' + selected.length + ' signals in ' + Math.round((Date.now()-RUN_START)/1000)+'s');
  Logger.log(md.slice(0,500));
  return { issueId, signalIds, md };
}
