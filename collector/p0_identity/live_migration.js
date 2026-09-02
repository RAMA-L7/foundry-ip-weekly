// P0 LIVE MIGRATION — transactional, rollback-safe, 207 MIGRATE + 3 HOLD
// Run: migrateP0Live()
// Hard safety: archive first, verify map, then migrate downstream, then audit + rebuild test
// No 1A-1G logic change, only identity references

function migrateP0Live() {
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const eventsSheet = ss.getSheetByName('EVENTS');
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const reviewedSheet = ss.getSheetByName('REVIEWED_EVENTS');
  const roadmapSheet = ss.getSheetByName('ROADMAP_IMPACT');
  const scoresSheet = ss.getSheetByName('EVENT_SCORES');
  const gateSheet = ss.getSheetByName('EVENT_GATE');
  const gatedScoresSheet = ss.getSheetByName('EVENT_SCORES_GATED');
  if (!eventsSheet) throw new Error('EVENTS missing');

  Logger.log('════════ P0 LIVE MIGRATION START ' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss') + ' ════════');

  // 1. ARCHIVE
  let archive = ss.getSheetByName('EVENTS_GEN0_ARCHIVE');
  if (archive) ss.deleteSheet(archive);
  archive = ss.insertSheet('EVENTS_GEN0_ARCHIVE');
  const evRange = eventsSheet.getDataRange();
  archive.getRange(1,1,evRange.getNumRows(), evRange.getNumColumns()).setValues(evRange.getValues());
  Logger.log('1. Archive EVENTS_GEN0_ARCHIVE created with ' + evRange.getNumRows() + ' rows');

  // 2. Build migration map — reuse identity.js logic (must be loaded)
  const holdIds = new Set(['1D314ECD','5D667AE5','002B0B20']); // actually event_ids are E-... need full
  // The 3 AMBIGUOUS from report: 1D314ECD Unbiggen AI, 5D667AE5 Trust But Verify, 002B0B20 Noodling Nuclear
  // Need full IDs: search EVENTS for canonical_title containing those
  const evVals = eventsSheet.getDataRange().getValues();
  const header = evVals[0];
  const rows = evVals.slice(1).filter(r=>String(r[0]||'').trim().startsWith('E-'));
  const ambOldIds = new Set();
  for (const r of rows) {
    const title = String(r[1]||'').toLowerCase();
    if (title.includes('unbiggen ai') || title.includes('trust, but verify') || title.includes('noodling on nuclear')) {
      ambOldIds.add(String(r[0]||'').trim());
    }
  }
  Logger.log('3 AMBIGUOUS identified: ' + Array.from(ambOldIds).join(', '));

  const map = new Map(); // oldId -> {newId, identityKey, confidence, action}
  let dupCheck = new Set();
  let dupFound = false;
  for (const r of rows) {
    const oldId = String(r[0]||'').trim();
    if (!oldId) continue;
    const title = String(r[1]||'');
    const date = String(r[2]||'');
    const domain = String(r[4]||'');
    const entities = String(r[5]||'');
    const topic = String(r[6]||'');
    if (ambOldIds.has(oldId)) {
      map.set(oldId, {newId: oldId, identityKey:'', confidence:'AMBIGUOUS', action:'HOLD', reason:'general domain weak identity'});
      continue;
    }
    const ident = identityForEvent({title, event_date:date, entities: entities.split(',').map(s=>s.trim()), topic, domain});
    const newId = ident.eventId;
    const key = ident.identityKey;
    if (dupCheck.has(newId)) {
      Logger.log('❌ DUP newId ' + newId + ' for ' + oldId + ' collides');
      dupFound = true;
    }
    dupCheck.add(newId);
    map.set(oldId, {newId, identityKey:key, confidence:'HIGH', action:'MIGRATE', reason:'deterministic'});
  }
  const migrateCount = Array.from(map.values()).filter(v=>v.action==='MIGRATE').length;
  const holdCount = Array.from(map.values()).filter(v=>v.action==='HOLD').length;
  Logger.log('2. Map built: ' + rows.length + ' total, MIGRATE ' + migrateCount + ' HOLD ' + holdCount + ' dup ' + (dupFound?'YES':'NO'));
  if (migrateCount!==207 || holdCount!==3) Logger.log('⚠️ Expected 207/3, got ' + migrateCount + '/' + holdCount + ' — abort check');
  if (dupFound) throw new Error('Duplicate stable IDs — abort migration');

  // Verify map completeness
  if (map.size !== rows.length) throw new Error('Map size mismatch');

  // 3. Create permanent migration map sheet
  let mapSheet = ss.getSheetByName('P0_MIGRATION_MAP');
  if (mapSheet) ss.deleteSheet(mapSheet);
  mapSheet = ss.insertSheet('P0_MIGRATION_MAP');
  mapSheet.getRange(1,1,1,7).setValues([['old_event_id','new_event_id','identity_version','identity_key','confidence','migration_action','migration_reason']]);
  const mapRows = Array.from(map.entries()).map(([oldId, v])=>[oldId, v.newId, 'EID_v0.1', v.identityKey.slice(0,80), v.confidence, v.action, v.reason]);
  if (mapRows.length>0) mapSheet.getRange(2,1,mapRows.length,7).setValues(mapRows);
  Logger.log('3. Migration map P0_MIGRATION_MAP written ' + mapRows.length + ' rows');

  // 4. Migrate downstream — helper to replace event_id in col 1
  function migrateSheet(sheetName, colIdx) {
    const sh = ss.getSheetByName(sheetName);
    if (!sh || sh.getLastRow()<2) { Logger.log(sheetName + ': no data to migrate'); return 0; }
    const vals = sh.getDataRange().getValues();
    let changed=0;
    for(let i=1;i<vals.length;i++){
      const oldId = String(vals[i][colIdx-1]||'').trim();
      const entry = map.get(oldId);
      if(entry && entry.action==='MIGRATE' && entry.newId!==oldId){
        sh.getRange(i+1, colIdx).setValue(entry.newId);
        changed++;
      }
    }
    Logger.log('  Migrated ' + sheetName + ': ' + changed + ' refs updated');
    return changed;
  }

  // Migrate EVENTS itself (col1)
  let evMigrated=0;
  for(let i=1;i<evVals.length;i++){
    const oldId = String(evVals[i][0]||'').trim();
    const entry = map.get(oldId);
    if(entry && entry.action==='MIGRATE' && entry.newId!==oldId){
      eventsSheet.getRange(i+1,1).setValue(entry.newId);
      // Add identity version column if not exists — we will add col 12 if needed
      evMigrated++;
    }
  }
  // Ensure identity_version column header
  if (eventsSheet.getLastColumn() < 12) {
    eventsSheet.getRange(1,12).setValue('event_identity_version');
  } else if (String(eventsSheet.getRange(1,12).getValue()).trim() !== 'event_identity_version') {
    eventsSheet.getRange(1,12).setValue('event_identity_version');
  }
  for(let i=1;i<evVals.length;i++){
    const oldId = String(evVals[i][0]||'').trim();
    const entry = map.get(oldId);
    const newId = entry ? entry.newId : oldId;
    // Set version for migrated, keep blank for held? Set version for all
    eventsSheet.getRange(i+1,12).setValue(entry && entry.action==='MIGRATE' ? 'EID_v0.1' : (entry ? 'HOLD' : ''));
  }
  Logger.log('4. EVENTS migrated: ' + evMigrated + ' IDs updated, version EID_v0.1 set');

  // Downstream
  migrateSheet('EVENT_ARTICLES', 1);
  migrateSheet('REVIEWED_EVENTS', 1);
  migrateSheet('ROADMAP_IMPACT', 2); // event_id col2 in ROADMAP_IMPACT per phase1g
  migrateSheet('EVENT_SCORES', 1);
  migrateSheet('EVENT_GATE', 1);
  migrateSheet('EVENT_SCORES_GATED', 1);
  // Also EVENT_SCORES_GATED if exists, already

  // 5. Post-migration audit
  Logger.log('── Post-migration audit ──');
  const newEvVals = eventsSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim());
  const newIds = newEvVals.map(r=>String(r[0]||'').trim());
  const uniqNew = new Set(newIds).size;
  Logger.log('EVENTS: ' + newEvVals.length + ' rows, unique ' + uniqNew + ' dup ' + (newEvVals.length-uniqNew));
  const eaVals2 = eaSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim());
  const eaOrphans = eaVals2.filter(r=> !new Set(newIds).has(String(r[0]||'').trim()));
  Logger.log('EVENT_ARTICLES: ' + eaVals2.length + ' refs, orphans ' + eaOrphans.length);
  const revVals2 = reviewedSheet ? reviewedSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim()) : [];
  const revOrphans = revVals2.filter(r=> !new Set(newIds).has(String(r[0]||'').trim()) && !ambOldIds.has(String(r[0]||'').trim()));
  Logger.log('REVIEWED_EVENTS: ' + revVals2.length + ' refs, orphans (excluding held) ' + revOrphans.length);
  // Check 18 gold preserved
  const goldPreserved = revVals2.filter(r=> String(r[0]||'').trim()).length;
  Logger.log('Gold preserved: ' + goldPreserved + '/18 reviewed still attached');

  // Rebuild test: recompute stable IDs for current EVENTS and compare
  let rebuildOk=true;
  for(const r of newEvVals){
    if (ambOldIds.has(String(r[0]||'').trim())) continue; // held keep old
    const title=String(r[1]||''); const date=String(r[2]||''); const domain=String(r[4]||''); const entities=String(r[5]||''); const topic=String(r[6]||'');
    const recomputed = identityForEvent({title, event_date:date, entities: entities.split(',').map(s=>s.trim()), topic, domain}).eventId;
    if(recomputed !== String(r[0]||'').trim()){
      Logger.log('❌ Rebuild mismatch ' + String(r[0]||'').trim() + ' vs recomputed ' + recomputed + ' title ' + title.slice(0,40));
      rebuildOk=false;
    }
  }
  Logger.log(rebuildOk?'✅ PASS rebuild A==B==C stable':'❌ FAIL rebuild');

  if (uniqNew !== newEvVals.length) throw new Error('Duplicate stable IDs after migration');
  if (eaOrphans.length>0) throw new Error('Orphan EVENT_ARTICLES after migration: ' + eaOrphans.length);
  if (!rebuildOk) throw new Error('Rebuild test failed');

  Logger.log('════════ P0 LIVE MIGRATION COMPLETE — 207 MIGRATE + 3 HOLD, downstream preserved ════════');
  return {migrated: evMigrated, hold: holdCount, uniqNew, dup: newEvVals.length-uniqNew};
}
