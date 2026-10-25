/* Stock und Stein – Ausdruck als A4 (DIN 5008, Form B): Angebot, Auftragsbestätigung, Rechnungen, Zahlungserinnerung.
   „Drucken“ öffnet das Druckmenü; dort „Als PDF sichern“ (Mac) bzw. am iPhone über Teilen → Drucken → PDF. */
'use strict';

(function () {
  const e = SuS.esc;
  const zahl2 = (cent) => SuS.centText(cent);
  /* Fehlende Firmendaten deutlich als Platzhalter zeigen, nie still weglassen. */
  const p = (wert, platzhalter) => (wert ? e(wert) : '<span class="platz">[' + e(platzhalter) + ']</span>');

  const STIL = `
  .a4 { width: 210mm; min-height: 297mm; background: #fff; color: #1d1b18; margin: 0 auto; padding: 16mm 18mm 12mm 22mm;
    font: 9.6pt/1.42 'Inter', Arial, sans-serif; display: flex; flex-direction: column; box-shadow: 0 6px 30px rgba(0,0,0,.25); }
  .a4 .platz { color: #b3261e; background: #fbe9e7; font-style: italic; padding: 0 2px; }
  .a4 .briefkopf { display: flex; justify-content: flex-end; align-items: center; gap: 10px; height: 24mm; }
  .a4 .briefkopf svg { width: 15mm; height: 15mm; }
  .a4 .briefkopf .name { font-family: 'Fraunces', Georgia, serif; font-size: 18pt; font-weight: 700; line-height: 1; color: #3f4a35; }
  .a4 .briefkopf .zusatz { font-size: 8.5pt; color: #5e5a55; letter-spacing: .06em; text-transform: uppercase; margin-top: 3px; }
  .a4 .oben { display: flex; justify-content: space-between; gap: 10mm; margin-top: 3mm; min-height: 45mm; }
  .a4 .anschrift { width: 85mm; }
  .a4 .absender { font-size: 7pt; color: #5e5a55; border-bottom: .5pt solid #8a8178; padding-bottom: 1mm; margin-bottom: 3mm; white-space: nowrap; overflow: hidden; }
  .a4 .info { font-size: 8.8pt; min-width: 62mm; }
  .a4 .info div { display: flex; justify-content: space-between; gap: 6mm; padding: .6mm 0; }
  .a4 .info span:first-child { color: #5e5a55; }
  .a4 .info span:last-child { font-weight: 700; text-align: right; }
  .a4 h1.dok { font-family: 'Fraunces', Georgia, serif; font-size: 17pt; margin: 6mm 0 1mm; color: #1d1b18; }
  .a4 .betreff { font-weight: 700; margin-bottom: 1mm; }
  .a4 .bv { color: #5e5a55; margin-bottom: 4mm; }
  .a4 .text { margin: 0 0 4mm; white-space: pre-line; }
  .a4 table { width: 100%; border-collapse: collapse; margin: 1mm 0 3mm; }
  .a4 thead { display: table-header-group; }
  .a4 th { font-size: 8pt; text-transform: uppercase; letter-spacing: .04em; color: #5e5a55; text-align: left; border-bottom: 1pt solid #1d1b18; padding: 1.5mm 1.5mm; }
  .a4 td { padding: 2mm 1.5mm; border-bottom: .4pt solid #e2dbcf; vertical-align: top; }
  .a4 tr { page-break-inside: avoid; break-inside: avoid; }
  .a4 .r { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
  .a4 td small { display: block; color: #5e5a55; font-size: 8.4pt; margin-top: .5mm; }
  .a4 tr.titel td { font-weight: 700; background: #f4efe6; border-bottom: 0; padding-top: 2.4mm; }
  .a4 tr.tsumme td { font-weight: 700; border-bottom: 1pt solid #cfc6b8; }
  .a4 tr.bedarf td { color: #5e5a55; }
  .a4 tr.notiz td { font-style: italic; color: #5e5a55; }
  .a4 .summen { margin-left: auto; width: 82mm; font-variant-numeric: tabular-nums; break-inside: avoid; }
  .a4 .summen div { display: flex; justify-content: space-between; padding: .8mm 0; }
  .a4 .summen .ges { font-weight: 700; font-size: 11pt; border-top: 1.2pt solid #1d1b18; margin-top: 1mm; padding-top: 1.6mm; }
  .a4 .summen .zahl { font-weight: 700; font-size: 11pt; background: #f4efe6; padding: 1.6mm 2mm; margin: 1mm -2mm 0; }
  .a4 .kasten { border-left: 2.5pt solid #4f6b3a; background: #f3f6ef; padding: 2.4mm 3mm; margin: 4mm 0 0; font-size: 8.8pt; break-inside: avoid; }
  .a4 .kasten.grau { border-color: #8a8178; background: #f6f4f0; }
  .a4 .gruss { margin-top: 6mm; break-inside: avoid; }
  .a4 .giro { display: flex; gap: 4mm; align-items: center; margin-top: 4mm; font-size: 8.6pt; break-inside: avoid; }
  .a4 .giro svg { flex: none; }
  .a4 .fuellung { flex: 1; }
  .a4 .fuss { display: grid; grid-template-columns: 1.1fr 1fr 1.2fr; gap: 5mm; border-top: .6pt solid #8a8178; padding-top: 2.5mm; margin-top: 8mm;
    font-size: 7.4pt; line-height: 1.45; color: #4a4640; break-inside: avoid; }
  .a4 .fuss b { color: #1d1b18; }
  @media print {
    @page { size: A4; margin: 12mm 0 12mm 0; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { background: #fff !important; }
    body.drucken > *:not(#druck) { display: none !important; }
    body.drucken #druck { position: static !important; background: #fff; overflow: visible; }
    .druck-leiste, .druck-tipp { display: none !important; }
    .druck-buehne { padding: 0 !important; }
    .druck-skala { transform: none !important; width: auto !important; height: auto !important; }
    .a4 { box-shadow: none; margin: 0; padding-top: 4mm; padding-bottom: 0; min-height: 272mm; }
  }`;

  const LOGO = '<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="40" width="46" height="16" rx="3" fill="#8a8178"/>' +
    '<path d="M4 43a3 3 0 0 1 3-3h40a3 3 0 0 1 3 3z" fill="#4f6b3a"/>' +
    '<path d="M14 38L52 8M36 21L52 24M26 29L28 15" stroke="#5e5a55" stroke-width="4" stroke-linecap="round" fill="none"/></svg>';

  function anrede(k) {
    if (!k) return 'Guten Tag,';
    if (k.art === 'firma') return k.ansprechpartner ? 'Guten Tag ' + k.ansprechpartner + ',' : 'Sehr geehrte Damen und Herren,';
    return 'Guten Tag ' + k.name + ',';
  }

  function titelVon(dok, variante) {
    if (variante === 'auftrag') return 'Auftragsbestätigung';
    if (variante === 'erinnerung') return 'Zahlungserinnerung';
    if (variante === 'mahnung') return SuS.MAHNSTUFEN[Math.max(1, SuS.mahnstufe(dok)) - 1];
    return SuS.TYPEN[dok.typ].name;
  }

  function standardEinleitung(dok, variante, k) {
    if (variante === 'auftrag') return 'vielen Dank für Ihren Auftrag. Hiermit bestätigen wir die Ausführung der folgenden Leistungen zu den Preisen unseres Angebots ' + dok.nummer + ' vom ' + SuS.datum(dok.datum) + '.';
    if (dok.typ === 'angebot') return 'vielen Dank für Ihre Anfrage. Gerne bieten wir Ihnen die folgenden Leistungen an:';
    if (dok.typ === 'abschlag') return 'wie vereinbart berechnen wir Ihnen für die laufenden Arbeiten folgenden Abschlag:';
    if (dok.typ === 'schluss') return 'vielen Dank für Ihren Auftrag. Nach Abschluss der Arbeiten berechnen wir Ihnen die erbrachten Leistungen wie folgt:';
    if (dok.typ === 'storno') return '';
    return 'vielen Dank für Ihren Auftrag. Für die ausgeführten Arbeiten berechnen wir Ihnen:';
  }

  function standardSchluss(dok, variante) {
    const f = SuS.firmaVon(dok);
    if (variante === 'auftrag') return 'Den genauen Ausführungstermin stimmen wir mit Ihnen ab. Wir freuen uns auf die Zusammenarbeit.';
    if (dok.typ === 'angebot') {
      const bis = SuS.plusTage(dok.datum, dok.gueltigTage || f.gueltigTage);
      return 'Dieses Angebot gilt bis zum ' + SuS.datum(bis) + '. Mengen werden nach tatsächlichem Aufmaß abgerechnet. Bedarfspositionen werden nur nach Rücksprache ausgeführt. Wir freuen uns auf Ihren Auftrag.';
    }
    if (dok.typ === 'storno') return '';
    return 'Bitte überweisen Sie den Betrag ' + (SuS.skonto(dok) ? '' : 'ohne Abzug ') + 'bis zum ' + SuS.datum(SuS.faellig(dok)) + ' auf das unten genannte Konto. Verwendungszweck: ' + (dok.nummer || 'Rechnungsnummer') + '.';
  }

  /* Werte im Infoblock sind bereits sicheres HTML (alles Fremde wird hier mit e() maskiert). */
  function infoBlock(dok, variante, k) {
    const f = SuS.firmaVon(dok);
    const z = [];
    const nrName = dok.typ === 'angebot' ? 'Angebot Nr.' : 'Rechnung Nr.';
    if (variante === 'erinnerung' || variante === 'mahnung') {
      const m = (dok.mahnungen || []).slice(-1)[0];
      z.push(['Datum', SuS.datum(variante === 'mahnung' && m ? m.datum : SuS.heute())], ['Rechnung Nr.', e(dok.nummer)], ['Rechnung vom', SuS.datum(dok.datum)]);
    } else {
      z.push(['Datum', SuS.datum(variante === 'auftrag' ? SuS.heute() : dok.datum)]);
      z.push([variante === 'auftrag' ? 'zum Angebot' : nrName, dok.nummer ? e(dok.nummer) : '<span class="platz">[beim Stellen]</span>']);
    }
    if (k && k.nr) z.push(['Kunden-Nr.', e(k.nr)]);
    if (SuS.istRechnung(dok) && variante !== 'erinnerung' && variante !== 'mahnung') {
      const von = dok.leistungVon, bis = dok.leistungBis;
      z.push([bis && bis !== von ? 'Leistungszeitraum' : 'Leistungsdatum',
        von ? SuS.datum(von) + (bis && bis !== von ? ' – ' + SuS.datum(bis) : '') : '<span class="platz">[fehlt]</span>']);
    }
    if (dok.typ === 'angebot' && !variante) z.push(['Gültig bis', SuS.datum(SuS.plusTage(dok.datum, dok.gueltigTage || f.gueltigTage))]);
    if (f.inhaber) z.push(['Ansprechpartner', e(f.inhaber)]);
    if (f.telefon) z.push(['Telefon', e(f.telefon)]);
    return '<div class="info">' + z.map(([a, b]) => '<div><span>' + a + '</span><span>' + b + '</span></div>').join('') + '</div>';
  }

  function tabelle(dok) {
    const nrn = SuS.nummeriere(dok.positionen);
    const zeilen = [];
    let titelSumme = null, titelName = '', titelNr = '';
    const schliesseTitel = () => {
      if (titelSumme != null) zeilen.push('<tr class="tsumme"><td></td><td colspan="4">Summe ' + e(titelNr) + ' ' + e(titelName) + '</td><td class="r">' + zahl2(titelSumme) + '</td></tr>');
      titelSumme = null;
    };
    dok.positionen.forEach((pos, i) => {
      if (pos.typ === 'titel') {
        schliesseTitel();
        titelSumme = 0; titelName = pos.text; titelNr = nrn[i];
        zeilen.push('<tr class="titel"><td>' + nrn[i] + '</td><td colspan="5">' + e(pos.text) + '</td></tr>');
        return;
      }
      if (pos.typ === 'text') {
        zeilen.push('<tr class="notiz"><td></td><td colspan="5">' + e(pos.text) + '</td></tr>');
        return;
      }
      const gp = SuS.posBetrag(pos);
      if (!pos.bedarf && titelSumme != null) titelSumme += gp;
      const besch = [pos.beschreibung, pos.bedarf ? 'Bedarfsposition – nur Einheitspreis, nicht in der Summe enthalten' : ''].filter(Boolean);
      zeilen.push('<tr' + (pos.bedarf ? ' class="bedarf"' : '') + '><td>' + nrn[i] + '</td><td><b>' + e(pos.text) + '</b>' +
        besch.map((b) => '<small>' + e(b) + '</small>').join('') + '</td>' +
        '<td class="r">' + SuS.zahl(pos.menge, 3) + '</td><td>' + e(pos.einheit) + '</td>' +
        '<td class="r">' + zahl2(pos.preis) + '</td><td class="r">' + (pos.bedarf ? '(' + zahl2(gp) + ')' : zahl2(gp)) + '</td></tr>');
    });
    schliesseTitel();
    return '<table><thead><tr><th style="width:9mm">Pos.</th><th>Leistung</th><th class="r" style="width:15mm">Menge</th>' +
      '<th style="width:12mm">Einh.</th><th class="r" style="width:20mm">EP €</th><th class="r" style="width:23mm">GP €</th></tr></thead><tbody>' +
      zeilen.join('') + '</tbody></table>';
  }

  function summenBlock(dok, s) {
    const z = [];
    if (s.rabatt) {
      z.push(['Zwischensumme', zahl2(s.zwischen)]);
      z.push(['abzüglich ' + SuS.zahl(s.rabattProzent, 2) + ' % Nachlass', '−' + zahl2(s.rabatt)]);
    }
    if (s.modus === 'regel') {
      z.push(['Nettobetrag', zahl2(s.netto)]);
      z.push(['zzgl. ' + SuS.zahl(s.satz, 1) + ' % Umsatzsteuer', zahl2(s.mwst)]);
    }
    if (s.modus === '13b') {
      z.push(['Nettobetrag', zahl2(s.netto)]);
      z.push(['Umsatzsteuer 0 % (§ 13b UStG)', zahl2(0)]);
    }
    let html = z.map(([a, b]) => '<div><span>' + a + '</span><span>' + b + ' €</span></div>').join('');
    html += '<div class="ges"><span>' + (s.modus === 'regel' ? 'Gesamtbetrag' : 'Rechnungsbetrag') + '</span><span>' + SuS.euro(s.brutto) + '</span></div>';
    if (s.abzuege.length) {
      for (const a of s.abzuege) {
        const plus = a.brutto < 0;
        html += '<div><span>' + (plus ? 'Rücknahme Abzug ' : 'abzgl. bezahlter Abschlag ') + e(a.nummer) + ' vom ' + SuS.datum(a.datum) +
          (s.modus === 'regel' ? '<br><small style="color:#5e5a55">netto ' + zahl2(a.netto) + ' € + USt ' + zahl2(a.mwst) + ' €</small>' : '') +
          '</span><span>' + (plus ? '+' + zahl2(-a.brutto) : '−' + zahl2(a.brutto)) + ' €</span></div>';
      }
      html += '<div class="zahl"><span>' + (dok.typ === 'storno' ? 'Storno gesamt' : 'Noch zu zahlen') + '</span><span>' + SuS.euro(s.zahlbetrag) + '</span></div>';
    }
    if (dok.typ === 'angebot' && s.modus !== 'regel') html = html.replace('Rechnungsbetrag', 'Angebotssumme');
    return '<div class="summen">' + html + '</div>';
  }

  /* Hinweise als Daten (für Ausdruck und PDF gleich): [{fett, text}] – reiner Text, ohne HTML. */
  function hinweisDaten(dok, s, k, variante) {
    const h = [];
    const sk = variante !== 'erinnerung' && variante !== 'mahnung' && variante !== 'auftrag' ? SuS.skonto(dok) : null;
    if (sk) h.push({ fett: 'Skonto: ', text: 'Bei Zahlung bis zum ' + SuS.datum(sk.bis) + ' dürfen Sie ' + SuS.zahl(sk.prozent, 2).replace(/,00$/, '') + ' % Skonto (' + SuS.euro(sk.betrag) + ') abziehen und überweisen dann ' + SuS.euro(sk.zahlbar) + '.' });
    if (s.modus === 'klein') h.push({ fett: '', text: 'Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung).' });
    if (s.modus === '13b') {
      h.push({ fett: '', text: 'Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG). Die Umsatzsteuer ist vom Leistungsempfänger anzumelden und abzuführen.' +
        (k && k.ustid ? ' USt-IdNr. des Leistungsempfängers: ' + k.ustid : '') });
    }
    const privat = !k || k.art !== 'firma';
    if (privat && s.lohnNetto > 0 && dok.typ !== 'storno') {
      const wort = dok.typ === 'angebot' ? 'Voraussichtlich enthaltene' : 'Enthaltene';
      h.push({ fett: wort + ' Arbeits-, Maschinen- und Fahrtkosten: ', text: SuS.euro(s.lohnBrutto) +
        (s.modus === 'regel' ? ' (netto ' + SuS.euro(s.lohnNetto) + ' zzgl. ' + SuS.euro(s.lohnBrutto - s.lohnNetto) + ' USt)' : '') +
        '. Dieser Anteil kann nach § 35a EStG steuerlich begünstigt sein (Handwerkerleistungen im Haushalt); Materialkosten sind nicht begünstigt. Bitte per Überweisung zahlen.' });
    }
    if (privat && SuS.istRechnung(dok) && variante !== 'erinnerung' && variante !== 'mahnung') {
      h.push({ fett: '', text: 'Hinweis: Als Privatperson sind Sie verpflichtet, diese Rechnung bzw. einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).' });
    }
    return h;
  }

  function hinweise(dok, s, k, variante) {
    return hinweisDaten(dok, s, k, variante).map((h, i) => '<div class="kasten' + (i ? ' grau' : '') + '">' + (h.fett ? '<b>' + e(h.fett) + '</b>' : '') + e(h.text) + '</div>').join('');
  }

  function bezahlCode(dok, s, f, variante) {
    if (!SuS.istRechnung(dok) || dok.typ === 'storno' || dok.status === 'storniert' || dok.status === 'bezahlt' || !SuS.giroCode) return '';
    const betrag = dok.fest ? SuS.offenerBetrag(dok) : s.zahlbetrag;
    const code = SuS.giroCode(f.name, f.iban, f.bic, betrag, (dok.nummer ? 'Rechnung ' + dok.nummer : 'Rechnung') + ' ' + f.name);
    if (!code) return '';
    let svg;
    try { svg = SuS.qrSvg(code, 26); } catch (x) { return ''; }
    return '<div class="giro">' + svg + '<div><b>Bequem bezahlen:</b> Code mit der Banking-App scannen (GiroCode). Empfänger, IBAN, Betrag ' +
      SuS.euro(betrag) + ' und Verwendungszweck sind schon ausgefüllt.</div></div>';
  }

  function fuss(f) {
    const ort = (f.plz || f.ort) ? e((f.plz + ' ' + f.ort).trim()) : '<span class="platz">[PLZ Ort]</span>';
    return '<div class="fuss">' +
      '<div><b>' + e(f.name) + '</b><br>' + (f.zusatz ? e(f.zusatz) + '<br>' : '') + (f.inhaber ? 'Inhaber: ' + e(f.inhaber) + '<br>' : '') +
        p(f.strasse, 'Straße Nr.') + '<br>' + ort + '</div>' +
      '<div>' + (f.telefon ? 'Tel. ' + e(f.telefon) + '<br>' : '<span class="platz">[Telefon]</span><br>') +
        (f.email ? e(f.email) + '<br>' : '<span class="platz">[E-Mail]</span><br>') + (f.web ? e(f.web) : '') + '</div>' +
      '<div>' + (f.bank ? e(f.bank) + '<br>' : '') + 'IBAN ' + p(f.iban, 'IBAN') + (f.bic ? '<br>BIC ' + e(f.bic) : '') + '<br>' +
        (f.ustid ? 'USt-IdNr. ' + e(f.ustid) : (f.steuernummer ? 'Steuernr. ' + e(f.steuernummer) : '<span class="platz">[Steuernummer]</span>')) +
        (f.ustid && f.steuernummer ? '<br>Steuernr. ' + e(f.steuernummer) : '') + '</div>' +
    '</div>';
  }

  /* Erinnerung/Mahnung als Daten (für Ausdruck und PDF gleich). */
  function erinnerungDaten(dok, s, variante) {
    const stufe = variante === 'mahnung' ? Math.max(1, SuS.mahnstufe(dok)) : 1;
    const m = (dok.mahnungen || [])[stufe - 1];
    const ab = m && variante === 'mahnung' ? m.datum : SuS.heute();
    const frist = SuS.datum(SuS.plusTage(ab, SuS.MAHNFRIST[stufe - 1]));
    const gebuehren = SuS.mahnGebuehren(dok), bezahlt = SuS.bezahltSumme(dok);
    const offen = Math.max(0, s.zahlbetrag - bezahlt);  // Rechnungsrest nie negativ (Fund Cursor)
    const gebuehrenOffen = SuS.offenerBetrag(dok) - offen;
    const einleitung = stufe === 1
      ? 'sicher ist es im Alltag untergegangen: Für unsere Rechnung ' + dok.nummer + ' vom ' + SuS.datum(dok.datum) + ' konnten wir bisher keinen vollständigen Zahlungseingang feststellen. Die Zahlung war fällig am ' + SuS.datum(SuS.faellig(dok)) + '.'
      : stufe === 2
        ? 'leider ist unsere Rechnung ' + dok.nummer + ' vom ' + SuS.datum(dok.datum) + ' trotz Zahlungserinnerung noch nicht vollständig bezahlt. Wir bitten Sie, den offenen Betrag jetzt zu begleichen.'
        : 'trotz Erinnerung und Mahnung ist unsere Rechnung ' + dok.nummer + ' vom ' + SuS.datum(dok.datum) + ' weiterhin offen. Dies ist unsere letzte Mahnung.';
    const zeilen = [['Rechnungsbetrag', SuS.euro(s.zahlbetrag)]];
    if (bezahlt) zeilen.push(['bereits gezahlt', '−' + SuS.euro(bezahlt)]);
    zeilen.push(['offener Betrag', SuS.euro(offen)]);
    if (gebuehren) zeilen.push(['Mahngebühren' + (gebuehrenOffen !== gebuehren ? ' (offen)' : ''), SuS.euro(gebuehrenOffen)]);
    const schluss = 'Bitte überweisen Sie den Betrag bis zum ' + frist + ' auf das unten genannte Konto (Verwendungszweck: ' + dok.nummer + ').' +
      (stufe >= 3 ? ' Sollte bis dahin kein Zahlungseingang erfolgen, werden wir die Forderung ohne weitere Ankündigung gerichtlich geltend machen; Verzugszinsen und weitere Kosten behalten wir uns vor.' : '') +
      ' Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.';
    return { einleitung, zeilen, gesamt: SuS.euro(offen + gebuehrenOffen), schluss };
  }

  function erinnerungInhalt(dok, s, variante) {
    const d = erinnerungDaten(dok, s, variante);
    return '<p class="text">' + e(d.einleitung) + '</p>' +
      '<div class="summen" style="width:100mm">' + d.zeilen.map(([a, b]) => '<div><span>' + e(a) + '</span><span>' + e(b) + '</span></div>').join('') +
      '<div class="ges"><span>Bitte überweisen</span><span>' + e(d.gesamt) + '</span></div></div>' +
      '<p class="text" style="margin-top:5mm">' + e(d.schluss) + '</p>';
  }

  /* Gemeinsame Bausteine für den PDF-Erzeuger (pdf.js) – dieselben Texte wie im Ausdruck. */
  SuS.druckHilfe = { anrede: (k) => anrede(k), titelVon: (d, v) => titelVon(d, v), einleitung: (d, v, k) => standardEinleitung(d, v, k),
    schluss: (d, v) => standardSchluss(d, v), hinweise: (d, s, k, v) => hinweisDaten(d, s, k, v), erinnerung: (d, s, v) => erinnerungDaten(d, s, v) };

  /* Ganzes Dokument als HTML. variante: '' | 'auftrag' | 'erinnerung' */
  SuS.dokumentHtml = (dok, variante) => {
    const f = SuS.firmaVon(dok), k = SuS.kundeVon(dok), s = SuS.summen(dok);
    const absender = [f.name, f.strasse, ((f.plz || '') + ' ' + (f.ort || '')).trim()].filter(Boolean).map(e).join(' · ');
    const anschrift = k
      ? [k.name, k.art === 'firma' && k.ansprechpartner ? 'z. Hd. ' + k.ansprechpartner : '', k.strasse, ((k.plz || '') + ' ' + (k.ort || '')).trim()].filter(Boolean).map(e).join('<br>')
      : '<span class="platz">[Kunde wählen]</span>';
    const einl = (dok.einleitung || '').trim() || standardEinleitung(dok, variante, k);
    const schl = (dok.schluss || '').trim() || standardSchluss(dok, variante);
    let titel = titelVon(dok, variante) + (['auftrag', 'erinnerung', 'mahnung'].includes(variante) ? '' : ' ' + (dok.nummer || ''));
    if (!variante && SuS.istRechnung(dok) && !dok.fest) titel = 'ENTWURF – ' + titel;
    let inhalt;
    if (variante === 'erinnerung' || variante === 'mahnung') inhalt = erinnerungInhalt(dok, s, variante) + bezahlCode(dok, s, f, variante);
    else {
      inhalt = (einl ? '<p class="text">' + e(einl) + '</p>' : '') + tabelle(dok) + summenBlock(dok, s) + hinweise(dok, s, k, variante) +
        (schl ? '<p class="text" style="margin-top:5mm">' + e(schl) + '</p>' : '') + bezahlCode(dok, s, f);
    }
    return '<article class="a4">' +
      '<div class="briefkopf">' + LOGO + '<div><div class="name">' + e(f.name) + '</div><div class="zusatz">' + e(f.zusatz) + '</div></div></div>' +
      '<div class="oben"><div class="anschrift"><div class="absender">' + (absender || '&nbsp;') + '</div>' + anschrift + '</div>' + infoBlock(dok, variante, k) + '</div>' +
      '<h1 class="dok">' + e(titel) + '</h1>' +
      (dok.betreff ? '<div class="betreff">' + e(dok.betreff) + '</div>' : '') +
      (dok.baustelle ? '<div class="bv">Bauvorhaben: ' + e(dok.baustelle) + '</div>' : '') +
      '<p class="text">' + e(anrede(k)) + '</p>' + inhalt +
      '<div class="gruss">Mit freundlichen Grüßen<br><br>' + e(f.inhaber || f.name) + '</div>' +
      (dok.typ === 'angebot' && dok.unterschrift ? '<div class="kasten grau" style="margin-top:6mm"><b>Auftrag erteilt</b> am ' + SuS.datum(dok.unterschrift.datum) + ' durch ' + e(dok.unterschrift.name) + ':<br>' +
        '<img src="' + e(dok.unterschrift.bild) + '" alt="Unterschrift" style="height:20mm;margin-top:2mm"></div>' : '') +
      '<div class="fuellung"></div>' + fuss(f) + '</article>';
  };

  SuS.zeigeDruck = (dok, variante) => {
    SuS.druckAktuell = { dok, variante: variante || '' };
    const huelle = document.getElementById('druck');
    const name = titelVon(dok, variante) + (dok.nummer ? ' ' + dok.nummer : '');
    const fehlt = !SuS.firmaVon(dok).strasse || !SuS.firmaVon(dok).iban;
    huelle.innerHTML = '<style>' + STIL + '</style>' +
      '<div class="druck-leiste"><button class="zu" type="button" data-druck="zu">Schließen</button><span class="titel">' + e(name) + '</span>' +
      '<button class="los" type="button" data-druck="teilen">Teilen</button><button class="zu" type="button" data-druck="los">Drucken</button></div>' +
      (SuS.istRechnung(dok) && dok.fest && !variante && (SuS.kundeVon(dok) || {}).art === 'firma'
        ? '<p class="druck-tipp">E-Rechnung für Firmenkunden: <button class="zu" type="button" data-druck="zugferd" style="border:0;border-radius:8px;padding:6px 10px;font-weight:700">PDF mit E-Rechnung (ZUGFeRD)</button> ' +
          '<button class="zu" type="button" data-druck="xrechnung" style="border:0;border-radius:8px;padding:6px 10px;font-weight:700">nur XML (XRechnung)</button></p>' : '') +
      (fehlt ? '<p class="druck-tipp">Rot markiert = fehlt noch. Firmendaten unter „Mehr → Firmendaten“ eintragen.</p>' : '') +
      '<p class="druck-tipp">„Teilen“ erzeugt ein PDF für Mail, WhatsApp oder Drucken am Handy.</p>' +
      '<div class="druck-buehne"><div class="druck-rahmen"><div class="druck-skala">' + SuS.dokumentHtml(dok, variante) + '</div></div></div>';
    huelle.hidden = false;
    document.body.classList.add('drucken');
    document.title = name + ' – ' + SuS.firmaVon(dok).name;
    passeAn();
    huelle.scrollTop = 0;
  };

  function passeAn() {
    const huelle = document.getElementById('druck');
    if (huelle.hidden) return;
    const skala = huelle.querySelector('.druck-skala'), rahmen = huelle.querySelector('.druck-rahmen'), blatt = huelle.querySelector('.a4');
    if (!blatt) return;
    skala.style.transform = 'none';
    const b = blatt.offsetWidth, h = blatt.offsetHeight;
    const f = Math.min(1, (window.innerWidth - 16) / b);
    skala.style.transform = 'scale(' + f + ')';
    rahmen.style.width = Math.ceil(b * f) + 'px';
    rahmen.style.height = Math.ceil(h * f) + 'px';
    rahmen.style.margin = '0 auto';
  }
  window.addEventListener('resize', passeAn);

  SuS.schliesseDruck = () => {
    const huelle = document.getElementById('druck');
    huelle.hidden = true; huelle.innerHTML = '';
    document.body.classList.remove('drucken');
    document.title = 'Stock und Stein · Angebote & Rechnungen';
  };

  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-druck]');
    if (!b) return;
    if (b.dataset.druck === 'zu') SuS.schliesseDruck();
    if (b.dataset.druck === 'teilen' && SuS.druckAktuell) SuS.pdfTeilen(SuS.druckAktuell.dok, SuS.druckAktuell.variante);
    if (b.dataset.druck === 'xrechnung' && SuS.druckAktuell) SuS.xrechnungTeilen(SuS.druckAktuell.dok);
    if (b.dataset.druck === 'zugferd' && SuS.druckAktuell) SuS.pdfTeilen(SuS.druckAktuell.dok, '', true);
    if (b.dataset.druck === 'los') {
      const skala = document.querySelector('.druck-skala');
      if (skala) skala.style.transform = 'none';
      setTimeout(() => { window.print(); passeAn(); }, 30);
    }
  });
})();
