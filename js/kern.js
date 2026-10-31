/* Stock und Stein · Angebote & Rechnungen – Kern: Speicher, Datenmodell, Rechnen.
   Alle Daten bleiben auf diesem Gerät: localStorage und zusätzlich die Datenbank des Browsers (IndexedDB, viel Platz).
   Beträge intern in Cent (ganze Zahlen). */
'use strict';

const SuS = window.SuS = {};

/* ---------- Hilfen ---------- */

SuS.id = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

SuS.heute = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

SuS.plusTage = (iso, tage) => {
  const [j, m, t] = iso.split('-').map(Number);
  const d = new Date(j, m - 1, t + Number(tage || 0));
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

SuS.datum = (iso) => {
  if (!iso) return '';
  const [j, m, t] = iso.split('-');
  return t + '.' + m + '.' + j;
};

/* Kaufmännisch runden, symmetrisch um null (−0,5 → −1 wie 0,5 → 1): so hebt ein Storno die Rechnung centgenau auf
   (Fund von Codex: Math.round rundet negative Halbwerte zur Null hin). Kleiner Zuschlag gegen Gleitkomma-Reste. */
SuS.runde = (x) => { const n = Number(x) || 0; return (n < 0 ? -1 : 1) * Math.round(Math.abs(n) + 1e-9); };

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
SuS.euro = (cent) => EURO.format((cent || 0) / 100);

SuS.zahl = (wert, stellen) => {
  const n = Number(wert) || 0;
  return n.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: stellen == null ? 3 : stellen });
};

/* Deutsche Zahl lesen: „1.234,50“, „1.234“ (Tausenderpunkt), „12,5“ oder „12.5“. */
SuS.leseZahl = (text) => {
  let s = String(text == null ? '' : text).trim().replace(/\s|€/g, '');
  if (!s) return NaN;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  return /^-?\d*\.?\d+$/.test(s) ? Number(s) : NaN;
};

SuS.leseCent = (text) => {
  const n = SuS.leseZahl(text);
  return Number.isFinite(n) ? Math.round(n * 100) : NaN;
};

/* Zahl für Eingabefelder: Komma, ohne Tausenderpunkte (sonst würde „1.234“ beim Sichern falsch gelesen – Fund von Codex). */
SuS.zahlFeld = (wert) => (Number(wert) || 0).toLocaleString('de-DE', { useGrouping: false, maximumFractionDigits: 3 });

