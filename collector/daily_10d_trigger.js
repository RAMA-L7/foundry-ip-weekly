// DAILY 10-DAY TEST — 20a25a0407ec@gmail.com only, no public
// Creates daily 07:00 trigger for weeklyRunFiW that auto-deletes after 10 runs
// Run once: setupDaily10DayFiW()

function setupDaily10DayFiW() {
  // Clean old daily triggers for weeklyRunFiW
  ScriptApp.getProjectTriggers().forEach(t=>{
    if (t.getHandlerFunction()==='weeklyRunFiW' || t.getHandlerFunction()==='weeklyRunFiWDaily10') {
      ScriptApp.deleteTrigger(t);
    }
  });
  ScriptApp.newTrigger('weeklyRunFiWDaily10').timeBased().everyDays(1).atHour(7).create();
  PropertiesService.getScriptProperties().setProperty('DAILY_10D_COUNT', '0');
  PropertiesService.getScriptProperties().setProperty('DAILY_10D_START', new Date().toISOString());
  Logger.log('✅ Daily 10-day trigger installed for weeklyRunFiWDaily10 at 07:00 — will auto-delete after 10 runs to 20a25a0407ec@gmail.com');
}

function weeklyRunFiWDaily10() {
  const props = PropertiesService.getScriptProperties();
  let count = parseInt(props.getProperty('DAILY_10D_COUNT')||'0',10);
  if (count >= 10) {
    // Delete trigger after 10
    ScriptApp.getProjectTriggers().forEach(t=>{ if(t.getHandlerFunction()==='weeklyRunFiWDaily10') ScriptApp.deleteTrigger(t); });
    Logger.log('10-day test complete — trigger deleted');
    return;
  }
  count++;
  props.setProperty('DAILY_10D_COUNT', String(count));
  Logger.log('Daily run ' + count + '/10 — ' + new Date().toISOString());
  // Use existing weeklyRunFiW from phase2e_delivery.js (must be loaded)
  const res = weeklyRunFiW(false);
  Logger.log('Daily ' + count + '/10 delivered ' + res.delivered + ' issue ' + res.issueId);
  if (count >= 10) {
    ScriptApp.getProjectTriggers().forEach(t=>{ if(t.getHandlerFunction()==='weeklyRunFiWDaily10') ScriptApp.deleteTrigger(t); });
    Logger.log('Reached 10 — trigger deleted, test complete');
  }
}

function cancelDaily10DayFiW() {
  ScriptApp.getProjectTriggers().forEach(t=>{ if(t.getHandlerFunction()==='weeklyRunFiWDaily10') ScriptApp.deleteTrigger(t); });
  PropertiesService.getScriptProperties().deleteProperty('DAILY_10D_COUNT');
  Logger.log('Daily 10-day trigger cancelled');
}
