// DAILY FULL PIPELINE 10-DAY — every tab auto-updates, 20a25a0407ec@gmail.com only
// Runs: fetch → normalize → dedupe → cluster → gate → RIT → enrichment → replay → brief → delivery
// Idempotent, time-guard aware, one failure doesn't stop downstream where safe
// Run once: setupDailyFullPipeline10()

function setupDailyFullPipeline10() {
  // Clean old triggers
  ScriptApp.getProjectTriggers().forEach(t=>{
    const fn=t.getHandlerFunction();
    if(fn==='dailyFullPipeline10' || fn==='weeklyRunFiWDaily10' || fn==='weeklyRunFiW') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailyFullPipeline10').timeBased().everyDays(1).atHour(7).create();
  PropertiesService.getScriptProperties().setProperty('DAILY_FULL_COUNT','0');
  PropertiesService.getScriptProperties().setProperty('DAILY_FULL_START', new Date().toISOString());
  Logger.log('✅ Daily FULL pipeline trigger installed 07:00 for 10 days — RAW→Brief→Email');
}

function dailyFullPipeline10() {
  const props = PropertiesService.getScriptProperties();
  let count = parseInt(props.getProperty('DAILY_FULL_COUNT')||'0',10);
  if(count>=10){
    ScriptApp.getProjectTriggers().forEach(t=>{ if(t.getHandlerFunction()==='dailyFullPipeline10') ScriptApp.deleteTrigger(t); });
    Logger.log('10-day FULL pipeline complete — trigger deleted');
    return;
  }
  count++; props.setProperty('DAILY_FULL_COUNT', String(count));
  const RUN_START = Date.now();
  Logger.log('════════ DAILY FULL PIPELINE ' + count + '/10 START ' + new Date().toISOString() + ' ════════');

  function safeRun(name, fn){
    try{ const r=fn(); Logger.log('✅ ' + name + ' done'); return r; }
    catch(e){ Logger.log('⚠️ ' + name + ' failed: ' + e.message); return null; }
  }

  // 1A — fetch (sharded, incremental flush, time guard already in phase1a)
  safeRun('1A fetch', ()=> fetchFiWPhase1A());
  // 1B — normalize
  safeRun('1B normalize', ()=> normalizeFiWPhase1B());
  // 1C — dedupe
  safeRun('1C dedupe', ()=> dedupeFiWPhase1C());
  // 1D — cluster (stable EID_v0.1, 210 base — will add new events deterministically)
  safeRun('1D cluster', ()=> clusterFiWPhase1D());
  // 1E — score
  safeRun('1E score', ()=> classifyAndScoreFiWPhase1E());
  // 1E.1 — gate + gated rescore
  safeRun('1E.1 gate', ()=> gateAndRescoreFiWPhase1E1());
  // 1G — RIT
  safeRun('1G RIT', ()=> runRoadmapImpactFiWPhase1G());
  // 1H/1I — enrichment for INSUFFICIENT (1H single + 1I 8 manifest — idempotent, already enriched will skip)
  safeRun('1H enrich', ()=> { try{ return enrichInsufficientFiWPhase1H(); }catch(e){ return enrich1I3Manifest(); } });
  safeRun('1I enrich', ()=> enrich1I3Manifest());
  // 2C — replay Decision Signals
  safeRun('2C replay', ()=> replay210FiWPhase2C());
  // 2D — brief
  safeRun('2D brief', ()=> generateWeeklyBriefFiW());
  // 2E — weekly run (archive→render→deliver)
  const deliv = safeRun('2E weeklyRun', ()=> weeklyRunFiW(false));

  Logger.log('════════ DAILY FULL PIPELINE ' + count + '/10 END delivered=' + (deliv?deliv.delivered:0) + ' in ' + Math.round((Date.now()-RUN_START)/1000)+'s ════════');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const logSheet = ss.getSheetByName('PROCESSING_LOG');
  if(logSheet){
    logSheet.getRange(logSheet.getLastRow()+1,1,1,13).setValues([[
      Utilities.getUuid(), Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss')+'-full', 'ALL', 'daily_full',
      Utilities.formatDate(new Date(RUN_START), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss'),
      'SUCCESS','',true,1,deliv?deliv.delivered:0,0,'daily full '+count+'/10'
    ]]);
  }
  if(count>=10){
    ScriptApp.getProjectTriggers().forEach(t=>{ if(t.getHandlerFunction()==='dailyFullPipeline10') ScriptApp.deleteTrigger(t); });
    Logger.log('Reached 10 — trigger deleted');
  }
}

function cancelDailyFullPipeline10() {
  ScriptApp.getProjectTriggers().forEach(t=>{ if(t.getHandlerFunction()==='dailyFullPipeline10') ScriptApp.deleteTrigger(t); });
  PropertiesService.getScriptProperties().deleteProperty('DAILY_FULL_COUNT');
  Logger.log('Daily FULL pipeline cancelled');
}
