// PHASE 2E — DELIVERY & WEEKLY RUN (operational, no intelligence mutation)
// Reads: ISSUE_DRAFT (2D) + DECISION_SIGNALS + SUBSCRIBERS
// Writes: ISSUE_ARCHIVE, DELIVERY_LOG, SUBSCRIBERS (idempotent)
// No LLM, no dashboard, no payment, no RIT/EID/score change

const FIW_SPREADSHEET_ID_E2 = 'YOUR_SPREADSHEET_ID';

function getFiwSpreadsheetE2_() {
  if (!FIW_SPREADSHEET_ID_E2 || FIW_SPREADSHEET_ID_E2 === 'YOUR_SPREADSHEET_ID') {
    const active = SpreadsheetApp.getActiveSpreadsheet();
    if (active) return active;
    throw new Error('FIW_SPREADSHEET_ID_E2 not set');
  }
  return SpreadsheetApp.openById(FIW_SPREADSHEET_ID_E2);
}

function setupFiwDelivery() {
  const ss = getFiwSpreadsheetE2_();
  let subs = ss.getSheetByName('SUBSCRIBERS') || ss.insertSheet('SUBSCRIBERS');
  if (subs.getLastRow()===0) subs.getRange(1,1,1,7).setValues([['subscriber_id','email','name','status','frequency','created_at','unsubscribe_token']]);
  let arch = ss.getSheetByName('ISSUE_ARCHIVE') || ss.insertSheet('ISSUE_ARCHIVE');
  if (arch.getLastRow()===0) arch.getRange(1,1,1,8).setValues([['issue_id','issue_number','period_start','period_end','status','signal_ids','rendered_html','created_at']]);
  let dl = ss.getSheetByName('DELIVERY_LOG') || ss.insertSheet('DELIVERY_LOG');
  if (dl.getLastRow()===0) dl.getRange(1,1,1,7).setValues([['delivery_id','issue_id','subscriber_id','email','status','sent_at','error']]);
  Logger.log('✅ Phase 2E delivery sheets ready — SUBSCRIBERS 7, ISSUE_ARCHIVE 8, DELIVERY_LOG 7');
}

function addSubscriberFiW(email, name) {
  const ss = getFiwSpreadsheetE2_();
  const sh = ss.getSheetByName('SUBSCRIBERS');
  if (!sh) throw new Error('SUBSCRIBERS missing');
  email = String(email||'').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Invalid email: ' + email);
  const vals = sh.getDataRange().getValues();
  for(let i=1;i<vals.length;i++) if(String(vals[i][1]||'').trim().toLowerCase()===email) {
    Logger.log('Subscriber already exists: ' + email + ' → ' + String(vals[i][0]||''));
    return String(vals[i][0]||'');
  }
  const sid = 'SUB-' + Utilities.getUuid().slice(0,8).toUpperCase();
  const token = Utilities.getUuid();
  const now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
  sh.getRange(sh.getLastRow()+1,1,1,7).setValues([[sid, email, String(name||''), 'active', 'weekly', now, token]]);
  Logger.log('✅ Subscriber added ' + sid + ' ' + email);
  return sid;
}

