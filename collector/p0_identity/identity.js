// P0 — Stable EVENT Identity (isolated experiment, no live sheet mutation)
// Contract: docs/04-EVENT-IDENTITY.md
// Identity = occurrence, not title string. Deterministic SHA1 of bearing fields.
// This module is pure (no SpreadsheetApp) for Node + Apps Script testability.

function sha1Hex(s) {
  // Node vs Apps Script dual
  if (typeof Utilities !== 'undefined' && Utilities.computeDigest) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_1, String(s))
      .map(function(b){ var v=b<0?b+256:b; var h=v.toString(16); return h.length===1?'0'+h:h; }).join('');
  }
  // Node fallback
  const crypto = require('crypto');
  return crypto.createHash('sha1').update(String(s), 'utf8').digest('hex');
}

function stemTitleCore(title) {
  let t = String(title||'').toLowerCase();
  t = t.replace(/^[a-z0-9\s\-&]+\s*[:—–-]\s*/i, '');
  t = t.replace(/2\s*nm/g, 'n2').replace(/3\s*nm/g, 'n3');
  // synonym canonicalization for benign wording (expands/increases/boosts → expand) — keep announced/delayed distinct
  const syn = { 'expands':'expand','expanding':'expand','increases':'expand','increasing':'expand','boosts':'expand','boosting':'expand','expands':'expand' };
  // Apply word-level synonym before punctuation removal
  t = t.split(/\s+/).map(w=> syn[w] || w).join(' ');
  t = t.replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const stop = new Set(['a','the','is','are','was','were','for','with','and','or','at','in','on','to','of','as','by','from']);
  t = t.split(' ').filter(w=>!stop.has(w)).join(' ');
  return t;
}

function normalizeEntities(entities) {
  const arr = (Array.isArray(entities) ? entities : String(entities).split(',')).map(s=>String(s).trim().toLowerCase()).filter(Boolean);
  arr.sort();
  return arr.join(',');
}

function buildIdentityKey({title_core, event_date, entities, topic, domain}) {
  // All bearing fields lowercased, sorted, date YYYY-MM-DD or '' for UNKNOWN
  const date = String(event_date||'').trim().slice(0,10); // YYYY-MM-DD
  const ent = normalizeEntities(entities);
  const key = [
    String(title_core||'').trim().toLowerCase(),
    date,
    ent,
    String(topic||'').trim().toLowerCase(),
    String(domain||'').trim().toLowerCase()
  ].join('|');
  return key;
}

function stableEventId(identityKey) {
  return 'E-' + sha1Hex(identityKey).slice(0,8).toUpperCase();
}

// Public API for tests
function identityForEvent({title, event_date, entities, topic, domain}) {
  const title_core = stemTitleCore(title);
  const key = buildIdentityKey({title_core, event_date, entities, topic, domain});
  const id = stableEventId(key);
  return { title_core, identityKey: key, eventId: id };
}

if (typeof module !== 'undefined') {
  module.exports = { sha1Hex, stemTitleCore, buildIdentityKey, stableEventId, identityForEvent };
}
