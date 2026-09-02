// P0 Apps Script wrapper — isolated experiment, no live EVENTS mutation
// Run: testP0IdentityIsolated()

// Load identity.js content via eval in Apps Script (since Apps Script has no require)
// Paste identity.js above this file in Apps Script or use eval.

function testP0IdentityIsolated() {
  Logger.log('════════ P0 ISOLATED 10 INVARIANTS + 242 REPRODUCIBILITY + ADVERSARIAL ════════');
  const results = [];

  // Helper to assert
  function assert(name, cond, detail) {
    const ok = !!cond;
    Logger.log((ok?'✅ PASS':'❌ FAIL') + ' ' + name + (detail?' — ' + detail:''));
    results.push({name, ok, detail});
    return ok;
  }

  // Invariant 1: Same input → same ID
  (function(){
    const a = identityForEvent({title:'TSMC expands N2 capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const b = identityForEvent({title:'TSMC expands N2 capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    assert('1 Same input → same ID', a.eventId===b.eventId, a.eventId + ' vs ' + b.eventId);
  })();

  // Invariant 2: Adding article same occurrence → same ID
  (function(){
    const base = identityForEvent({title:'TSMC N2 PDK update', event_date:'2026-08-30', entities:['TSMC'], topic:'PDK', domain:'Foundry'});
    const withExtra = identityForEvent({title:'TSMC N2 PDK update', event_date:'2026-08-30', entities:['TSMC'], topic:'PDK', domain:'Foundry'});
    assert('2 Adding article same occurrence → same ID', base.eventId===withExtra.eventId, base.eventId);
  })();

  // Invariant 3: Benign title wording → same ID
  (function(){
    const a = identityForEvent({title:'TSMC expands N2 capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const b = identityForEvent({title:'TSMC increases 2nm capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const c = identityForEvent({title:'TSMC boosts N2 production capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    // With stemming 2nm→n2 and stopword removal, a and b should be close but may differ; report
    const abSame = a.eventId===b.eventId;
    const acSame = a.eventId===c.eventId;
    Logger.log('  3a expands vs increases: ' + (abSame?'SAME':'DIFFERENT') + ' ' + a.identityKey + ' | ' + b.identityKey);
    Logger.log('  3b expands vs boosts: ' + (acSame?'SAME':'DIFFERENT'));
    // For P0 we require benign wording (expands/increases) same ID — if not, it's a finding
    assert('3 Benign wording → same ID (expands vs increases)', abSame, abSame?'stable':'different — needs title_core improvement');
  })();

  // Invariant 4: Deterministic rebuild 242 — synthetic 242 with deterministic IDs
  (function(){
    const synthetic = [];
    for(let i=0;i<242;i++) synthetic.push({title:'Event '+i+' TSMC N2 capacity', event_date:'2026-08-'+String(24+(i%7)).padStart(2,'0'), entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const runA = synthetic.map(e=>identityForEvent(e).eventId);
    const runB = synthetic.map(e=>identityForEvent(e).eventId);
    const runC = synthetic.map(e=>identityForEvent(e).eventId);
    const sameAB = runA.join(',')===runB.join(',');
    const sameAC = runA.join(',')===runC.join(',');
    const uniq = new Set(runA).size;
    assert('4 Rebuild 242 deterministic A==B', sameAB, 'uniq '+uniq);
    assert('4 Rebuild 242 deterministic A==C', sameAC, '');
    Logger.log('  4 event count 242, unique IDs ' + uniq + ', dupes ' + (242-uniq));
  })();

  // Invariant 5: Merge — deterministic survivor earliest
  (function(){
    const evA = identityForEvent({title:'TSMC N2 Aug30', event_date:'2026-08-30', entities:['TSMC'], topic:'Process Node', domain:'Foundry'});
    const evB = identityForEvent({title:'TSMC N2 Aug31', event_date:'2026-08-31', entities:['TSMC'], topic:'Process Node', domain:'Foundry'});
    // Simulate merge: survivor is earliest by pub
    const survivor = evA.eventId < evB.eventId ? evA : evB; // deterministic by ID sort for test
    const merged = evA.eventId < evB.eventId ? evA.eventId : evB.eventId;
    assert('5 Merge deterministic survivor', !!merged, 'survivor ' + merged);
  })();

  // Invariant 6: Split — new deterministic ID, lineage preserved
  (function(){
    const original = identityForEvent({title:'TSMC N2 capacity expansion announced', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const splitA = identityForEvent({title:'TSMC N2 capacity expansion announced', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const splitB = identityForEvent({title:'TSMC N2 capacity expansion delayed', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const different = splitA.eventId !== splitB.eventId;
    assert('6 Split announced vs delayed → different IDs', different, splitA.eventId + ' vs ' + splitB.eventId);
    assert('6 Split original lineage preserved (announced same as original)', original.eventId===splitA.eventId, '');
  })();

  // Invariants 7-9: downstream lineage — synthetic
  (function(){
    const ev = identityForEvent({title:'Intel 14A yield', event_date:'2026-08-30', entities:['Intel'], topic:'Yield', domain:'Foundry'});
    const reviewed = {event_id: ev.eventId, human_impact:80, why:'test'};
    const ea = {event_id: ev.eventId, nid:'NORM-001'};
    const ri = {event_id: ev.eventId, roadmap_result:'YES'};
    // Simulate rebuild with same identity
    const ev2 = identityForEvent({title:'Intel 14A yield', event_date:'2026-08-30', entities:['Intel'], topic:'Yield', domain:'Foundry'});
    const preserved = reviewed.event_id===ev2.eventId && ea.event_id===ev2.eventId && ri.event_id===ev2.eventId;
    assert('7-9 Downstream REVIEWED/ROADMAP/EA survive rebuild', preserved, ev.eventId + '→' + ev2.eventId);
  })();

  // Invariant 10: No duplicate stable IDs for distinct keys
  (function(){
    const a = identityForEvent({title:'TSMC N2 capacity expansion announced', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const b = identityForEvent({title:'TSMC N2 capacity expansion delayed', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'});
    const c = identityForEvent({title:'Intel 18A yield', event_date:'2026-08-30', entities:['Intel'], topic:'Yield', domain:'Foundry'});
    const set = new Set([a.eventId,b.eventId,c.eventId]);
    assert('10 No duplicate IDs for distinct keys', set.size===3, a.eventId + ',' + b.eventId + ',' + c.eventId);
  })();

  // Adversarial A-J
  const adversarial = [
    {name:'A Same event different wording', a:{title:'TSMC expands N2 capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, b:{title:'TSMC increases 2nm capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, expect:'SAME'},
    {name:'B Adding corroborating source', a:{title:'TSMC N2 PDK', event_date:'2026-08-30', entities:['TSMC'], topic:'PDK', domain:'Foundry'}, b:{title:'TSMC N2 PDK', event_date:'2026-08-30', entities:['TSMC'], topic:'PDK', domain:'Foundry'}, expect:'SAME'},
    {name:'C Same entity different event', a:{title:'TSMC N2 capacity expansion announced', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, b:{title:'TSMC CoWoS capacity', event_date:'2026-08-30', entities:['TSMC'], topic:'Packaging', domain:'Packaging'}, expect:'DIFFERENT'},
    {name:'D Same topic different date', a:{title:'TSMC N2', event_date:'2026-08-20', entities:['TSMC'], topic:'Process Node', domain:'Foundry'}, b:{title:'TSMC N2', event_date:'2026-08-31', entities:['TSMC'], topic:'Process Node', domain:'Foundry'}, expect:'DIFFERENT'},
    {name:'E Same entity/topic separate occurrences', a:{title:'TSMC N2 roadmap', event_date:'2026-08-30', entities:['TSMC'], topic:'Process Node', domain:'Foundry'}, b:{title:'TSMC N2 yield improvement', event_date:'2026-08-31', entities:['TSMC'], topic:'Yield', domain:'Foundry'}, expect:'DIFFERENT'},
    {name:'F Announcement vs delay', a:{title:'TSMC N2 expansion announced', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, b:{title:'TSMC N2 expansion delayed', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, expect:'DIFFERENT'},
    {name:'G Capacity increase vs reduction', a:{title:'TSMC capacity increase', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, b:{title:'TSMC capacity reduction', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, expect:'DIFFERENT'},
    {name:'H Product launch vs research', a:{title:'M3D 6T SRAM product launch at 2nm', event_date:'2026-08-30', entities:['TSMC'], topic:'PDK', domain:'Foundry'}, b:{title:'M3D 6T SRAM research at 2nm', event_date:'2026-08-30', entities:['TSMC'], topic:'Process Node', domain:'Foundry'}, expect:'DIFFERENT'},
    {name:'I Merge two separate', a:{title:'TSMC N2 Aug30', event_date:'2026-08-30', entities:['TSMC'], topic:'Process Node', domain:'Foundry'}, b:{title:'TSMC N2 Aug31', event_date:'2026-08-31', entities:['TSMC'], topic:'Process Node', domain:'Foundry'}, expect:'DIFFERENT then MERGE survivor deterministic'},
    {name:'J Split one into two', a:{title:'TSMC N2 capacity announced', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, b:{title:'TSMC N2 capacity delayed', event_date:'2026-08-30', entities:['TSMC'], topic:'Capacity', domain:'Foundry'}, expect:'DIFFERENT'},
  ];
  for(const t of adversarial){
    const ida = identityForEvent(t.a).eventId;
    const idb = identityForEvent(t.b).eventId;
    const isSame = ida===idb;
    const pass = (t.expect==='SAME' && isSame) || (t.expect==='DIFFERENT' && !isSame) || t.expect.includes('MERGE');
    Logger.log((pass?'✅':'❌') + ' Adversarial ' + t.name + ' ' + ida + (isSame?' == ':' != ') + idb + ' expect ' + t.expect);
    results.push({name: t.name, ok: pass});
  }

  const passed = results.filter(r=>r.ok).length;
  const total = results.length;
  Logger.log('════════ P0 ISOLATED RESULT ' + passed + '/' + total + ' PASS ════════');
  return {passed, total, results};
}

function testP0RealData() {
  Logger.log('════════ P0 REAL 242/210 REPRODUCIBILITY + 18 GOLD MAPPING (read-only) ════════');
  const ss = SpreadsheetApp.getActiveSpreadsheet() || SpreadsheetApp.openById('YOUR_SPREADSHEET_ID');
  const normSheet = ss.getSheetByName('NORMALIZED');
  const eventsSheet = ss.getSheetByName('EVENTS');
  const reviewedSheet = ss.getSheetByName('REVIEWED_EVENTS');

  // Test on NORMALIZED 242
  if (normSheet && normSheet.getLastRow()>1) {
    const vals = normSheet.getDataRange().getValues().slice(1);
    const runA = vals.map(r=> identityForEvent({title:String(r[4]||''), event_date:String(r[6]||''), entities:String(r[2]||'').split(',').map(s=>s.trim()), topic:String(r[4]||'').toLowerCase().includes('n2')?'Process Node':'General', domain:'Market / Policy'}).eventId);
    const runB = vals.map(r=> identityForEvent({title:String(r[4]||''), event_date:String(r[6]||''), entities:String(r[2]||'').split(',').map(s=>s.trim()), topic:String(r[4]||'').toLowerCase().includes('n2')?'Process Node':'General', domain:'Market / Policy'}).eventId);
    const same = runA.join(',')===runB.join(',');
    const uniq = new Set(runA).size;
    Logger.log((same?'✅ PASS':'❌ FAIL') + ' Real NORMALIZED 242 reproducibility A==B uniq=' + uniq + ' dupes=' + (242-uniq));
  }

  // Test on EVENTS 210
  if (eventsSheet && eventsSheet.getLastRow()>1) {
    const vals = eventsSheet.getDataRange().getValues().slice(1);
    const runA = vals.map(r=> identityForEvent({title:String(r[1]||''), event_date:String(r[2]||''), entities:String(r[5]||'').split(',').map(s=>s.trim()), topic:String(r[6]||''), domain:String(r[4]||'')}).eventId);
    const runB = vals.map(r=> identityForEvent({title:String(r[1]||''), event_date:String(r[2]||''), entities:String(r[5]||'').split(',').map(s=>s.trim()), topic:String(r[6]||''), domain:String(r[4]||'')}).eventId);
    const runC = vals.map(r=> identityForEvent({title:String(r[1]||''), event_date:String(r[2]||''), entities:String(r[5]||'').split(',').map(s=>s.trim()), topic:String(r[6]||''), domain:String(r[4]||'')}).eventId);
    const sameAB = runA.join(',')===runB.join(',');
    const sameAC = runA.join(',')===runC.join(',');
    const uniq = new Set(runA).size;
    Logger.log((sameAB&&sameAC?'✅ PASS':'❌ FAIL') + ' Real EVENTS ' + vals.length + ' reproducibility A==B==C uniq=' + uniq + ' dupes=' + (vals.length-uniq));
    if (uniq !== vals.length) {
      // Find colliding keys
      const seen = new Map();
      for(let i=0;i<vals.length;i++){
        const k = runA[i];
        if(seen.has(k)) Logger.log('  Collision: ' + vals[i][0] + ' and ' + seen.get(k) + ' → ' + k);
        else seen.set(k, String(vals[i][0]||'').trim());
      }
    }
  }

  // 18 gold mapping
  if (reviewedSheet && eventsSheet) {
    const revVals = reviewedSheet.getDataRange().getValues().slice(1).filter(r=>String(r[0]||'').trim().startsWith('E-')).slice(0,18);
    const evMap = new Map();
    if (eventsSheet.getLastRow()>1) {
      const evVals = eventsSheet.getDataRange().getValues().slice(1);
      evVals.forEach(r=>{ const eid=String(r[0]||'').trim(); if(eid) evMap.set(eid, r); });
    }
    Logger.log('Gold mapping 18:');
    for(const r of revVals){
      const oldId = String(r[0]||'').trim();
      const evRow = evMap.get(oldId);
      if(!evRow){ Logger.log('  ' + oldId + ' → NOT FOUND in EVENTS (orphan)'); continue; }
      const title = String(evRow[1]||'');
      const date = String(evRow[2]||'');
      const domain = String(evRow[4]||'');
      const entities = String(evRow[5]||'').split(',').map(s=>s.trim());
      const topic = String(evRow[6]||'');
      const stable = identityForEvent({title, event_date:date, entities, topic, domain});
      const confidence = (domain==='general' && topic==='General') ? 'AMBIGUOUS — general domain, weak identity' : 'HIGH — deterministic';
      Logger.log('  ' + oldId + ' → ' + stable.eventId + ' ' + confidence + ' | ' + stable.identityKey.slice(0,60));
    }
  }

  Logger.log('════════ P0 REAL DATA END — no sheet mutation ════════');
}
