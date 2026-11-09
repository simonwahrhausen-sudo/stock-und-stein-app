/* Stock und Stein – Sprechen statt tippen (08.11.2026) und Anleitung für Menschen, die noch nie eine App benutzt haben.
   Sprechen: Spracherkennung des Browsers (Safari/Chrome). Die Erkennung selbst macht der Hersteller des Handys
   (Apple/Google) – wie beim Mikrofon auf der Tastatur. Gespeichert wird nur auf diesem Gerät.
   Vorlesen: Sprachausgabe des Handys (auf dem Gerät). */
'use strict';

(function () {
  const A = SuS.aktionen, e = SuS.esc || ((s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  SuS.kannSprechen = !!SR;

  /* ---------- Vorlesen ---------- */
  SuS.vorlesen = (text) => {
    try {
      if (!window.speechSynthesis) return false;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'de-DE'; u.rate = 0.95;
      window.speechSynthesis.speak(u);
      return true;
    } catch (x) { return false; }
  };
  A.vorlesen = (el) => { if (!SuS.vorlesen(el.dataset.text || '')) SuS.melde('Vorlesen geht auf diesem Gerät leider nicht.', true); };

  /* ---------- Was wurde gesagt? ---------- */
  const klein = (s) => String(s || '').toLowerCase().replace(/[.,!?;:]/g, ' ').replace(/\s+/g, ' ').trim();
  SuS.verstehe = (satz) => {
    const t = klein(satz);
    const hat = (...w) => w.some((x) => t.includes(x));
    let was = '';
    if (hat('anruf', 'angerufen', 'rückruf', 'zurückrufen', 'telefoniert')) was = 'anruf';
    else if (hat('rechnung', 'abrechnen', 'geld verlangen')) was = 'rechnung';
    else if (hat('angebot', 'kostenvoranschlag', 'preis')) was = 'angebot';
    else if (hat('foto', 'zettel', 'bon', 'beleg', 'quittung', 'lieferschein', 'tankstelle', 'tanken', 'baumarkt')) was = 'zettel';
    else if (hat('baustelle', 'auftrag')) was = 'baustelle';
    else if (hat('woche', 'termin', 'kalender', 'heute', 'morgen')) was = 'woche';
    else if (hat('sicher', 'backup')) was = 'sichern';
    else if (hat('hilfe', 'anleitung', 'wie geht', 'erklär')) was = 'hilfe';
    else if (hat('bezahlt', 'offen', 'überfällig', 'mahn')) was = 'unbezahlt';
    /* Kunde: bekannter Name, der im Satz vorkommt (längster Treffer gewinnt) */
    let kunde = null;
    for (const k of SuS.daten.kunden || []) {
      const teile = klein(k.name).split(' ').filter((w) => w.length > 2 && !['familie', 'herr', 'frau', 'firma', 'gmbh'].includes(w));
      if (teile.some((w) => t.includes(w)) && (!kunde || k.name.length > kunde.name.length)) kunde = k;
    }
    /* Worum geht es: alles nach „für …“ ohne Befehlswörter und Kundennamen */
    let rest = t.replace(/\b(neues?|neuen|ein|eine|einen|bitte|mach|mache|schreib|schreibe|erstell|erstelle|ich|will|möchte|brauche)\b/g, ' ')
      .replace(/\b(angebot|rechnung|baustelle|kostenvoranschlag)\b/g, ' ');
    if (kunde) klein(kunde.name).split(' ').forEach((w) => { if (w.length > 2) rest = rest.replace(new RegExp('\\b(familie|herr|frau)?\\s*' + w.replace(/[^\wäöüß]/g, '') + '\\b', 'g'), ' '); });
    rest = rest.replace(/\b(für|fuer|bei|von)\b/g, ' ').replace(/\s+/g, ' ').trim();
    /* Anruf: Telefonnummer (Ziffernfolge) und Name nach „von …“ */
    const nummer = (String(satz || '').match(/(\+?\d[\d\s\/-]{4,}\d)/) || [''])[0].replace(/[^\d+]/g, '');
    const nameM = /\b(?:von|vom|hat)\s+(?:herrn?|frau|familie)?\s*([a-zäöüß][a-zäöüß-]+(?:\s+[a-zäöüß][a-zäöüß-]+)?)/i.exec(String(satz || '').replace(/[,.]/g, ' , '));
    let name = kunde ? kunde.name : '';
    if (!name && nameM) name = nameM[1].replace(/\s+(will|möchte|wegen|braucht|hat|und|angerufen)\b.*$/i, '').trim().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
    const anliegenM = /\b(will|möchte|wegen|braucht|fragt)\b(.*)$/i.exec(String(satz || ''));
    const anliegen = anliegenM ? (anliegenM[1] + anliegenM[2]).replace(/[,\s]*(?:unter|nummer|telefon|tel\.?)?\s*\+?\d[\d\s\/-]{4,}\d/gi, '').replace(/[,\s]+$/, '').trim() : '';
    return { was, kunde, nummer, name, anliegen, betreff: rest.length > 2 ? rest.charAt(0).toUpperCase() + rest.slice(1) : '' };
  };

  async function ausfuehren(satz) {
    const v = SuS.verstehe(satz);
    SuS.blattZu();
    if (v.was === 'angebot' || v.was === 'rechnung') {
      let dok = null;
      const ok = await SuS.transaktionSicher(() => {
        dok = SuS.neuesDokument(v.was, v.kunde ? v.kunde.id : '');
        if (v.was !== 'angebot') dok.leistungVon = SuS.heute();
        if (v.betreff) dok.betreff = v.betreff;
      });
      if (!ok) { SuS.melde('Speichern fehlgeschlagen – nichts angelegt.', true); return; }
      location.hash = '#/dok/' + dok.id;
      SuS.melde((v.was === 'angebot' ? 'Angebot' : 'Rechnung') + ' angelegt' + (v.kunde ? ' für ' + v.kunde.name : '') + '.');
      return;
    }
    if (v.was === 'anruf') return A.anrufMerken(null, v);
    if (v.was === 'zettel') return A.belegErfassen();
    if (v.was === 'baustelle') return A.baustelleNeu({ dataset: {} });
    if (v.was === 'woche') { location.hash = '#/woche'; return; }
    if (v.was === 'sichern') { location.hash = '#/sicherung'; return; }
    if (v.was === 'unbezahlt') { location.hash = '#/posten'; return; }
    if (v.was === 'hilfe') return A.anleitung();
    SuS.blatt('Nicht verstanden',
      '<p class="gross-text">Ich habe verstanden: <b>„' + e(satz) + '“</b></p>' +
      '<p class="gross-text">Sagen Sie zum Beispiel:</p>' + BEISPIELE +
      '<button type="button" class="knopf haupt breit gross" data-a="sprechen">🎤 Nochmal sprechen</button>');
  }
  SuS.spracheAusfuehren = ausfuehren;

  const BEISPIELE = '<ul class="sprach-beispiele"><li>„Angebot für Müller, Terrasse pflastern“</li><li>„Rechnung für Schmidt“</li>' +
    '<li>„Anruf von Meier, will einen neuen Zaun“</li>' +
    '<li>„Zettel fotografieren“</li><li>„Neue Baustelle“</li><li>„Was ist noch nicht bezahlt?“</li></ul>';

  /* ---------- Sprechen ---------- */
  let erkenner = null;
  A.sprechen = () => {
    if (!SR) {
      SuS.blatt('Sprechen',
        '<p class="gross-text">Auf diesem Handy geht Sprechen so:</p>' +
        '<ol class="gross-schritte"><li>In ein Feld tippen.</li><li>Unten auf der Tastatur das <b>Mikrofon 🎤</b> drücken.</li><li>Sprechen. Fertig.</li></ol>' +
        '<button type="button" class="knopf breit" data-a="blattZu">Verstanden</button>');
      return;
    }
    SuS.blatt('Sprechen',
      '<div class="mikro an" aria-hidden="true">🎤</div>' +
      '<p class="gross-text" style="text-align:center" data-hoeren>Ich höre zu … Sagen Sie, was Sie möchten.</p>' +
      BEISPIELE);
    try { if (erkenner) erkenner.abort(); } catch (x) { /* egal */ }
    const r = new SR();
    erkenner = r;
    r.lang = 'de-DE'; r.interimResults = true; r.maxAlternatives = 1; r.continuous = false;
    let text = '', fertig = false;
    const zeige = (t) => { const p = document.querySelector('[data-hoeren]'); if (p) p.innerHTML = '„' + e(t) + '“'; };
    r.onresult = (ev) => {
      text = Array.from(ev.results).map((x) => x[0].transcript).join(' ');
      zeige(text);
      if (ev.results[ev.results.length - 1].isFinal && !fertig) { fertig = true; setTimeout(() => ausfuehren(text), 500); }
    };
    r.onerror = (ev) => {
      if (fertig) return; fertig = true;
      const verboten = ev.error === 'not-allowed' || ev.error === 'service-not-allowed';
      SuS.blatt('Sprechen', '<p class="gross-text">' + (verboten
        ? 'Das Handy erlaubt das Mikrofon noch nicht. Bitte beim nächsten Mal auf <b>„Erlauben“</b> drücken.'
        : ev.error === 'no-speech' ? 'Ich habe nichts gehört.' : 'Das hat nicht geklappt (kein Internet?).') + '</p>' +
        '<button type="button" class="knopf haupt breit gross" data-a="sprechen">🎤 Nochmal</button>');
    };
    r.onend = () => { const m = document.querySelector('.mikro'); if (m) m.classList.remove('an'); if (!fertig && text) { fertig = true; ausfuehren(text); } };
    try { r.start(); } catch (x) { SuS.melde('Sprechen geht gerade nicht.', true); }
  };

  /* ---------- Anruf merken (nach dem Telefonat: wer, Nummer, was will er) ---------- */
  A.anrufMerken = (el, v) => {
    v = v || {};
    const k = v.kunde || null;
    SuS.blatt('Anruf merken',
      '<p class="gross-text" style="margin-top:0">Wer hat angerufen und was will er?</p>' +
      SuS.feld('name', 'Name', v.name || (k ? k.name : ''), { auto: !v.name, platz: 'z. B. Familie Meier' }) +
      SuS.feld('telefon', 'Telefonnummer', v.nummer || (k ? k.telefon : ''), { typ: 'tel', platz: 'falls bekannt' }) +
      SuS.feld('anliegen', 'Was will er/sie?', v.anliegen || '', { typ: 'textarea', platz: 'z. B. neuer Zaun, will Angebot, ab 17 Uhr erreichbar' }) +
      '<p class="sprechtipp" style="margin-top:0">🎤 Tipp: Beim Tippen das Mikrofon auf der Tastatur drücken und sprechen.</p>' +
      '<button type="submit" class="knopf haupt breit gross">Merken</button>',
      async (fd) => {
        const name = String(fd.get('name') || '').trim(), tel = String(fd.get('telefon') || '').trim(), was = String(fd.get('anliegen') || '').trim();
        if (!name && !tel) { SuS.melde('Bitte einen Namen oder eine Nummer eintragen.', true); return false; }
        const zeile = 'Anruf ' + SuS.datum(SuS.heute()) + ': ' + (was || 'bitte zurückrufen');
        const vorhanden = k || (SuS.daten.kunden || []).find((x) => name && x.name.toLowerCase() === name.toLowerCase());
        let ziel = null;
        if (!(await SuS.transaktionSicher(() => {
          if (vorhanden) { ziel = SuS.kunde(vorhanden.id); if (tel && !ziel.telefon) ziel.telefon = tel; }
          else { ziel = { id: SuS.id(), nr: SuS.naechsteKundenNr(), art: 'privat', name: name || tel, telefon: tel, notiz: '' }; SuS.daten.kunden.push(ziel); }
          ziel.notiz = (zeile + (ziel.notiz ? '\n' + ziel.notiz : '')).slice(0, 4000);
        }))) { SuS.melde('Speichern fehlgeschlagen.', true); return false; }
        SuS.melde('Gemerkt bei ' + ziel.name + '.');
        location.hash = '#/kunde/' + ziel.id;
        return true;
      });
  };

  /* ---------- Anleitung (erscheint beim allerersten Öffnen von selbst) ---------- */
  const SCHRITTE = [
    ['👋', 'Willkommen!', 'Diese App schreibt Angebote und Rechnungen für Sie. Sie müssen nichts über Computer wissen.'],
    ['👆', 'Einfach antippen', 'Auf der Startseite gibt es vier große Knöpfe. Tippen Sie einfach auf das, was Sie machen wollen.'],
    ['🎤', 'Oder sprechen', 'Drücken Sie auf „Sprechen“ und sagen Sie zum Beispiel: Angebot für Müller.'],
    ['📞', 'Anruf merken', 'Nach einem Telefonat auf „Anruf merken“ drücken. Name und Wunsch eintragen oder sagen. Die App merkt sich alles beim Kunden.'],
    ['📄', 'Angebot schreiben', 'Erst den Kunden wählen. Dann die Arbeit auswählen. Zum Schluss unten auf „Ansehen und senden“.'],
    ['🔒', 'Ihre Daten', 'Alles bleibt auf diesem Handy. Ab und zu unter „Mehr“ auf „Daten sichern“ gehen.'],
    ['✅', 'Fertig!', 'Diese Anleitung finden Sie jederzeit wieder unten auf der Startseite: „So geht’s“.']
  ];
  const MERKER = 'sus-anleitung-gesehen';
  A.anleitung = (el) => {
    const i = Math.max(0, Math.min(SCHRITTE.length - 1, parseInt(el && el.dataset && el.dataset.schritt, 10) || 0));
    const [bild, titel, text] = SCHRITTE[i], letzter = i === SCHRITTE.length - 1;
    SuS.blatt('So geht’s',
      '<div class="anleitung"><div class="anleitung-bild" aria-hidden="true">' + bild + '</div>' +
      '<h3>' + e(titel) + '</h3><p>' + e(text) + '</p>' +
      '<button type="button" class="knopf breit" data-a="vorlesen" data-text="' + e(titel + '. ' + text) + '">🔊 Vorlesen</button>' +
      '<div class="punkte" aria-label="Schritt ' + (i + 1) + ' von ' + SCHRITTE.length + '">' + SCHRITTE.map((_, j) => '<span class="' + (j === i ? 'an' : '') + '"></span>').join('') + '</div>' +
      (letzter ? '<button type="button" class="knopf haupt breit gross" data-a="anleitungFertig">Los geht’s</button>'
        : '<button type="button" class="knopf haupt breit gross" data-a="anleitung" data-schritt="' + (i + 1) + '">Weiter ›</button>') +
      (i > 0 ? '<button type="button" class="knopf breit" style="margin-top:8px" data-a="anleitung" data-schritt="' + (i - 1) + '">‹ Zurück</button>' : '') +
      '</div>');
  };
  A.anleitungFertig = () => { try { localStorage.setItem(MERKER, '1'); } catch (x) { /* egal */ } SuS.blattZu(); };
  SuS.anleitungBeimStart = () => {
    let gesehen = true;
    try { gesehen = localStorage.getItem(MERKER) === '1'; } catch (x) { gesehen = true; }
    if (gesehen || (SuS.daten.dokumente || []).some((d) => !d.beispiel)) return;  // wer schon arbeitet, sieht sie nicht
    try { localStorage.setItem(MERKER, '1'); } catch (x) { /* egal */ }
    setTimeout(() => { if (document.getElementById('blatt').hidden && SuS.letzteSeite === 'start') A.anleitung(); }, 300);
  };
})();
