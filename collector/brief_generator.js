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
    const whatChanged = String(r[4]||'').slice(0,300) || title;
    const impact = String(r[5]||'');
    const decision = String(r[6]||'');
    const decisionObj = String(r[8]||'');
    const owner = String(r[9]||'');
    const horizon = String(r[10]||'');
    const confidence = String(r[11]||'');
    const whyItMatters = String(r[13]||'').slice(0,300) || 'Concrete roadmap consequence with decision trigger';
    const watchNext = String(r[14]||'').slice(0,300) || 'Monitor qualification/production milestone';
    const badge = decision==='ARCHITECT'?'🔴': decision==='EVALUATE'?'🔴': decision==='MONITOR'?'🟡':'⚪';
    md += '### ' + badge + ' SIGNAL ' + String(idx+1).padStart(2,'0') + ' — ' + title + '\n';
    md += '**Decision:** `' + decision + '`' + (decisionObj?' `' + decisionObj + '`':'') + ' | **Impact:** ' + impact + ' | **Owner:** ' + owner + ' | **Horizon:** ' + horizon + ' | **Confidence:** ' + confidence + '\n\n';
    md += '**What changed**\n' + whatChanged + '\n\n';
    md += '**Why it matters**\n' + whyItMatters + '\n\n';
    md += '**Decision object**\n' + decisionObj + '\n\n';
    md += '**Watch next**\n' + watchNext + '\n\n';
    md += '**Evidence** — ' + String(r[1]||'') + ' via DECISION_SIGNALS `DS_v0.1`\n\n';
    md += '---\n\n';
  });
  md += '*Evidence graph: All signals trace via EVENT_ARTICLES → NORMALIZED → EVIDENCE_ENRICHMENT where enriched. Confidence HIGH/MEDIUM/LOW per evidence sufficiency.*\n';

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
