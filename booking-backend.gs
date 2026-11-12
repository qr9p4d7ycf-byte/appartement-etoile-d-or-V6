/* Service de réservation (Google Apps Script, gratuit).
   Reçoit les demandes du site, vous les envoie par e-mail, les range dans la feuille « Demandes »
   et permet à la page admin de les lire, de les accepter ou de les refuser. */
const OWNER_EMAIL = 'contact@exemple.fr';              // À MODIFIER : l'e-mail qui reçoit les demandes
const ADMIN_KEY   = 'CHANGEZ-MOI-PAR-UN-LONG-CODE';    // À MODIFIER : 12 caractères minimum, gardez-le secret
const SITE_NAME   = 'Chalet l’étoile d’or';
const SHEET_NAME  = 'Demandes';
const COLS = ['id','recu','statut','nom','email','telephone','arrivee','depart','nuits','personnes','animal','message','langue','estimation','reponse','code','remise','auto'];

const DEFAULT_TPL = {
 accept: {
  fr: 'Bonjour {prenom},\n\nBonne nouvelle : votre demande du {arrivee} au {depart} ({nuits} nuits, {personnes} personne(s)) est acceptée.\n\nTarif estimé : {total}\n\nMoyens de paiement :\n- Virement bancaire : IBAN à compléter\n- Autre moyen : à compléter\n\nVotre réservation sera confirmée dès réception du paiement. Répondez simplement à ce message pour toute question.\n\nÀ bientôt,\n{site}',
  en: 'Hello {prenom},\n\nGood news: your request for {arrivee} to {depart} ({nuits} nights, {personnes} guest(s)) is accepted.\n\nEstimated rate: {total}\n\nPayment methods:\n- Bank transfer: IBAN to be completed\n- Other method: to be completed\n\nYour booking will be confirmed once payment is received. Simply reply to this message with any question.\n\nSee you soon,\n{site}',
  de: 'Guten Tag {prenom},\n\ngute Nachrichten: Ihre Anfrage für {arrivee} bis {depart} ({nuits} Nächte, {personnes} Gast/Gäste) ist angenommen.\n\nGeschätzter Preis: {total}\n\nZahlungsmöglichkeiten:\n- Überweisung: IBAN bitte ergänzen\n- Andere Möglichkeit: bitte ergänzen\n\nIhre Buchung ist bestätigt, sobald die Zahlung eingegangen ist. Antworten Sie einfach auf diese Nachricht, wenn Sie Fragen haben.\n\nBis bald,\n{site}'
 },
 decline: {
  fr: 'Bonjour {prenom},\n\nMerci pour votre demande du {arrivee} au {depart}. Malheureusement, le logement n’est pas disponible à ces dates. N’hésitez pas à nous proposer d’autres dates.\n\nCordialement,\n{site}',
  en: 'Hello {prenom},\n\nThank you for your request for {arrivee} to {depart}. Unfortunately, the apartment is not available on these dates. Please feel free to suggest other dates.\n\nKind regards,\n{site}',
  de: 'Guten Tag {prenom},\n\nvielen Dank für Ihre Anfrage für {arrivee} bis {depart}. Leider ist die Wohnung zu diesen Terminen nicht verfügbar. Gerne können Sie uns andere Termine vorschlagen.\n\nFreundliche Grüße,\n{site}'
 }
};
const ACK = {
 fr: {s: 'Nous avons bien reçu votre demande', b: function(r){return 'Bonjour ' + first_(r.nom) + ',\n\nNous avons bien reçu votre demande de séjour du ' + r.arrivee + ' au ' + r.depart + '. Aucun paiement n’est demandé pour le moment : nous vous répondons rapidement pour confirmer et vous indiquer les moyens de paiement.\n\n' + SITE_NAME;}},
 en: {s: 'We have received your request', b: function(r){return 'Hello ' + first_(r.nom) + ',\n\nWe have received your stay request for ' + r.arrivee + ' to ' + r.depart + '. No payment is required for now: we will reply shortly to confirm and send you the payment methods.\n\n' + SITE_NAME;}},
 de: {s: 'Wir haben Ihre Anfrage erhalten', b: function(r){return 'Guten Tag ' + first_(r.nom) + ',\n\nwir haben Ihre Aufenthaltsanfrage für ' + r.arrivee + ' bis ' + r.depart + ' erhalten. Aktuell ist keine Zahlung nötig: Wir antworten Ihnen in Kürze zur Bestätigung und senden Ihnen die Zahlungsmöglichkeiten.\n\n' + SITE_NAME;}}
};

