/* Stock und Stein – Ansichten: Start, Listen, Kunden, Firmendaten, Leistungen, Sicherung. Gemeinsame Bausteine (Blatt, Meldung). */
'use strict';

(function () {
  const e = SuS.esc;
  SuS.aktionen = {};
  const A = SuS.aktionen;
  SuS.ansicht = { filterA: 'alle', filterR: 'alle', suche: '' };

  /* ---------- Bausteine ---------- */

  let meldungUhr = null;
  SuS.melde = (text, fehler) => {
    const m = document.getElementById('meldung');
    m.textContent = text; m.className = fehler ? 'fehler' : ''; m.hidden = false;
    clearTimeout(meldungUhr);
    meldungUhr = setTimeout(() => { m.hidden = true; }, fehler ? 5200 : 2600);
  };

  SuS.zeige = (html, vollbild) => {
    const m = document.getElementById('inhalt');
    m.innerHTML = html;
    document.body.classList.toggle('vollbild', !!vollbild);
    window.scrollTo(0, 0);
  };

  /* Blatt von unten: html mit Formular; beimSichern(formularDaten, form) gibt true zurück, wenn es schließen darf. */
  SuS.blatt = (titel, html, beimSichern, sichernText) => {
    const h = document.getElementById('blatt');
    h.innerHTML = '<form class="blatt" novalidate><div class="griff"></div><div class="blatt-kopf"><button type="button" data-a="blattZu">Abbrechen</button>' +
      '<h2>' + e(titel) + '</h2>' + (beimSichern ? '<button type="submit">' + e(sichernText || 'Fertig') + '</button>' : '<span style="width:70px"></span>') +
      '</div>' + html + '</form>';
    h.hidden = false;
    const form = h.querySelector('form');
    let fertig = false, laeuft = false;  // zweites Absenden (z. B. Kopf- und Hauptknopf kurz nacheinander) ignorieren
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      if (fertig || laeuft) return;
      const erg = beimSichern ? beimSichern(new FormData(form), form) : true;
      if (erg && typeof erg.then === 'function') {  // asynchron (z. B. Verschlüsseln): erst nach dem Ergebnis schließen
        laeuft = true;
        erg.then((ok) => { laeuft = false; if (ok !== false && form.isConnected) { fertig = true; SuS.blattZu(); } }, () => { laeuft = false; });
        return;
      }
      if (erg !== false) { fertig = true; SuS.blattZu(); }
    });
    const erstes = form.querySelector('[autofocus]');
    if (erstes) setTimeout(() => erstes.focus(), 60);
    return form;
  };
  SuS.blattZu = () => { const h = document.getElementById('blatt'); h.hidden = true; h.innerHTML = ''; };
  A.blattZu = () => SuS.blattZu();
  document.addEventListener('keydown', (ev) => {
    if (ev.key === 'Escape' && !document.getElementById('blatt').hidden && !(SuS.gesperrt && SuS.gesperrt())) SuS.blattZu();  // nicht während „Wird gesichert …“ (Codex R11)
  });
  document.getElementById('blatt').addEventListener('click', (ev) => { if (ev.target.id === 'blatt') SuS.blattZu(); });

  /* Zweistufiges Löschen ohne Systemdialog: erster Tipp fragt nach, zweiter führt aus. */
  SuS.sicher = (knopf) => {
    /* Zweiter Tipp zählt erst nach einer kurzen Pause – ein versehentlicher Doppeltipp löst nichts aus (Fund von Cursor). */
    if (knopf.dataset.sicher === '1') return Date.now() - Number(knopf.dataset.seit || 0) > 700;
    knopf.dataset.sicher = '1';
    knopf.dataset.seit = String(Date.now());
    knopf.dataset.alt = knopf.textContent;
    knopf.textContent = 'Wirklich? Nochmal tippen';
    setTimeout(() => { if (knopf.isConnected) { knopf.dataset.sicher = ''; knopf.textContent = knopf.dataset.alt; } }, 3500);
    return false;
  };

  SuS.feld = (name, beschriftung, wert, extra) => {
    const x = extra || {};
    const typ = x.typ || 'text';
    const attr = (x.dezimal ? ' inputmode="decimal"' : '') + (x.platz ? ' placeholder="' + e(x.platz) + '"' : '') + (x.auto ? ' autofocus' : '') +
      (x.autocomplete ? ' autocomplete="' + x.autocomplete + '"' : '') + (x.liste ? ' list="' + x.liste + '"' : '');
    let eingabe;
    if (typ === 'textarea') eingabe = '<textarea name="' + name + '"' + attr + '>' + e(wert) + '</textarea>';
    else if (typ === 'select') eingabe = '<select name="' + name + '">' + x.optionen.map(([w, t]) => '<option value="' + e(w) + '"' + (String(w) === String(wert) ? ' selected' : '') + '>' + e(t) + '</option>').join('') + '</select>';
    else eingabe = '<input type="' + typ + '" name="' + name + '" value="' + e(wert == null ? '' : wert) + '"' + attr + '>';
    return '<label class="feld"' + (x.id ? ' id="' + x.id + '"' : '') + '><span>' + e(beschriftung) + '</span>' + eingabe + (x.hilfe ? '<small>' + x.hilfe + '</small>' : '') + '</label>';
  };

  const ICON_LEER = '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6zM14 3v5h5M9 12h7M9 16h7"/></svg>';

  function dokZeile(d) {
    const k = SuS.kundeVon(d), st = SuS.status(d), s = SuS.summen(d);
    const typ = d.typ === 'angebot' || d.typ === 'rechnung' ? '' : SuS.TYPEN[d.typ].name + ' · ';
    return '<li><a class="zeile" href="#/dok/' + e(d.id) + '"><div class="haupt"><div class="titel">' + e(k ? k.name : 'Ohne Kunde') + '</div>' +
      '<div class="klein">' + e(typ + (d.nummer || 'ohne Nummer') + (d.betreff ? ' · ' + d.betreff : '') + ' · ' + SuS.datum(d.datum)) + '</div></div>' +
      '<div><div class="betrag">' + SuS.euro(s.zahlbetrag) + '</div><div style="text-align:right"><span class="chip ' + st.klasse + '">' + st.text + '</span></div></div></a></li>';
  }

  SuS.dokZeile = dokZeile;
  /* Reiter über den Belegen: Angebote · Rechnungen · Offene Posten */
  SuS.belegReiter = (aktiv) => '<div class="kopf"><h1>Belege</h1>' + (aktiv === 'posten' ? '' : '<button class="knopf haupt klein" data-a="neu" data-typ="' + (aktiv === 'angebote' ? 'angebot' : 'rechnung') + '">+ Neu</button>') + '</div>' +
    '<div class="segment">' + [['angebote', 'Angebote'], ['rechnungen', 'Rechnungen'], ['posten', 'Offene Posten']].map(([k, t]) =>
      '<button type="button" data-a="zurueck" data-ziel="#/' + k + '" class="' + (k === aktiv ? 'an' : '') + '">' + t + '</button>').join('') + '</div>';

  /* ---------- Start ---------- */

  SuS.seiten = {};
  SuS.seiten.start = () => {
    const d = SuS.daten, f = d.firma;
    const angebote = d.dokumente.filter((x) => x.typ === 'angebot');
    const rechnungen = d.dokumente.filter((x) => SuS.istRechnung(x) && x.typ !== 'storno');
    const offenA = angebote.filter((x) => SuS.status(x).klasse === 'offen');
    const offenR = rechnungen.filter((x) => ['offen', 'warn'].includes(SuS.status(x).klasse) && x.fest);
    const ueber = rechnungen.filter((x) => SuS.status(x).text === 'Überfällig');
    const jahr = String(new Date().getFullYear());
    const bezahlt = rechnungen.filter((x) => x.status === 'bezahlt' && (x.bezahltAm || '').slice(0, 4) === jahr);
    const summe = (liste) => liste.reduce((a, x) => a + SuS.summen(x).zahlbetrag, 0);
    const stunde = new Date().getHours();
    const gruss = stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Hallo' : 'Guten Abend';
    const hinweise = [];
    if (SuS.keinSpeicher) hinweise.push('<div class="hinweis fehler"><b>Achtung: Daten werden nicht gespeichert</b>Dieser Browser erlaubt der App keinen Speicher. Bitte die App über den Orchestrator oder als eigene Seite öffnen und vor dem Schließen eine Datensicherung als Text machen.</div>');
    if (!f.strasse || !f.iban || (!f.steuernummer && !f.ustid)) {
      hinweise.push('<div class="hinweis"><b>Firmendaten fehlen noch</b>Anschrift, Steuernummer und Bankverbindung eintragen – sonst stehen rote Platzhalter auf dem Ausdruck. <a href="#/firma">Jetzt eintragen</a></div>');
    }
    /* Erinnerung an die Datensicherung: Daten liegen nur auf diesem Gerät (Fund der unbeteiligten Bewertung). */
    const echte = d.dokumente.filter((x) => !x.beispiel).length;
    const tage = d.letzteSicherung ? Math.floor((Date.now() - Date.parse(d.letzteSicherung)) / 86400000) : null;
    if (echte && (tage == null || tage >= 7)) {
      hinweise.push('<div class="hinweis"><b>' + (tage == null ? 'Noch keine Datensicherung' : 'Letzte Datensicherung vor ' + tage + ' Tagen') + '</b>Ihre Angebote und Rechnungen liegen nur auf diesem Gerät. <a href="#/sicherung">Jetzt sichern</a></div>');
    }
    if (!f.preiseGeprueft) {
      hinweise.push('<div class="hinweis info"><b>Richtwerte statt eigener Preise</b>Der Leistungskatalog enthält Richtwerte für den Raum Hildesheim. Bitte einmal durchgehen und eigene Preise eintragen. <a href="#/leistungen">Preise ansehen</a></div>');
    }
    const heute = SuS.daten.termine.filter((t) => t.datum === SuS.heute()).sort((a, b) => (a.von || '').localeCompare(b.von || ''));
    const nachfassen = SuS.nachfassen();
    if (nachfassen.length) hinweise.push('<div class="hinweis info"><b>' + nachfassen.length + ' Angebot(e) seit über ' + SuS.NACHFASSEN_TAGE + ' Tagen ohne Antwort</b>Nachfassen lohnt sich: ' +
      nachfassen.slice(0, 3).map((x) => '<a href="#/dok/' + e(x.id) + '">' + e((SuS.kundeVon(x) || { name: x.nummer }).name) + '</a>').join(', ') + (nachfassen.length > 3 ? ' …' : '') + '</div>');
    const vertraege = SuS.faelligeVertraege();
    if (vertraege.length) hinweise.push('<div class="hinweis info"><b>' + vertraege.length + ' Pflegerechnung(en) fällig</b><a href="#/vertraege">Entwürfe erstellen</a></div>');
    const zuletzt = d.dokumente.slice().sort((a, b) => (b.geaendert || b.erstellt || '').localeCompare(a.geaendert || a.erstellt || '')).slice(0, 5);
    SuS.zeige(
      '<section class="begruessung"><svg class="deko" viewBox="0 0 64 64"><rect x="4" y="40" width="46" height="16" rx="3" fill="#fff"/><path d="M14 38L52 8M36 21L52 24M26 29L28 15" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>' +
      '<h1>' + gruss + '!</h1><p>' + e(f.name) + ' · Baustellen, Angebote, Rechnungen</p>' +
      '<div class="knopfreihe" style="margin:0"><button class="knopf haupt" data-a="neu" data-typ="angebot">+ Angebot</button>' +
      '<button class="knopf zweit" data-a="baustelleNeu">+ Baustelle</button></div></section>' +
      hinweise.join('') +
      (heute.length ? '<h2>Heute</h2><ul class="liste">' + heute.map(SuS.terminZeile).join('') + '</ul>' : '') +
      '<div class="kacheln">' +
        '<a class="kachel" href="#/angebote" data-filter="versendet"><div class="name">Offene Angebote (' + offenA.length + ')</div><div class="wert">' + SuS.euro(summe(offenA)) + '</div></a>' +
        '<a class="kachel" href="#/posten"><div class="name">Offene Rechnungen (' + offenR.length + ')</div><div class="wert">' + SuS.euro(offenR.reduce((a, x) => a + SuS.offenerBetrag(x), 0)) + '</div></a>' +
        '<a class="kachel' + (ueber.length ? ' warn' : '') + '" href="#/posten"><div class="name">Überfällig (' + ueber.length + ')</div><div class="wert">' + SuS.euro(ueber.reduce((a, x) => a + SuS.offenerBetrag(x), 0)) + '</div></a>' +
        '<div class="kachel"><div class="name">Bezahlt ' + jahr + '</div><div class="wert">' + SuS.euro(summe(bezahlt)) + '</div></div>' +
      '</div>' +
      (zuletzt.length
        ? '<h2>Zuletzt bearbeitet</h2><ul class="liste">' + zuletzt.map(dokZeile).join('') + '</ul>'
        : '<div class="karte leer">' + ICON_LEER + '<p><b>Noch keine Angebote.</b><br>Erstellen Sie Ihr erstes Angebot – oder schauen Sie sich zuerst ein fertiges Beispiel an.</p>' +
          '<button class="knopf zweit" data-a="beispiel">Beispiel ansehen</button></div>')
    );
  };

  A.neu = async (el) => {
    const typ = el.dataset.typ;
    let dok = null;
    const marke = SuS.navMarke();
    if (!(await SuS.transaktionSicher(() => { dok = SuS.neuesDokument(typ, el.dataset.kunde || ''); if (typ !== 'angebot') dok.leistungVon = SuS.heute(); }))) {
      SuS.melde('Speichern fehlgeschlagen – nichts angelegt.', true); SuS.neuZeichnen(); return;  // Fund Cursor R9
    }
    SuS.gehZu('#/dok/' + dok.id, marke);
  };
  A.beispiel = () => { const a = SuS.katalog.beispiel(); location.hash = '#/dok/' + a.id; };

  document.addEventListener('click', (ev) => {
    const k = ev.target.closest('.kachel[data-filter]');
    if (!k) return;
    if (k.dataset.filter === 'versendet') SuS.ansicht.filterA = 'versendet';
    else SuS.ansicht.filterR = k.dataset.filter;
  });

  /* ---------- Listen ---------- */

  function liste(art) {
    const istA = art === 'angebote';
    const filterKey = istA ? 'filterA' : 'filterR';
    const filter = SuS.ansicht[filterKey];
    const q = SuS.ansicht.suche.toLowerCase();
    const filterListe = istA
      ? [['alle', 'Alle'], ['entwurf', 'Entwürfe'], ['versendet', 'Versendet'], ['angenommen', 'Angenommen'], ['abgelehnt', 'Abgelehnt']]
      : [['alle', 'Alle'], ['entwurf', 'Entwürfe'], ['offen', 'Offen'], ['ueber', 'Überfällig'], ['bezahlt', 'Bezahlt']];
    let docs = SuS.daten.dokumente.filter((d) => (istA ? d.typ === 'angebot' : SuS.istRechnung(d)));
    docs = docs.filter((d) => {
      const st = SuS.status(d);
      if (filter === 'alle') return true;
      if (filter === 'entwurf') return st.klasse === 'entwurf';
      if (filter === 'versendet') return d.status === 'versendet';
      if (filter === 'angenommen') return d.status === 'angenommen';
      if (filter === 'abgelehnt') return d.status === 'abgelehnt';
      if (filter === 'offen') return st.text === 'Offen' || st.text === 'Überfällig';
      if (filter === 'ueber') return st.text === 'Überfällig';
      if (filter === 'bezahlt') return st.text === 'Bezahlt';
      return true;
    });
    if (q) {
      docs = docs.filter((d) => {
        const k = SuS.kundeVon(d);
        return [d.nummer, d.betreff, d.baustelle, k && k.name].join(' ').toLowerCase().includes(q);
      });
    }
    docs.sort((a, b) => (b.datum + b.erstellt).localeCompare(a.datum + a.erstellt));
    SuS.zeige(
      SuS.belegReiter(istA ? 'angebote' : 'rechnungen') +
      '<input class="suche" type="search" placeholder="Suchen: Kunde, Nummer, Betreff" value="' + e(SuS.ansicht.suche) + '" data-suche>' +
      '<div class="filter">' + filterListe.map(([k, t]) => '<button type="button" data-a="filter" data-key="' + filterKey + '" data-wert="' + k + '" class="' + (k === filter ? 'an' : '') + '">' + t + '</button>').join('') + '</div>' +
      (docs.length ? '<ul class="liste">' + docs.map(dokZeile).join('') + '</ul>'
        : '<div class="karte leer">' + ICON_LEER + '<p>' + (filter === 'alle' && !q ? (istA ? 'Noch keine Angebote.' : 'Noch keine Rechnungen. Am schnellsten: ein angenommenes Angebot öffnen und „In Rechnung umwandeln“ tippen.') : 'Nichts gefunden.') + '</p></div>')
    );
  }
  SuS.seiten.angebote = () => liste('angebote');
  SuS.seiten.rechnungen = () => liste('rechnungen');
  A.filter = (el) => { SuS.ansicht[el.dataset.key] = el.dataset.wert; SuS.neuZeichnen(); };
  document.addEventListener('input', (ev) => {
    if (!ev.target.matches('[data-suche]')) return;
    SuS.ansicht.suche = ev.target.value;
    const pos = ev.target.selectionStart;
    SuS.neuZeichnen();
    const neu = document.querySelector('[data-suche]');
    if (neu) { neu.focus(); try { neu.setSelectionRange(pos, pos); } catch (x) { /* egal */ } }
  });

  /* ---------- Kunden ---------- */

  SuS.naechsteKundenNr = () => {
    const max = SuS.daten.kunden.reduce((m, k) => Math.max(m, parseInt(String(k.nr || '').replace(/\D/g, ''), 10) || 0), 0);
    return 'K-' + String(max + 1).padStart(3, '0');
  };

  SuS.seiten.kunden = () => {
    const zurueck = '<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button>';
    const q = SuS.ansicht.suche.toLowerCase();
    const kunden = SuS.daten.kunden.filter((k) => !q || [k.name, k.ort, k.strasse, k.nr].join(' ').toLowerCase().includes(q))
      .sort((a, b) => a.name.localeCompare(b.name, 'de'));
    SuS.zeige(
      zurueck + '<div class="kopf"><h1>Kunden</h1><button class="knopf haupt klein" data-a="kundeBearbeiten">+ Neu</button></div>' +
      '<input class="suche" type="search" placeholder="Suchen: Name, Ort" value="' + e(SuS.ansicht.suche) + '" data-suche>' +
      (kunden.length ? '<ul class="liste">' + kunden.map((k) => '<li><a class="zeile" href="#/kunde/' + e(k.id) + '"><div class="kundenwahl gesetzt" style="border:0;padding:0;background:none;width:auto"><div class="avatar">' +
        e((k.name || '?').trim().charAt(0).toUpperCase()) + '</div></div><div class="haupt"><div class="titel">' + e(k.name) + '</div><div class="klein">' +
        e([k.nr, k.art === 'firma' ? 'Firma' : 'Privat', [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(' · ')) + '</div></div></a></li>').join('') + '</ul>'
        : '<div class="karte leer"><p>' + (q ? 'Nichts gefunden.' : 'Noch keine Kunden. Kunden können Sie auch direkt beim Angebot anlegen.') + '</p></div>')
    );
  };

  SuS.seiten.kunde = (id) => {
    const k = SuS.kunde(id);
    if (!k) { location.hash = '#/kunden'; return; }
    const docs = SuS.daten.dokumente.filter((d) => d.kundeId === id);
    SuS.zeige(
      '<button class="zurueck" data-a="zurueck" data-ziel="#/kunden">‹ Kunden</button>' +
      '<div class="kopf"><div><h1>' + e(k.name) + '</h1><div class="unterzeile">' + e([k.nr, k.art === 'firma' ? 'Firma' : 'Privatkunde'].filter(Boolean).join(' · ')) + '</div></div>' +
      '<button class="knopf klein" data-a="kundeBearbeiten" data-id="' + e(k.id) + '">Bearbeiten</button></div>' +
      '<div class="karte">' + [k.ansprechpartner && 'z. Hd. ' + k.ansprechpartner, k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).map(e).join('<br>') +
      (k.telefon ? '<br><a href="tel:' + e(k.telefon.replace(/[^\d+]/g, '')) + '">' + e(k.telefon) + '</a>' : '') +
      (k.email ? '<br><a href="mailto:' + e(k.email) + '">' + e(k.email) + '</a>' : '') +
      (k.notiz ? '<p class="unterzeile">' + e(k.notiz) + '</p>' : '') + '</div>' +
      '<div class="knopfreihe"><button class="knopf haupt" data-a="neu" data-typ="angebot" data-kunde="' + e(k.id) + '">+ Angebot</button>' +
      '<button class="knopf zweit" data-a="neu" data-typ="rechnung" data-kunde="' + e(k.id) + '">+ Rechnung</button>' +
      '<button class="knopf" data-a="baustelleNeu" data-kunde="' + e(k.id) + '">+ Baustelle</button></div>' +
      '<h2>Vorgänge</h2>' + (docs.length ? '<ul class="liste">' + docs.map(dokZeile).join('') + '</ul>' : '<p class="unterzeile">Noch keine.</p>')
    );
  };

  A.zurueck = (el) => { location.hash = el.dataset.ziel; };

  /* Kundenformular; nachher(kunde) wird nach dem Sichern aufgerufen. */
  SuS.kundenFormular = (k, nachher) => {
    const neu = !k;
    const x = k || { art: 'privat', name: '', ansprechpartner: '', strasse: '', plz: '', ort: '', telefon: '', email: '', ustid: '', notiz: '', referenz: '' };
    const form = SuS.blatt(neu ? 'Neuer Kunde' : 'Kunde bearbeiten',
      '<div class="segment" data-segment="art"><button type="button" data-wert="privat" class="' + (x.art !== 'firma' ? 'an' : '') + '">Privat</button>' +
      '<button type="button" data-wert="firma" class="' + (x.art === 'firma' ? 'an' : '') + '">Firma / Gewerbe</button></div>' +
      '<input type="hidden" name="art" value="' + e(x.art || 'privat') + '">' +
      SuS.feld('name', 'Name', x.name, { auto: neu, platz: 'z. B. Familie Meier', autocomplete: 'off' }) +
      SuS.feld('ansprechpartner', 'Ansprechpartner', x.ansprechpartner, { id: 'nurFirma1' }) +
      SuS.feld('strasse', 'Straße und Hausnummer', x.strasse) +
      '<div class="plzort">' + SuS.feld('plz', 'PLZ', x.plz, { dezimal: true }) + SuS.feld('ort', 'Ort', x.ort) + '</div>' +
      '<div class="zwei">' + SuS.feld('telefon', 'Telefon', x.telefon, { typ: 'tel' }) + SuS.feld('email', 'E-Mail', x.email, { typ: 'email' }) + '</div>' +
      SuS.feld('ustid', 'USt-IdNr. (für § 13b nötig)', x.ustid, { id: 'nurFirma2' }) +
      SuS.feld('referenz', 'Käuferreferenz / Leitweg-ID (für E-Rechnungen)', x.referenz || '', { id: 'nurFirma3', hilfe: 'Bei Behörden Pflicht (Leitweg-ID); sonst z. B. Bestellnummer des Kunden – leer = Kundennummer.' }) +
      SuS.feld('notiz', 'Notiz (nur intern)', x.notiz, { typ: 'textarea', platz: 'z. B. Tor-Code, Hund, bevorzugte Zeiten' }) +
      (neu ? '' : '<button type="button" class="knopf gefahr breit" data-a="kundeLoeschen" data-id="' + e(x.id) + '">Kunde löschen</button>'),
      async (fd) => {
        const name = String(fd.get('name') || '').trim();
        if (!name) { SuS.melde('Bitte einen Namen eintragen.', true); return false; }
        const werte = {};
        ['art', 'name', 'ansprechpartner', 'strasse', 'plz', 'ort', 'telefon', 'email', 'ustid', 'notiz', 'referenz'].forEach((f) => { werte[f] = String(fd.get(f) || '').trim(); });
        let ziel = null;
        /* Ganz oder gar nicht, Erfolg erst nach bestätigter Ablage (Funde Codex/Cursor R13) */
        if (!(await SuS.transaktionSicher(() => {
          ziel = k ? SuS.kunde(k.id) : { id: SuS.id(), nr: SuS.naechsteKundenNr() };
          Object.assign(ziel, werte);
          if (neu) SuS.daten.kunden.push(ziel);
        }))) { SuS.melde('Speichern fehlgeschlagen.', true); return false; }
        SuS.melde(neu ? 'Kunde angelegt.' : 'Gespeichert.');
        if (nachher) nachher(SuS.kunde(ziel.id)); else SuS.neuZeichnen();
        return true;
      }, 'Sichern');
    const zeigeFirma = () => {
      const firma = form.querySelector('[name=art]').value === 'firma';
      form.querySelector('#nurFirma1').hidden = !firma; form.querySelector('#nurFirma2').hidden = !firma; form.querySelector('#nurFirma3').hidden = !firma;
    };
    zeigeFirma();
    form.querySelector('[data-segment=art]').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-wert]'); if (!b) return;
      form.querySelectorAll('[data-segment=art] button').forEach((x) => x.classList.toggle('an', x === b));
      form.querySelector('[name=art]').value = b.dataset.wert; zeigeFirma();
    });
  };
  A.kundeBearbeiten = (el) => SuS.kundenFormular(el.dataset.id ? SuS.kunde(el.dataset.id) : null, el.dataset.id ? null : (k) => { location.hash = '#/kunde/' + k.id; });
  A.kundeLoeschen = async (el) => {
    const id = el.dataset.id, marke = SuS.navMarke();
    if (SuS.daten.dokumente.some((d) => d.kundeId === id)) { SuS.melde('Dieser Kunde hat Angebote oder Rechnungen und bleibt deshalb erhalten.', true); return; }
    if (SuS.daten.projekte.some((p) => p.kundeId === id) || SuS.daten.vertraege.some((v) => v.kundeId === id)) {  // Fund Cursor R14
      SuS.melde('Dieser Kunde hat Baustellen oder Pflegeverträge und bleibt deshalb erhalten.', true); return;
    }
    if (!SuS.sicher(el)) return;
    if (!(await SuS.transaktionSicher(() => { SuS.daten.kunden = SuS.daten.kunden.filter((k) => k.id !== id); }))) {
      SuS.melde('Speichern fehlgeschlagen – der Kunde bleibt.', true); return;  // Fund Cursor R13
    }
    SuS.blattZu(); SuS.melde('Kunde gelöscht.'); SuS.gehZu('#/kunden', marke);
  };

  /* ---------- Mehr ---------- */

  SuS.seiten.mehr = () => {
    const eintrag = (href, titel, text) => '<li><a class="zeile" href="' + href + '"><div class="haupt"><div class="titel">' + titel + '</div><div class="klein">' + text + '</div></div><span aria-hidden="true">›</span></a></li>';
    SuS.zeige('<div class="kopf"><h1>Mehr</h1></div><ul class="liste">' +
      eintrag('#/kunden', 'Kunden', SuS.daten.kunden.length + ' Kunden') +
      eintrag('#/mitarbeiter', 'Mitarbeiter', SuS.daten.mitarbeiter.length + ' · für Stunden und Wochenplan') +
      eintrag('#/vertraege', 'Pflegeverträge', SuS.daten.vertraege.length + ' · wiederkehrende Rechnungen') +
      eintrag('#/ausgaben', 'Ausgaben', SuS.daten.ausgaben.length + ' Belege · Material, Sprit, Kippe – mit Foto') +
      eintrag('#/export', 'Für den Steuerberater', 'Rechnungsausgangsbuch, Ausgaben, DATEV') +
      '<li><button class="zeile" data-a="eRechnungOeffnen"><div class="haupt"><div class="titel">Empfangene E-Rechnung ansehen</div><div class="klein">XRechnung oder ZUGFeRD-XML lesbar machen</div></div><span aria-hidden="true">›</span></button></li>' +
      eintrag('#/firma', 'Firmendaten', 'Anschrift, Steuernummer, Bank, Kleinunternehmer') +
      eintrag('#/leistungen', 'Leistungen & Preise', SuS.daten.leistungen.length + ' Leistungen · eigene Preise pflegen') +
      eintrag('#/sicherung', 'Datensicherung', 'Verschlüsselt sichern, auf neues Gerät übertragen, wiederherstellen') +
      eintrag('#/installieren', 'Auf dem Handy installieren', SuS.installiert ? 'Installiert ✓' : 'Mit Symbol auf dem Startbildschirm, auch offline') +
      (SuS.eigenstaendig ? '' : eintrag('tageszettel/index.html', 'Tageszettel', 'Die bisherige Tageszettel-App')) +
      eintrag('#/hilfe', 'Hinweise', 'Pflichtangaben, § 35a, E-Rechnung – kurz erklärt') +
      '</ul><p class="unterzeile" style="margin-top:16px">Alle Daten bleiben auf diesem Gerät. Nichts wird ins Internet übertragen.</p>');
  };

  SuS.seiten.firma = () => {
    const f = SuS.daten.firma;
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><h1>Firmendaten</h1></div>' +
      '<form id="firmaForm" novalidate>' +
      '<div class="karte"><h3>Betrieb</h3>' + SuS.feld('name', 'Firmenname', f.name) + SuS.feld('zusatz', 'Zusatz', f.zusatz) +
      SuS.feld('inhaber', 'Inhaber / Ansprechpartner', f.inhaber, { platz: 'Vor- und Nachname' }) +
      SuS.feld('strasse', 'Straße und Hausnummer', f.strasse) + '<div class="plzort">' + SuS.feld('plz', 'PLZ', f.plz, { dezimal: true }) + SuS.feld('ort', 'Ort', f.ort) + '</div>' +
      '<div class="zwei">' + SuS.feld('telefon', 'Telefon', f.telefon, { typ: 'tel' }) + SuS.feld('email', 'E-Mail', f.email, { typ: 'email' }) + '</div>' + SuS.feld('web', 'Webseite', f.web) + '</div>' +
      '<div class="karte"><h3>Steuer</h3>' + '<div class="zwei">' + SuS.feld('steuernummer', 'Steuernummer', f.steuernummer) + SuS.feld('ustid', 'USt-IdNr.', f.ustid) + '</div>' +
      '<p class="unterzeile" style="margin-top:-4px">Eins von beiden muss auf jede Rechnung.</p>' +
      '<label class="schalter"><input type="checkbox" name="kleinunternehmer"' + (f.kleinunternehmer ? ' checked' : '') + '><span><b>Kleinunternehmer (§ 19 UStG)</b><small>Dann wird keine Umsatzsteuer ausgewiesen. Nur ankreuzen, wenn das mit dem Finanzamt so vereinbart ist.</small></span></label>' +
      SuS.feld('mwst', 'Umsatzsteuersatz in %', SuS.zahl(f.mwst, 1), { dezimal: true }) + '</div>' +
      '<div class="karte"><h3>Bankverbindung</h3>' + SuS.feld('bank', 'Bank', f.bank) + SuS.feld('iban', 'IBAN', f.iban, { platz: 'DE…' }) + SuS.feld('bic', 'BIC', f.bic) + '</div>' +
      '<div class="karte"><h3>Voreinstellungen</h3><div class="zwei">' + SuS.feld('zahlungsziel', 'Zahlungsziel (Tage)', f.zahlungsziel, { dezimal: true }) +
      SuS.feld('gueltigTage', 'Angebot gültig (Tage)', f.gueltigTage, { dezimal: true }) + '</div>' +
      '<div class="zwei">' + SuS.feld('skontoProzent', 'Skonto % (0 = keins)', f.skontoProzent ? SuS.zahl(f.skontoProzent, 2) : '', { dezimal: true, platz: '0' }) +
      SuS.feld('skontoTage', 'Skonto innerhalb (Tage)', f.skontoTage, { dezimal: true }) + '</div>' +
      SuS.feld('mahngebuehr', 'Mahngebühr ab der 1. Mahnung (€)', f.mahngebuehr ? SuS.centText(f.mahngebuehr) : '', { dezimal: true, platz: '0,00', hilfe: 'Nur tatsächliche Kosten (z. B. Porto); bei Privatkunden im Zweifel 0 lassen.' }) + '<div class="drei">' +
      SuS.feld('praefixAngebot', 'Kürzel Angebot', f.praefixAngebot) + SuS.feld('praefixRechnung', 'Kürzel Rechnung', f.praefixRechnung) +
      SuS.feld('startRechnung', 'Nächste Rechnung Nr. ab', f.startRechnung, { dezimal: true, hilfe: 'Nur falls Sie eine bestehende Nummernfolge fortsetzen.' }) + '</div></div>' +
      '<button class="knopf haupt breit" type="submit">Speichern</button></form>');
    const form = document.getElementById('firmaForm');
    /* Jede Änderung wird sofort übernommen (Fund von Cursor: Zurück ohne „Speichern“ verlor die Eingaben). */
    const uebernehmen = () => {
      const fd = new FormData(form);
      ['name', 'zusatz', 'inhaber', 'strasse', 'plz', 'ort', 'telefon', 'email', 'web', 'steuernummer', 'ustid', 'bank', 'bic', 'praefixAngebot', 'praefixRechnung']
        .forEach((k) => { f[k] = String(fd.get(k) || '').trim(); });
      f.iban = String(fd.get('iban') || '').replace(/\s+/g, '').toUpperCase().replace(/(.{4})/g, '$1 ').trim();
      f.kleinunternehmer = fd.get('kleinunternehmer') === 'on';
      const mwst = SuS.leseZahl(fd.get('mwst')); if (Number.isFinite(mwst) && mwst >= 0 && mwst < 100) f.mwst = mwst;
      const mg = String(fd.get('mahngebuehr') || '').trim() ? SuS.leseCent(fd.get('mahngebuehr')) : 0; if (Number.isFinite(mg) && mg >= 0 && mg <= 10000) f.mahngebuehr = mg;
      ['zahlungsziel', 'gueltigTage', 'startRechnung'].forEach((k) => { const n = parseInt(fd.get(k), 10); if (n >= 0 && n < 100000) f[k] = n; });
      const sp = String(fd.get('skontoProzent') || '').trim() ? SuS.leseZahl(fd.get('skontoProzent')) : 0; if (Number.isFinite(sp) && sp >= 0 && sp <= 10) f.skontoProzent = Math.round(sp * 100) / 100;
      const st = parseInt(fd.get('skontoTage'), 10); if (st >= 1 && st <= 90) f.skontoTage = st;
      if (!f.name) f.name = 'Stock und Stein';
      SuS.speichern();
    };
    form.addEventListener('change', uebernehmen);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault(); uebernehmen();
      const marke = SuS.navMarke();
      if (!(await SuS.speichernAbwarten())) { SuS.melde('Speichern fehlgeschlagen – Firmendaten nicht gesichert.', true); return; }  // Fund Cursor R11
      SuS.melde('Firmendaten gespeichert.'); SuS.gehZu('#/mehr', marke);
    });
  };

  /* ---------- Leistungen ---------- */

  SuS.seiten.leistungen = () => {
    const gruppen = {};
    SuS.daten.leistungen.forEach((l) => { (gruppen[l.gruppe || 'Sonstiges'] = gruppen[l.gruppe || 'Sonstiges'] || []).push(l); });
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button>' +
      '<div class="kopf"><h1>Leistungen & Preise</h1><button class="knopf haupt klein" data-a="leistungBearbeiten">+ Neu</button></div>' +
      (SuS.daten.firma.preiseGeprueft ? '' : '<div class="hinweis info"><b>Das sind Richtwerte (netto) – ' + e(SuS.katalog.STAND) + '.</b>Aus öffentlichen Quellen (Tariflohn, Entsorgungsgebühren, Marktpreise). Bitte durch Ihre eigenen Preise ersetzen. ' +
        '<div class="knopfreihe"><button class="knopf klein" data-a="richtwerte">Aktuelle Richtwerte übernehmen</button><button class="knopf klein" data-a="preiseOk">Erledigt – meine Preise stimmen</button></div></div>') +
      '<div class="knopfreihe"><button class="knopf klein" data-a="preiseAnpassen">Alle Preise um … % anpassen</button></div>' +
      Object.keys(gruppen).map((g) => '<h2>' + e(g) + '</h2><ul class="liste">' + gruppen[g].map((l) =>
        '<li><button class="zeile" data-a="leistungBearbeiten" data-id="' + e(l.id) + '"><div class="haupt"><div class="titel">' + e(l.text) + '</div><div class="klein"><span class="art ' + e(l.art) + '">' +
        SuS.ARTEN[l.art].name + (l.art === 'gemischt' ? ' ' + SuS.zahl(l.lohnanteil, 0) + ' % Lohn' : '') + '</span>' + e(l.beschreibung) + '</div></div>' +
        '<div class="betrag">' + SuS.euro(l.preis) + '<div class="klein" style="font-weight:400;color:var(--leise)">je ' + e(l.einheit) + '</div></div></button></li>').join('') + '</ul>').join(''));
  };
  A.preiseAnpassen = () => {
    SuS.blatt('Preise anpassen', '<p class="unterzeile" style="margin-top:0">Z. B. zur jährlichen Preiserhöhung. Ändert alle Preise im Leistungskatalog – bestehende Angebote und Rechnungen bleiben, wie sie sind.</p>' +
      '<div class="zwei">' + SuS.feld('prozent', 'Änderung in %', '', { dezimal: true, auto: true, platz: 'z. B. 4 oder -2' }) +
      SuS.feld('rundung', 'Runden auf', '10', { typ: 'select', optionen: [['1', '1 Cent'], ['10', '10 Cent'], ['50', '50 Cent'], ['100', '1 Euro']] }) + '</div>', (fd) => {
      try { const n = SuS.preiseAnpassen(SuS.leseZahl(fd.get('prozent')), fd.get('rundung')); SuS.speichern(); SuS.neuZeichnen(); SuS.melde(n + ' Preise angepasst.'); return true; }
      catch (x) { SuS.melde(x.message, true); return false; }
    }, 'Anpassen');
  };
  A.richtwerte = () => { const n = SuS.katalog.richtwerteUebernehmen(); SuS.speichern(); SuS.neuZeichnen(); SuS.melde(n + ' Preise aktualisiert.'); };
  A.preiseOk = () => { SuS.daten.firma.preiseGeprueft = true; SuS.speichern(); SuS.neuZeichnen(); };

  SuS.EINHEITEN = ['m²', 'm', 'm³', 'Stk', 'Std', 'psch', 'Tag', 't', 'kg', 'Sack'];
  SuS.einheitenListe = () => '<datalist id="einheiten">' + SuS.EINHEITEN.map((x) => '<option value="' + x + '">').join('') + '</datalist>';
  SuS.artFelder = (art, lohnanteil) => SuS.feld('art', 'Art (für den Ausweis der Arbeitskosten)', art || 'lohn',
    { typ: 'select', optionen: Object.keys(SuS.ARTEN).map((k) => [k, SuS.ARTEN[k].name]) }) +
    SuS.feld('lohnanteil', 'Davon Arbeitsanteil in %', lohnanteil == null ? 50 : SuS.zahl(lohnanteil, 0), { dezimal: true, id: 'lohnFeld',
      hilfe: 'Nur bei „Arbeit + Material“: welcher Teil des Preises ist Lohn? Wichtig für § 35a beim Privatkunden.' });
  SuS.artUmschalter = (form) => {
    const sel = form.querySelector('[name=art]'), feld = form.querySelector('#lohnFeld');
    const zeige = () => { feld.hidden = sel.value !== 'gemischt'; };
    sel.addEventListener('change', zeige); zeige();
  };

  A.leistungBearbeiten = (el) => {
    const l = el.dataset.id ? SuS.leistung(el.dataset.id) : null;
    const x = l || { gruppe: '', text: '', beschreibung: '', einheit: 'm²', preis: 0, art: 'lohn', lohnanteil: 50 };
    const gruppen = [...new Set(SuS.daten.leistungen.map((y) => y.gruppe).filter(Boolean))];
    const form = SuS.blatt(l ? 'Leistung bearbeiten' : 'Neue Leistung',
      SuS.feld('text', 'Bezeichnung', x.text, { auto: !l }) + SuS.feld('beschreibung', 'Beschreibung (erscheint kleiner im Angebot)', x.beschreibung, { typ: 'textarea' }) +
      '<div class="zwei">' + SuS.feld('preis', 'Preis netto (€)', SuS.centText(x.preis), { dezimal: true }) + SuS.feld('einheit', 'je Einheit', x.einheit, { liste: 'einheiten' }) + '</div>' +
      SuS.einheitenListe() +
      '<details class="karte" style="padding:12px"' + (x.ek != null ? ' open' : '') + '><summary><b>Kalkulation aus Einkaufspreis</b></summary><div style="height:10px"></div><div class="zwei">' +
      SuS.feld('ek', 'Einkauf netto (€)', x.ek != null ? SuS.centText(x.ek) : '', { dezimal: true }) + SuS.feld('aufschlag', 'Aufschlag %', x.aufschlag != null ? SuS.zahl(x.aufschlag, 1) : '', { dezimal: true, platz: 'z. B. 25' }) + '</div>' +
      '<button type="button" class="knopf klein" data-kalk>Preis berechnen</button></details>' +
      SuS.artFelder(x.art, x.lohnanteil) +
      SuS.feld('gruppe', 'Gruppe', x.gruppe, { liste: 'gruppen' }) + '<datalist id="gruppen">' + gruppen.map((g) => '<option value="' + e(g) + '">').join('') + '</datalist>' +
      (l ? '<button type="button" class="knopf gefahr breit" data-a="leistungLoeschen" data-id="' + e(l.id) + '">Leistung löschen</button>' : ''),
      (fd) => {
        const text = String(fd.get('text') || '').trim(), preis = SuS.leseCent(fd.get('preis'));
        if (!text) { SuS.melde('Bitte eine Bezeichnung eintragen.', true); return false; }
        if (!Number.isFinite(preis) || preis < 0) { SuS.melde('Preis bitte als Zahl, z. B. 45,50.', true); return false; }
        const ziel = l || { id: SuS.id() };
        Object.assign(ziel, {
          text, preis, beschreibung: String(fd.get('beschreibung') || '').trim(), einheit: String(fd.get('einheit') || '').trim() || 'Stk',
          art: String(fd.get('art')), gruppe: String(fd.get('gruppe') || '').trim() || 'Sonstiges'
        });
        const la = SuS.leseZahl(fd.get('lohnanteil'));
        ziel.lohnanteil = ziel.art === 'gemischt' && Number.isFinite(la) ? Math.min(100, Math.max(0, la)) : null;
        const ek = SuS.leseCent(fd.get('ek')), auf = SuS.leseZahl(fd.get('aufschlag'));
        ziel.ek = Number.isFinite(ek) && ek >= 0 ? ek : null;
        ziel.aufschlag = Number.isFinite(auf) && auf >= 0 ? Math.min(1000, auf) : null;
        if (!l) SuS.daten.leistungen.push(ziel);
        SuS.speichern(); SuS.neuZeichnen(); SuS.melde('Gespeichert.');
        return true;
      }, 'Sichern');
    SuS.artUmschalter(form);
    form.querySelector('[data-kalk]').addEventListener('click', () => {
      const ek = SuS.leseCent(form.querySelector('[name=ek]').value), auf = SuS.leseZahl(form.querySelector('[name=aufschlag]').value || '0');
      if (!Number.isFinite(ek) || !Number.isFinite(auf)) { SuS.melde('Bitte Einkaufspreis und Aufschlag eingeben.', true); return; }
      form.querySelector('[name=preis]').value = SuS.centText(SuS.runde(ek * (100 + auf) / 100));
    });
  };
  A.leistungLoeschen = (el) => {
    if (!SuS.sicher(el)) return;
    SuS.daten.leistungen = SuS.daten.leistungen.filter((l) => l.id !== el.dataset.id);
    SuS.speichern(); SuS.blattZu(); SuS.neuZeichnen(); SuS.melde('Leistung gelöscht. Bestehende Angebote bleiben unverändert.');
  };

  /* ---------- Sicherung ---------- */

  SuS.seiten.sicherung = () => {
    const d = SuS.daten;
    const beispiele = d.kunden.some((k) => k.beispiel) || d.dokumente.some((x) => x.beispiel) || d.projekte.some((p) => p.beispiel);
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><h1>Datensicherung</h1></div>' +
      '<div class="karte"><p style="margin-top:0">Auf diesem Gerät: <b>' + d.kunden.length + ' Kunden, ' + d.dokumente.length + ' Angebote/Rechnungen, ' + d.leistungen.length + ' Leistungen</b>.</p>' +
      '<p class="unterzeile">Die Daten liegen nur hier. Wer das Gerät wechselt oder den Browserverlauf löscht, braucht eine Sicherung. Rechnungen sind Buchungsbelege und müssen 8 Jahre aufbewahrt werden – die PDFs zusätzlich ablegen.</p>' +
      '<button class="knopf haupt breit" data-a="sichernVerschluesselt" style="margin:6px 0 4px">🔒 Verschlüsselt sichern (empfohlen)</button>' +
      '<p class="unterzeile">Mit Passwort geschützt – geeignet für iCloud Drive, Google Drive oder Mail an sich selbst. Fotos können mit.</p><h3 style="margin:14px 0 4px">Ohne Verschlüsselung (ohne Fotos)</h3>' +
      '<p class="unterzeile" style="margin-top:0">Enthält nur die Daten, <b>keine Fotos</b>. Für einen Gerätewechsel mit Fotos die verschlüsselte Sicherung nehmen.</p>' +
      (window.parent !== window
        ? '<div class="hinweis info">Im App-Fenster des Orchestrators sind Datei-Downloads gesperrt. Bitte „Als Text anzeigen“, alles kopieren und z. B. als Notiz sichern.</div>' +
          '<div class="knopfreihe"><button class="knopf haupt" data-a="sichernText">Als Text anzeigen</button><button class="knopf" data-a="sichernDatei">Als Datei</button></div></div>'
        : '<div class="knopfreihe"><button class="knopf haupt" data-a="sichernDatei">Sicherung als Datei</button><button class="knopf" data-a="sichernText">Als Text anzeigen</button></div></div>') +
      '<div class="karte"><h3>Wiederherstellen</h3><p class="unterzeile" style="margin-top:0">Ersetzt alle Daten auf diesem Gerät durch die Sicherung.</p>' +
      '<div class="knopfreihe"><label class="knopf">Datei wählen<input type="file" accept=".json,application/json" data-datei hidden></label><button class="knopf" data-a="textEinfuegen">Text einfügen</button></div></div>' +
      (vorherDa() ? '<div class="karte"><h3>Stand vor dem letzten Wiederherstellen</h3><p class="unterzeile" style="margin-top:0">Falls beim Wiederherstellen etwas schiefging: den vorherigen Stand zurückholen.</p><button class="knopf" data-a="vorherZurueck">Vorherigen Stand zurückholen</button></div>' : '') +
      (beispiele ? '<div class="karte"><h3>Beispiel entfernen</h3><p class="unterzeile" style="margin-top:0">Löscht den Beispielkunden und das Beispielangebot.</p><button class="knopf gefahr" data-a="beispielWeg">Beispiel löschen</button></div>' : ''));
  };
  const vorherDa = () => SuS.vorherVorhanden === true || (() => { try { return !!localStorage.getItem('sus-buero-v1-vorher'); } catch (x) { return false; } })();
  /* Ersetzt die Daten durch d (bereits bereinigt) und merkt den jetzigen Stand; Fotos werden nach Wunsch getauscht.
     Gibt true zurück oder wirft einen Fehler – dann ist nichts verändert. */
  async function ersetzen(d, fotosGemerkt) {
    const jetzt = SuS.daten;
    await SuS.vorherMerken(JSON.stringify(Object.assign({}, jetzt, { fotosGemerkt: !!fotosGemerkt })));
    delete d.fotosGemerkt;
    SuS.daten = d;
    if (!(await SuS.speichernAbwarten())) { SuS.daten = jetzt; SuS.speichern(); throw new Error('Speichern fehlgeschlagen – nichts wurde ersetzt.'); }
    SuS.laden(JSON.stringify(d));
  }
  A.vorherZurueck = async (el) => {
    if (!SuS.sicher(el)) return;
    let alt, fotosTauschen = false;
    try {
      const roh = await SuS.vorherHolen();
      if (!roh) return;
      alt = JSON.parse(roh); delete alt.vorherUm;
      if (!alt || alt.v !== 1 || !Array.isArray(alt.dokumente) || !Array.isArray(alt.kunden)) { SuS.melde('Der gemerkte Stand ist beschädigt.', true); return; }
      fotosTauschen = alt.fotosGemerkt === true;
      alt.firma = Object.assign(SuS.leer().firma, alt.firma || {});
      if (!Array.isArray(alt.leistungen)) alt.leistungen = [];
      SuS.bereinige(alt);
      SuS.zaehlerVereinen(alt, SuS.daten);  // Nummern, die inzwischen vergeben wurden, nie erneut vergeben (Prüfrunde 2)
      await ersetzen(alt, fotosTauschen);
    } catch (x) { SuS.melde('Zurückholen fehlgeschlagen – nichts wurde geändert.', true); return; }
    let text = 'Vorheriger Stand zurückgeholt.';
    if (fotosTauschen) { try { const n = await SuS.fotosVorherTauschen(); text += ' Fotos: ' + n + '.'; } catch (x) { text += ' Die Fotos konnten nicht zurückgetauscht werden.'; } }
    SuS.melde(text); SuS.neuZeichnen();
  };
  const sicherungText = SuS.sicherungText = () => JSON.stringify(Object.assign({ app: 'stock-und-stein-buero', gesichert: new Date().toISOString() }, SuS.daten), null, 1);
  A.sichernDatei = () => {
    /* Im abgeschotteten App-Fenster sind Downloads gesperrt, ohne dass ein Fehler kommt (Fund von Codex). */
    if (window.parent !== window) { A.sichernText(); return; }
    try {
      const url = URL.createObjectURL(new Blob([sicherungText()], { type: 'application/json' }));
      const a = document.createElement('a');
      sicherungMerken();
      a.href = url; a.download = 'stock-und-stein-sicherung-' + SuS.heute() + '.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      SuS.melde('Sicherung erstellt. Falls nichts passiert: „Als Text anzeigen“ nutzen.');
    } catch (x) { A.sichernText(); }
  };
  const sicherungMerken = () => { SuS.daten.letzteSicherung = new Date().toISOString(); SuS.speichern(); };
  A.sichernText = () => {
    sicherungMerken();
    const f = SuS.blatt('Sicherung als Text', '<p class="unterzeile">Alles markieren, kopieren und z. B. in einer Notiz oder Mail an sich selbst ablegen.</p>' +
      '<label class="feld"><textarea readonly style="min-height:260px;font-size:12px" data-auswahl></textarea></label>');
    const t = f.querySelector('textarea'); t.value = sicherungText();
    t.addEventListener('focus', () => t.select());
  };
  A.textEinfuegen = () => {
    SuS.blatt('Sicherung einfügen', '<label class="feld"><span>Sicherungstext</span><textarea name="t" style="min-height:220px;font-size:12px" autofocus></textarea></label>', (fd) => pruefeUndFrage(String(fd.get('t') || '')), 'Weiter');
  };
  document.addEventListener('change', (ev) => {
    if (!ev.target.matches('[data-datei]')) return;
    const datei = ev.target.files[0]; if (!datei) return;
    const r = new FileReader();
    r.onload = () => pruefeUndFrage(String(r.result || ''));
    r.readAsText(datei);
  });
  function pruefeUndFrage(text) {
    if (SuS.istVerschluesselt && SuS.istVerschluesselt(text)) { setTimeout(() => SuS.entschluesselnUndFrage(text, pruefeUndFrage), 0); return true; }
    let d;
    try { d = JSON.parse(text); } catch (x) { SuS.melde('Das ist keine gültige Sicherung.', true); return false; }
    if (!d || d.v !== 1 || !Array.isArray(d.dokumente) || !Array.isArray(d.kunden) || !d.firma || typeof d.firma !== 'object') { SuS.melde('Das ist keine Sicherung dieser App.', true); return false; }
    const fotos = Array.isArray(d.fotos) ? d.fotos : null;  // Fotos gehören in den Bildspeicher, nicht in den Datenspeicher
    delete d.fotos;
    /* Vorab vollständig bereinigen und durchrechnen – erst wenn das klappt, wird überhaupt etwas ersetzt (Fund von Codex). */
    try {
      d.firma = Object.assign(SuS.leer().firma, d.firma);
      if (!Array.isArray(d.leistungen)) d.leistungen = [];
      if (!d.zaehler || typeof d.zaehler !== 'object') d.zaehler = {};
      SuS.bereinige(d);
      const merk = SuS.daten; SuS.daten = d;
      try { d.dokumente.forEach((x) => { SuS.summen(x); SuS.status(x); }); } finally { SuS.daten = merk; }
    } catch (x) { SuS.melde('Die Sicherung ist beschädigt und wurde nicht eingespielt.', true); return false; }
    const merk2 = SuS.daten; SuS.daten = d;
    const veraendert = d.dokumente.filter((x) => SuS.veraendert(x)).length;
    SuS.daten = merk2;
    setTimeout(() => {
      SuS.blatt('Wiederherstellen?', '<p>Die Sicherung' + (d.gesichert ? ' vom ' + SuS.datum(String(d.gesichert).slice(0, 10)) : '') + ' enthält <b>' + d.kunden.length + ' Kunden</b> und <b>' +
        d.dokumente.length + ' Angebote/Rechnungen</b>.</p><div class="hinweis">Alle Daten auf diesem Gerät werden dadurch ersetzt. Rechnungen, die nach dieser Sicherung gestellt wurden, fehlen danach (ihre Nummern werden aber nicht erneut vergeben). Der jetzige Stand wird vorher gemerkt und kann zurückgeholt werden.</div>' +
        (veraendert ? '<div class="hinweis fehler"><b>' + veraendert + ' festgeschriebene Rechnung(en) wurden außerhalb der App verändert.</b>Bitte nur einspielen, wenn Sie wissen, warum.</div>' : '') +
        (fotos ? '<p class="unterzeile">Dazu ' + fotos.length + ' Fotos – sie ersetzen die Fotos auf diesem Gerät.</p>' : '<p class="unterzeile">Die Sicherung enthält keine Fotos; Fotos auf diesem Gerät bleiben, wie sie sind.</p>') +
        '<button type="submit" class="knopf haupt breit">Ja, wiederherstellen</button>', async () => {
        delete d.app; delete d.gesichert;
        /* Nummernkreise nie zurückdrehen: höhere Zähler dieses Geräts bleiben erhalten (Fund von Cursor). */
        SuS.zaehlerVereinen(d, SuS.daten);
        const bildspeicher = !!(fotos && SuS.fotosVerfuegbar && await SuS.fotosVerfuegbar());
        /* Fotos erst merken, dann ersetzen – sonst ginge beim Zurückholen der Fotostand verloren (Fund Codex). */
        if (bildspeicher) { try { await SuS.fotosVorherMerken(); } catch (x) { SuS.melde('Die Fotos auf diesem Gerät konnten nicht gemerkt werden – nichts wurde ersetzt.', true); return false; } }
        try { await ersetzen(d, bildspeicher); } catch (x) { SuS.melde(x.message || 'Speichern fehlgeschlagen – nichts wurde ersetzt.', true); return false; }
        let text = 'Wiederhergestellt.', warn = false;
        if (fotos && !bildspeicher) { text += ' Die ' + fotos.length + ' Fotos konnten hier nicht eingespielt werden (Bildspeicher nicht verfügbar).'; warn = true; }
        else if (fotos) {
          SuS.melde('Daten wiederhergestellt – Fotos werden eingespielt …');
          try { const erg = await SuS.fotosErsetzen(fotos); text += erg.fehler ? ' Achtung: nur ' + erg.ok + ' von ' + fotos.length + ' Fotos eingespielt.' : ' Dazu ' + erg.ok + ' Fotos.'; warn = erg.fehler > 0; }
          catch (x) { text += ' Fotos konnten nicht eingespielt werden – „Vorherigen Stand zurückholen“ stellt die alten Fotos wieder her.'; warn = true; }
        }
        SuS.melde(text, warn); location.hash = '#/start'; SuS.neuZeichnen();
        return true;
      }, 'Ersetzen');
    }, 0);
    return true;
  }
  A.beispielWeg = (el) => {
    if (!SuS.sicher(el)) return;
    const d = SuS.daten;
    const kundenIds = d.kunden.filter((k) => k.beispiel).map((k) => k.id);
    d.dokumente = d.dokumente.filter((x) => !x.beispiel && !(kundenIds.includes(x.kundeId) && !x.fest));
    d.kunden = d.kunden.filter((k) => !k.beispiel || d.dokumente.some((x) => x.kundeId === k.id));
    const weg = d.projekte.filter((p) => p.beispiel && !d.dokumente.some((x) => x.projektId === p.id && x.fest)).map((p) => p.id);
    d.projekte = d.projekte.filter((p) => !weg.includes(p.id));
    d.aufwand = d.aufwand.filter((a) => !a.beispiel && !weg.includes(a.projektId));
    d.termine = d.termine.filter((t) => !t.beispiel && !weg.includes(t.projektId));
    d.mitarbeiter = d.mitarbeiter.filter((m) => !m.beispiel || d.aufwand.some((a) => a.mitarbeiterId === m.id));
    SuS.speichern(); SuS.melde('Beispiel entfernt.'); SuS.neuZeichnen();
  };

  /* ---------- Installieren ---------- */
  SuS.seiten.installieren = () => {
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent), android = /Android/.test(navigator.userAgent);
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><h1>Auf dem Handy installieren</h1></div>' +
      (SuS.installiert ? '<div class="hinweis info"><b>Die App ist installiert.</b>Sie läuft auch ohne Internet. Ihre Daten bleiben auf diesem Gerät.</div>' : '') +
      (!SuS.eigenstaendig ? '<div class="hinweis">Sie sehen die App gerade im Fenster des Orchestrators. Installieren geht nur über die eigene Internetadresse der App (siehe Anleitung in der Mappe).</div>' : '') +
      '<div class="karte"><h3>iPhone (Safari)</h3><ol style="padding-left:20px;margin:6px 0"><li>Diese Seite in <b>Safari</b> öffnen.</li><li>Unten auf <b>Teilen</b> tippen (Quadrat mit Pfeil).</li>' +
        '<li><b>Zum Home-Bildschirm</b> wählen, dann <b>Hinzufügen</b>.</li><li>Ab jetzt die App über das Symbol „S&S Büro“ starten.</li></ol></div>' +
      '<div class="karte"><h3>Android (Chrome)</h3><ol style="padding-left:20px;margin:6px 0"><li>Diese Seite in <b>Chrome</b> öffnen.</li><li>Oben rechts auf <b>⋮</b> tippen.</li>' +
        '<li><b>App installieren</b> bzw. <b>Zum Startbildschirm hinzufügen</b>.</li></ol></div>' +
      '<div class="karte"><h3>Wichtig</h3><ul style="padding-left:20px;margin:6px 0"><li>Alle Daten liegen nur auf diesem Handy – <b>regelmäßig verschlüsselt sichern</b> (Mehr → Datensicherung). Die App erinnert nach 7 Tagen.</li>' +
        '<li>Auf dem iPhone die App immer über das Symbol starten, nicht über Safari – sonst sieht man dort andere (leere) Daten.</li>' +
        '<li>PDF verschicken: Beleg öffnen → Vorschau → <b>Teilen</b> → Mail oder WhatsApp. Drucken am Handy: im Teilen-Menü „Drucken“.</li></ul></div>' +
      (SuS.speicherDauerhaft === false ? '<div class="hinweis"><b>Speicher nicht dauerhaft zugesagt.</b>Das System könnte die App-Daten bei Platzmangel löschen. Deshalb unbedingt regelmäßig verschlüsselt sichern – auf dem iPhone hilft es, die App über den Home-Bildschirm zu nutzen.</div>' : '') +
      '<p class="unterzeile">Gerät erkannt: ' + (ios ? 'iPhone/iPad' : android ? 'Android' : 'Computer') + ' · Speicher dauerhaft: ' + (SuS.speicherDauerhaft === true ? 'ja' : SuS.speicherDauerhaft === false ? 'nein' : 'wird geprüft') + '</p>');
  };

  /* ---------- Hinweise ---------- */

  SuS.seiten.hilfe = () => {
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><h1>Hinweise</h1></div>' +
      '<div class="karte"><h3>Was die App automatisch auf die Rechnung schreibt</h3><ul style="padding-left:20px;margin:0">' +
      '<li>Pflichtangaben nach § 14 UStG: Ihre Anschrift, Steuernummer/USt-IdNr., Kundenanschrift, fortlaufende Rechnungsnummer, Datum, Leistungszeitraum, Mengen, Nettobetrag, Steuersatz und Steuerbetrag.</li>' +
      '<li>Bei Privatkunden: den Hinweis auf die zweijährige Aufbewahrungspflicht (Arbeiten am Grundstück).</li>' +
      '<li>Bei Privatkunden: die enthaltenen Arbeits-, Maschinen- und Fahrtkosten getrennt vom Material (für den Steuerbonus nach § 35a EStG).</li>' +
      '<li>Kleinunternehmer-Hinweis oder § 13b (Steuerschuldnerschaft des Leistungsempfängers), wenn eingestellt.</li>' +
      '<li>In der Schlussrechnung werden nur bezahlte Abschläge samt Umsatzsteuer abgezogen (§ 14 Abs. 5 UStG). Ist ein Abschlag noch offen: Zahlung eintragen oder Abschlag stornieren.</li></ul>' +
      '<p class="unterzeile">Eine Rechnung wird beim „Stellen“ festgeschrieben und bekommt erst dann ihre Nummer. Danach ist sie in der App nicht mehr änderbar – Korrekturen laufen über eine Stornorechnung.</p></div>' +
      '<div class="karte"><h3>E-Rechnung an Firmenkunden</h3><p style="margin-top:0">Privatkunden bekommen weiter eine normale Rechnung (PDF/Papier). Für Rechnungen an <b>Firmen</b> gilt: ab 2027 Pflicht zur E-Rechnung für Betriebe mit mehr als 800.000 € Vorjahresumsatz, ab 2028 für die übrigen Betriebe (Kleinunternehmer und Kleinbeträge bis 250 € ausgenommen). ' +
      'Diese App erstellt die E-Rechnung im Format <b>XRechnung 3.0</b> (Vorschau → „E-Rechnung erzeugen“, nur bei Firmenkunden) – geprüft mit dem offiziellen Prüfwerkzeug. Privatkunden bekommen weiter das PDF.</p></div>' +
      '<div class="karte"><h3>Wichtig</h3><p style="margin:0">Die App ist eine Arbeitshilfe, keine Steuer- oder Rechtsberatung. Bitte die erste Rechnung einmal vom Steuerberater ansehen lassen. Rechnungen 8 Jahre aufbewahren (PDF ablegen; Fristen im Zweifel mit dem Steuerberater klären).</p></div>');
  };
})();
