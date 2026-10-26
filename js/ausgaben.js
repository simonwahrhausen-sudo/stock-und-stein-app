/* Stock und Stein – Ausgaben (Eingangsbelege) erfassen: Material, Sprit, Kippe, Miete … mit Belegfoto, Zuordnung zur
   Baustelle (fließt in die Nachkalkulation) und Liste für den Steuerberater. Empfangene E-Rechnungen lassen sich mit
   einem Tipp übernehmen. Alles bleibt auf dem Gerät. */
'use strict';

(function () {
  const e = SuS.esc, A = SuS.aktionen;
  let jahrA = String(new Date().getFullYear());

  SuS.seiten.ausgaben = () => {
    const alle = SuS.daten.ausgaben;
    const jahre = [...new Set(alle.map((a) => a.datum.slice(0, 4)).concat(String(new Date().getFullYear())))].sort().reverse();
    if (!jahre.includes(jahrA)) jahrA = jahre[0];
    const liste = alle.filter((a) => a.datum.slice(0, 4) === jahrA).sort((a, b) => b.datum.localeCompare(a.datum));
    const monat = SuS.heute().slice(0, 7), sj = SuS.ausgabenSumme(liste), sm = SuS.ausgabenSumme(liste.filter((a) => a.datum.slice(0, 7) === monat));
    let letzterMonat = '';
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><div><h1>Ausgaben</h1><p>Belege fotografieren, der Baustelle zuordnen</p></div>' +
      '<button class="knopf haupt klein" data-a="ausgabeBearbeiten">+ Neu</button></div>' +
      (jahre.length > 1 ? '<div class="filter">' + jahre.map((j) => '<button type="button" data-a="ausgabenJahr" data-j="' + e(j) + '" class="' + (j === jahrA ? 'an' : '') + '">' + e(j) + '</button>').join('') + '</div>' : '') +
      '<div class="kacheln"><div class="kachel"><div class="name">Dieser Monat (brutto)</div><div class="wert">' + SuS.euro(sm.brutto) + '</div></div>' +
      '<div class="kachel"><div class="name">' + e(jahrA) + ' gesamt (brutto)</div><div class="wert">' + SuS.euro(sj.brutto) + '</div></div></div>' +
      '<p class="unterzeile" style="margin-top:4px">Darin enthaltene Vorsteuer ' + e(jahrA) + ': ' + SuS.euro(sj.steuer) + '</p>' +
      (liste.length ? '<ul class="liste">' + liste.map((a) => {
        const p = a.projektId ? SuS.projekt(a.projektId) : null, m = a.datum.slice(0, 7);
        const kopf = m !== letzterMonat ? '<li class="unterzeile" style="padding:10px 14px 4px;list-style:none">' + SuS.MONATE[Number(m.slice(5)) - 1] + ' ' + m.slice(0, 4) + '</li>' : '';
        letzterMonat = m;
        return kopf + '<li><button class="zeile" data-a="ausgabeBearbeiten" data-id="' + e(a.id) + '"><div class="haupt"><div class="titel">' + e(a.lieferant || a.text || 'Ausgabe') + '</div><div class="klein">' +
          e([SuS.datum(a.datum), SuS.AUSGABE_ARTEN[a.art], a.text && a.lieferant ? a.text : '', p ? p.titel : '', a.bezahlt ? '' : 'noch offen'].filter(Boolean).join(' · ')) +
          '</div></div><div class="betrag">' + SuS.euro(a.brutto) + '</div></button></li>';
      }).join('') + '</ul>' : '<div class="karte leer"><p>Noch keine Ausgaben in ' + e(jahrA) + '. Tipp: Beleg gleich an der Kasse fotografieren.</p></div>') +
      '<div class="knopfreihe"><button class="knopf" data-a="steuerPaketBlatt">📦 Paket für den Steuerberater (ZIP)</button><button class="knopf" data-a="ausgabenCsv">Nur Liste (CSV)</button></div>' +
      '<p class="unterzeile">Papierbelege trotzdem aufbewahren (10 Jahre für Buchungsbelege). Die Vorsteuer ist aus dem Bruttobetrag herausgerechnet.</p>');
  };
  A.ausgabenJahr = (el) => { jahrA = el.dataset.j; SuS.neuZeichnen(); };

  A.ausgabeBearbeiten = (el) => {
    const alt = el.dataset.id ? SuS.daten.ausgaben.find((a) => a.id === el.dataset.id) : null;
    const x = alt || SuS.neueAusgabe(SuS.ausgabeVorgabe || { projektId: el.dataset.p || '' });
    SuS.ausgabeVorgabe = null;
    let form = null;
    /* Neue Ausgabe: Fotoknopf zuerst – das Foto füllt die Felder darunter aus */
    const fotoKasten = '<div class="beleg-erkennung"><label class="knopf haupt breit">📷 Beleg fotografieren – Felder werden ausgefüllt<input type="file" name="beleg" accept="image/*" capture="environment" hidden></label>' +
      '<div class="beleg-status unterzeile" aria-live="polite">Oder unten von Hand eintragen.</div><img class="beleg-vorschau" alt="Beleg" hidden>' +
      '<button type="button" class="knopf klein beleg-drehen" hidden>↻ Bild drehen und neu erkennen</button></div>';
    form = SuS.blatt(alt ? 'Ausgabe' : 'Neue Ausgabe', (alt ? '' : fotoKasten) +
      '<div class="zwei">' + SuS.feld('datum', 'Datum', x.datum, { typ: 'date' }) + SuS.feld('brutto', 'Betrag brutto', x.brutto ? SuS.centText(x.brutto) : '', { dezimal: true, auto: false }) + '</div>' +
      SuS.feld('lieferant', 'Bei wem?', x.lieferant, { platz: 'z. B. Baustoffhandel, Tankstelle, Deponie' }) +
      SuS.feld('text', 'Was?', x.text, { platz: 'z. B. 6 t Splitt 2/5, Diesel, Grünschnitt' }) +
      '<div class="zwei">' + SuS.feld('art', 'Art', x.art, { typ: 'select', optionen: Object.keys(SuS.AUSGABE_ARTEN).map((k) => [k, SuS.AUSGABE_ARTEN[k]]) }) +
      SuS.feld('satz', 'USt im Beleg', String(x.satz), { typ: 'select', optionen: [['19', '19 %'], ['7', '7 %'], ['0', 'keine']] }) + '</div>' +
      SuS.feld('projekt', 'Baustelle (für die Nachkalkulation)', x.projektId, { typ: 'select', optionen: [['', '– keine –']].concat(SuS.daten.projekte.map((p) => [p.id, p.nr + ' ' + p.titel])) }) +
      SuS.feld('nummer', 'Belegnummer (optional)', x.nummer) +
      SuS.feld('vorsteuer', 'Vorsteuer laut Beleg (leer = aus dem Satz)', x.vorsteuer != null ? SuS.centText(x.vorsteuer) : '', { dezimal: true, platz: 'automatisch' }) +
      (x.gemischt ? '<div class="hinweis">Vorsteuer weicht vom Satz ab (z. B. mehrere Steuersätze): im DATEV-Export nicht enthalten – bitte von Hand buchen.</div>' : '') +
      '<label class="schalter"><input type="checkbox" name="bezahlt"' + (x.bezahlt ? ' checked' : '') + '><span><b>Bezahlt</b><small>Aus, wenn die Rechnung noch überwiesen werden muss.</small></span></label>' +
      (alt ? '<h3 style="margin:10px 0 6px">Belegfoto</h3><div id="fotos-a' + e(x.id) + '"><p class="unterzeile">Wird geladen …</p></div>' +
        '<button type="button" class="knopf gefahr breit" data-a="ausgabeLoeschen" data-id="' + e(x.id) + '">Ausgabe löschen</button>'
        : ''),
    async (fd) => {
      const brutto = SuS.leseCent(fd.get('brutto'));
      if (!Number.isFinite(brutto) || brutto === 0 || Math.abs(brutto) > 100000000) { SuS.melde('Bitte den Betrag eingeben (Gutschriften mit Minus).', true); return false; }
      const vs = String(fd.get('vorsteuer') || '').trim() ? SuS.leseCent(fd.get('vorsteuer')) : null;
      if (vs != null && (!Number.isFinite(vs) || Math.abs(vs) > Math.abs(brutto) || (vs !== 0 && Math.sign(vs) !== Math.sign(brutto)))) { SuS.melde('Vorsteuer passt nicht zum Betrag.', true); return false; }
      const neuWerte = { datum: String(fd.get('datum') || SuS.heute()), brutto, lieferant: String(fd.get('lieferant') || '').trim().slice(0, 120),
        text: String(fd.get('text') || '').trim().slice(0, 200), art: String(fd.get('art')), satz: Number(fd.get('satz')), projektId: String(fd.get('projekt') || ''),
        nummer: String(fd.get('nummer') || '').trim().slice(0, 60), bezahlt: fd.get('bezahlt') === 'on', vorsteuer: vs };
      if (!neuWerte.lieferant && !neuWerte.text) { SuS.melde('Bitte angeben, bei wem oder was.', true); return false; }
      const schluessel = SuS.lieferantSchluessel ? SuS.lieferantSchluessel(neuWerte.lieferant) : '';
      /* Mischbeleg aus der Erkennung bleibt markiert, solange die Vorsteuer laut Beleg eingetragen ist (Fund Codex) */
      neuWerte.gemischt = SuS.ausgabeAbweichend(Object.assign({}, neuWerte, { gemischt: false })) || (!alt && !!form.belegGemischt && vs != null);
      /* Ganz oder gar nicht (Fund Cursor R7): bei Speicherfehler bleibt der vorherige Stand */
      if (!(await SuS.transaktionSicher(() => {
        const ziel = alt ? SuS.daten.ausgaben.find((a) => a.id === x.id) : x;
        Object.assign(ziel, neuWerte);
        if (!alt) SuS.daten.ausgaben.push(ziel);
        /* Lernen: zuletzt bestätigte Kategorie je Lieferant (für die nächste Beleg-Erkennung) */
        if (schluessel) { SuS.daten.lieferantArt = SuS.daten.lieferantArt || {}; SuS.daten.lieferantArt[schluessel] = neuWerte.art; }
      }))) { SuS.melde('Speichern fehlgeschlagen.', true); return false; }  // Foto erst danach (Fund Cursor R8)
      const datei = fd.get('beleg');
      if (datei && datei.size && SuS.fotoVerkleinern) {
        /* Aufbereiteter, verkleinerter Ausschnitt aus der Erkennung, sonst das verkleinerte Originalfoto */
        const gleich = (x, y) => x && y && x.name === y.name && x.size === y.size && x.lastModified === y.lastModified;  // FormData liefert ein neues Dateiobjekt
        const bild = form.belegBild && gleich(form.belegBild.datei, datei) ? form.belegBild.blob : await SuS.fotoVerkleinern(datei);
        try { await SuS.fotoSpeichern({ id: SuS.id(), projektId: 'a' + x.id, datum: x.datum, notiz: 'Beleg', bild }); }
        catch (f) { SuS.melde('Ausgabe gespeichert, Foto nicht: ' + f.message, true); SuS.neuZeichnen(); return true; }
      }
      SuS.melde('Ausgabe gespeichert.'); SuS.neuZeichnen(); return true;
    }, 'Sichern');
    if (alt && SuS.fotosZeichnen) setTimeout(() => SuS.fotosZeichnen('a' + x.id), 0);
    if (!alt) belegErkennungAnbinden(form);
  };

  /* ---------- Beleg-Erkennung im Formular (siehe beleg.js) ---------- */
  function belegErkennungAnbinden(form) {
    const kasten = form.querySelector('.beleg-erkennung');
    if (!kasten || !SuS.belegErkennen) return;
    const eingabe = kasten.querySelector('input[name="beleg"]'), status = kasten.querySelector('.beleg-status');
    const vorschau = kasten.querySelector('.beleg-vorschau'), drehen = kasten.querySelector('.beleg-drehen');
    const FELDER = ['datum', 'brutto', 'lieferant', 'art', 'satz', 'vorsteuer'];
    const feld = (name) => form.querySelector('[name="' + name + '"]');
    const anfang = Object.fromEntries(FELDER.map((n) => [n, feld(n) ? feld(n).value : '']));
    let drehung = 0, laeuft = false, nochmal = null, lauf = 0, vorschauUrl = '';
    /* Vorschlag eintragen und gelb markieren; ein Tipp (Fokus/Änderung) bestätigt und nimmt die Markierung weg */
    const vorschlagen = (name, wert) => {
      const el = feld(name);
      if (!el || wert === '' || wert == null) return;
      el.value = String(wert);
      const label = el.closest('.feld'); if (label) label.classList.add('vorschlag');
    };
    /* Neuer Lauf: alle noch unbestätigten Vorschläge des letzten Laufs zurücksetzen (Fund Codex: alte Vorsteuer blieb stehen) */
    const zuruecksetzen = () => {
      for (const n of FELDER) {
        const el = feld(n), label = el && el.closest('.feld');
        if (label && label.classList.contains('vorschlag')) { el.value = anfang[n]; label.classList.remove('vorschlag'); }
      }
      form.belegGemischt = false;
    };
    form.addEventListener('focusin', (ev) => { const l = ev.target.closest('.feld.vorschlag'); if (l) l.classList.remove('vorschlag'); });
    form.addEventListener('change', (ev) => { const l = ev.target.closest('.feld.vorschlag'); if (l) l.classList.remove('vorschlag'); });
    const erkennen = async (dr) => {
      const datei = eingabe.files && eingabe.files[0];
      if (!datei) return;
      if (laeuft) { nochmal = { dr }; return; }  // neueste Auswahl nach dem laufenden Durchgang erkennen (Fund Codex)
      const meinLauf = ++lauf;
      laeuft = true; drehen.hidden = true;
      status.textContent = 'Texterkennung wird vorbereitet … (läuft nur auf diesem Gerät)';
      SuS.belegFortschritt = (m) => {
        if (m && m.status === 'recognizing text') status.textContent = 'Beleg wird gelesen … ' + Math.round((m.progress || 0) * 100) + ' %';
        else if (m && /load/.test(m.status || '')) status.textContent = 'Texterkennung wird geladen …';
      };
      try {
        const r = await SuS.belegErkennen(datei, dr);
        if (meinLauf !== lauf || eingabe.files[0] !== datei || nochmal) return;  // inzwischen anderes Foto gewählt: Ergebnis verwerfen
        drehung = r.drehung;
        zuruecksetzen();
        form.belegBild = { datei, blob: r.bild.speicher };
        if (vorschauUrl) URL.revokeObjectURL(vorschauUrl);
        vorschauUrl = URL.createObjectURL(r.bild.speicher); vorschau.src = vorschauUrl; vorschau.hidden = false;
        const v = r.vorschlag;
        vorschlagen('datum', v.datum);
        if (v.brutto) vorschlagen('brutto', SuS.centText(v.brutto));
        vorschlagen('lieferant', v.lieferant);
        vorschlagen('art', v.art);
        if (v.sicher.satz) vorschlagen('satz', String(v.satz));
        else if (v.keinAusweis && v.brutto) vorschlagen('satz', '0');  // kein Steuerausweis: ausdrücklich „keine“, nicht still 19 % (Fund Codex R2)
        /* Vorsteuer ausdrücklich, wenn sie vom Satz abweicht oder mehrere Sätze vorkommen – dann bleibt der Beleg aus dem
           automatischen DATEV-Export (gemischt, von Hand buchen) */
        if (v.brutto && v.sicher.satz && (v.gemischt || Math.abs(v.steuer - Math.round(v.brutto * v.satz / (100 + v.satz))) > 2)) vorschlagen('vorsteuer', SuS.centText(v.steuer));
        form.belegGemischt = !!v.gemischt;
        const fehlt = [v.datum ? '' : 'Datum', v.brutto ? '' : 'Betrag', v.lieferant ? '' : 'Lieferant', v.sicher.satz || v.keinAusweis ? '' : 'Steuersatz'].filter(Boolean);
        status.innerHTML = '<b>Gelb = Vorschlag aus dem Foto.</b> Bitte prüfen – antippen bestätigt, Speichern übernimmt alles.' +
          (v.brutto && v.sicher.satz ? ' Netto ' + SuS.euro(v.netto) + ' + MwSt ' + (v.gemischt ? '(mehrere Sätze) ' : v.satz + ' % ') + SuS.euro(v.steuer) + '.' : '') +
          (v.gutschrift ? ' Gutschrift erkannt (Beträge mit Minus).' : '') +
          (v.sicher.satz && v.satzUnsicher ? ' Steuersatz nicht sicher lesbar – 19 % angenommen, bitte prüfen.' : '') +
          (v.keinAusweis && v.brutto ? ' Keine Mehrwertsteuer auf dem Beleg erkannt – „keine“ eingetragen; steht doch MwSt drauf, bitte den Satz wählen.' : '') +
          (v.gemischt ? ' Mehrere Steuersätze: Vorsteuer laut Beleg, bitte im DATEV-Export von Hand buchen.' : '') +
          (fehlt.length ? ' Nicht erkannt: ' + fehlt.join(', ') + ' – bitte selbst eintragen.' : '');
      } catch (x) {
        if (meinLauf === lauf) status.textContent = 'Erkennung nicht möglich (' + x.message + '). Bitte von Hand ausfüllen – das Foto wird trotzdem gespeichert.';
      } finally {
        laeuft = false; drehen.hidden = false; SuS.belegFortschritt = null;
        if (nochmal) { const n = nochmal; nochmal = null; erkennen(n.dr); }
      }
    };
    eingabe.addEventListener('change', () => { drehung = 0; form.belegBild = null; erkennen(); });
    drehen.addEventListener('click', () => erkennen((drehung + 90) % 360));
  }
  A.ausgabeLoeschen = async (el) => {
    if (!SuS.sicher(el)) return;
    const id = el.dataset.id;
    const abgelegt = await SuS.transaktionSicher(() => { SuS.daten.ausgaben = SuS.daten.ausgaben.filter((a) => a.id !== id); });
    SuS.blattZu(); SuS.neuZeichnen();
    if (!abgelegt) { SuS.melde('Speichern fehlgeschlagen – die Ausgabe bleibt.', true); return; }
    /* Fotos erst nach erfolgreichem Speichern löschen (Fund Cursor R7) */
    try { if (await SuS.fotosVerfuegbar()) for (const f of await SuS.fotosVon('a' + id)) await SuS.fotoLoeschen(f.id); } catch (x) { /* Fotos bleiben dann liegen */ }
  };
  A.ausgabenCsv = () => {
    const csv = SuS.ausgabenCsv(jahrA);
    if (window.parent !== window) { SuS.textZeigen('Ausgaben ' + jahrA, csv); return; }
    SuS.dateiTeilen('ausgaben-' + jahrA + '.csv', csv, 'text/csv', 'Ausgaben ' + jahrA + ' (Tabelle, öffnet in Excel/Numbers).', 'Ausgaben ' + jahrA);
  };

  /* Text zum Kopieren anzeigen (Ersatz, wo Dateien nicht gehen) */
  SuS.textZeigen = (titel, inhalt) => {
    const f = SuS.blatt(titel, '<p class="unterzeile">Alles markieren, kopieren und in eine Datei mit der Endung .csv einfügen oder per Mail an den Steuerberater.</p><label class="feld"><textarea readonly style="min-height:260px;font-size:12px"></textarea></label>');
    const t = f.querySelector('textarea'); t.value = String(inhalt).replace(/^﻿/, ''); t.addEventListener('focus', () => t.select());
  };

  /* Aus einer empfangenen E-Rechnung (siehe eingang.js) eine Ausgabe vorbereiten */
  /* Gutschriften (CreditNote/381) mindern die Ausgaben: Beträge negativ. Vorsteuer genau laut Beleg; passt sie zu
     keinem einzelnen Satz (mehrere Steuersätze), wird der Beleg als „gemischt“ markiert (Funde Codex). */
  SuS.ausgabeAusERechnung = (r) => {
    const zahl = (t) => { const n = Number(t); return t !== '' && Number.isFinite(n) ? Math.round(n * 100) : NaN; };
    const vz = r.art === 'Gutschrift' ? -1 : 1;
    const brutto = zahl(r.brutto || r.zahlbetrag), netto = zahl(r.netto), steuer = zahl(r.steuer);
    const quote = netto > 0 && Number.isFinite(steuer) ? steuer / netto * 100 : 19;
    const satz = [19, 7, 0].reduce((b, s) => (Math.abs(s - quote) < Math.abs(b - quote) ? s : b), 19);
    const gemischt = netto > 0 && Number.isFinite(steuer) && Math.abs(SuS.runde(netto * satz / 100) - steuer) > 2;
    const iso = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(r.datum || '');
    SuS.ausgabeVorgabe = { lieferant: (r.verkaeufer && r.verkaeufer.name || '').slice(0, 120), nummer: String(r.nummer || '').slice(0, 60),
      text: (r.positionen[0] ? r.positionen[0].text : 'E-Rechnung').slice(0, 200) + (r.positionen.length > 1 ? ' u. a.' : ''),
      brutto: Number.isFinite(brutto) ? vz * brutto : 0, satz, vorsteuer: Number.isFinite(steuer) ? vz * steuer : null, gemischt,
      datum: iso ? iso[3] + '-' + iso[2] + '-' + iso[1] : SuS.heute(), bezahlt: false, art: 'material' };
    A.ausgabeBearbeiten({ dataset: {} });
  };
})();