function first_(n){return String(n).split(' ')[0];}
function out_(o){return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);}
function sheet_(){
  var ss = SpreadsheetApp.getActiveSpreadsheet(), s = ss.getSheetByName(SHEET_NAME);
  if (!s) { s = ss.insertSheet(SHEET_NAME); s.getRange('A:R').setNumberFormat('@'); s.appendRow(COLS); return s; }
  var h = s.getRange(1, 1, 1, COLS.length).getValues()[0];
  if (h.join('|') !== COLS.join('|')) { s.getRange('A:R').setNumberFormat('@'); s.getRange(1, 1, 1, COLS.length).setValues([COLS]); }
  return s;
}
function rows_(){
  var v = sheet_().getDataRange().getValues(); var h = v.shift();
  return v.map(function(r){var o = {}; h.forEach(function(k,i){o[k] = r[i];}); return o;});
}
function tpl_(){var p = PropertiesService.getScriptProperties().getProperty('tpl'); return p ? JSON.parse(p) : DEFAULT_TPL;}
function nightsOf_(a, b){
  var out = [], p = String(a).split('-'), q = String(b).split('-');
  var t = Date.UTC(+p[0], +p[1]-1, +p[2]), e = Date.UTC(+q[0], +q[1]-1, +q[2]);
  for (; t < e; t += 86400000) out.push(new Date(t).toISOString().slice(0,10));
  return out;
}
function blocked_(){
  var set = {};
  rows_().forEach(function(r){ if (r.statut === 'acceptee') nightsOf_(r.arrivee, r.depart).forEach(function(d){set[d] = 1;}); });
  return Object.keys(set).sort();
}
function doGet(e){
  if (e && e.parameter && e.parameter.a === 'blocked') return out_({booked: blocked_()});   // dates seulement, aucune donnée personnelle
  return out_({ok: true});
}
function doPost(e){
  var d; try { d = JSON.parse(e.postData.contents); } catch (x) { return out_({ok: false, error: 'bad'}); }
  if (d.action === 'request') return out_(request_(d));
  if (d.action === 'promo') return out_(promoPublic_(d));
  if (d.action === 'hit') return out_(hit_(d));
  if (d.action === 'contact') return out_(contact_(d));
  if (!(typeof d.key === 'string' && d.key.length >= 8 && d.key === ADMIN_KEY)) return out_({ok: false, error: 'auth'});
  if (d.action === 'list') return out_({ok: true, items: rows_().reverse()});
  if (d.action === 'decide') return out_(decide_(d));
  if (d.action === 'markdone') return out_(markdone_(d));
  if (d.action === 'getTemplates') return out_({ok: true, templates: tpl_()});
  if (d.action === 'saveTemplates') { PropertiesService.getScriptProperties().setProperty('tpl', JSON.stringify(d.templates)); return out_({ok: true}); }
  if (d.action === 'getConfig') return out_({ok: true, promos: get_('promos', []), auto: get_('auto', DEFAULT_AUTO), uses: usesMap_(), rev: get_('rev', {})});
  if (d.action === 'savePromos') { props_().setProperty('promos', JSON.stringify(d.promos || [])); return out_({ok: true}); }
  if (d.action === 'saveAuto') { props_().setProperty('auto', JSON.stringify(d.auto || [])); return out_({ok: true}); }
  if (d.action === 'runAuto') return out_({ok: true, sent: runAutomations_()});
  if (d.action === 'testAuto') return out_(testAuto_(d));
  if (d.action === 'installTrigger') { try { installTrigger(); return out_({ok: true}); } catch (x) { return out_({ok: false, error: 'trigger'}); } }
  if (d.action === 'stats') {
    var all = props_().getProperties(), days = {};
    Object.keys(all).forEach(function(k){ if (k.indexOf('d_') === 0) { try { days[k.slice(2)] = JSON.parse(all[k]); } catch (x) {} } });
    return out_({ok: true, days: days});
  }
  if (d.action === 'saveRevenue') { props_().setProperty('rev', JSON.stringify(d.rev || {})); return out_({ok: true}); }
  return out_({ok: false, error: 'unknown'});
}
function request_(d){
  if (d.website) return {ok: true};   // piège anti-robots
  var cache = CacheService.getScriptCache(), k = 'n' + new Date().toISOString().slice(0,10), n = +(cache.get(k) || 0);
  if (n > 40) return {ok: false, error: 'busy'};
  cache.put(k, String(n + 1), 86400);
  var t = function(v, m){return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, m);};
  var r = {id: Utilities.getUuid().slice(0,8), recu: new Date().toISOString(), statut: 'nouvelle', nom: t(d.nom,80), email: t(d.email,120), telephone: t(d.telephone,40),
    arrivee: t(d.arrivee,10), depart: t(d.depart,10), nuits: t(d.nuits,4), personnes: t(d.personnes,3), animal: t(d.animal,200), message: t(d.message,2000),
    langue: ['fr','en','de'].indexOf(d.lang) >= 0 ? d.lang : 'fr', estimation: t(d.estimation,40), reponse: ''};
  var iso = /^\d{4}-\d{2}-\d{2}$/;
  if (!r.nom || !/^\S+@\S+\.\S+$/.test(r.email) || !iso.test(r.arrivee) || !iso.test(r.depart) || r.depart <= r.arrivee) return {ok: false, error: 'invalid'};
  var pc = null;
  if (d.code) { pc = promoCheck_(d.code, r.arrivee); if (!pc) return {ok: false, error: 'promo'}; }
  r.code = pc ? String(pc.code).toUpperCase() : ''; r.remise = pc ? '−' + pc.value + (pc.type === 'percent' ? ' %' : ' €') : ''; r.auto = '';
  sheet_().appendRow(COLS.map(function(c){return r[c];}));
  MailApp.sendEmail({to: OWNER_EMAIL, replyTo: r.email, name: SITE_NAME,
    subject: 'Nouvelle demande : ' + r.nom + ' (' + r.arrivee + ' → ' + r.depart + ')',
    body: 'Nouvelle demande de réservation\n\nNom : ' + r.nom + '\nE-mail : ' + r.email + '\nTéléphone : ' + r.telephone + '\nArrivée : ' + r.arrivee + '\nDépart : ' + r.depart + ' (' + r.nuits + ' nuits)\nPersonnes : ' + r.personnes + '\nAnimal : ' + r.animal + '\nEstimation : ' + r.estimation + '\nCode promo : ' + r.code + ' ' + r.remise + '\n\nMessage :\n' + r.message + '\n\nGérez cette demande depuis la page admin de votre site.'});
  try { var a = ACK[r.langue]; MailApp.sendEmail({to: r.email, replyTo: OWNER_EMAIL, name: SITE_NAME, subject: a.s + ' – ' + SITE_NAME, body: a.b(r)}); } catch (x) {}
  return {ok: true};
}
function decide_(d){
  var all = rows_(), idx = -1, r = null;
  all.forEach(function(x,i){ if (x.id === d.id) { idx = i; r = x; } });
  if (!r) return {ok: false, error: 'notfound'};
  var accept = d.decision === 'accepted';
  if (accept && !d.force) {
    var o = all.filter(function(x){return x.id !== r.id && x.statut === 'acceptee' && String(x.arrivee) < String(r.depart) && String(x.depart) > String(r.arrivee);})[0];
    if (o) return {ok: false, error: 'overlap'};
  }
  try { MailApp.sendEmail({to: r.email, replyTo: OWNER_EMAIL, name: SITE_NAME, subject: String(d.subject || SITE_NAME).slice(0,150), body: String(d.body || '').slice(0,5000)}); }
  catch (x) { return {ok: false, error: 'mail'}; }
  var s = sheet_(), row = idx + 2;
  s.getRange(row, COLS.indexOf('statut') + 1).setValue(accept ? 'acceptee' : 'refusee');
  s.getRange(row, COLS.indexOf('reponse') + 1).setValue(new Date().toISOString());
  return {ok: true};
}

