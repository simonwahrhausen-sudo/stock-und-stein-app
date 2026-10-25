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
      '<div class="knopfreihe"><button class="knopf" data-a="ausgabenCsv">Liste für den Steuerberater (CSV)</button></div>' +
      '<p class="unterzeile">Papierbelege trotzdem aufbewahren (10 Jahre für Buchungsbelege). Die Vorsteuer ist aus dem Bruttobetrag herausgerechnet.</p>');
  };
  A.ausgabenJahr = (el) => { jahrA = el.dataset.j; SuS.neuZeichnen(); };

  A.ausgabeBearbeiten = (el) => {
    const alt = el.dataset.id ? SuS.daten.ausgaben.find((a) => a.id === el.dataset.id) : null;
    const x = alt || SuS.neueAusgabe(SuS.ausgabeVorgabe || { projektId: el.dataset.p || '' });
    SuS.ausgabeVorgabe = null;
    SuS.blatt(alt ? 'Ausgabe' : 'Neue Ausgabe',
      '<div class="zwei">' + SuS.feld('datum', 'Datum', x.datum, { typ: 'date' }) + SuS.feld('brutto', 'Betrag brutto', x.brutto ? SuS.centText(x.brutto) : '', { dezimal: true, auto: !alt }) + '</div>' +
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
        : '<label class="feld"><span>Belegfoto (optional)</span><input type="file" name="beleg" accept="image/*" capture="environment"></label>'),
    async (fd) => {
      const brutto = SuS.leseCent(fd.get('brutto'));
      if (!Number.isFinite(brutto) || brutto === 0 || Math.abs(brutto) > 100000000) { SuS.melde('Bitte den Betrag eingeben (Gutschriften mit Minus).', true); return false; }
      const vs = String(fd.get('vorsteuer') || '').trim() ? SuS.leseCent(fd.get('vorsteuer')) : null;
      if (vs != null && (!Number.isFinite(vs) || Math.abs(vs) > Math.abs(brutto) || (vs !== 0 && Math.sign(vs) !== Math.sign(brutto)))) { SuS.melde('Vorsteuer passt nicht zum Betrag.', true); return false; }
      const neuWerte = { datum: String(fd.get('datum') || SuS.heute()), brutto, lieferant: String(fd.get('lieferant') || '').trim().slice(0, 120),
        text: String(fd.get('text') || '').trim().slice(0, 200), art: String(fd.get('art')), satz: Number(fd.get('satz')), projektId: String(fd.get('projekt') || ''),
        nummer: String(fd.get('nummer') || '').trim().slice(0, 60), bezahlt: fd.get('bezahlt') === 'on', vorsteuer: vs };
      if (!neuWerte.lieferant && !neuWerte.text) { SuS.melde('Bitte angeben, bei wem oder was.', true); return false; }
      neuWerte.gemischt = SuS.ausgabeAbweichend(Object.assign({}, neuWerte, { gemischt: false }));
      /* Ganz oder gar nicht (Fund Cursor R7): bei Speicherfehler bleibt der vorherige Stand */
      if (!(await SuS.transaktionSicher(() => {
        const ziel = alt ? SuS.daten.ausgaben.find((a) => a.id === x.id) : x;
        Object.assign(ziel, neuWerte);
        if (!alt) SuS.daten.ausgaben.push(ziel);
      }))) { SuS.melde('Speichern fehlgeschlagen.', true); return false; }  // Foto erst danach (Fund Cursor R8)
      const datei = fd.get('beleg');
      if (datei && datei.size && SuS.fotoVerkleinern) {
        try { await SuS.fotoSpeichern({ id: SuS.id(), projektId: 'a' + x.id, datum: x.datum, notiz: 'Beleg', bild: await SuS.fotoVerkleinern(datei) }); }
        catch (f) { SuS.melde('Ausgabe gespeichert, Foto nicht: ' + f.message, true); SuS.neuZeichnen(); return true; }
      }
      SuS.melde('Ausgabe gespeichert.'); SuS.neuZeichnen(); return true;
    }, 'Sichern');
    if (alt && SuS.fotosZeichnen) setTimeout(() => SuS.fotosZeichnen('a' + x.id), 0);
  };
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
