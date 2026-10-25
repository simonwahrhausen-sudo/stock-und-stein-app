/* Stock und Stein – Editor für Angebote und Rechnungen: Kunde, Positionen, Schnellpakete, Summen, Abläufe. */
'use strict';

(function () {
  const e = SuS.esc, A = SuS.aktionen;
  let aktuell = null;

  const gespeichert = (dok) => { dok.geaendert = new Date().toISOString(); SuS.speichern(); };
  /* Gestellte Rechnungen sind fest; Angebote, sobald ein gestellter Folgebeleg existiert (Fund von Cursor). */
  /* Unterschriebene Angebote sind ebenfalls fest – Änderungen nur als Nachtrag (Fund Codex). */
  /* Nach einem Fehlschlag hat transaktion() frische Objekte geladen – den Editor auf diese umstellen (Fund Cursor R7). */
  const frisch = (id) => { aktuell = SuS.dok(id) || aktuell; };
  const gesperrt = (dok) => !!dok.fest || (dok.typ === 'angebot' && (SuS.angebotGesperrt(dok) || !!dok.unterschrift));

  function kundenKarte(dok) {
    const k = SuS.kundeVon(dok);
    if (!k) return '<button type="button" class="kundenwahl" data-a="kundeWaehlen"' + (gesperrt(dok) ? ' disabled' : '') + '><div class="avatar">+</div><div><b>Kunde wählen</b><div class="unterzeile">oder neu anlegen</div></div></button>';
    return '<button type="button" class="kundenwahl gesetzt" data-a="kundeWaehlen"' + (gesperrt(dok) ? ' disabled' : '') + '><div class="avatar">' + e(k.name.trim().charAt(0).toUpperCase()) + '</div><div style="min-width:0;flex:1"><b>' + e(k.name) + '</b>' +
      '<div class="unterzeile">' + e([k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') || 'Anschrift fehlt') + '</div></div>' +
      (gesperrt(dok) ? '' : '<span class="unterzeile">ändern</span>') + '</button>';
  }

  function positionZeile(dok, p, nr) {
    if (p.typ === 'titel') return '<li class="pos titel" data-a="posBearbeiten" data-id="' + e(p.id) + '"><span class="nr">' + nr + '</span><span class="txt"><b>' + e(p.text) + '</b></span><span></span></li>';
    if (p.typ === 'text') return '<li class="pos text" data-a="posBearbeiten" data-id="' + e(p.id) + '"><span class="nr"></span><span class="txt">' + e(p.text) + '</span><span></span></li>';
    const art = SuS.ARTEN[p.art] || SuS.ARTEN.lohn;
    return '<li class="pos' + (p.bedarf ? ' bedarf' : '') + '" data-a="posBearbeiten" data-id="' + e(p.id) + '"><span class="nr">' + nr + '</span>' +
      '<span class="txt"><b>' + e(p.text || 'Ohne Bezeichnung') + '</b>' + (p.beschreibung ? '<small>' + e(p.beschreibung) + '</small>' : '') +
      '<span class="rechnung"><span class="art ' + e(p.art) + '">' + art.name + (p.art === 'gemischt' ? ' ' + SuS.zahl(SuS.lohnQuote(p), 0) + ' %' : '') + '</span>' +
      SuS.zahl(p.menge) + ' ' + e(p.einheit) + ' × ' + SuS.euro(p.preis) + (p.bedarf ? ' · Bedarfsposition' : '') + '</span></span>' +
      '<span class="gp">' + (p.bedarf ? '(' + SuS.euro(SuS.posBetrag(p)) + ')' : SuS.euro(SuS.posBetrag(p))) + '</span></li>';
  }

  function summenKarte(dok) {
    const s = SuS.summen(dok), k = SuS.kundeVon(dok);
    const z = [];
    if (s.rabatt) z.push(['Zwischensumme', SuS.euro(s.zwischen)], ['Nachlass ' + SuS.zahl(s.rabattProzent, 2) + ' %', '−' + SuS.euro(s.rabatt)]);
    if (s.modus === 'regel') z.push(['Netto', SuS.euro(s.netto)], ['USt ' + SuS.zahl(s.satz, 1) + ' %', SuS.euro(s.mwst)]);
    let html = z.map(([a, b]) => '<div><span>' + a + '</span><span>' + b + '</span></div>').join('') +
      '<div class="gesamt"><span>Gesamt' + (s.modus === 'klein' ? ' (§ 19 UStG)' : s.modus === '13b' ? ' (§ 13b UStG)' : '') + '</span><span>' + SuS.euro(s.brutto) + '</span></div>';
    for (const a of s.abzuege) html += '<div><span>' + (a.brutto < 0 ? 'Rücknahme Abzug ' : 'abzgl. Abschlag ') + e(a.nummer) + '</span><span>' + (a.brutto < 0 ? '+' + SuS.euro(-a.brutto) : '−' + SuS.euro(a.brutto)) + '</span></div>';
    if (s.abzuege.length) html += '<div class="gesamt"><span>Noch zu zahlen</span><span>' + SuS.euro(s.zahlbetrag) + '</span></div>';
    if ((!k || k.art !== 'firma') && s.lohnNetto) html += '<div class="lohn"><span>davon Arbeit/Maschine/Fahrt (§ 35a)</span><span>' + SuS.euro(s.lohnBrutto) + '</span></div>';
    return '<div class="summen">' + html + '</div>';
  }

  function verknuepft(dok) {
    const liste = SuS.daten.dokumente.filter((d) => d.id !== dok.id && (d.vonId === dok.id || d.id === dok.vonId || (dok.vonId && d.vonId === dok.vonId)));
    if (!liste.length) return '';
    return '<h2>Zum selben Auftrag</h2><ul class="liste">' + liste.map((d) => {
      const st = SuS.status(d);
      return '<li><a class="zeile" href="#/dok/' + e(d.id) + '"><div class="haupt"><div class="titel">' + e(SuS.TYPEN[d.typ].name + ' ' + (d.nummer || '(Entwurf)')) + '</div><div class="klein">' + SuS.datum(d.datum) + '</div></div>' +
        '<div class="betrag">' + SuS.euro(SuS.summen(d).zahlbetrag) + '<div style="text-align:right"><span class="chip ' + st.klasse + '">' + st.text + '</span></div></div></a></li>';
    }).join('') + '</ul>';
  }

  function zahlungenKarte(dok) {
    if (!dok.fest || dok.typ === 'storno') return '';
    const z = dok.zahlungen || [];
    if (!z.length && dok.status !== 'bezahlt' && !(dok.mahnungen || []).length) return '';
    return '<div class="karte"><h3>Zahlungen</h3><div class="summen">' +
      z.map((x) => '<div><span>' + SuS.datum(x.datum) + (x.art === 'skonto' ? ' · Skonto' : '') + '</span><span>' + SuS.euro(x.betrag) + '</span></div>').join('') +
      (!z.length && dok.status === 'bezahlt' ? '<div><span>bezahlt am ' + SuS.datum(dok.bezahltAm) + '</span><span>' + SuS.euro(SuS.summen(dok).zahlbetrag) + '</span></div>' : '') +
      (dok.umgebucht ? '<div class="unterzeile">Zahlung umgebucht auf ' + e(dok.umgebucht) + '</div>' : '') +
      (SuS.mahnGebuehren(dok) ? '<div><span>Mahngebühren</span><span>+ ' + SuS.euro(SuS.mahnGebuehren(dok)) + '</span></div>' : '') +
      '<div class="gesamt"><span>Noch offen</span><span>' + SuS.euro(SuS.offenerBetrag(dok)) + '</span></div>' +
      (SuS.ueberzahlung(dok) ? '<div class="lohn"><span>Überzahlung</span><span>' + SuS.euro(SuS.ueberzahlung(dok)) + '</span></div>' : '') +
      (dok.mahnungen || []).map((m) => '<div class="lohn"><span>' + SuS.MAHNSTUFEN[m.stufe - 1] + ' vom ' + SuS.datum(m.datum) + '</span><span>' + (m.gebuehr ? 'Gebühr ' + SuS.euro(m.gebuehr) : '') + '</span></div>').join('') +
      '</div></div>';
  }

  function aktionen(dok) {
    const b = (a, text, klasse) => '<button type="button" class="knopf ' + (klasse || '') + '" data-a="' + a + '">' + text + '</button>';
    const r = [];
    if (dok.typ === 'angebot') {
      if (dok.status === 'entwurf') r.push(b('versendet', 'Als versendet markieren', 'zweit'));
      if (dok.status === 'versendet' || dok.status === 'entwurf') r.push(b('angenommen', 'Auftrag erhalten ✓', 'zweit'));
      if (dok.status === 'versendet') r.push(b('abgelehnt', 'Abgelehnt'));
      if (dok.status === 'versendet' && SuS.nachfassen().includes(dok)) r.push(b('nachgefasst', 'Nachgefasst – in ' + SuS.NACHFASSEN_TAGE + ' Tagen wieder erinnern'));
      if (dok.status === 'angenommen') {
        const rz = SuS.rechnungZu(dok);
        if (rz) r.push('<a class="knopf haupt" href="#/dok/' + e(rz.id) + '">' + e(SuS.TYPEN[rz.typ].name) + ' öffnen</a>');
        else r.push(b('inRechnung', 'In Rechnung umwandeln', 'haupt'), b('abschlag', 'Abschlagsrechnung'));
        r.push(b('auftragDruck', 'Auftragsbestätigung'));
      }
      if (['entwurf', 'versendet'].includes(dok.status) && !SuS.angebotGesperrt(dok)) r.push(b('unterschrift', '✍︎ Vor Ort unterschreiben lassen'));
      if ((dok.status === 'abgelehnt' || dok.status === 'angenommen') && !SuS.folge(dok).length && !dok.unterschrift) r.push(b('wiederOffen', 'Status zurücksetzen'));
      r.push(b('duplizieren', SuS.angebotGesperrt(dok) || dok.unterschrift ? 'Nachtrag (Kopie)' : 'Duplizieren'));
      if (dok.positionen.length) r.push(b('alsVorlage', 'Als Vorlage speichern'));
      if (!SuS.folge(dok).some((x) => x.fest) && !dok.unterschrift) r.push(b('loeschen', 'Löschen', 'gefahr'));
    } else if (!dok.fest) {
      r.push(b('stellen', 'Rechnung stellen', 'haupt'), b('loeschen', 'Entwurf löschen', 'gefahr'));
    } else if (dok.typ !== 'storno' && dok.status !== 'storniert') {
      if (dok.status !== 'bezahlt') {
        r.push(b('bezahlt', 'Zahlung erfassen', 'haupt'));
        const stufe = SuS.mahnstufe(dok);
        if (SuS.faellig(dok) < SuS.heute() && stufe < 3 && SuS.naechsteMahnungAb(dok) <= SuS.heute()) r.push(b('mahnen', SuS.MAHNSTUFEN[stufe] + ' erstellen'));
        if (stufe) r.push(b('mahnungDruck', SuS.MAHNSTUFEN[stufe - 1] + ' erneut drucken'));
        if (dok.typ === 'abschlag' && SuS.bezahltSumme(dok) > 0) r.push(b('abschlagKorrigieren', 'Auf erhaltenen Betrag korrigieren'));
      }
      if ((dok.zahlungen || []).length || dok.status === 'bezahlt') r.push(b('unbezahlt', 'Letzte Zahlung zurücknehmen'));
      if (dok.typ === 'rechnung') r.push(b('wiederholen', 'Als neue Rechnung wiederholen'));
      r.push(b('stornieren', 'Stornieren', 'gefahr'));
    }
    return '<div class="knopfreihe">' + r.join('') + '</div>';
  }

  SuS.seiten.dok = (id) => {
    const dok = SuS.dok(id);
    if (!dok) { location.hash = '#/start'; return; }
    aktuell = dok;
    if (dok.typ === 'schluss' && !dok.fest) {
      const vorher = (dok.abschlaege || []).join();
      SuS.aktualisiereAbzuege(dok);
      if (vorher !== dok.abschlaege.join()) SuS.speichern();
    }
    const typ = SuS.TYPEN[dok.typ], st = SuS.status(dok), fest = gesperrt(dok), k = SuS.kundeVon(dok);
    const zurueck = dok.typ === 'angebot' ? ['#/angebote', 'Angebote'] : ['#/rechnungen', 'Rechnungen'];
    const nrn = SuS.nummeriere(dok.positionen);
    const s = SuS.summen(dok);
    const dis = fest ? ' disabled' : '';
    const datumsfelder = SuS.istRechnung(dok)
      ? '<div class="zwei">' + feld('leistungVon', 'Leistung von', dok.leistungVon, 'date', dis) + feld('leistungBis', 'bis (falls mehrere Tage)', dok.leistungBis, 'date', dis) + '</div>' +
        '<div class="zwei">' + feld('datum', 'Rechnungsdatum', dok.datum, 'date', dis) + feld('zahlungsziel', 'Zahlbar in Tagen', dok.zahlungsziel, 'text', dis + ' inputmode="numeric"') + '</div>'
      : '<div class="zwei">' + feld('datum', 'Angebotsdatum', dok.datum, 'date', dis) + feld('gueltigTage', 'Gültig (Tage)', dok.gueltigTage, 'text', dis + ' inputmode="numeric"') + '</div>';
    SuS.zeige(
      '<button class="zurueck" data-a="zurueck" data-ziel="' + zurueck[0] + '">‹ ' + zurueck[1] + '</button>' +
      '<div class="dokkopf"><div><h1>' + e(typ.name) + '</h1><div class="unterzeile">' + e(dok.nummer || 'Nummer wird beim Stellen vergeben') + ' · ' + SuS.datum(dok.datum) + '</div></div>' +
      '<span class="chip ' + st.klasse + '">' + st.text + '</span></div>' +
      (SuS.veraendert(dok) ? '<div class="hinweis fehler" style="margin-top:12px"><b>Achtung: nachträglich verändert</b>Diese festgeschriebene Rechnung wurde außerhalb der App geändert (z. B. über eine bearbeitete Sicherungsdatei). Bitte mit dem Original-PDF vergleichen.</div>' : '') +
      (dok.fest ? '<div class="gesperrt" style="margin-top:12px">Gestellt am ' + SuS.datum(dok.fest.am.slice(0, 10)) + ' – festgeschrieben und nicht mehr änderbar. Korrekturen über „Stornieren“.' +
        (dok.status === 'bezahlt' ? ' Bezahlt am ' + SuS.datum(dok.bezahltAm) + '.' : '') + '</div>' : '') +
      (dok.typ === 'angebot' && fest ? '<div class="gesperrt" style="margin-top:12px">' + (dok.unterschrift ? 'Vom Kunden unterschrieben' : 'Zu diesem Angebot gibt es gestellte Rechnungen') + ' – es ist deshalb gesperrt. Zusätzliche Arbeiten: „Nachtrag (Kopie)“ anlegen.</div>' : '') +
      (dok.typ === 'angebot' && !fest && dok.status === 'versendet' ? '<div class="hinweis info" style="margin-top:12px">Bereits versendet. Wenn Sie etwas ändern, schicken Sie das Angebot bitte neu.</div>' : '') +
      '<h2>Kunde & Bauvorhaben</h2><div class="karte">' + kundenKarte(dok) + '<div style="height:12px"></div>' +
      '<label class="feld"><span>Baustelle</span><select data-dokfeld="projektId"' + dis + '><option value="">– keine –</option>' +
        SuS.daten.projekte.map((p) => '<option value="' + e(p.id) + '"' + (p.id === dok.projektId ? ' selected' : '') + '>' + e(p.nr + ' · ' + p.titel) + '</option>').join('') + '</select>' +
        (dok.projektId && SuS.projekt(dok.projektId) ? '<small><a href="#/baustelle/' + e(dok.projektId) + '">Zur Baustelle</a></small>' : '') + '</label>' +
      feld('betreff', 'Betreff', dok.betreff, 'text', dis + ' placeholder="z. B. Neue Terrasse hinter dem Haus"') +
      feld('baustelle', 'Bauvorhaben / Baustelle', dok.baustelle, 'text', dis + ' placeholder="Anschrift der Baustelle, falls abweichend"') + datumsfelder + '</div>' +
      '<h2>Positionen</h2><div class="karte">' +
      (dok.positionen.length ? '<ul class="positionen">' + dok.positionen.map((p, i) => positionZeile(dok, p, nrn[i])).join('') + '</ul>'
        : '<p class="unterzeile" style="margin-top:0">Noch keine Positionen. Am schnellsten geht es mit einem Schnellpaket – z. B. „Terrasse pflastern“: Fläche eingeben, fertig.</p>') +
      (fest ? '' : '<div class="hinzu"><button type="button" class="knopf zweit" data-a="paket">⚡ Schnellpaket</button><button type="button" class="knopf zweit" data-a="ausKatalog">+ Aus Leistungen</button>' +
        '<button type="button" class="knopf" data-a="neuePos">+ Freie Position</button><button type="button" class="knopf" data-a="neuerTitel">+ Überschrift</button></div>') +
      '</div>' +
      '<div class="karte">' + summenKarte(dok) + '</div>' +
      '<details class="karte"' + (dok.einleitung || dok.schluss || dok.rabatt ? ' open' : '') + '><summary><b>Texte, Nachlass & Steuer</b></summary><div style="height:12px"></div>' +
      feld('einleitung', 'Einleitungstext (leer = Standardtext)', dok.einleitung, 'textarea', dis) +
      feld('schluss', 'Schlusstext (leer = Standardtext mit Frist/Gültigkeit)', dok.schluss, 'textarea', dis) +
      (dis ? '' : '<div class="knopfreihe eng" style="margin-top:-4px"><button type="button" class="knopf klein" data-a="bausteinWahl">Textbaustein einfügen</button>' +
        '<button type="button" class="knopf klein" data-a="bausteinMerken">Text als Baustein merken</button></div>') +
      feld('rabatt', 'Nachlass in %', dok.rabatt ? SuS.zahl(dok.rabatt, 2) : '', 'text', dis + ' inputmode="decimal" placeholder="0"') +
      (['rechnung', 'schluss'].includes(dok.typ) ? '<div class="zwei">' + feld('skontoProzent', 'Skonto in % (leer = keins)', dok.skonto ? SuS.zahl(dok.skonto.prozent, 2) : '', 'text', dis + ' inputmode="decimal" placeholder="0"') +
        feld('skontoTage', 'Skonto innerhalb Tagen', dok.skonto ? dok.skonto.tage : SuS.daten.firma.skontoTage, 'text', dis + ' inputmode="numeric"') + '</div>' : '') +
      (k && k.art === 'firma' && !SuS.daten.firma.kleinunternehmer ? '<label class="schalter"><input type="checkbox" data-dokfeld="r13b"' + (dok.r13b ? ' checked' : '') + dis +
        '><span><b>§ 13b – Kunde schuldet die Umsatzsteuer</b><small>Nur bei Bauleistungen an Firmen, die selbst nachhaltig Bauleistungen erbringen (z. B. als Subunternehmer für eine Baufirma). Im Zweifel Steuerberater fragen.</small></span></label>' : '') +
      '</details>' +
      zahlungenKarte(dok) + (dok.unterschrift ? '<div class="karte"><h3>Unterschrift</h3><img src="' + e(dok.unterschrift.bild) + '" alt="Unterschrift" style="max-width:100%;height:90px;object-fit:contain;background:#fff;border-radius:8px">' +
        '<div class="unterzeile">' + e(dok.unterschrift.name) + ', ' + SuS.datum(dok.unterschrift.datum) + '</div></div>' : '') +
      '<h2>Weiter</h2>' + aktionen(dok) + verknuepft(dok) +
      '<div class="aktionsleiste"><div class="summe"><small>' + (s.abzuege.length ? 'Noch zu zahlen' : s.modus === 'regel' ? 'Gesamt inkl. USt' : 'Gesamt') + '</small><b>' + SuS.euro(s.zahlbetrag) + '</b></div>' +
      '<button type="button" class="knopf haupt" data-a="vorschau">Vorschau & PDF</button></div>', true);
  };

  /* Textbausteine für Einleitung und Schluss (z. B. „Pflege – Angebot“, „Zahlung in bar“) */
  A.bausteinWahl = () => {
    const liste = SuS.daten.bausteine;
    if (!liste.length) { SuS.melde('Noch keine Bausteine. Einen Text eintippen und „Text als Baustein merken“.', true); return; }
    SuS.blatt('Textbaustein', '<ul class="liste">' + liste.map((b) => '<li><button type="button" class="zeile" data-a="bausteinEinfuegen" data-id="' + e(b.id) + '"><div class="haupt"><div class="titel">' + e(b.name) +
      '</div><div class="klein">' + (b.feld === 'schluss' ? 'Schlusstext' : 'Einleitung') + ' · ' + e(b.text.slice(0, 80)) + '</div></div></button></li>').join('') + '</ul>' +
      '<p class="unterzeile">Löschen: Baustein lange behalten ist kein Problem; zum Entfernen „Baustein löschen“ unten.</p>' +
      '<details><summary class="unterzeile">Baustein löschen</summary>' + liste.map((b) => '<button type="button" class="knopf gefahr klein" style="margin:4px 4px 0 0" data-a="bausteinLoeschen" data-id="' + e(b.id) + '">' + e(b.name) + '</button>').join('') + '</details>');
  };
  A.bausteinEinfuegen = (el) => {
    const b = SuS.daten.bausteine.find((x) => x.id === el.dataset.id);
    if (!b || !aktuell || gesperrt(aktuell)) return;
    aktuell[b.feld] = aktuell[b.feld] ? aktuell[b.feld] + '\n\n' + b.text : b.text;
    gespeichert(aktuell); SuS.blattZu(); neu();
  };
  A.bausteinLoeschen = (el) => {
    if (!SuS.sicher(el)) return;
    SuS.daten.bausteine = SuS.daten.bausteine.filter((x) => x.id !== el.dataset.id);
    SuS.speichern(); SuS.blattZu(); SuS.melde('Baustein gelöscht.');
  };
  A.bausteinMerken = () => {
    if (!aktuell) return;
    const opt = [['einleitung', 'Einleitungstext'], ['schluss', 'Schlusstext']].filter(([f]) => String(aktuell[f] || '').trim());
    if (!opt.length) { SuS.melde('Erst einen Einleitungs- oder Schlusstext eintippen.', true); return; }
    SuS.blatt('Als Baustein merken', SuS.feld('feld', 'Welcher Text?', opt[0][0], { typ: 'select', optionen: opt }) + SuS.feld('name', 'Name des Bausteins', '', { auto: true, platz: 'z. B. Pflege – Einleitung' }), (fd) => {
      const f = String(fd.get('feld')), name = String(fd.get('name') || '').trim();
      if (!name) { SuS.melde('Bitte einen Namen eingeben.', true); return false; }
      SuS.daten.bausteine.push({ id: SuS.id(), feld: f === 'schluss' ? 'schluss' : 'einleitung', name: name.slice(0, 60), text: String(aktuell[f]).slice(0, 4000) });
      SuS.speichern(); SuS.melde('Baustein gemerkt.'); return true;
    }, 'Merken');
  };

  function feld(name, beschriftung, wert, typ, attr) {
    const a = ' data-dokfeld="' + name + '"' + (attr || '');
    const ein = typ === 'textarea' ? '<textarea' + a + '>' + e(wert) + '</textarea>' : '<input type="' + typ + '" value="' + e(wert == null ? '' : wert) + '"' + a + '>';
    return '<label class="feld"><span>' + e(beschriftung) + '</span>' + ein + '</label>';
  }

  /* Felder im Editor speichern beim Verlassen (change). */
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-dokfeld]');
    if (!el || !aktuell || gesperrt(aktuell)) return;
    const f = el.dataset.dokfeld, d = aktuell;
    if (f === 'r13b') d.r13b = el.checked;
    else if (f === 'rabatt') { const n = SuS.leseZahl(el.value || '0'); d.rabatt = Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : 0; }
    else if (f === 'zahlungsziel' || f === 'gueltigTage') { const n = parseInt(el.value, 10); d[f] = n >= 0 && n < 1000 ? n : d[f]; }
    else if (f === 'skontoProzent' || f === 'skontoTage') {
      const form = el.closest('details') || document, p = SuS.leseZahl((form.querySelector('[data-dokfeld=skontoProzent]') || {}).value || '0');
      const t = parseInt((form.querySelector('[data-dokfeld=skontoTage]') || {}).value, 10);
      if (Number.isFinite(p) && p > 0 && p <= 10) d.skonto = { prozent: Math.round(p * 100) / 100, tage: t >= 1 && t <= 90 ? t : SuS.daten.firma.skontoTage };
      else delete d.skonto;
    }
    else if (f === 'datum') d.datum = el.value || SuS.heute();
    else if (f === 'projektId') {
      d.projektId = el.value;
      const p = SuS.projekt(el.value);
      if (p && !d.baustelle) d.baustelle = p.adresse;
      if (p && !d.kundeId && p.kundeId) d.kundeId = p.kundeId;
    }
    else d[f] = el.value;
    if (f === 'leistungVon' && d.leistungBis && d.leistungBis < d.leistungVon) d.leistungBis = '';
    gespeichert(d);
    if (['rabatt', 'r13b', 'datum', 'gueltigTage', 'zahlungsziel', 'projektId', 'skontoProzent'].includes(f)) neu();
  });

  /* Texteingaben schon beim Tippen sichern (sonst gehen sie verloren, wenn die App ohne Verlassen des Feldes geschlossen
     wird – Fund von Cursor). Kein Neuzeichnen, damit der Cursor im Feld bleibt. */
  let tippUhr = null;
  document.addEventListener('input', (ev) => {
    const el = ev.target.closest('[data-dokfeld]');
    if (!el || !aktuell || gesperrt(aktuell) || !['betreff', 'baustelle', 'einleitung', 'schluss'].includes(el.dataset.dokfeld)) return;
    aktuell[el.dataset.dokfeld] = el.value;
    clearTimeout(tippUhr);
    tippUhr = setTimeout(() => { if (!(SuS.gesperrt && SuS.gesperrt())) gespeichert(aktuell); }, 400);
  });
  window.addEventListener('pagehide', () => { if (tippUhr) { clearTimeout(tippUhr); SuS.speichern(); } });

  function neu() {
    const y = window.scrollY;
    SuS.neuZeichnen();
    window.scrollTo(0, y);
  }

  /* ---------- Kunde wählen ---------- */

  A.kundeWaehlen = () => {
    const d = aktuell;
    const form = SuS.blatt('Kunde wählen', '<input class="suche" type="search" placeholder="Name oder Ort" data-kundensuche autofocus>' +
      '<button type="button" class="knopf zweit breit" data-a="kundeNeuFuerDok" style="margin-bottom:12px">+ Neuer Kunde</button><ul class="liste" data-kundenliste></ul>');
    const liste = form.querySelector('[data-kundenliste]');
    const zeichne = (q) => {
      const kunden = SuS.daten.kunden.filter((k) => !q || (k.name + ' ' + k.ort).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.name.localeCompare(b.name, 'de'));
      liste.innerHTML = kunden.length ? kunden.map((k) => '<li><button type="button" class="zeile" data-a="kundeSetzen" data-id="' + e(k.id) + '"><div class="haupt"><div class="titel">' + e(k.name) +
        '</div><div class="klein">' + e([k.strasse, k.ort].filter(Boolean).join(', ')) + '</div></div>' + (k.id === d.kundeId ? '✓' : '') + '</button></li>').join('')
        : '<li class="leer">' + (q ? 'Kein Treffer.' : 'Noch keine Kunden.') + '</li>';
    };
    zeichne('');
    form.querySelector('[data-kundensuche]').addEventListener('input', (ev) => zeichne(ev.target.value));
  };
  function setzeKunde(k) {
    const d = aktuell;
    d.kundeId = k.id;
    if (k.art !== 'firma') d.r13b = false;
    if (!d.baustelle && k.strasse) d.baustelle = [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ');
    gespeichert(d); neu();
  }
  A.kundeSetzen = (el) => { setzeKunde(SuS.kunde(el.dataset.id)); SuS.blattZu(); };
  A.kundeNeuFuerDok = () => { SuS.blattZu(); setTimeout(() => SuS.kundenFormular(null, setzeKunde), 0); };

  /* ---------- Positionen ---------- */

  /* Positionsblatt. istNeu: Position wird erst beim Sichern eingefügt. */
  function positionsBlatt(p, istNeu) {
    const d = aktuell, fest = gesperrt(d);
    if (p.typ !== 'pos') {
      SuS.blatt(p.typ === 'titel' ? 'Überschrift' : 'Hinweistext',
        SuS.feld('text', p.typ === 'titel' ? 'Überschrift (z. B. Terrasse, Vorgarten)' : 'Text', p.text, { auto: true, typ: p.typ === 'text' ? 'textarea' : 'text' }) +
        (istNeu ? '' : bewegen(p)), fest ? null : (fd) => {
          p.text = String(fd.get('text') || '').trim();
          if (!p.text) { SuS.melde('Bitte einen Text eintragen.', true); return false; }
          if (istNeu) d.positionen.push(p);
          gespeichert(d); neu(); return true;
        }, 'Sichern');
      return;
    }
    const mengeText = p.formel || (p.menge != null && p.menge !== '' ? SuS.zahlFeld(p.menge) : '');
    const form = SuS.blatt(istNeu ? 'Position hinzufügen' : 'Position',
      SuS.feld('text', 'Bezeichnung', p.text, { auto: istNeu && !p.text }) +
      SuS.feld('beschreibung', 'Beschreibung', p.beschreibung, { typ: 'textarea' }) +
      '<div class="zwei">' + SuS.feld('menge', 'Menge', mengeText, { dezimal: false, platz: 'z. B. 24 oder 4,5*5,3', auto: istNeu && !!p.text,
        hilfe: 'Rechnen erlaubt: 4,5*5,3 + 2' }) + SuS.feld('einheit', 'Einheit', p.einheit, { liste: 'einheiten' }) + '</div>' + SuS.einheitenListe() +
      SuS.feld('preis', 'Einzelpreis netto (€)', p.preis ? SuS.centText(p.preis) : '', { dezimal: true, platz: '0,00' }) +
      '<div class="vorschau-betrag"><span>Gesamt netto</span><span data-gp>–</span></div>' +
      SuS.artFelder(p.art, p.lohnanteil) +
      (d.typ === 'angebot' ? '<label class="schalter"><input type="checkbox" name="bedarf"' + (p.bedarf ? ' checked' : '') + '><span><b>Bedarfsposition</b><small>Wird mit Preis angeboten, aber nicht mitgerechnet – nur falls nötig.</small></span></label>' : '') +
      (!fest && !p.leistungId ? '<label class="schalter"><input type="checkbox" name="merken"><span><b>Als Leistung merken</b><small>Mit diesem Preis in „Leistungen & Preise“ übernehmen.</small></span></label>' : '') +
      (istNeu ? '' : bewegen(p)),
      fest ? null : (fd) => {
        const text = String(fd.get('text') || '').trim();
        const mengeEin = String(fd.get('menge') || '').trim();
        const menge = mengeEin === '' ? 0 : SuS.rechne(mengeEin);
        const preis = String(fd.get('preis') || '').trim() === '' ? 0 : SuS.leseCent(fd.get('preis'));
        if (!text) { SuS.melde('Bitte eine Bezeichnung eintragen.', true); return false; }
        if (!Number.isFinite(menge)) { SuS.melde('Menge nicht verstanden. Beispiele: 12 · 12,5 · 4,5*3', true); return false; }
        if (!Number.isFinite(preis)) { SuS.melde('Preis bitte als Zahl, z. B. 45,50.', true); return false; }
        Object.assign(p, {
          text, beschreibung: String(fd.get('beschreibung') || '').trim(), menge, einheit: String(fd.get('einheit') || '').trim(),
          preis, art: String(fd.get('art')), bedarf: fd.get('bedarf') === 'on',
          formel: /[*/+()]/.test(mengeEin.replace(/^-/, '')) ? mengeEin : ''
        });
        const la = SuS.leseZahl(fd.get('lohnanteil'));
        p.lohnanteil = p.art === 'gemischt' && Number.isFinite(la) ? Math.min(100, Math.max(0, la)) : null;
        if (fd.get('merken') === 'on') {
          SuS.daten.leistungen.push({ id: SuS.id(), gruppe: 'Eigene', text: p.text, beschreibung: p.beschreibung, einheit: p.einheit, preis: p.preis, art: p.art, lohnanteil: p.lohnanteil });
          SuS.melde('Als Leistung gemerkt.');
        }
        if (istNeu) d.positionen.push(p);
        gespeichert(d); neu(); return true;
      }, istNeu ? 'Hinzufügen' : 'Sichern');
    SuS.artUmschalter(form);
    const gp = form.querySelector('[data-gp]');
    const rechne = () => {
      const m = SuS.rechne(form.querySelector('[name=menge]').value || '0');
      const pr = SuS.leseCent(form.querySelector('[name=preis]').value || '0');
      gp.textContent = Number.isFinite(m) && Number.isFinite(pr) ? (/[*/+()]/.test(form.querySelector('[name=menge]').value) ? SuS.zahl(m) + ' ' + (form.querySelector('[name=einheit]').value || '') + ' · ' : '') + SuS.euro(Math.round(m * pr)) : 'Eingabe prüfen';
    };
    form.addEventListener('input', rechne); rechne();
    if (fest) form.querySelectorAll('input, textarea, select').forEach((x) => { x.disabled = true; });
  }

  function bewegen(p) {
    if (gesperrt(aktuell)) return '';
    return '<div class="knopfreihe"><button type="button" class="knopf klein" data-a="posHoch" data-id="' + e(p.id) + '">↑ Nach oben</button>' +
      '<button type="button" class="knopf klein" data-a="posRunter" data-id="' + e(p.id) + '">↓ Nach unten</button>' +
      '<button type="button" class="knopf klein" data-a="posKopie" data-id="' + e(p.id) + '">Duplizieren</button>' +
      '<button type="button" class="knopf klein gefahr" data-a="posLoeschen" data-id="' + e(p.id) + '">Entfernen</button></div>';
  }

  A.posBearbeiten = (el) => { const p = aktuell.positionen.find((x) => x.id === el.dataset.id); if (p) positionsBlatt(p, false); };
  A.neuePos = () => positionsBlatt({ id: SuS.id(), typ: 'pos', text: '', beschreibung: '', menge: 1, einheit: 'Std', preis: 0, art: 'lohn', lohnanteil: null }, true);
  A.neuerTitel = () => positionsBlatt({ id: SuS.id(), typ: 'titel', text: '' }, true);
  const verschiebe = (id, um) => {
    const l = aktuell.positionen, i = l.findIndex((x) => x.id === id), j = i + um;
    if (i < 0 || j < 0 || j >= l.length) return;
    [l[i], l[j]] = [l[j], l[i]];
    gespeichert(aktuell); SuS.blattZu(); neu();
  };
  A.posHoch = (el) => verschiebe(el.dataset.id, -1);
  A.posRunter = (el) => verschiebe(el.dataset.id, 1);
  A.posKopie = (el) => {
    const l = aktuell.positionen, i = l.findIndex((x) => x.id === el.dataset.id);
    if (i < 0) return;
    l.splice(i + 1, 0, Object.assign({}, l[i], { id: SuS.id() }));
    gespeichert(aktuell); SuS.blattZu(); neu(); SuS.melde('Dupliziert.');
  };
  A.posLoeschen = (el) => {
    if (!SuS.sicher(el)) return;
    aktuell.positionen = aktuell.positionen.filter((x) => x.id !== el.dataset.id);
    gespeichert(aktuell); SuS.blattZu(); neu();
  };

  A.ausKatalog = () => {
    const form = SuS.blatt('Aus Leistungen', '<input class="suche" type="search" placeholder="Suchen: Pflaster, Rasen, Hecke …" data-katsuche autofocus><div data-katliste></div>');
    const ziel = form.querySelector('[data-katliste]');
    const zeichne = (q) => {
      const treffer = SuS.daten.leistungen.filter((l) => !q || (l.text + ' ' + l.beschreibung + ' ' + l.gruppe).toLowerCase().includes(q.toLowerCase()));
      const gruppen = {};
      treffer.forEach((l) => { (gruppen[l.gruppe] = gruppen[l.gruppe] || []).push(l); });
      ziel.innerHTML = Object.keys(gruppen).map((g) => '<h3 style="margin:14px 0 6px">' + e(g) + '</h3><ul class="liste">' + gruppen[g].map((l) =>
        '<li><button type="button" class="zeile" data-a="katWahl" data-id="' + e(l.id) + '"><div class="haupt"><div class="titel">' + e(l.text) + '</div><div class="klein">' + e(l.beschreibung) + '</div></div>' +
        '<div class="betrag">' + SuS.euro(l.preis) + '<div class="klein" style="font-weight:400">je ' + e(l.einheit) + '</div></div></button></li>').join('') + '</ul>').join('') ||
        '<p class="leer">Nichts gefunden. Tipp: „Freie Position“ nutzen.</p>';
    };
    zeichne('');
    form.querySelector('[data-katsuche]').addEventListener('input', (ev) => zeichne(ev.target.value));
  };
  A.katWahl = (el) => {
    const l = SuS.leistung(el.dataset.id);
    SuS.blattZu();
    setTimeout(() => positionsBlatt({ id: SuS.id(), typ: 'pos', text: l.text, beschreibung: l.beschreibung, einheit: l.einheit, menge: '', preis: l.preis, art: l.art, lohnanteil: l.lohnanteil, leistungId: l.id }, true), 0);
  };

  A.alsVorlage = () => {
    const d = aktuell;
    SuS.blatt('Als Vorlage speichern', SuS.feld('name', 'Name der Vorlage', d.betreff || '', { auto: true, platz: 'z. B. Terrasse 20 m² mit Rasen' }) +
      '<p class="unterzeile">Alle Positionen werden als eigenes Schnellpaket gespeichert und stehen in jedem neuen Angebot unter „Schnellpaket“.</p>', (fd) => {
      const v = SuS.vorlageSpeichern(d, String(fd.get('name') || ''));
      SuS.speichern(); SuS.melde('Vorlage „' + v.name + '“ gespeichert.'); return true;
    }, 'Speichern');
  };
  A.vorlageEinfuegen = (el) => {
    const v = (SuS.daten.vorlagen || []).find((x) => x.id === el.dataset.id);
    if (!v) return;
    aktuell.positionen.push(...SuS.kopierePositionen(v.positionen));
    gespeichert(aktuell); SuS.blattZu(); neu(); SuS.melde('Vorlage eingefügt – Mengen prüfen.');
  };
  A.vorlageLoeschen = (el) => {
    if (!SuS.sicher(el)) return;
    SuS.daten.vorlagen = (SuS.daten.vorlagen || []).filter((x) => x.id !== el.dataset.id);
    SuS.speichern(); SuS.blattZu(); A.paket();
  };
  A.paket = () => {
    const eigene = SuS.daten.vorlagen || [];
    SuS.blatt('Schnellpaket', '<p class="unterzeile" style="margin-top:0">Ein paar Maße eingeben – die passenden Positionen mit Ihren Preisen werden eingefügt. Danach können Sie alles anpassen.</p>' +
      (eigene.length ? '<h3 style="margin:6px 0">Eigene Vorlagen</h3><ul class="liste" style="margin-bottom:12px">' + eigene.map((v) => '<li><div class="zeile"><button type="button" class="haupt" style="background:none;border:0;text-align:left;cursor:pointer" data-a="vorlageEinfuegen" data-id="' + e(v.id) + '"><div class="titel">' + e(v.name) +
        '</div><div class="klein">' + v.positionen.filter((p) => p.typ === 'pos').length + ' Positionen</div></button><button type="button" class="knopf klein gefahr" data-a="vorlageLoeschen" data-id="' + e(v.id) + '">Löschen</button></div></li>').join('') + '</ul><h3 style="margin:6px 0">Mitgelieferte Pakete</h3>' : '') +
      '<ul class="liste">' + SuS.katalog.pakete.map((p, i) => '<li><button type="button" class="zeile" data-a="paketWahl" data-i="' + i + '"><div class="haupt"><div class="titel">' + e(p.name) +
      '</div><div class="klein">' + p.positionen.length + ' Positionen · fragt nach ' + p.fragen.map((f) => f.text).join(' und ') + '</div></div><span>›</span></button></li>').join('') + '</ul>');
  };
  A.paketWahl = (el) => {
    const paket = SuS.katalog.pakete[Number(el.dataset.i)];
    SuS.blattZu();
    setTimeout(() => {
      SuS.blatt(paket.name, paket.fragen.map((f, i) => SuS.feld(f.k, f.text + ' (' + f.einheit + ')', '', { dezimal: false, auto: i === 0, platz: f.k === 'A' ? 'z. B. 24 oder 6*4' : 'z. B. 14', hilfe: f.k === 'A' ? 'Rechnen erlaubt, z. B. 6*4 + 2,5*2' : '' })).join('') +
        '<div class="hinweis info">Mengen wie Aushub (Fläche × 0,3 m) und Verschnitt (+5 %) werden geschätzt – bitte kurz prüfen.</div>',
      (fd) => {
        const werte = {};
        for (const f of paket.fragen) {
          const w = SuS.rechne(String(fd.get(f.k) || ''));
          if (!Number.isFinite(w) || w < 0) { SuS.melde('Bitte ' + f.text + ' als Zahl eingeben.', true); return false; }
          werte[f.k] = w;
        }
        const erg = SuS.katalog.paketPositionen(paket, werte);
        aktuell.positionen.push(...erg.positionen);
        gespeichert(aktuell); neu();
        SuS.melde(erg.fehlt.length ? 'Eingefügt. Nicht im Katalog: ' + erg.fehlt.join(', ') : (erg.positionen.length - 1) + ' Positionen eingefügt.', !!erg.fehlt.length);
        return true;
      }, 'Einfügen');
    }, 0);
  };

  /* ---------- Abläufe ---------- */

  A.vorschau = () => SuS.zeigeDruck(aktuell, '');
  A.auftragDruck = () => SuS.zeigeDruck(aktuell, 'auftrag');
  A.erinnerung = () => SuS.zeigeDruck(aktuell, 'erinnerung');
  const status = (s, text) => () => { aktuell.status = s; gespeichert(aktuell); neu(); SuS.melde(text); };
  A.versendet = status('versendet', 'Als versendet markiert.');
  A.nachgefasst = () => { if (!aktuell) return; aktuell.nachgefasst = SuS.heute(); gespeichert(aktuell); SuS.melde('Gemerkt – Erinnerung in ' + SuS.NACHFASSEN_TAGE + ' Tagen.'); neu(); };
  A.angenommen = status('angenommen', 'Auftrag erhalten – jetzt Rechnung oder Abschlag erstellen.');
  A.abgelehnt = status('abgelehnt', 'Als abgelehnt markiert.');
  A.wiederOffen = status('versendet', 'Status zurückgesetzt.');

  A.duplizieren = async () => {
    const q = aktuell, marke = SuS.navMarke();
    let n = null;
    if (!(await SuS.transaktionSicher(() => {  // Nummer gilt erst nach bestätigter Ablage (Fund Cursor R9)
      n = SuS.neuesDokument('angebot', q.kundeId);
      Object.assign(n, { betreff: q.betreff, baustelle: q.baustelle, einleitung: q.einleitung, schluss: q.schluss, rabatt: q.rabatt, r13b: q.r13b, projektId: q.projektId || '', positionen: SuS.kopierePositionen(q.positionen), geaendert: new Date().toISOString() });
    }))) { SuS.melde('Speichern fehlgeschlagen – keine Kopie angelegt.', true); frisch(q.id); neu(); return; }
    SuS.melde('Kopie angelegt: ' + n.nummer); SuS.gehZu('#/dok/' + n.id, marke);
  };

  /* Wiederkehrende Arbeiten (z. B. monatliche Gartenpflege): gleiche Positionen als neuer Rechnungsentwurf. */
  A.wiederholen = async () => {
    const q = aktuell, marke = SuS.navMarke();
    let n = null;
    if (!(await SuS.transaktionSicher(() => {
      n = SuS.neuesDokument('rechnung', q.kundeId);
      Object.assign(n, { betreff: q.betreff, baustelle: q.baustelle, einleitung: q.einleitung, schluss: q.schluss, rabatt: q.rabatt, r13b: q.r13b,
        projektId: q.projektId || '', positionen: SuS.kopierePositionen(q.positionen), leistungVon: SuS.heute(), geaendert: new Date().toISOString() });
    }))) { SuS.melde('Speichern fehlgeschlagen – kein Entwurf angelegt.', true); frisch(q.id); neu(); return; }
    SuS.melde('Neuer Entwurf mit denselben Positionen – Leistungsdatum und Mengen prüfen.'); SuS.gehZu('#/dok/' + n.id, marke);
  };

  A.loeschen = async (el) => {
    const d = aktuell;
    if (d.fest) return;
    if (SuS.daten.dokumente.some((x) => x.vonId === d.id && x.fest)) { SuS.melde('Zu diesem Angebot gibt es gestellte Rechnungen – es bleibt erhalten.', true); return; }
    if (d.unterschrift) { SuS.melde('Dieses Angebot ist vom Kunden unterschrieben und bleibt erhalten.', true); return; }
    if (!SuS.sicher(el)) return;
    let hinweis = '';
    const marke = SuS.navMarke();
    if (!(await SuS.transaktionSicher(() => { SuS.daten.dokumente = SuS.daten.dokumente.filter((x) => x.id !== d.id); hinweis = SuS.vertragsEntwurfGeloescht(d); }))) {
      SuS.melde('Speichern fehlgeschlagen – nichts gelöscht.', true); frisch(d.id); neu(); return;  // Fund Cursor R8
    }
    SuS.melde(hinweis ? 'Gelöscht. ' + hinweis : 'Gelöscht.', hinweis.startsWith('Achtung'));
    SuS.gehZu(d.typ === 'angebot' ? '#/angebote' : '#/rechnungen', marke);
  };

  A.inRechnung = async () => {
    const vorhanden = SuS.rechnungZu(aktuell);
    if (vorhanden) { location.hash = '#/dok/' + vorhanden.id; return; }
    const st = SuS.abschlagStand(aktuell);
    if (st.entwuerfe.length) { SuS.melde('Es gibt noch einen nicht gestellten Abschlag. Bitte zuerst stellen oder löschen.', true); location.hash = '#/dok/' + st.entwuerfe[0].id; return; }
    const id = aktuell.id, marke = SuS.navMarke();
    let r = null;
    if (!(await SuS.transaktionSicher(() => { r = SuS.rechnungAus(SuS.dok(id)); r.leistungVon = SuS.heute(); r.geaendert = new Date().toISOString(); }))) {
      SuS.melde('Speichern fehlgeschlagen – keine Rechnung angelegt.', true); frisch(id); neu(); return;  // Funde Codex/Cursor R13
    }
    SuS.melde(r.typ === 'schluss' ? 'Schlussrechnung angelegt – Abschläge werden abgezogen.' : 'Rechnung angelegt. Mengen nach Aufmaß prüfen, dann „Rechnung stellen“.');
    SuS.gehZu('#/dok/' + r.id, marke);
  };

  A.abschlag = () => {
    const a = aktuell, s = SuS.summen(a), st = SuS.abschlagStand(a);
    if (SuS.rechnungZu(a)) { SuS.melde('Es gibt schon eine (Schluss-)Rechnung zu diesem Auftrag.', true); return; }
    const rest = s.netto - st.netto;
    const form = SuS.blatt('Abschlagsrechnung', '<p class="unterzeile" style="margin-top:0">Auftragssumme ' + SuS.euro(s.netto) + ' netto' +
      (st.netto ? ' · bereits abgerechnet ' + SuS.euro(st.netto) + ' · offen ' + SuS.euro(rest) : '') + '.</p>' +
      (st.entwuerfe.length ? '<div class="hinweis">Es gibt bereits einen nicht gestellten Abschlag – bitte nicht doppelt abrechnen.</div>' : '') +
      '<div class="segment" data-segment="weise"><button type="button" data-wert="p" class="an">Prozent</button><button type="button" data-wert="b">Betrag</button></div>' +
      SuS.feld('wert', 'Abschlag in %', '30', { dezimal: true, auto: true, id: 'abWert' }) +
      '<input type="hidden" name="weise" value="p"><div class="vorschau-betrag"><span>Abschlag netto</span><span data-ab>–</span></div>',
      async (fd) => {
        const w = SuS.leseZahl(fd.get('wert'));
        if (!Number.isFinite(w) || w <= 0) { SuS.melde('Bitte einen Wert eingeben.', true); return false; }
        const betrag = fd.get('weise') === 'p' ? Math.round(s.netto * Math.min(w, 100) / 100) : Math.round(w * 100);
        if (betrag > rest) { SuS.melde('Mehr als die offene Auftragssumme (' + SuS.euro(rest) + ') geht nicht.', true); return false; }
        let r = null;
        const id = a.id, marke = SuS.navMarke();
        if (!(await SuS.transaktionSicher(() => {  // kein doppelter Entwurf bei Fehlschlag (Fund Codex R13)
          const auftrag = SuS.dok(id);
          r = fd.get('weise') === 'p' ? SuS.abschlagAus(auftrag, Math.min(w, 100), null) : SuS.abschlagAus(auftrag, 0, Math.round(w * 100));
          r.leistungVon = SuS.heute(); r.geaendert = new Date().toISOString();
        }))) { frisch(id); SuS.melde('Speichern fehlgeschlagen.', true); return false; }
        SuS.gehZu('#/dok/' + r.id, marke);
        return true;
      }, 'Erstellen');
    const zeige = () => {
      const w = SuS.leseZahl(form.querySelector('[name=wert]').value), p = form.querySelector('[name=weise]').value === 'p';
      form.querySelector('[data-ab]').textContent = Number.isFinite(w) ? SuS.euro(p ? Math.round(s.netto * Math.min(w, 100) / 100) : Math.round(w * 100)) : '–';
    };
    form.addEventListener('input', zeige); zeige();
    form.querySelector('[data-segment=weise]').addEventListener('click', (ev) => {
      const b = ev.target.closest('button[data-wert]'); if (!b) return;
      form.querySelectorAll('[data-segment=weise] button').forEach((x) => x.classList.toggle('an', x === b));
      form.querySelector('[name=weise]').value = b.dataset.wert;
      form.querySelector('#abWert span').textContent = b.dataset.wert === 'p' ? 'Abschlag in %' : 'Abschlag netto in €';
      zeige();
    });
  };

  A.stellen = () => {
    const d = aktuell, fehlt = SuS.pruefeRechnung(d);
    if (fehlt.length) {
      SuS.blatt('Noch nicht vollständig', '<div class="hinweis fehler"><b>Für eine gültige Rechnung fehlt noch:</b><ul>' + fehlt.map((x) => '<li>' + e(x) + '</li>').join('') + '</ul></div>' +
        '<p class="unterzeile">Sie können die Vorschau trotzdem jederzeit ansehen – dort ist Fehlendes rot markiert.</p>' +
        '<div class="knopfreihe"><a class="knopf" href="#/firma" data-a="blattZu">Firmendaten</a><button type="button" class="knopf" data-a="blattZu">Zurück</button></div>');
      return;
    }
    SuS.aktualisiereAbzuege(d);
    const s = SuS.summen(d);
    const offenAufwand = d.projektId ? SuS.offenerAufwand(d.projektId).length : 0;
    SuS.blatt('Rechnung stellen?', '<div class="vorschau-betrag"><span>' + e(SuS.kundeVon(d).name) + '</span><span>' + SuS.euro(s.zahlbetrag) + '</span></div>' +
      (offenAufwand ? '<div class="hinweis"><b>' + offenAufwand + ' Einträge Stunden/Material dieser Baustelle sind nicht abgerechnet.</b>Sollen sie in diese Rechnung? Dann zuerst in der Baustelle „In Rechnung übernehmen“. Sind sie schon von Hand enthalten, bitte dort löschen, damit nichts doppelt berechnet wird.</div>' : '') +
      '<p>Die Rechnung bekommt jetzt ihre fortlaufende Nummer und wird <b>festgeschrieben</b>: danach nicht mehr änderbar (Korrektur nur per Storno).</p>' +
      '<button type="submit" class="knopf haupt breit">Rechnung stellen und Vorschau öffnen</button>', async () => {
      const id = d.id, marke = SuS.navMarke();
      /* Abschläge zusammen nie über der Auftragssumme – auch wenn der Entwurf nachträglich geändert wurde (Prüfrunde 2). */
      if (d.typ === 'abschlag' && d.vonId && SuS.dok(d.vonId)) {
        const auftrag = SuS.dok(d.vonId), gesamt = SuS.summen(auftrag).netto, bisher = SuS.abschlagStand(auftrag).netto, dieser = SuS.summen(d).netto;
        if (bisher + dieser > gesamt) {
          SuS.melde('Abschläge zusammen (' + SuS.euro(bisher + dieser) + ') wären höher als die Auftragssumme (' + SuS.euro(gesamt) + '). Bitte Betrag anpassen.', true);
          return true;
        }
      }
      if (!(await SuS.transaktionSicher(() => { const x = SuS.dok(id); SuS.festschreiben(x); x.geaendert = new Date().toISOString(); }))) {
        SuS.melde('Speichern fehlgeschlagen – die Rechnung wurde NICHT gestellt. Bitte Datensicherung erstellen und Speicher prüfen.', true);
        frisch(id); neu(); return true;
      }
      neu();
      const neuDok = SuS.dok(id);
      SuS.melde('Rechnung ' + neuDok.nummer + ' gestellt.');
      if (marke === SuS.navMarke()) setTimeout(() => SuS.zeigeDruck(neuDok, ''), 50);  // nicht über eine andere Seite (Fund Cursor R13)
      return true;
    }, 'Stellen');
  };

  A.bezahlt = () => {
    const d = aktuell, offen = SuS.offenerBetrag(d), sk = SuS.skonto(d);
    const skMoeglich = sk && !SuS.skontoGenutzt(d) && offen - SuS.mahnGebuehren(d) > sk.betrag;
    SuS.blatt('Zahlung erfassen', '<div class="vorschau-betrag"><span>Noch offen</span><span>' + SuS.euro(offen) + '</span></div>' +
      SuS.feld('betrag', 'Erhaltener Betrag (€)', SuS.centText(offen), { dezimal: true, auto: true, hilfe: 'Weniger eintragen, wenn nur ein Teil bezahlt wurde.' }) +
      SuS.feld('am', 'Zahlungseingang am', SuS.heute(), { typ: 'date' }) +
      (skMoeglich ? '<label class="schalter"><input type="checkbox" name="skonto" data-skonto-betrag="' + SuS.centText(offen - sk.betrag) + '" data-voll="' + SuS.centText(offen) + '"><span><b>Mit Skonto bezahlt</b><small>' +
        SuS.zahl(sk.prozent, 2).replace(/,00$/, '') + ' % = ' + SuS.euro(sk.betrag) + ' abgezogen, Frist bis ' + SuS.datum(sk.bis) + (SuS.heute() > sk.bis ? ' – <b>abgelaufen</b>' : '') + '. Der Rest wird als Skonto ausgebucht.</small></span></label>' : ''), async (fd) => {
      const betrag = SuS.leseCent(fd.get('betrag')), id = d.id;
      try {
        if (!(await SuS.transaktionSicher(() => SuS.zahlungErfassen(SuS.dok(id), betrag, String(fd.get('am') || SuS.heute()), fd.get('skonto') === 'on')))) { frisch(id); SuS.melde('Speichern fehlgeschlagen.', true); return false; }
      } catch (x) { frisch(id); SuS.melde(x.message, true); return false; }
      const x = SuS.dok(id);
      neu(); SuS.melde(x.status === 'bezahlt' ? 'Vollständig bezahlt.' + (SuS.skontoGenutzt(x) ? ' Skonto ' + SuS.euro(SuS.skontoGenutzt(x)) + ' ausgebucht.' : '') : 'Teilzahlung erfasst – noch offen: ' + SuS.euro(SuS.offenerBetrag(x)) + '.'); return true;
    }, 'Sichern');
  };
  /* Skonto-Haken setzt den Betrag passend (ohne Inline-Skript wegen der strengen CSP) */
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-skonto-betrag]');
    if (!el) return;
    const f = el.form && el.form.querySelector('[name=betrag]');
    if (f) f.value = el.checked ? el.dataset.skontoBetrag : el.dataset.voll;
  });
  A.unbezahlt = async () => {
    const schluss = SuS.schlussMitAbschlag(aktuell);
    if (schluss) { SuS.melde('Dieser Abschlag ist in der Schlussrechnung ' + schluss.nummer + ' als bezahlt abgezogen. Bitte zuerst die Schlussrechnung stornieren.', true); return; }
    /* Ganz oder gar nicht, wie beim Erfassen (Fund Cursor): scheitert das Speichern, bleibt die Zahlung bestehen. */
    const id = aktuell.id;
    if (!(await SuS.transaktionSicher(() => { const d = SuS.dok(id); SuS.letzteZahlungZurueck(d); d.geaendert = new Date().toISOString(); }))) {
      SuS.melde('Speichern fehlgeschlagen – die Zahlung bleibt bestehen.', true);
    }
    frisch(id); neu();
  };
  A.mahnen = () => {
    const d = aktuell, stufe = SuS.mahnstufe(d);
    SuS.blatt(SuS.MAHNSTUFEN[stufe] + ' erstellen?', '<div class="vorschau-betrag"><span>' + e(d.nummer) + ' · offen</span><span>' + SuS.euro(SuS.offenerBetrag(d)) + '</span></div>' +
      '<p>' + (stufe === 0 ? 'Eine freundliche Erinnerung mit neuer Frist (10 Tage).' : stufe === 1 ? 'Erste Mahnung mit Frist (10 Tage).' :
        'Letzte Mahnung mit Frist (7 Tage) und Hinweis auf das gerichtliche Mahnverfahren.') + ' Bitte vorher prüfen, ob das Geld vielleicht schon da ist.</p>' +
      (stufe >= 1 ? SuS.feld('gebuehr', 'Mahngebühr (€) – nur tatsächliche Kosten, z. B. Porto', SuS.centText(SuS.mahnGebuehrVorschlag(d)), { dezimal: true,
        hilfe: (SuS.kundeVon(d) || {}).art === 'firma' ? 'Firmenkunde.' : 'Privatkunde: im Zweifel 0 lassen.' }) : '') +
      '<button type="submit" class="knopf haupt breit">Erstellen und drucken</button>', async (fd) => {
      const g = stufe >= 1 ? SuS.leseCent(fd.get('gebuehr') || '0') : 0;
      if (!Number.isFinite(g) || g < 0) { SuS.melde('Gebühr bitte als Zahl.', true); return false; }
      const id = d.id, marke = SuS.navMarke();
      try { if (!(await SuS.transaktionSicher(() => SuS.mahnen(SuS.dok(id), g)))) { frisch(id); SuS.melde('Speichern fehlgeschlagen.', true); return false; } } catch (x) { frisch(id); SuS.melde(x.message, true); return false; }
      neu(); if (marke === SuS.navMarke()) setTimeout(() => SuS.zeigeDruck(SuS.dok(id), 'mahnung'), 50); return true;
    }, 'Erstellen');
  };
  A.mahnungDruck = () => SuS.zeigeDruck(aktuell, 'mahnung');
  A.abschlagKorrigieren = () => {
    const d = aktuell, bezahlt = SuS.bezahltSumme(d);
    SuS.blatt('Abschlag korrigieren?', '<p>Erhalten: <b>' + SuS.euro(bezahlt) + '</b> von ' + SuS.euro(SuS.summen(d).zahlbetrag) + '.</p>' +
      '<p>Die App storniert ' + e(d.nummer) + ' und stellt einen neuen Abschlag über genau den erhaltenen Betrag (als bezahlt). So zieht die Schlussrechnung nur ab, was wirklich gezahlt wurde.</p>' +
      '<button type="submit" class="knopf haupt breit">Korrigieren</button>', async () => {
      let erg = null;
      const id = d.id, marke = SuS.navMarke();
      try { if (!(await SuS.transaktionSicher(() => { erg = SuS.abschlagKorrigieren(SuS.dok(id)); }))) { frisch(id); neu(); SuS.melde('Speichern fehlgeschlagen – nichts korrigiert.', true); return true; } }
      catch (x) { frisch(id); neu(); SuS.melde(x.message, true); return true; }
      SuS.melde('Neuer Abschlag ' + erg.neu.nummer + ' über ' + SuS.euro(SuS.summen(erg.neu).zahlbetrag) + '.');
      SuS.gehZu('#/dok/' + erg.neu.id, marke); return true;
    }, 'Korrigieren');
  };

  /* ---------- Unterschrift vor Ort ---------- */
  A.unterschrift = () => {
    const d = aktuell, k = SuS.kundeVon(d), s = SuS.summen(d);
    const form = SuS.blatt('Auftrag unterschreiben', '<div class="vorschau-betrag"><span>' + e(d.nummer) + '</span><span>' + SuS.euro(s.brutto) + '</span></div>' +
      '<p class="unterzeile" style="margin-top:0">Mit der Unterschrift erteilt der Kunde den Auftrag zu diesem Angebot. Bitte vorher die Vorschau gemeinsam ansehen.</p>' +
      SuS.feld('name', 'Name der unterschreibenden Person', k ? (k.ansprechpartner || k.name) : '', {}) +
      '<div class="feld"><span>Unterschrift</span><canvas data-zeichen width="600" height="220" style="width:100%;height:160px;background:#fff;border:1px solid #cfc6b8;border-radius:10px;touch-action:none"></canvas>' +
      '<small><button type="button" class="knopf klein" data-leeren>Neu</button></small></div>', async (fd) => {
      const name = String(fd.get('name') || '').trim();
      if (!name) { SuS.melde('Bitte den Namen eintragen.', true); return false; }
      if (!gezeichnet) { SuS.melde('Bitte unterschreiben lassen.', true); return false; }
      const bild = canvas.toDataURL('image/png');
      if (bild.length > 110000) { SuS.melde('Unterschrift zu groß – bitte etwas einfacher.', true); return false; }
      const id = d.id;
      if (!(await SuS.transaktionSicher(() => { const x = SuS.dok(id); x.unterschrift = { bild, name, datum: SuS.heute() }; x.status = 'angenommen'; x.geaendert = new Date().toISOString(); }))) {
        frisch(id); SuS.melde('Speichern fehlgeschlagen – die Unterschrift wurde nicht übernommen.', true); return false;  // Fund Cursor R7
      }
      neu(); SuS.melde('Auftrag unterschrieben. Auftragsbestätigung mit Unterschrift ist druckbereit.'); return true;
    }, 'Bestätigen');
    const canvas = form.querySelector('[data-zeichen]'), c = canvas.getContext('2d');
    c.lineWidth = 3.2; c.lineCap = 'round'; c.lineJoin = 'round'; c.strokeStyle = '#1d1b18';
    let zeichnet = false, gezeichnet = false;
    const punkt = (ev) => { const r = canvas.getBoundingClientRect(); return [(ev.clientX - r.left) * canvas.width / r.width, (ev.clientY - r.top) * canvas.height / r.height]; };
    canvas.addEventListener('pointerdown', (ev) => { zeichnet = true; try { canvas.setPointerCapture(ev.pointerId); } catch (x) { /* ohne Fang weiterzeichnen */ } const [x, y] = punkt(ev); c.beginPath(); c.moveTo(x, y); });
    canvas.addEventListener('pointermove', (ev) => { if (!zeichnet) return; const [x, y] = punkt(ev); c.lineTo(x, y); c.stroke(); gezeichnet = true; });
    ['pointerup', 'pointercancel'].forEach((t) => canvas.addEventListener(t, () => { zeichnet = false; }));
    form.querySelector('[data-leeren]').addEventListener('click', () => { c.clearRect(0, 0, canvas.width, canvas.height); gezeichnet = false; });
  };

  A.stornieren = () => {
    const d = aktuell;
    const schluss = d.typ === 'abschlag' ? SuS.schlussMitAbschlag(d) : null;
    if (schluss) { SuS.melde('Dieser Abschlag ist in der Schlussrechnung ' + schluss.nummer + ' abgezogen. Bitte zuerst die Schlussrechnung stornieren.', true); return; }
    SuS.blatt('Rechnung stornieren?', '<div class="vorschau-betrag"><span>' + e(d.nummer) + '</span><span>' + SuS.euro(SuS.summen(d).zahlbetrag) + '</span></div>' +
      '<p>Es wird eine <b>Stornorechnung</b> mit eigener Nummer erstellt, die diese Rechnung vollständig aufhebt. Das lässt sich nicht rückgängig machen.</p>' +
      '<p class="unterzeile">Danach können Sie aus dem Angebot eine neue, korrigierte Rechnung erstellen.</p>' +
      '<button type="submit" class="knopf gefahr breit">Ja, Stornorechnung erstellen</button>', async () => { await storniere(d.id); return true; }, 'Stornieren');
  };
  async function storniere(id) {
    const d = SuS.dok(id), marke = SuS.navMarke();
    if (!d) return;
    /* Nie doppelt stornieren (Prüfrunde 2). */
    if (d.status === 'storniert' || SuS.daten.dokumente.some((x) => x.typ === 'storno' && x.vonId === d.id)) { SuS.melde('Diese Rechnung ist bereits storniert.', true); return; }
    let s = null;
    const ok = await SuS.transaktionSicher(() => {
      const r = SuS.dok(id);
      s = SuS.stornoAus(r);
      SuS.festschreiben(s);
      s.status = 'storno';
      r.status = 'storniert';
      s.geaendert = r.geaendert = new Date().toISOString();
    });
    if (!ok) { SuS.melde('Speichern fehlgeschlagen – es wurde NICHT storniert.', true); frisch(id); neu(); return; }
    s = SuS.dok(s.id);
    SuS.melde('Stornorechnung ' + s.nummer + ' erstellt.');
    SuS.gehZu('#/dok/' + s.id, marke);
    if (marke === SuS.navMarke()) setTimeout(() => SuS.zeigeDruck(s, ''), 80);
  }
})();