function archiveIssueFiW() {
  const ss = getFiwSpreadsheetE2_();
  const draft = ss.getSheetByName('ISSUE_DRAFT');
  const arch = ss.getSheetByName('ISSUE_ARCHIVE');
  if (!draft || draft.getLastRow()<2) throw new Error('ISSUE_DRAFT empty — run Phase 2D first');
  const lastDraft = draft.getRange(draft.getLastRow(),1,1,7).getValues()[0];
  const issueId = String(lastDraft[0]||'').trim();
  if (!issueId) throw new Error('Last ISSUE_DRAFT missing issue_id');
  // Idempotent: if already archived, skip
  if (arch.getLastRow()>1) {
    const vals = arch.getDataRange().getValues().slice(1);
    if (vals.some(r=>String(r[0]||'').trim()===issueId)) {
      Logger.log('Issue already archived: ' + issueId);
      return issueId;
    }
  }
  arch.getRange(arch.getLastRow()+1,1,1,8).setValues([[lastDraft[0], lastDraft[1], lastDraft[2], lastDraft[3], 'DRAFT', lastDraft[5], lastDraft[6], Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss')]]);
  Logger.log('✅ Archived issue ' + issueId);
  return issueId;
}

function renderEmailFiW(issueId) {
  const ss = getFiwSpreadsheetE2_();
  const arch = ss.getSheetByName('ISSUE_ARCHIVE');
  const draft = ss.getSheetByName('ISSUE_DRAFT');
  let md='';
  let foundIssueId=issueId;
  if (arch && arch.getLastRow()>1) {
    const vals = arch.getDataRange().getValues().slice(1);
    const row = vals.find(r=>String(r[0]||'').trim()===String(issueId||'').trim());
    if(row) md = String(row[6]||'');
  }
  if (!md && draft && draft.getLastRow()>1) {
    const vals = draft.getDataRange().getValues().slice(1);
    const row = vals.find(r=>String(r[0]||'').trim()===String(issueId||'').trim()) || vals[vals.length-1];
    md = String(row[6]||'');
    foundIssueId = String(row[0]||'').trim();
  }
  if (!md) throw new Error('No rendered_markdown for issue ' + issueId);
  // Deterministic Markdown → HTML (no LLM) — professional B2B
  let html = md
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" style="color:#0b57d0;text-decoration:none" target="_blank">$1</a>')
    .replace(/^# (.*)$/gm, '<h1 style="font-size:22px;margin:0 0 8px;color:#0b1e3a">$1</h1>')
    .replace(/^### (.*)$/gm, '<h3 style="font-size:16px;margin:20px 0 8px;color:#0b1e3a;border-top:1px solid #e5e7eb;padding-top:16px">$1</h3>')
    .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
    .replace(/`([^`]+)`/g, '<code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:12px">$1</code>')
    .replace(/\n\n/g, '</p><p style="margin:0 0 12px">')
    .replace(/\n/g, '<br>');
  html = '<div style="font-family:Inter,Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;line-height:1.65;color:#111827;background:#ffffff">'
       + '<div style="background:#0b1e3a;color:#fff;padding:16px 20px;border-radius:8px;margin-bottom:20px"><div style="font-size:12px;letter-spacing:0.08em;opacity:0.8">FOUNDRY / IP DECISION INTELLIGENCE</div><div style="font-size:18px;font-weight:700">Weekly Decision Brief</div><div style="font-size:12px;opacity:0.85">Evidence-backed · 5-minute read</div></div>'
       + '<p style="margin:0 0 12px">' + html + '</p>'
       + '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"><p style="font-size:12px;color:#64748b">Foundry/IP Decision Intelligence — Provenance via <code>DECISION_SIGNALS DS_v0.1</code> · <a href="https://docs.google.com/spreadsheets/d/1uXMdGyWoIFpIFRTNTKhcBaDaZdiod05QjrV126alFx8/edit" style="color:#0b57d0" target="_blank">Full evidence sheet</a> · <a href="#" style="color:#64748b">Preferences</a> · <a href="#" style="color:#64748b">Unsubscribe</a></p></div>';
  Logger.log('✅ Rendered email for ' + foundIssueId + ' HTML ' + html.length + ' chars');
  return { issueId: foundIssueId, html, markdown: md };
}

function deliverIssueFiW(issueId, dryRun) {
  const ss = getFiwSpreadsheetE2_();
  const subs = ss.getSheetByName('SUBSCRIBERS');
  const arch = ss.getSheetByName('ISSUE_ARCHIVE');
  const dl = ss.getSheetByName('DELIVERY_LOG');
  if (!subs || subs.getLastRow()<2) { Logger.log('No subscribers — skipping delivery'); return {sent:0, skipped:0}; }
  if (!arch) throw new Error('ISSUE_ARCHIVE missing — run archiveIssueFiW()');

  // Resolve issue
  let targetIssueId = String(issueId||'').trim();
  if (!targetIssueId) {
    const vals = arch.getDataRange().getValues().slice(1);
    if (vals.length===0) throw new Error('No archived issue to deliver');
    targetIssueId = String(vals[vals.length-1][0]||'').trim();
  }
  const rendered = renderEmailFiW(targetIssueId);
  const subVals = subs.getDataRange().getValues().slice(1).filter(r=>String(r[3]||'').trim().toLowerCase()==='active');
  const dlVals = dl.getLastRow()>1 ? dl.getDataRange().getValues().slice(1) : [];
  const alreadySent = new Set(dlVals.filter(r=>String(r[1]||'').trim()===targetIssueId && String(r[4]||'').trim()==='SENT').map(r=>String(r[3]||'').trim().toLowerCase()));

  let sent=0, skipped=0, failed=0;
  for(const s of subVals){
    const email = String(s[1]||'').trim().toLowerCase();
    const sid = String(s[0]||'').trim();
    if (alreadySent.has(email)) { skipped++; Logger.log('Skip already SENT ' + email + ' for ' + targetIssueId); continue; }
    if (dryRun) {
      Logger.log('[DRY-RUN] Would send ' + targetIssueId + ' to ' + email);
      sent++;
      continue;
    }
    try {
      Logger.log('Delivering ' + targetIssueId + ' to ' + email);
      MailApp.sendEmail({to: email, subject: 'Foundry/IP Decision Intelligence — ' + targetIssueId, htmlBody: rendered.html});
      dl.getRange(dl.getLastRow()+1,1,1,7).setValues([[Utilities.getUuid(), targetIssueId, sid, email, 'SENT', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), '']]);
      sent++;
    } catch(e){
      dl.getRange(dl.getLastRow()+1,1,1,7).setValues([[Utilities.getUuid(), targetIssueId, sid, email, 'FAILED', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'), String(e.message).slice(0,200)]]);
      failed++;
      Logger.log('Failed ' + email + ': ' + e.message);
    }
  }
  // Update ISSUE_ARCHIVE status
  if (!dryRun && sent>0) {
    const archVals = arch.getDataRange().getValues();
    for(let i=1;i<archVals.length;i++) if(String(archVals[i][0]||'').trim()===targetIssueId) {
      arch.getRange(i+1,5).setValue('SENT');
      break;
    }
  }
  Logger.log('✅ Delivery ' + targetIssueId + ' dryRun=' + !!dryRun + ' sent=' + sent + ' skipped=' + skipped + ' failed=' + failed);
  return { sent, skipped, failed };
}

function weeklyRunFiW(dryRun) {
  Logger.log('════════ WEEKLY RUN START dryRun=' + !!dryRun + ' ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') + ' ════════');
  const runId = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Utilities.getUuid().slice(0,4);
  const RUN_START = Date.now();
  // 1. Assume collect/process already done via 2C/2D (idempotent) — for MVP we reuse existing DECISION_SIGNALS/ISSUE_DRAFT
  // 2. Archive
  const issueId = archiveIssueFiW();
  // 3. Render
  const rendered = renderEmailFiW(issueId);
  // 4. Deliver
  const deliv = deliverIssueFiW(issueId, dryRun);
  // 5. Observability
  const ss = getFiwSpreadsheetE2_();
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if (logSheet) {
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), runId, 'ALL', 'weekly_run',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,1,deliv.sent,deliv.skipped, 'weekly_run ' + issueId + ' dryRun=' + !!dryRun
    ]]);
  }
  Logger.log('════════ WEEKLY RUN END ' + issueId + ' sent=' + deliv.sent + ' in ' + Math.round((Date.now()-RUN_START)/1000)+'s ════════');
  return { issueId, delivered: deliv.sent, runId };
}