SuS.centText = (cent) => ((cent || 0) / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/* Aufmaß: kleine Rechenformel wie „4,5*3 + 2*1,2“ – nur Zahlen, + - * / ( ) und benannte Werte (A, U, L, N).
   Kein eval; eigener Zerleger. Gibt NaN zurück, wenn etwas nicht passt. */
SuS.rechne = (formel, werte) => {
  const s = String(formel == null ? '' : formel).replace(/\s+/g, '').replace(/×|x/gi, '*').replace(/:/g, '/');
  if (!s || s.length > 200) return NaN;
  let i = 0;
  const vars = werte || {};
  function zahl() {
    const t = /^(\d{1,3}(?:\.\d{3})+)(?![\d.,])/.exec(s.slice(i));  // 1.250 = Tausenderpunkt
    if (t) { i += t[1].length; return Number(t[1].replace(/\./g, '')); }
    const m = /^(\d+(?:[.,]\d+)?)/.exec(s.slice(i));
    if (m) { i += m[1].length; return Number(m[1].replace(',', '.')); }
    const v = /^([A-Za-z])/.exec(s.slice(i));
    if (v && Object.prototype.hasOwnProperty.call(vars, v[1].toUpperCase())) { i += 1; return Number(vars[v[1].toUpperCase()]); }
    throw 0;
  }
  function faktor() {
    if (s[i] === '-') { i++; return -faktor(); }
    if (s[i] === '(') { i++; const w = summe(); if (s[i] !== ')') throw 0; i++; return w; }
    return zahl();
  }
  function produkt() {
    let w = faktor();
    while (s[i] === '*' || s[i] === '/') {
      const op = s[i++]; const r = faktor();
      if (op === '/' && r === 0) throw 0;
      w = op === '*' ? w * r : w / r;
    }
    return w;
  }
  function summe() {
    let w = produkt();
    while (s[i] === '+' || s[i] === '-') { const op = s[i++]; const r = produkt(); w = op === '+' ? w + r : w - r; }
    return w;
  }
  try {
    const w = summe();
    if (i !== s.length || !Number.isFinite(w)) return NaN;
    return Math.round(w * 1000) / 1000;
  } catch (e) { return NaN; }
};

SuS.esc = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------- Speicher ---------- */

const SCHLUESSEL = 'sus-buero-v1';

SuS.leer = () => ({
  v: 1,
  firma: {
    name: 'Stock und Stein', zusatz: 'Garten- und Landschaftsbau', inhaber: '',
    strasse: '', plz: '', ort: '', telefon: '', email: '', web: '',
    steuernummer: '', ustid: '', bank: '', iban: '', bic: '',
    kleinunternehmer: false, mwst: 19, zahlungsziel: 14, gueltigTage: 30,
    praefixAngebot: 'AN', praefixRechnung: 'RE', startRechnung: 1, preiseGeprueft: false, mahngebuehr: 0, skontoProzent: 0, skontoTage: 10,
    beraterNr: '', mandantNr: '', skr: '03', debitor: '10000', kreditor: '70000', bankKonto: ''
  },
  kunden: [],
  leistungen: [],
  dokumente: [],
  /* Ausbau (Orientierung an Branchen-Software, siehe ORIENTIERUNG.md) */
  projekte: [], aufwand: [], termine: [], mitarbeiter: [], vertraege: [], vorlagen: [], ausgaben: [], bausteine: [],
  ablage: [],  /* Dokumente ohne Betrag (Vertrag, Versicherung, Lieferschein …); Dateien liegen im Bildspeicher unter „u“ + id */
  zaehler: {},
  lieferantArt: {}  /* Beleg-Erkennung: zuletzt bestätigte Kategorie je Lieferant */
});

SuS.daten = null;

SuS.laden = (roh) => {
  /* Ohne funktionierenden Speicher (z. B. gesperrtes App-Fenster ohne Ersatzspeicher) würde nichts gesichert:
     erkennen und deutlich anzeigen (Fund Codex). */
  try { localStorage.setItem('sus-test', '1'); SuS.keinSpeicher = localStorage.getItem('sus-test') !== '1'; localStorage.removeItem('sus-test'); }
  catch (e) { SuS.keinSpeicher = true; }
  let d = null;
  try { d = JSON.parse(roh != null ? roh : localStorage.getItem(SCHLUESSEL) || 'null'); } catch (e) { d = null; }
  if (!d || d.v !== 1) {
    d = SuS.leer();
    d.leistungen = SuS.katalog.leistungen();
  }
  const leer = SuS.leer();
  d.firma = Object.assign(leer.firma, d.firma || {});
  ['kunden', 'leistungen', 'dokumente', 'projekte', 'aufwand', 'termine', 'mitarbeiter', 'vertraege', 'vorlagen', 'ausgaben', 'bausteine', 'ablage'].forEach((k) => { if (!Array.isArray(d[k])) d[k] = []; });
  if (!d.zaehler || typeof d.zaehler !== 'object' || Array.isArray(d.zaehler)) d.zaehler = {};
  if (!d.lieferantArt || typeof d.lieferantArt !== 'object' || Array.isArray(d.lieferantArt)) d.lieferantArt = {};
  for (const k of Object.keys(d.lieferantArt)) if (!/^[a-z0-9äöüß]{1,40}$/.test(k) || !Object.prototype.hasOwnProperty.call(SuS.AUSGABE_ARTEN, d.lieferantArt[k])) delete d.lieferantArt[k];
  SuS.bereinige(d);
  SuS.daten = d;
  SuS.bestaetigt = JSON.stringify(d);  // Ausgangsstand für eine Rücknahme
  return d;
};

/* Gespeicherte oder wiederhergestellte Daten in eine sichere Form bringen: Kennungen nur aus Kleinbuchstaben/Ziffern
   (verweisende Felder werden mitgeführt), feste Auswahlwerte, Zahlen als Zahlen, Datumsangaben als JJJJ-MM-TT.
   Schützt vor eingeschleustem HTML über eine präparierte Sicherungsdatei (Fund von Cursor). */
SuS.bereinige = (d) => {
  const ID = /^[a-z0-9]{4,40}$/, DATUM = /^\d{4}-\d{2}-\d{2}$/;
  const neu = new Map();
  const id = (alt, leerErlaubt) => {
    if (leerErlaubt && (alt == null || alt === '')) return '';
    if (typeof alt === 'string' && ID.test(alt)) return alt;
    const k = String(alt);
    if (!neu.has(k)) neu.set(k, SuS.id());
    return neu.get(k);
  };
  const text = (x) => (x == null ? '' : String(x));
  const zahl = (x, std) => (Number.isFinite(Number(x)) ? Number(x) : std);
  const datum = (x) => (typeof x === 'string' && DATUM.test(x) ? x : '');
  const STATUS = ['entwurf', 'versendet', 'angenommen', 'abgelehnt', 'offen', 'bezahlt', 'storniert', 'storno'];
  const position = (p) => {
    const q = Object.assign({}, p);
    q.id = id(q.id);
    q.typ = ['pos', 'titel', 'text'].includes(q.typ) ? q.typ : 'pos';
    ['text', 'beschreibung', 'einheit', 'formel'].forEach((f) => { q[f] = text(q[f]); });
    q.menge = zahl(q.menge, 0); q.preis = Math.round(zahl(q.preis, 0));
    q.art = Object.prototype.hasOwnProperty.call(SuS.ARTEN, q.art) ? q.art : 'lohn';
    q.lohnanteil = q.lohnanteil == null ? null : Math.min(100, Math.max(0, zahl(q.lohnanteil, 50)));
    q.leistungId = id(q.leistungId, true);
    q.bedarf = !!q.bedarf;
    return q;
  };
  const kunde = (k) => {
    const q = Object.assign({}, k);
    q.id = id(q.id);
    ['nr', 'name', 'ansprechpartner', 'strasse', 'plz', 'ort', 'telefon', 'email', 'ustid', 'notiz', 'referenz'].forEach((f) => { q[f] = text(q[f]); });
    q.art = q.art === 'firma' ? 'firma' : 'privat';
    return q;
  };
  d.kunden = d.kunden.filter((k) => k && typeof k === 'object').map(kunde);
  d.leistungen = d.leistungen.filter((l) => l && typeof l === 'object').map((l) => {
    const q = position(Object.assign({}, l, { typ: 'pos' }));
    delete q.typ; delete q.menge; delete q.formel; delete q.bedarf; delete q.leistungId;
    q.gruppe = text(l.gruppe) || 'Sonstiges';
    q.ek = l.ek == null || l.ek === '' ? null : Math.max(0, Math.round(zahl(l.ek, 0)));
    q.aufschlag = l.aufschlag == null || l.aufschlag === '' ? null : Math.min(1000, Math.max(0, zahl(l.aufschlag, 0)));
    return q;
  });
  d.dokumente = d.dokumente.filter((x) => x && typeof x === 'object' && Object.prototype.hasOwnProperty.call(SuS.TYPEN, x.typ)).map((x) => {
    const q = Object.assign({}, x);
    q.id = id(q.id); q.kundeId = id(q.kundeId, true); q.vonId = id(q.vonId, true);
    q.abschlaege = Array.isArray(q.abschlaege) ? q.abschlaege.map((a) => id(a)) : [];
    q.positionen = Array.isArray(q.positionen) ? q.positionen.filter((p) => p && typeof p === 'object').map(position) : [];
    ['nummer', 'betreff', 'baustelle', 'einleitung', 'schluss'].forEach((f) => { q[f] = text(q[f]); });
    q.datum = datum(q.datum) || SuS.heute();
    ['leistungVon', 'leistungBis', 'bezahltAm', 'nachgefasst'].forEach((f) => { q[f] = datum(q[f]); });
    q.status = STATUS.includes(q.status) ? q.status : 'entwurf';
    q.rabatt = Math.min(100, Math.max(0, zahl(q.rabatt, 0)));
    q.zahlungsziel = Math.max(0, Math.round(zahl(q.zahlungsziel, 14)));
    q.gueltigTage = Math.max(0, Math.round(zahl(q.gueltigTage, 30)));
    q.r13b = !!q.r13b;
    q.projektId = id(q.projektId, true);
    q.zahlungen = Array.isArray(q.zahlungen) ? q.zahlungen.filter((z) => z && typeof z === 'object').map((z) => ({
      id: id(z.id), datum: datum(z.datum) || SuS.heute(), betrag: Math.round(zahl(z.betrag, 0)), art: z.art === 'skonto' ? 'skonto' : 'zahlung' })).filter((z) => z.betrag !== 0) : [];
    const sk = q.skonto;
    q.skonto = sk && typeof sk === 'object' && Number(sk.prozent) > 0 && Number(sk.tage) > 0
      ? { prozent: Math.min(10, Math.round(Number(sk.prozent) * 100) / 100), tage: Math.min(90, Math.round(Number(sk.tage))) } : null;
    if (!q.skonto) delete q.skonto;
    q.mahnungen = Array.isArray(q.mahnungen) ? q.mahnungen.filter((m) => m && typeof m === 'object').slice(0, 3).map((m, i) => ({
      stufe: i + 1, datum: datum(m.datum) || SuS.heute(), gebuehr: Math.max(0, Math.round(zahl(m.gebuehr, 0))) })) : [];
    const u = q.unterschrift;
    q.unterschrift = u && typeof u === 'object' && typeof u.bild === 'string' && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(u.bild) && u.bild.length < 120000
      ? { bild: u.bild, name: text(u.name).slice(0, 80), datum: datum(u.datum) || SuS.heute() } : null;
    if (!q.unterschrift) delete q.unterschrift;
    q.umgebucht = text(q.umgebucht).slice(0, 30);
    q.bruttoVorgabe = q.bruttoVorgabe == null ? undefined : Math.round(zahl(q.bruttoVorgabe, 0)) || undefined;
    q.vertragAb = datum(q.vertragAb);
    q.vertragId = id(q.vertragId, true);
    const steuer = (st) => (st && typeof st === 'object' ? { modus: ['regel', 'klein', '13b'].includes(st.modus) ? st.modus : 'regel', satz: zahl(st.satz, 19) } : null);
    q.steuerVorgabe = steuer(q.steuerVorgabe);
    if (q.fest && typeof q.fest === 'object') {
      const f = q.fest;
      q.fest = {
        am: typeof f.am === 'string' && DATUM.test(f.am.slice(0, 10)) ? f.am : new Date().toISOString(),
        firma: (() => {
          const quelle = f.firma && typeof f.firma === 'object' ? f.firma : {}, ziel = SuS.leer().firma;
          Object.keys(ziel).forEach((k) => {
            if (!(k in quelle)) return;
            ziel[k] = typeof ziel[k] === 'boolean' ? !!quelle[k] : typeof ziel[k] === 'number' ? zahl(quelle[k], ziel[k]) : text(quelle[k]);
          });
          return ziel;
        })(),
        kunde: f.kunde && typeof f.kunde === 'object' ? kunde(f.kunde) : null,
        steuer: steuer(f.steuer) || { modus: 'regel', satz: 19 },
        abzuege: Array.isArray(f.abzuege) ? f.abzuege.map((a) => ({
          id: id(a.id), nummer: text(a.nummer), datum: datum(a.datum), netto: Math.round(zahl(a.netto, 0)), mwst: Math.round(zahl(a.mwst, 0)), brutto: Math.round(zahl(a.brutto, 0))
        })) : undefined,
        pruef: typeof f.pruef === 'string' ? f.pruef.slice(0, 20) : undefined
      };
    } else delete q.fest;
    return q;
  });
  /* Ausbau: Baustellen, Aufwand (Stunden/Material), Termine, Mitarbeiter, Pflegeverträge */
  const ROLLEN = ['facharbeiter', 'helfer'], PSTATUS = ['anfrage', 'geplant', 'laufend', 'fertig', 'abgerechnet'];
  const uhr = (x) => (typeof x === 'string' && /^\d{2}:\d{2}$/.test(x) ? x : '');
  const obj = (liste) => (Array.isArray(liste) ? liste.filter((x) => x && typeof x === 'object') : []);
  const bsp = (q, x) => (x.beispiel === true ? Object.assign(q, { beispiel: true }) : q);
  d.mitarbeiter = obj(d.mitarbeiter).map((m) => bsp({ id: id(m.id), name: text(m.name).slice(0, 60) || 'Mitarbeiter', rolle: ROLLEN.includes(m.rolle) ? m.rolle : 'facharbeiter', aktiv: m.aktiv !== false }, m));
  d.projekte = obj(d.projekte).map((p) => bsp({ id: id(p.id), nr: text(p.nr).slice(0, 20), titel: text(p.titel).slice(0, 120) || 'Baustelle',
    kundeId: id(p.kundeId, true), adresse: text(p.adresse).slice(0, 200), status: PSTATUS.includes(p.status) ? p.status : 'anfrage',
    notiz: text(p.notiz).slice(0, 4000), erstellt: typeof p.erstellt === 'string' ? p.erstellt.slice(0, 30) : new Date().toISOString() }, p));
  d.aufwand = obj(d.aufwand).map((a) => bsp({ id: id(a.id), projektId: id(a.projektId, true), typ: a.typ === 'material' ? 'material' : 'zeit',
    datum: datum(a.datum) || SuS.heute(), mitarbeiterId: id(a.mitarbeiterId, true), stunden: Math.max(0, Math.min(24, zahl(a.stunden, 0))),
    taetigkeit: text(a.taetigkeit).slice(0, 200), leistungId: id(a.leistungId, true), text: text(a.text).slice(0, 200),
    menge: zahl(a.menge, 0), einheit: text(a.einheit).slice(0, 12), preis: Math.round(zahl(a.preis, 0)), dokId: id(a.dokId, true), posId: id(a.posId, true) }, a));
  d.termine = obj(d.termine).map((t) => bsp({ id: id(t.id), projektId: id(t.projektId, true), datum: datum(t.datum) || SuS.heute(),
    von: uhr(t.von), bis: uhr(t.bis), text: text(t.text).slice(0, 200), mitarbeiter: Array.isArray(t.mitarbeiter) ? t.mitarbeiter.map((m) => id(m)) : [], vertragId: id(t.vertragId, true) }, t));
  d.vertraege = obj(d.vertraege).map((v) => ({ id: id(v.id), kundeId: id(v.kundeId, true), projektId: id(v.projektId, true),
    titel: text(v.titel).slice(0, 120) || 'Pflegevertrag', intervall: [1, 3, 6, 12].includes(Number(v.intervall)) ? Number(v.intervall) : 1,
    naechstes: datum(v.naechstes) || SuS.heute(), aktiv: v.aktiv !== false, positionen: obj(v.positionen).map(position),
    aufgaben: obj(v.aufgaben).slice(0, 20).map((a) => ({ text: text(a.text).slice(0, 80), monate: Array.isArray(a.monate) ? [...new Set(a.monate.map(Number).filter((m) => Number.isInteger(m) && m >= 1 && m <= 12))].sort((x, y) => x - y) : [] }))
      .filter((a) => a.text && a.monate.length) }));
  d.bausteine = obj(d.bausteine).slice(0, 200).map((b) => ({ id: id(b.id), feld: b.feld === 'schluss' ? 'schluss' : 'einleitung', name: text(b.name).slice(0, 60) || 'Baustein', text: text(b.text).slice(0, 4000) }));
  d.ausgaben = obj(d.ausgaben).slice(0, 20000).map((a) => bsp({ id: id(a.id), datum: datum(a.datum) || SuS.heute(), lieferant: text(a.lieferant).slice(0, 120),
    nummer: text(a.nummer).slice(0, 60), text: text(a.text).slice(0, 200), brutto: Math.max(-100000000, Math.min(100000000, Math.round(zahl(a.brutto, 0)))),
    satz: [19, 7, 0].includes(Number(a.satz)) ? Number(a.satz) : 19, art: Object.prototype.hasOwnProperty.call(SuS.AUSGABE_ARTEN, a.art) ? a.art : 'material',
    projektId: id(a.projektId, true), bezahlt: a.bezahlt !== false,
    vorsteuer: a.vorsteuer == null || a.vorsteuer === '' || !Number.isFinite(Number(a.vorsteuer)) ? null : Math.max(-100000000, Math.min(100000000, Math.round(Number(a.vorsteuer)))), gemischt: a.gemischt === true,
    belegart: Object.prototype.hasOwnProperty.call(SuS.BELEGARTEN, a.belegart) ? a.belegart : '' }, a));
  d.ablage = obj(d.ablage).slice(0, 20000).map((u) => ({ id: id(u.id), titel: text(u.titel).trim().slice(0, 120) || 'Dokument',
    art: Object.prototype.hasOwnProperty.call(SuS.ABLAGE_ARTEN, u.art) ? u.art : 'sonstiges', datum: datum(u.datum) || SuS.heute(), notiz: text(u.notiz).slice(0, 1000),
    projektId: id(u.projektId, true), kundeId: id(u.kundeId, true), suchtext: text(u.suchtext).slice(0, 1500) }));
  d.vorlagen = obj(d.vorlagen).slice(0, 100).map((v) => ({ id: id(v.id), name: text(v.name).slice(0, 80) || 'Vorlage', positionen: obj(v.positionen).slice(0, 300).map(position) }));
  const f = d.firma;
  Object.keys(f).forEach((k) => { if (typeof f[k] !== 'boolean' && typeof f[k] !== 'number') f[k] = text(f[k]); });
  f.mahngebuehr = Math.max(0, Math.round(zahl(f.mahngebuehr, 0)));
  f.skontoProzent = Math.min(10, Math.max(0, zahl(f.skontoProzent, 0))); f.skontoTage = Math.min(90, Math.max(1, Math.round(zahl(f.skontoTage, 10))));
  f.mwst = zahl(f.mwst, 19); f.zahlungsziel = zahl(f.zahlungsziel, 14); f.gueltigTage = zahl(f.gueltigTage, 30); f.startRechnung = zahl(f.startRechnung, 1);
  f.kleinunternehmer = !!f.kleinunternehmer; f.preiseGeprueft = !!f.preiseGeprueft;
  f.skr = f.skr === '04' ? '04' : '03'; f.beraterNr = text(f.beraterNr).replace(/\D/g, '').slice(0, 7); f.mandantNr = text(f.mandantNr).replace(/\D/g, '').slice(0, 5); f.debitor = text(f.debitor).replace(/\D/g, '').slice(0, 9) || '10000'; f.kreditor = text(f.kreditor).replace(/\D/g, '').slice(0, 9) || '70000'; f.bankKonto = text(f.bankKonto).replace(/\D/g, '').slice(0, 8);
  /* Zähler nie unter die höchste vorhandene Nummer fallen lassen. */
  const z = {};
  Object.keys(d.zaehler).forEach((k) => { if (/^(angebot|rechnung|projekt)-\d{4}$/.test(k)) z[k] = Math.max(0, Math.round(zahl(d.zaehler[k], 0))); });
  d.dokumente.forEach((x) => {
    const m = /-(\d{4})-(\d+)$/.exec(x.nummer);
    if (!m) return;
    const k = (x.typ === 'angebot' ? 'angebot' : 'rechnung') + '-' + m[1];
    z[k] = Math.max(z[k] || 0, parseInt(m[2], 10));
  });
  d.projekte.forEach((p) => {
    const m = /-(\d{4})-(\d+)$/.exec(p.nr);
    if (m) z['projekt-' + m[1]] = Math.max(z['projekt-' + m[1]] || 0, parseInt(m[2], 10));
  });
  d.zaehler = z;
  if (d.letzteSicherung != null && (typeof d.letzteSicherung !== 'string' || !Number.isFinite(Date.parse(d.letzteSicherung)))) delete d.letzteSicherung;
  return d;
};

/* Zweite Ablage in IndexedDB („Datenbank des Browsers“): großer Speicher, übersteht ein volles localStorage.
   Beim Start wird die neuere der beiden Fassungen genommen (Zeitstempel gespeichertUm). Im abgeschotteten
   App-Fenster des Orchestrators gibt es keine IndexedDB – dann bleibt es bei localStorage. */
let idbVersprechen = null;
SuS.idbBereit = false;
const idb = () => {
  if (idbVersprechen) return idbVersprechen;
  idbVersprechen = new Promise((ok, fehl) => {
    try {
      if (typeof indexedDB === 'undefined' || !indexedDB) throw new Error('keine IndexedDB');
      const r = indexedDB.open('sus-daten', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('kv');
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fehl(r.error || new Error('IndexedDB'));
    } catch (e) { fehl(e); }
  });
  idbVersprechen.catch(() => { idbVersprechen = null; });
  return idbVersprechen;
};
const idbVorgang = async (modus, fn) => {
  const db = await idb();
  return new Promise((ok, fehl) => {
    const t = db.transaction('kv', modus), r = fn(t.objectStore('kv'));
    let erg; if (r) r.onsuccess = () => { erg = r.result; };
    t.oncomplete = () => ok(erg); t.onerror = () => fehl(t.error); t.onabort = () => fehl(t.error || new Error('abgebrochen'));
  });
};
SuS.idbLesen = (k) => idbVorgang('readonly', (s) => s.get(k));
SuS.idbSetzen = (k, v) => idbVorgang('readwrite', (s) => s.put(v, k));
SuS.idbLoeschen = (k) => idbVorgang('readwrite', (s) => s.delete(k));
const stempel = (roh) => { try { return Number((JSON.parse(roh) || {}).gespeichertUm) || 0; } catch (e) { return -1; } };
/* Beim Start (vor dem ersten Zeichnen): Datenbank öffnen und die neuere Fassung übernehmen. */
/* startStempel = Stand beim Laden aus localStorage (Vergleich damit, nicht mit später Gespeichertem – Funde Codex/Cursor).
   Die Oberfläche wird erst nach diesem Abgleich freigegeben (start.js). */
SuS.speicherAbgleich = async (startStempel) => {
  try {
    await Promise.race([idb(), new Promise((o, f) => setTimeout(() => f(new Error('Zeit')), 2500))]);
    SuS.idbBereit = true;
    const roh = await SuS.idbLesen('daten');
    const hier = startStempel != null ? Number(startStempel) || 0 : Number(SuS.daten && SuS.daten.gespeichertUm) || 0;
    if (typeof roh === 'string' && stempel(roh) > hier) {
      SuS.laden(roh); SuS.ausDatenbank = true;
      try { localStorage.setItem(SCHLUESSEL, roh); } catch (e) { /* localStorage voll – Datenbank bleibt maßgeblich */ }
    } else if (hier || SuS.daten.dokumente.length) await SuS.idbSetzen('daten', JSON.stringify(SuS.daten));
    SuS.vorherVorhanden = !!(await SuS.idbLesen('vorher')) || lokalVorher();
  } catch (e) { SuS.idbBereit = false; SuS.vorherVorhanden = lokalVorher(); }
};
const lokalVorher = () => { try { return !!localStorage.getItem(SCHLUESSEL + '-vorher'); } catch (e) { return false; } };
let warnungVoll = false;
/* Gibt true zurück, wenn localStorage geschrieben ist. Ist localStorage voll, aber die Datenbank da, ist die Ablage
   „ausstehend“: SuS.ablageAusstehend ist dann das Versprechen des Datenbank-Schreibens (true) – Transaktionen und
   Wiederherstellen warten darauf bzw. nehmen die Änderung zurück, wenn es scheitert (Funde Codex/Cursor). */
SuS.ablageAusstehend = null;
/* Datenbank-Schreibvorgänge laufen strikt nacheinander (keine Überholung). Jede Speicherung hat eine Generation;
   „bestätigt“ ist der zuletzt sicher abgelegte Stand. Scheitert die NEUESTE Ablage (localStorage voll und Datenbank
   scheitert), kehrt die App zu diesem Stand zurück – für jede Speicherung, nicht nur Transaktionen (Funde Codex/Cursor).
   Scheitert eine ältere, während eine neuere noch läuft, legt die neuere den vollständigen Stand ohnehin ab. */
let idbKette = Promise.resolve(), generation = 0, bestaetigtGen = 0, ausstehend = 0;
/* Solange eine Ablage nur in der Datenbank aussteht (Gerätespeicher voll), ist die Bedienung gesperrt: keine Aktion kann
   auf einem noch ungesicherten Stand weiterarbeiten (Funde Codex/Cursor R7–R9). Gilt für jede Speicherung. */
let gesperrt = [], fokusVorher = null;
const sperre = (an) => {
  if (typeof document === 'undefined' || !document.body) return;
  let el = document.getElementById('sichern-sperre');
  if (an && !el) {
    /* Alles andere inert: weder Klick noch Tastatur noch Fokus (Funde Codex/Cursor R10) */
    fokusVorher = document.activeElement;
    gesperrt = Array.from(document.body.children).filter((k) => !k.inert);
    gesperrt.forEach((k) => { k.inert = true; });
    el = document.createElement('div'); el.id = 'sichern-sperre'; el.setAttribute('role', 'status'); el.tabIndex = -1;
    el.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(255,255,255,.55);display:flex;align-items:center;justify-content:center;font:600 16px system-ui;color:#333';
    el.textContent = 'Wird gesichert …';
    document.body.appendChild(el);
    try { el.focus(); } catch (e) { /* egal */ }
  } else if (!an && el) {
    el.remove();
    gesperrt.forEach((k) => { k.inert = false; }); gesperrt = [];
    if (fokusVorher && fokusVorher.isConnected) { try { fokusVorher.focus(); } catch (e) { /* egal */ } }
    fokusVorher = null;
    if (SuS.routeWartet) { SuS.routeWartet = false; if (SuS.neuZeichnen) SuS.neuZeichnen(); }  // aufgeschobene Navigation
  }
};
SuS.gesperrt = () => ausstehend > 0;
SuS.bestaetigt = null;
const alsBestaetigt = (gen, json) => { if (gen >= bestaetigtGen) { bestaetigtGen = gen; SuS.bestaetigt = json; } };
SuS.speichern = () => {
  SuS.daten.gespeichertUm = Date.now();
  const json = JSON.stringify(SuS.daten), gen = ++generation;
  let lokal = true;
  try { localStorage.setItem(SCHLUESSEL, json); } catch (e) { lokal = false; }
  if (lokal) alsBestaetigt(gen, json);
  SuS.ablageAusstehend = null;
  if (SuS.idbBereit) {
    const p = idbKette = idbKette.catch(() => {}).then(() => SuS.idbSetzen('daten', json)).then(() => { alsBestaetigt(gen, json); return true; });
    if (lokal) { p.catch(() => {}); return true; }
    SuS.ablageAusstehend = p;
    ausstehend++; sperre(true);
    p.then(() => {}, () => {}).then(() => { ausstehend--; if (!ausstehend) sperre(false); });
    p.catch(() => {
      if (gen !== generation) return;  // eine neuere Ablage folgt
      if (SuS.bestaetigt) { try { SuS.daten = JSON.parse(SuS.bestaetigt); } catch (e) { /* bleibt */ } }
      SuS.melde && SuS.melde('NICHT gespeichert: Gerätespeicher und Datenbank sind voll – die letzten Änderungen wurden zurückgenommen. Bitte sofort „Datensicherung → Als Text“ und Platz schaffen.', true);
      SuS.neuZeichnen && SuS.neuZeichnen();
    });
    if (!warnungVoll) { warnungVoll = true; SuS.melde && SuS.melde('Der kleine Gerätespeicher ist voll – die Daten liegen jetzt in der Datenbank des Browsers. Bitte bald verschlüsselt sichern.', true); }
    return true;
  }
  if (!lokal) SuS.melde && SuS.melde('Speichern fehlgeschlagen – Speicher voll? Bitte Datensicherung erstellen.', true);
  return lokal;
};
/* Transaktion, die erst als gelungen gilt, wenn auch eine nur in der Datenbank ausstehende Ablage bestätigt ist
   (Funde Codex/Cursor R8). Für alles, was Nummern vergibt, druckt oder „erledigt“ meldet. */
SuS.transaktionSicher = async (fn) => {
  if (!SuS.transaktion(fn)) return false;
  const p = SuS.ablageAusstehend;
  if (!p) return true;
  try { return await p; } catch (e) { return false; }
};
/* Speichern und auf die tatsächliche Ablage warten (für Wiederherstellen u. Ä.) */
SuS.speichernAbwarten = async () => {
  if (!SuS.speichern()) return false;
  if (!SuS.ablageAusstehend) return true;
  try { return await SuS.ablageAusstehend; } catch (e) { return false; }
};
/* Stand vor dem Wiederherstellen merken / zurückholen (Datenbank, sonst localStorage) */
/* In beide Ablagen; was in localStorage nicht passt, wird dort entfernt (sonst bliebe ein älterer Stand liegen). */
/* Ein älterer Stand darf nie liegen bleiben, wo der neue nicht hinpasste (Fund Codex); beim Holen gewinnt der neueste. */
SuS.vorherMerken = async (json) => {
  const marke = JSON.stringify(Object.assign(JSON.parse(json), { vorherUm: Date.now() }));
  let lokal = true, db = false;
  try { localStorage.setItem(SCHLUESSEL + '-vorher', marke); } catch (e) { lokal = false; }
  if (SuS.idbBereit) { try { await SuS.idbSetzen('vorher', marke); db = true; } catch (e) { db = false; } }
  /* Scheitern beide, bleibt der bisherige Vorher-Stand unangetastet (Fund Cursor); sonst wird nur ein dadurch
     veralteter Stand in der anderen Ablage entfernt. */
  if (!lokal && !db) throw new Error('Kein Platz für den vorherigen Stand.');
  if (!lokal) { try { localStorage.removeItem(SCHLUESSEL + '-vorher'); } catch (x) { /* egal */ } }
  if (SuS.idbBereit && !db) { try { await SuS.idbLoeschen('vorher'); } catch (x) { /* egal */ } }
  SuS.vorherVorhanden = true;
};
SuS.vorherHolen = async () => {
  const um = (roh) => { try { return Number((JSON.parse(roh) || {}).vorherUm) || 0; } catch (e) { return -1; } };
  let db = null, lokal = null;
  if (SuS.idbBereit) { try { db = await SuS.idbLesen('vorher'); } catch (e) { db = null; } }
  try { lokal = localStorage.getItem(SCHLUESSEL + '-vorher'); } catch (e) { lokal = null; }
  const kandidaten = [db, lokal].filter((x) => typeof x === 'string' && um(x) >= 0).sort((a, b) => um(b) - um(a));
  return kandidaten[0] || null;
};

/* Mehrere Änderungen ganz oder gar nicht: schlägt das Speichern fehl, wird der vorherige Stand zurückgeholt
   (Fund von Codex: sonst gälte eine Rechnung als gestellt, deren Nummer nach dem Neuladen erneut vergeben würde). */
SuS.transaktion = (fn) => {
  const vorher = JSON.stringify(SuS.daten);
  try { fn(); } catch (e) { SuS.daten = JSON.parse(vorher); throw e; }
  if (SuS.speichern()) return true;  // scheitert eine nur in der Datenbank ausstehende Ablage, nimmt speichern() selbst zurück
  SuS.daten = JSON.parse(vorher);
  return false;
};

/* Beim Ersetzen des Datenbestands (Wiederherstellen, Zurückholen) nie einen Zähler zurückdrehen. */
SuS.zaehlerVereinen = (ziel, quelle) => {
  ziel.zaehler = ziel.zaehler && typeof ziel.zaehler === 'object' ? ziel.zaehler : {};
  Object.keys((quelle && quelle.zaehler) || {}).forEach((k) => { ziel.zaehler[k] = Math.max(Number(ziel.zaehler[k]) || 0, Number(quelle.zaehler[k]) || 0); });
  return ziel;
};

/* ---------- Nachschlagen ---------- */

SuS.kunde = (id) => SuS.daten.kunden.find((k) => k.id === id) || null;
SuS.dok = (id) => SuS.daten.dokumente.find((d) => d.id === id) || null;
SuS.leistung = (id) => SuS.daten.leistungen.find((l) => l.id === id) || null;

/* Arten von Ausgaben (Eingangsbelege) */
SuS.AUSGABE_ARTEN = { material: 'Material', maschinen: 'Maschinen/Miete', fahrzeug: 'Fahrzeug/Sprit', entsorgung: 'Entsorgung/Kippe',
  fremd: 'Fremdleistung', werkzeug: 'Werkzeug/Kleingerät', buero: 'Büro/Telefon/Versicherung', sonstiges: 'Sonstiges' };
/* Belegart einer Ausgabe ('' = nicht angegeben, ältere Einträge) und Bereiche der Dokumenten-Ablage (Auftrag Simon 31.10.2026) */
SuS.BELEGARTEN = { kassenbon: 'Kassenbon', eingangsrechnung: 'Eingangsrechnung', gutschrift: 'Gutschrift', lieferschein: 'Lieferschein', sonstiges: 'Sonstiges' };
SuS.ABLAGE_ARTEN = { vertrag: 'Vertrag', versicherung: 'Versicherung', lieferschein: 'Lieferschein', fahrzeug: 'Fahrzeug', sonstiges: 'Sonstiges' };

SuS.ARTEN = {
  lohn: { name: 'Arbeit', lohn: 100 },
  maschine: { name: 'Maschine/Fahrt', lohn: 100 },
  material: { name: 'Material', lohn: 0 },
  entsorgung: { name: 'Entsorgung', lohn: 0 },
  gemischt: { name: 'Arbeit + Material', lohn: null }
};

SuS.TYPEN = {
  angebot: { name: 'Angebot', mehrzahl: 'Angebote' },
  rechnung: { name: 'Rechnung', mehrzahl: 'Rechnungen' },
  abschlag: { name: 'Abschlagsrechnung', mehrzahl: 'Abschlagsrechnungen' },
  schluss: { name: 'Schlussrechnung', mehrzahl: 'Schlussrechnungen' },
  storno: { name: 'Stornorechnung', mehrzahl: 'Stornorechnungen' }
};

SuS.istRechnung = (dok) => dok.typ !== 'angebot';

/* ---------- Rechnen ---------- */

SuS.lohnQuote = (p) => {
  const art = SuS.ARTEN[p.art] || SuS.ARTEN.lohn;
  if (art.lohn != null) return art.lohn;
  const q = Number(p.lohnanteil);
  return Number.isFinite(q) ? Math.min(100, Math.max(0, q)) : 50;
};

SuS.posBetrag = (p) => SuS.runde((Number(p.menge) || 0) * (Number(p.preis) || 0));

/* Steuer eines Dokuments: festgeschrieben = eingefroren, sonst aus den Firmeneinstellungen. */
SuS.steuer = (dok) => {
  if (dok.fest && dok.fest.steuer) return dok.fest.steuer;
  if (dok.steuerVorgabe) return dok.steuerVorgabe;
  const f = SuS.daten.firma;
  if (f.kleinunternehmer) return { modus: 'klein', satz: 0 };
  if (dok.r13b) return { modus: '13b', satz: 0 };
  return { modus: 'regel', satz: Number(f.mwst) || 0 };
};

SuS.summen = (dok) => {
  let netto = 0, lohn = 0, material = 0;
  for (const p of dok.positionen || []) {
    if (p.typ !== 'pos' || p.bedarf) continue;
    const gp = SuS.posBetrag(p);
    const l = SuS.runde(gp * SuS.lohnQuote(p) / 100);
    netto += gp; lohn += l; material += gp - l;
  }
  const rp = Math.min(100, Math.max(0, Number(dok.rabatt) || 0));
  const rabatt = SuS.runde(netto * rp / 100);
  const nettoNachRabatt = netto - rabatt;
  if (rabatt) { lohn = SuS.runde(lohn * (100 - rp) / 100); material = nettoNachRabatt - lohn; }
  const st = SuS.steuer(dok);
  let mwst = SuS.runde(nettoNachRabatt * st.satz / 100);
  /* Abschlagskorrektur: Brutto ist genau der erhaltene Betrag, die Steuer der Rest (Rundung höchstens 1 Cent). */
  if (dok.bruttoVorgabe && st.modus === 'regel' && Math.abs(dok.bruttoVorgabe - nettoNachRabatt - mwst) <= 1) mwst = dok.bruttoVorgabe - nettoNachRabatt;
  const brutto = nettoNachRabatt + mwst;
  /* Schlussrechnung: bereits gestellte Abschläge abziehen. */
  const abzuege = [];
  /* Storno einer Schlussrechnung: dieselben Abzüge mit umgekehrtem Vorzeichen. */
  if (dok.fest && Array.isArray(dok.fest.abzuege)) abzuege.push(...dok.fest.abzuege);
  else if (dok.typ === 'schluss' || dok.typ === 'storno') {
    const vz = dok.typ === 'storno' ? -1 : 1;
    for (const aid of dok.abschlaege || []) {
      const a = SuS.dok(aid);
      if (!a || !a.fest || (a.status === 'storniert' && dok.typ === 'schluss')) continue;
      const s = SuS.summen(a);
      abzuege.push({ id: a.id, nummer: a.nummer, datum: a.datum, netto: vz * s.netto, mwst: vz * s.mwst, brutto: vz * s.brutto });
    }
  }
  const abzug = abzuege.reduce((x, a) => x + a.brutto, 0);
  return {
    zwischen: netto, rabattProzent: rp, rabatt, netto: nettoNachRabatt, satz: st.satz, modus: st.modus, mwst, brutto,
    lohnNetto: lohn, lohnBrutto: SuS.runde(lohn * (100 + st.satz) / 100), material,
    abzuege, zahlbetrag: brutto - abzug
  };
};

/* Positionsnummern: Zwischenüberschriften zählen als Titel 1, 2 …; Positionen darunter 1.1, 1.2 … */
SuS.nummeriere = (positionen) => {
  let titel = 0, pos = 0;
  const hatTitel = positionen.some((p) => p.typ === 'titel');
  return positionen.map((p) => {
    if (p.typ === 'titel') { titel++; pos = 0; return String(titel); }
    if (p.typ !== 'pos') return '';
    pos++;
    return hatTitel ? (Math.max(titel, 1)) + '.' + pos : String(pos);
  });
};

/* ---------- Nummernkreise ---------- */

SuS.naechsteNummer = (art) => {
  const f = SuS.daten.firma;
  if (art === 'projekt') {
    const jahr = new Date().getFullYear(), key = 'projekt-' + jahr, n = (SuS.daten.zaehler[key] || 0) + 1;
    SuS.daten.zaehler[key] = n;
    return 'BV-' + jahr + '-' + String(n).padStart(3, '0');
  }
  const jahr = new Date().getFullYear();
  const key = art + '-' + jahr;
  const start = art === 'rechnung' ? Math.max(1, parseInt(f.startRechnung, 10) || 1) : 1;
  const n = Math.max((SuS.daten.zaehler[key] || 0) + 1, start);
  SuS.daten.zaehler[key] = n;
  const praefix = art === 'rechnung' ? (f.praefixRechnung || 'RE') : (f.praefixAngebot || 'AN');
  return praefix + '-' + jahr + '-' + String(n).padStart(3, '0');
};

/* ---------- Status ---------- */

SuS.faellig = (dok) => SuS.plusTage(dok.datum, dok.zahlungsziel != null ? dok.zahlungsziel : SuS.daten.firma.zahlungsziel);

SuS.status = (dok) => {
  if (dok.typ === 'angebot') {
    if (dok.status === 'angenommen') return { text: 'Angenommen', klasse: 'gut' };
    if (dok.status === 'abgelehnt') return { text: 'Abgelehnt', klasse: 'aus' };
    const bis = SuS.plusTage(dok.datum, dok.gueltigTage || SuS.daten.firma.gueltigTage);
    if (dok.status === 'versendet') {
      return bis < SuS.heute() ? { text: 'Abgelaufen', klasse: 'warn' } : { text: 'Versendet', klasse: 'offen' };
    }
    return { text: 'Entwurf', klasse: 'entwurf' };
  }
  if (!dok.fest) return { text: 'Entwurf', klasse: 'entwurf' };
  if (dok.status === 'storniert') return { text: 'Storniert', klasse: 'aus' };
  if (dok.typ === 'storno') return { text: 'Storno', klasse: 'aus' };
  if (dok.status === 'bezahlt') return { text: 'Bezahlt', klasse: 'gut' };
  const stufe = (dok.mahnungen || []).length;
  if (SuS.faellig(dok) < SuS.heute()) return { text: stufe ? (stufe === 1 ? 'Erinnert' : (stufe - 1) + '. Mahnung') : 'Überfällig', klasse: 'warn' };
  if (SuS.bezahltSumme(dok) > 0) return { text: 'Teilbezahlt', klasse: 'offen' };
  return { text: 'Offen', klasse: 'offen' };
};

/* Pflichtangaben vor dem Stellen einer Rechnung prüfen (§ 14 Abs. 4 UStG, vereinfachte Liste). */
SuS.pruefeRechnung = (dok) => {
  const f = SuS.daten.firma, k = SuS.kunde(dok.kundeId), fehlt = [];
  if (!f.name || !f.strasse || !f.plz || !f.ort) fehlt.push('Ihr Firmenname und Ihre vollständige Anschrift (Mehr → Firmendaten)');
  if (!f.steuernummer && !f.ustid) fehlt.push('Steuernummer oder USt-IdNr. (Mehr → Firmendaten)');
  if (!k) fehlt.push('Kunde');
  else if (!k.name || !k.strasse || !k.plz || !k.ort) fehlt.push('Vollständige Anschrift des Kunden');
  if (!(dok.positionen || []).some((p) => p.typ === 'pos' && !p.bedarf && SuS.posBetrag(p) !== 0)) fehlt.push('Mindestens eine Position mit Betrag');
  if (!dok.leistungVon) fehlt.push('Leistungsdatum bzw. Leistungszeitraum');
  if (dok.r13b && (!k || k.art !== 'firma')) fehlt.push('§ 13b nur bei Firmenkunden');
  if (dok.typ === 'schluss' && dok.vonId) {
    SuS.offeneAbschlaege(dok.vonId).forEach((a) => fehlt.push('Abschlag ' + a.nummer + ' ist noch nicht bezahlt: Zahlungseingang eintragen (dann wird er abgezogen) oder den Abschlag stornieren (dann wird der volle Betrag berechnet). Nur teilweise bezahlt: Abschlag stornieren und einen neuen Abschlag über den erhaltenen Betrag stellen und als bezahlt markieren. Die Schlussrechnung muss bei Arbeiten am Grundstück spätestens 6 Monate nach Fertigstellung gestellt sein.'));
  }
  if (!f.iban) fehlt.push('Bankverbindung (IBAN) – sonst weiß der Kunde nicht, wohin er zahlt');
  return fehlt;
};

/* Schlussrechnungs-Entwurf: Abzüge immer aus den aktuell gestellten, nicht stornierten Abschlägen (Fund von Codex). */
SuS.aktualisiereAbzuege = (dok) => {
  if (dok.typ !== 'schluss' || dok.fest || !dok.vonId) return;
  /* Abgezogen werden nur vereinnahmte (bezahlte) Abschläge – § 14 Abs. 5 Satz 2 UStG (Fund Codex bei der Rezept-Prüfung). */
  dok.abschlaege = SuS.daten.dokumente.filter((d) => d.typ === 'abschlag' && d.vonId === dok.vonId && d.fest && d.status === 'bezahlt').map((d) => d.id);
};

/* Prüfsumme über alles, was auf einer festgeschriebenen Rechnung steht – erkennt nachträgliche Änderungen (z. B. über eine
   bearbeitete Sicherungsdatei). Kein Schutz gegen Absicht, aber ein sichtbarer Hinweis. */
SuS.FIRMENFELDER = ['name', 'zusatz', 'inhaber', 'strasse', 'plz', 'ort', 'telefon', 'email', 'web', 'steuernummer', 'ustid', 'bank', 'iban', 'bic'];
/* Version 2 (Prüfrunde 2): zusätzlich eingefrorene Firmendaten (IBAN!), Texte, Zahlungsziel, Betreff, Baustelle, Abzugsdaten. */
SuS.pruefsumme = (dok) => '2.' + SuS.pruefsummeRoh(dok, 2);
SuS.pruefsummeRoh = (dok, version) => {
  const f = dok.fest || {};
  const t = (x) => (x == null ? '' : String(x)), z = (x) => Number(x) || 0;  // gleiche Form wie nach dem Bereinigen
  const inhalt = JSON.stringify([t(dok.typ), t(dok.nummer), t(dok.datum), t(dok.leistungVon), t(dok.leistungBis), z(dok.rabatt), !!dok.r13b,
    (dok.positionen || []).map((p) => [t(p.typ), t(p.text), t(p.beschreibung), z(p.menge), t(p.einheit), z(p.preis), t(p.art), p.lohnanteil == null ? null : z(p.lohnanteil), !!p.bedarf]),
    f.kunde ? [t(f.kunde.name), t(f.kunde.strasse), t(f.kunde.plz), t(f.kunde.ort)] : null,
    f.steuer ? [t(f.steuer.modus), z(f.steuer.satz)] : null,
    (f.abzuege || []).map((a) => [t(a.nummer), z(a.netto), z(a.mwst), z(a.brutto)].concat(version >= 2 ? [t(a.datum)] : []))]
    .concat(version >= 2 ? [SuS.FIRMENFELDER.map((k) => t((f.firma || {})[k])), t(dok.einleitung), t(dok.schluss), z(dok.zahlungsziel), t(dok.betreff), t(dok.baustelle)] : [])
    .concat(dok.bruttoVorgabe ? [z(dok.bruttoVorgabe)] : [])
    .concat(dok.skonto ? [['skonto', z(dok.skonto.prozent), z(dok.skonto.tage)]] : []));
  let h = 0x811c9dc5;
  for (let i = 0; i < inhalt.length; i++) { h ^= inhalt.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(36);
};
SuS.veraendert = (dok) => {
  const p = dok.fest && dok.fest.pruef;
  if (!p) return false;
  return p.indexOf('2.') === 0 ? p !== SuS.pruefsumme(dok) : p !== SuS.pruefsummeRoh(dok, 1);  // ältere Belege: Version 1
};

/* Rechnung festschreiben: Nummer vergeben, Firma/Kunde/Steuer einfrieren. Danach nicht mehr änderbar (nur Storno). */
SuS.festschreiben = (dok) => {
  if (dok.fest) return;
  SuS.aktualisiereAbzuege(dok);
  const abzuege = SuS.summen(dok).abzuege;
  dok.nummer = SuS.naechsteNummer('rechnung');
  const orig = dok.typ === 'storno' ? SuS.dok(dok.vonId) : null;
  /* Storno geht an denselben Empfänger wie die Originalrechnung (Fund von Codex). */
  const k = orig && orig.fest && orig.fest.kunde ? orig.fest.kunde : SuS.kunde(dok.kundeId);
  dok.fest = {
    am: new Date().toISOString(),
    firma: JSON.parse(JSON.stringify(SuS.daten.firma)),
    kunde: k ? JSON.parse(JSON.stringify(k)) : null,
    steuer: SuS.steuer(dok),
    abzuege
  };
  dok.fest.pruef = SuS.pruefsumme(dok);
  dok.status = 'offen';
};

/* Festgeschriebene Rechnungen zeigen die eingefrorenen Daten; Angebote die aktuellen Firmen- und Kundendaten. */
SuS.firmaVon = (dok) => (dok.fest && dok.fest.firma) || SuS.daten.firma;
SuS.kundeVon = (dok) => (dok.fest && dok.fest.kunde) || SuS.kunde(dok.kundeId);

SuS.neuesDokument = (typ, kundeId) => {
  const f = SuS.daten.firma;
  const dok = {
    id: SuS.id(), typ, nummer: typ === 'angebot' ? SuS.naechsteNummer('angebot') : '',
    datum: SuS.heute(), kundeId: kundeId || '', baustelle: '', betreff: '',
    einleitung: '', schluss: '', positionen: [], rabatt: 0, status: 'entwurf',
    zahlungsziel: Number(f.zahlungsziel) || 14, gueltigTage: Number(f.gueltigTage) || 30,
    leistungVon: '', leistungBis: '', vonId: '', abschlaege: [], erstellt: new Date().toISOString()
  };
  if ((typ === 'rechnung' || typ === 'schluss') && f.skontoProzent > 0) dok.skonto = { prozent: f.skontoProzent, tage: f.skontoTage };
  SuS.daten.dokumente.unshift(dok);
  return dok;
};

/* ---------- Belegkette ---------- */

/* Folgebelege eines Angebots (ohne Stornos). */
SuS.folge = (angebot) => SuS.daten.dokumente.filter((d) => d.vonId === angebot.id && d.typ !== 'storno');
/* Angebot sperren, sobald ein gestellter, nicht stornierter Folgebeleg existiert (Fund von Cursor). */
SuS.angebotGesperrt = (angebot) => SuS.folge(angebot).some((d) => d.fest && d.status !== 'storniert');
/* Vorhandene (Schluss-)Rechnung zum Angebot – Entwurf oder gestellt, nicht storniert. */
SuS.rechnungZu = (angebot) => SuS.folge(angebot).find((d) => (d.typ === 'rechnung' || d.typ === 'schluss') && d.status !== 'storniert') || null;
/* Summe der gestellten, nicht stornierten Abschläge (netto) und offene Abschlagsentwürfe. */
SuS.abschlagStand = (angebot) => {
  const ab = SuS.folge(angebot).filter((d) => d.typ === 'abschlag' && d.status !== 'storniert');
  return { netto: ab.filter((d) => d.fest).reduce((x, d) => x + SuS.summen(d).netto, 0), entwuerfe: ab.filter((d) => !d.fest) };
};
/* Wird dieser Abschlag von einer gestellten, nicht stornierten Schlussrechnung abgezogen? */
/* Gestellte, noch nicht bezahlte Abschläge eines Auftrags: blockieren die Schlussrechnung, bis bezahlt oder storniert. */
SuS.offeneAbschlaege = (angebotId) => SuS.daten.dokumente.filter((d) => d.typ === 'abschlag' && d.vonId === angebotId && d.fest
  && d.status !== 'storniert' && d.status !== 'bezahlt');
SuS.schlussMitAbschlag = (abschlag) => SuS.daten.dokumente.find((d) => d.typ === 'schluss' && d.fest && d.status !== 'storniert' && (d.abschlaege || []).includes(abschlag.id)) || null;

/* Kopie der Positionen mit neuen IDs. */
SuS.kopierePositionen = (liste) => (liste || []).map((p) => Object.assign({}, p, { id: SuS.id() }));

/* Angebot → Rechnung (oder Schlussrechnung, wenn schon Abschläge gestellt wurden). */
SuS.rechnungAus = (angebot) => {
  const abschlaege = SuS.daten.dokumente.filter((d) => d.typ === 'abschlag' && d.vonId === angebot.id && d.fest && d.status !== 'storniert');
  const typ = abschlaege.length ? 'schluss' : 'rechnung';
  const bezahlt = abschlaege.filter((a) => a.status === 'bezahlt');
  const r = SuS.neuesDokument(typ, angebot.kundeId);
  Object.assign(r, {
    baustelle: angebot.baustelle, betreff: angebot.betreff, rabatt: angebot.rabatt, projektId: angebot.projektId || '',
    positionen: SuS.kopierePositionen(angebot.positionen.filter((p) => !p.bedarf)),
    vonId: angebot.id, abschlaege: bezahlt.map((a) => a.id), r13b: !!angebot.r13b
  });
  return r;
};

SuS.abschlagAus = (angebot, prozent, betragCent) => {
  const s = SuS.summen(angebot);
  const netto = betragCent != null ? betragCent : SuS.runde(s.netto * prozent / 100);
  /* Arbeitsanteil ungerundet übernehmen; gerundet wird erst der Centbetrag (Fund von Codex). */
  const lohnQuote = s.netto ? s.lohnNetto * 100 / s.netto : 0;
  const r = SuS.neuesDokument('abschlag', angebot.kundeId);
  const bisher = SuS.daten.dokumente.filter((d) => d.typ === 'abschlag' && d.vonId === angebot.id && d.id !== r.id).length;
  Object.assign(r, {
    baustelle: angebot.baustelle, betreff: angebot.betreff, vonId: angebot.id, r13b: !!angebot.r13b, projektId: angebot.projektId || '',
    positionen: [{
      id: SuS.id(), typ: 'pos', menge: 1, einheit: 'psch', preis: netto, art: 'gemischt', lohnanteil: lohnQuote,
      text: (bisher + 1) + '. Abschlag' + (prozent ? ' (' + SuS.zahl(prozent, 1) + ' %)' : ''),
      beschreibung: 'gemäß Angebot ' + angebot.nummer + ' vom ' + SuS.datum(angebot.datum) + ', Auftragssumme ' + SuS.euro(s.netto) + ' netto'
    }]
  });
  return r;
};

SuS.stornoAus = (rechnung) => {
  const s = SuS.neuesDokument('storno', rechnung.kundeId);
  Object.assign(s, {
    baustelle: rechnung.baustelle, betreff: 'Storno zu ' + rechnung.nummer, vonId: rechnung.id, rabatt: rechnung.rabatt, projektId: rechnung.projektId || '',
    leistungVon: rechnung.leistungVon, leistungBis: rechnung.leistungBis, r13b: !!rechnung.r13b,
    steuerVorgabe: rechnung.fest ? rechnung.fest.steuer : null,
    bruttoVorgabe: rechnung.bruttoVorgabe ? -rechnung.bruttoVorgabe : undefined,  // Storno hebt korrigierte Abschläge centgenau auf
    abschlaege: rechnung.typ === 'schluss' ? (rechnung.abschlaege || []).slice() : [],
    positionen: SuS.kopierePositionen(rechnung.positionen).map((p) => (p.typ === 'pos' ? Object.assign(p, { menge: -(Number(p.menge) || 0) }) : p)),
    einleitung: 'hiermit stornieren wir die Rechnung ' + rechnung.nummer + ' vom ' + SuS.datum(rechnung.datum) + ' vollständig.',
    schluss: 'Bereits gezahlte Beträge erstatten wir bzw. verrechnen wir mit einer neuen Rechnung.'
  });
  return s;
};