/* ---------- Questions (demandes de renseignements) ---------- */
function contact_(d){
  if (d.website) return {ok: true};
  var cache = CacheService.getScriptCache(), k = 'c' + new Date().toISOString().slice(0,10), n = +(cache.get(k) || 0);
  if (n > 40) return {ok: false, error: 'busy'};
  cache.put(k, String(n + 1), 86400);
  var t = function(v, m){return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').slice(0, m);};
  var r = {id: Utilities.getUuid().slice(0,8), recu: new Date().toISOString(), statut: 'info', nom: t(d.nom,80), email: t(d.email,120), message: t(d.message,2000), langue: ['fr','en','de'].indexOf(d.lang) >= 0 ? d.lang : 'fr'};
  if (!r.nom || !r.message || !/^\S+@\S+\.\S+$/.test(r.email)) return {ok: false, error: 'invalid'};
  sheet_().appendRow(COLS.map(function(c){return r[c] == null ? '' : r[c];}));
  MailApp.sendEmail({to: OWNER_EMAIL, replyTo: r.email, name: SITE_NAME, subject: 'Nouvelle question : ' + r.nom,
    body: 'Nouvelle question reçue sur le site\n\nNom : ' + r.nom + '\nE-mail : ' + r.email + '\n\nMessage :\n' + r.message + '\n\nVous la retrouvez aussi dans la page admin (onglet Réservations).'});
  return {ok: true};
}
function markdone_(d){
  var all = rows_(), idx = -1;
  all.forEach(function(x,i){ if (x.id === d.id && x.statut === 'info') idx = i; });
  if (idx < 0) return {ok: false, error: 'notfound'};
  sheet_().getRange(idx + 2, COLS.indexOf('statut') + 1).setValue('traitee');
  return {ok: true};
}

/* ---------- Codes promo ---------- */
function props_(){return PropertiesService.getScriptProperties();}
function get_(k, def){var p = props_().getProperty(k); return p ? JSON.parse(p) : def;}
function usesOf_(code){var c = String(code).trim().toUpperCase(); return rows_().filter(function(r){return String(r.code).toUpperCase() === c && r.statut !== 'refusee';}).length;}
function usesMap_(){var m = {}; rows_().forEach(function(r){ if (r.code && r.statut !== 'refusee') m[r.code] = (m[r.code] || 0) + 1; }); return m;}
function promoCheck_(code, arrivee){
  var c = String(code || '').trim().toUpperCase(); if (!c) return null;
  var p = get_('promos', []).filter(function(x){return String(x.code).trim().toUpperCase() === c && (x.active === true || x.active === 'true');})[0];
  if (!p) return null;
  if (arrivee) { if (p.from && arrivee < p.from) return null; if (p.to && arrivee > p.to) return null; }
  var mu = +p.maxUses || 0; if (mu && usesOf_(p.code) >= mu) return null;
  return p;
}
function promoPublic_(d){
  var cache = CacheService.getScriptCache(), k = 'p' + new Date().toISOString().slice(0,10), n = +(cache.get(k) || 0);
  if (n > 200) return {ok: false};
  cache.put(k, String(n + 1), 86400);
  var p = promoCheck_(d.code, d.arrivee);
  return p ? {ok: true, type: p.type === 'amount' ? 'amount' : 'percent', value: +p.value} : {ok: false};
}

/* ---------- E-mails automatiques ---------- */
const MON = {fr: ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'],
  en: ['January','February','March','April','May','June','July','August','September','October','November','December'],
  de: ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember']};
const DEFAULT_AUTO = [
 {id: 'avant', name: 'La veille de l’arrivée', event: 'arrivee', offset: -1, enabled: false, promo: '',
  subject: ['Votre séjour commence demain – {site}', 'Your stay starts tomorrow – {site}', 'Ihr Aufenthalt beginnt morgen – {site}'],
  body: ['Bonjour {prenom},\n\nNous avons hâte de vous accueillir demain, le {arrivee}.\n\nInformations d’arrivée : à compléter (heure d’arrivée, remise des clés, accès).\n\nÀ très bientôt,\n{site}',
         'Hello {prenom},\n\nWe look forward to welcoming you tomorrow, {arrivee}.\n\nArrival information: to be completed (arrival time, key handover, access).\n\nSee you very soon,\n{site}',
         'Guten Tag {prenom},\n\nwir freuen uns, Sie morgen, am {arrivee}, zu empfangen.\n\nInformationen zur Anreise: bitte ergänzen (Ankunftszeit, Schlüsselübergabe, Zugang).\n\nBis bald,\n{site}']},
 {id: 'depart', name: 'Le jour du départ', event: 'depart', offset: 0, enabled: false, promo: '',
  subject: ['Merci pour votre séjour – {site}', 'Thank you for your stay – {site}', 'Danke für Ihren Aufenthalt – {site}'],
  body: ['Bonjour {prenom},\n\nMerci d’avoir séjourné chez nous ! Nous espérons que vous avez passé un excellent séjour.\n\nPour votre prochaine visite, voici un code promo : {promo}\n\nÀ bientôt,\n{site}',
         'Hello {prenom},\n\nThank you for staying with us! We hope you had a wonderful stay.\n\nFor your next visit, here is a promo code: {promo}\n\nSee you soon,\n{site}',
         'Guten Tag {prenom},\n\nvielen Dank für Ihren Aufenthalt! Wir hoffen, Sie hatten eine schöne Zeit.\n\nFür Ihren nächsten Besuch haben wir einen Promo-Code: {promo}\n\nBis bald,\n{site}']}
];
function fmt_(s, l){var p = String(s).split('-'), m = (MON[l] || MON.fr)[+p[1] - 1]; return l === 'en' ? m + ' ' + (+p[2]) + ', ' + p[0] : (+p[2]) + (l === 'de' ? '. ' : ' ') + m + ' ' + p[0];}
function addDays_(s, n){var p = String(s).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]) + n * 86400000).toISOString().slice(0,10);}
function ymd_(n){return Utilities.formatDate(new Date(Date.now() + n * 86400000), 'Europe/Paris', 'yyyy-MM-dd');}
function fill_(t, r, ru){
  var l = r.langue || 'fr', v = {prenom: first_(r.nom), nom: r.nom, arrivee: fmt_(r.arrivee, l), depart: fmt_(r.depart, l), nuits: r.nuits, personnes: r.personnes, total: r.estimation || '—', site: SITE_NAME, promo: ru.promo || ''};
  return String(t || '').replace(/\{(\w+)\}/g, function(m, k){return v[k] == null ? m : v[k];});
}
function sendAuto_(ru, r, prefix){
  var i = {fr: 0, en: 1, de: 2}[r.langue || 'fr'] || 0, sub = (ru.subject || [])[i] || (ru.subject || [])[0], body = (ru.body || [])[i] || (ru.body || [])[0];
  if (!sub || !body) return false;
  try { MailApp.sendEmail({to: r.email, replyTo: OWNER_EMAIL, name: SITE_NAME, subject: (prefix || '') + fill_(sub, r, ru), body: fill_(body, r, ru)}); return true; } catch (x) { return false; }
}
function runAutomations_(){
  var rules = get_('auto', DEFAULT_AUTO).filter(function(x){return x.enabled === true || x.enabled === 'true';});
  if (!rules.length) return 0;
  var today = ymd_(0), yest = ymd_(-1), sent = 0, s = sheet_(), all = rows_();
  all.forEach(function(r, i){
    if (r.statut !== 'acceptee') return;
    var done = String(r.auto || '').split(',').filter(String);
    rules.forEach(function(ru){
      if (done.indexOf(ru.id) >= 0) return;
      var tgt = addDays_(ru.event === 'depart' ? r.depart : r.arrivee, +ru.offset || 0);
      if (tgt !== today && tgt !== yest) return;
      if (String(r.reponse).slice(0,10) > tgt) return;   // acceptée après la date prévue : on n'envoie pas
      if (sendAuto_(ru, r)) { done.push(ru.id); sent++; s.getRange(i + 2, COLS.indexOf('auto') + 1).setValue(done.join(',')); }
    });
  });
  return sent;
}
function runAutomations(){return runAutomations_();}
function testAuto_(d){
  var ru = get_('auto', DEFAULT_AUTO).filter(function(x){return x.id === d.id;})[0];
  if (!ru) return {ok: false, error: 'notfound'};
  var r = {nom: 'Test Client', email: OWNER_EMAIL, arrivee: addDays_(ymd_(0), 7), depart: addDays_(ymd_(0), 10), nuits: '3', personnes: '2', estimation: '450 €', langue: d.lang || 'fr'};
  return sendAuto_(ru, r, '[TEST] ') ? {ok: true} : {ok: false, error: 'mail'};
}
function installTrigger(){
  ScriptApp.getProjectTriggers().forEach(function(t){ if (t.getHandlerFunction() === 'runAutomations') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('runAutomations').timeBased().atHour(8).everyDays(1).inTimezone('Europe/Paris').create();
}

/* ---------- Compteur de visites (anonyme : aucun cookie, aucune donnée personnelle) ---------- */
function hit_(d){
  var c = CacheService.getScriptCache(), ck = 'h' + new Date().toISOString().slice(0,10), n = +(c.get(ck) || 0);
  if (n > 4000) return {ok: true};
  c.put(ck, String(n + 1), 86400);
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(3000)) return {ok: true};
  try {
    var key = 'd_' + ymd_(0), o = get_(key, {v: 0, q: 0, fr: 0, en: 0, de: 0});
    if (d.t === 'q') o.q++;
    else { o.v++; var l = ['fr','en','de'].indexOf(d.lang) >= 0 ? d.lang : 'fr'; o[l]++; }
    props_().setProperty(key, JSON.stringify(o));
  } finally { lock.releaseLock(); }
  return {ok: true};
}
