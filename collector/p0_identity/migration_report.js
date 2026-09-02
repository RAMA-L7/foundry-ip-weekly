// P0 Migration Report — read-only, no live sheet mutation
// Reads EVENTS 210 + REVIEWED + ROADMAP_IMPACT + EVENT_ARTICLES
// Produces migration mapping old→stable for all 210, with 18 gold highlighted
// Run: buildP0MigrationReport()

function buildP0MigrationReport() {
  Logger.log('════════ P0 MIGRATION REPORT (read-only) ════════');
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const eventsSheet = ss.getSheetByName('EVENTS');
  const eaSheet = ss.getSheetByName('EVENT_ARTICLES');
  const reviewedSheet = ss.getSheetByName('REVIEWED_EVENTS');
  const roadmapSheet = ss.getSheetByName('ROADMAP_IMPACT');
  if (!eventsSheet) throw new Error('EVENTS missing');
  const evVals = eventsSheet.getDataRange().getValues();
  const header = evVals[0];
  const rows = evVals.slice(1).filter(r=>String(r[0]||'').trim().startsWith('E-'));
  Logger.log('EVENTS rows=' + rows.length);

  // Build maps for downstream counts
  const eaByEvent = new Map();
  if (eaSheet && eaSheet.getLastRow()>1) {
    const eaVals = eaSheet.getDataRange().getValues().slice(1);
    eaVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(!eid) return; if(!eaByEvent.has(eid)) eaByEvent.set(eid,0); eaByEvent.set(eid, eaByEvent.get(eid)+1); });
  }
  const reviewedSet = new Set();
  if (reviewedSheet && reviewedSheet.getLastRow()>1) {
    const revVals = reviewedSheet.getDataRange().getValues().slice(1);
    revVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) reviewedSet.add(eid); });
  }
  const roadmapMap = new Map();
  if (roadmapSheet && roadmapSheet.getLastRow()>1) {
    const riVals = roadmapSheet.getDataRange().getValues().slice(1);
    riVals.forEach(r=>{ const eid=String(r[1]||'').trim(); if(eid) roadmapMap.set(eid, String(r[11]||'').trim()); });
  }

  const report = [];
  const seenNew = new Map(); // newId -> oldId for collision detection
  let high=0, amb=0, dup=0;

  for (const r of rows) {
    const oldId = String(r[0]||'').trim();
    const title = String(r[1]||'').trim();
    const eventDate = String(r[2]||'').trim();
    const domain = String(r[4]||'').trim();
    const entities = String(r[5]||'').trim();
    const topic = String(r[6]||'').trim();
    const articleCount = parseInt(String(r[9]||'1'),10) || 1;

    const ident = identityForEvent({title, event_date:eventDate, entities: entities.split(',').map(s=>s.trim()), topic, domain});
    const newId = ident.eventId;
    const identityKey = ident.identityKey;
    const identityVersion = 'EID_v0.1';

    // Confidence: if domain general + topic General + old title is generic, mark AMBIGUOUS
    let confidence='HIGH';
    let reason='deterministic';
    if (domain.toLowerCase()==='general' && topic.toLowerCase()==='general' && title.length < 30) { confidence='AMBIGUOUS'; reason='general domain weak identity'; amb++; }
    else if (seenNew.has(newId)) { confidence='AMBIGUOUS'; reason='collision with ' + seenNew.get(newId); dup++; }
    else { high++; }

    if (!seenNew.has(newId)) seenNew.set(newId, oldId);

    const reviewedStatus = reviewedSet.has(oldId) ? 'REVIEWED' : 'NOT_REVIEWED';
    const roadmapStatus = roadmapMap.get(oldId) || '';
    const eaCount = eaByEvent.get(oldId) || 0;

    let action='MIGRATE';
    if (confidence==='AMBIGUOUS') action='REVIEW';
    // Gold events are all HIGH per previous run, so MIGRATE

    report.push([oldId, newId, identityKey.slice(0,80), confidence, title.slice(0,80), eventDate, entities.slice(0,50), String(articleCount), reviewedStatus, roadmapStatus, String(eaCount), action, reason, identityVersion]);
  }

  Logger.log('Report rows=' + report.length + ' HIGH=' + high + ' AMBIGUOUS=' + amb + ' dup collisions=' + dup);
  if (dup>0) Logger.log('❌ FAIL duplicate stable IDs detected');
  else Logger.log('✅ PASS no duplicate stable IDs for 210');

  // Highlight 18 gold
  const goldIds = reviewedSet;
  const goldMigrated = report.filter(r=> goldIds.has(r[0]));
  Logger.log('Gold 18 migrated: ' + goldMigrated.length + ' all ' + (goldMigrated.every(r=>r[3]==='HIGH')?'HIGH':'mixed'));

  // Investigate E-8EB0A153 anomaly
  const anomaly = report.find(r=>r[0]==='E-8EB0A153');
  if (anomaly) {
    Logger.log('Anomaly E-8EB0A153: old title "' + anomaly[4].slice(0,60) + '" → new ' + anomaly[1] + ' key ' + anomaly[2].slice(0,60) + ' confidence ' + anomaly[3]);
    const evRow = rows.find(r=>String(r[0]||'').trim()==='E-8EB0A153');
    if (evRow) Logger.log('  EVENTS row raw: title="' + String(evRow[1]||'').slice(0,80) + '" date=' + String(evRow[2]||'') + ' domain=' + String(evRow[4]||'') + ' entities=' + String(evRow[5]||'').slice(0,40));
    // Also check NORMALIZED articles for this event
    if (eaByEvent.has('E-8EB0A153')) {
      const eaVals = eaSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim()==='E-8EB0A153');
      Logger.log('  EVENT_ARTICLES for E-8EB0A153: ' + eaVals.length + ' articles');
      const normSheet = ss.getSheetByName('NORMALIZED');
      if (normSheet) {
        const normMap = new Map();
        const nVals = normSheet.getDataRange().getValues().slice(1);
        nVals.forEach(r=>{ const nid=String(r[0]||'').trim(); if(nid) normMap.set(nid, String(r[4]||'').slice(0,60)); });
        eaVals.forEach(r=>{ const nid=String(r[1]||'').trim(); Logger.log('    ' + nid + ' → ' + (normMap.get(nid)||'NOT FOUND').slice(0,60)); });
      }
    }
  }

  // Write report sheet (new, no pipeline mutation)
  try {
    let rep = ss.getSheetByName('P0_MIGRATION_REPORT');
    if (rep) rep.clear(); else rep = ss.insertSheet('P0_MIGRATION_REPORT');
    rep.getRange(1,1,1,14).setValues([['old_event_id','new_event_id','identity_key','confidence','canonical_title','event_date','entity_set','article_count','reviewed_status','roadmap_impact_status','event_article_count','migration_action','migration_reason','identity_version']]);
    if (report.length>0) rep.getRange(2,1,report.length,14).setValues(report);
    Logger.log('P0_MIGRATION_REPORT written ' + report.length + ' rows');
  } catch(e){ Logger.log('Report write failed: ' + e.message); }

  Logger.log('════════ P0 MIGRATION REPORT END — read-only ════════');
  return {total: report.length, high, amb, dup, gold: goldMigrated.length};
}
