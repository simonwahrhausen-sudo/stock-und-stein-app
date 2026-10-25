/* Stock und Stein – empfangene E-Rechnungen lesbar anzeigen (XRechnung UBL und CII/ZUGFeRD-XML). Seit 2025 müssen
   Betriebe E-Rechnungen empfangen können; eine XML-Datei ist ohne Werkzeug kaum lesbar. Die Datei wird nur gelesen
   und als Text angezeigt (alles maskiert), nichts wird ausgeführt oder verschickt. */
'use strict';

(function () {
  const e = SuS.esc, A = SuS.aktionen;
  const alle = (knoten, name) => (knoten ? Array.from(knoten.getElementsByTagNameNS('*', name)) : []);
  const erst = (knoten, ...pfad) => {
    let k = knoten;
    for (const name of pfad) { if (!k) return null; k = Array.from(k.children || []).find((c) => c.localName === name) || null; }
    return k;
  };
  const txt = (k) => (k ? String(k.textContent || '').trim() : '');
  const tief = (knoten, name) => txt(alle(knoten, name)[0]);
  const euro = (t) => { const n = Number(t); return Number.isFinite(n) && t !== '' ? SuS.euro(Math.round(n * 100)) : (t || '–'); };
  const datum = (t) => { const s = String(t || '').replace(/[^0-9-]/g, ''); return /^\d{8}$/.test(s) ? s.slice(6, 8) + '.' + s.slice(4, 6) + '.' + s.slice(0, 4) : /^\d{4}-\d{2}-\d{2}/.test(s) ? SuS.datum(s.slice(0, 10)) : (t || '–'); };

  /* Liest die wichtigsten Angaben. Gibt ein einfaches Objekt zurück oder wirft einen verständlichen Fehler. */
  SuS.eRechnungLesen = (xmlText) => {
    if (typeof DOMParser === 'undefined') throw new Error('Anzeigen ist in diesem Browser nicht möglich.');
    if (String(xmlText).length > 5000000) throw new Error('Datei zu groß.');
    if (/<!DOCTYPE|<!ENTITY/i.test(xmlText)) throw new Error('Datei enthält unzulässige Bestandteile (DOCTYPE/ENTITY).');
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Keine gültige XML-Datei.');
    const w = doc.documentElement;
    if (w.localName === 'Invoice' || w.localName === 'CreditNote') {
      const partei = (rolle) => {
        const p = erst(w, rolle, 'Party');
        return { name: txt(erst(p, 'PartyLegalEntity', 'RegistrationName')) || tief(erst(p, 'PartyName'), 'Name'),
          adresse: [tief(erst(p, 'PostalAddress'), 'StreetName'), [tief(erst(p, 'PostalAddress'), 'PostalZone'), tief(erst(p, 'PostalAddress'), 'CityName')].join(' ').trim()].filter(Boolean).join(', '),
          ustid: alle(p, 'PartyTaxScheme').map((x) => tief(x, 'CompanyID')).filter(Boolean).join(' / '), email: tief(erst(p, 'Contact'), 'ElectronicMail') || txt(erst(p, 'EndpointID')) };
      };
      const summe = erst(w, 'LegalMonetaryTotal');
      return {
        format: 'XRechnung (UBL)', art: w.localName === 'CreditNote' ? 'Gutschrift' : ({ 380: 'Rechnung', 326: 'Teil-/Abschlagsrechnung', 381: 'Gutschrift', 384: 'Korrekturrechnung' }[txt(erst(w, 'InvoiceTypeCode'))] || 'Rechnung'),
        nummer: txt(erst(w, 'ID')), datum: datum(txt(erst(w, 'IssueDate'))), faellig: datum(txt(erst(w, 'DueDate'))),
        verkaeufer: partei('AccountingSupplierParty'), kaeufer: partei('AccountingCustomerParty'),
        positionen: alle(w, w.localName === 'CreditNote' ? 'CreditNoteLine' : 'InvoiceLine').map((z) => {
          const m = erst(z, w.localName === 'CreditNote' ? 'CreditedQuantity' : 'InvoicedQuantity');
          return { text: tief(erst(z, 'Item'), 'Name'), menge: txt(m), einheit: m ? m.getAttribute('unitCode') || '' : '', preis: tief(erst(z, 'Price'), 'PriceAmount'), betrag: txt(erst(z, 'LineExtensionAmount')) };
        }),
        netto: txt(erst(summe, 'TaxExclusiveAmount')), steuer: txt(erst(erst(w, 'TaxTotal'), 'TaxAmount')), brutto: txt(erst(summe, 'TaxInclusiveAmount')),
        zahlbetrag: txt(erst(summe, 'PayableAmount')), iban: txt(erst(erst(w, 'PaymentMeans'), 'PayeeFinancialAccount', 'ID')),
        zweck: txt(erst(erst(w, 'PaymentMeans'), 'PaymentID')) || txt(erst(w, 'ID')), notizen: alle(w, 'Note').slice(0, 6).map(txt).filter(Boolean)
      };
    }
    if (w.localName === 'CrossIndustryInvoice') {
      const handel = alle(w, 'SupplyChainTradeTransaction')[0];
      const abrechnung = alle(handel, 'ApplicableHeaderTradeSettlement')[0], summe = alle(abrechnung, 'SpecifiedTradeSettlementHeaderMonetarySummation')[0];
      const partei = (name) => {
        const p = alle(handel, name)[0], a = alle(p, 'PostalTradeAddress')[0];
        return { name: txt(erst(p, 'Name')), adresse: [tief(a, 'LineOne'), [tief(a, 'PostcodeCode'), tief(a, 'CityName')].join(' ').trim()].filter(Boolean).join(', '),
          ustid: alle(p, 'SpecifiedTaxRegistration').map((x) => tief(x, 'ID')).filter(Boolean).join(' / '), email: tief(p, 'URIID') };
      };
      const kopf = alle(w, 'ExchangedDocument')[0];
      return {
        format: 'ZUGFeRD/Factur-X (CII)', art: ({ 380: 'Rechnung', 326: 'Teil-/Abschlagsrechnung', 381: 'Gutschrift', 384: 'Korrekturrechnung' }[txt(erst(kopf, 'TypeCode'))] || 'Rechnung'),
        nummer: txt(erst(kopf, 'ID')), datum: datum(tief(erst(kopf, 'IssueDateTime'), 'DateTimeString')), faellig: datum(tief(alle(abrechnung, 'SpecifiedTradePaymentTerms')[0], 'DateTimeString')),
        verkaeufer: partei('SellerTradeParty'), kaeufer: partei('BuyerTradeParty'),
        positionen: alle(handel, 'IncludedSupplyChainTradeLineItem').map((z) => {
          const m = alle(z, 'BilledQuantity')[0];
          return { text: tief(alle(z, 'SpecifiedTradeProduct')[0], 'Name'), menge: txt(m), einheit: m ? m.getAttribute('unitCode') || '' : '',
            preis: tief(alle(z, 'NetPriceProductTradePrice')[0], 'ChargeAmount'), betrag: tief(alle(z, 'SpecifiedTradeSettlementLineMonetarySummation')[0], 'LineTotalAmount') };
        }),
        netto: tief(summe, 'TaxBasisTotalAmount'), steuer: tief(summe, 'TaxTotalAmount'), brutto: tief(summe, 'GrandTotalAmount'), zahlbetrag: tief(summe, 'DuePayableAmount'),
        iban: tief(alle(abrechnung, 'PayeePartyCreditorFinancialAccount')[0], 'IBANID'), zweck: tief(abrechnung, 'PaymentReference') || txt(erst(kopf, 'ID')),
        notizen: alle(kopf, 'IncludedNote').slice(0, 6).map((n) => tief(n, 'Content')).filter(Boolean)
      };
    }
    throw new Error('Unbekanntes Format – erwartet wird eine XRechnung (UBL) oder ZUGFeRD/Factur-X-XML.');
  };

  function zeigen(r) {
    const partei = (titel, p) => '<div class="karte"><h3>' + titel + '</h3>' + e(p.name || '–') + (p.adresse ? '<br>' + e(p.adresse) : '') +
      (p.ustid ? '<div class="unterzeile">Steuer: ' + e(p.ustid) + '</div>' : '') + (p.email ? '<div class="unterzeile">' + e(p.email) + '</div>' : '') + '</div>';
    SuS.blatt('Empfangene E-Rechnung', '<div class="vorschau-betrag"><span>' + e(r.art + ' ' + r.nummer) + '</span><span>' + e(euro(r.zahlbetrag || r.brutto)) + '</span></div>' +
      '<p class="unterzeile" style="margin-top:0">' + e(r.format) + ' · vom ' + e(r.datum) + (r.faellig !== '–' ? ' · fällig ' + e(r.faellig) : '') + '</p>' +
      partei('Von', r.verkaeufer) + partei('An', r.kaeufer) +
      '<div class="karte"><h3>Positionen</h3><ul class="liste" style="box-shadow:none">' + r.positionen.slice(0, 200).map((p) =>
        '<li class="zeile" style="cursor:default"><div class="haupt"><div class="titel" style="white-space:normal">' + e(p.text || '–') + '</div><div class="klein">' +
        e(p.menge + ' ' + p.einheit + ' × ' + euro(p.preis)) + '</div></div><div class="betrag">' + e(euro(p.betrag)) + '</div></li>').join('') + '</ul></div>' +
      '<div class="karte summen"><div><span>Netto</span><span>' + e(euro(r.netto)) + '</span></div><div><span>Umsatzsteuer</span><span>' + e(euro(r.steuer)) + '</span></div>' +
        '<div class="gesamt"><span>Zu zahlen</span><span>' + e(euro(r.zahlbetrag || r.brutto)) + '</span></div></div>' +
      (r.iban ? '<div class="karte"><h3>Überweisung</h3>IBAN ' + e(r.iban) + '<br>Verwendungszweck: ' + e(r.zweck) + '</div>' : '') +
      (r.notizen.length ? '<div class="karte"><h3>Hinweise</h3>' + r.notizen.map((n) => '<p style="margin:4px 0">' + e(n) + '</p>').join('') + '</div>' : '') +
      '<button type="button" class="knopf haupt breit" data-a="eRechnungAlsAusgabe">Als Ausgabe übernehmen</button>' +
      '<p class="unterzeile">Die Originaldatei bitte aufbewahren (8 Jahre) und an den Steuerberater weitergeben.</p>');
    zuletzt = r;
  }
  let zuletzt = null;
  A.eRechnungAlsAusgabe = () => { if (zuletzt && SuS.ausgabeAusERechnung) SuS.ausgabeAusERechnung(zuletzt); };

  A.eRechnungOeffnen = () => {
    SuS.blatt('E-Rechnung ansehen', '<p class="unterzeile" style="margin-top:0">XML-Datei einer empfangenen E-Rechnung wählen (XRechnung oder ZUGFeRD-XML). Sie wird nur angezeigt, nicht gespeichert.</p>' +
      '<label class="knopf haupt breit">Datei wählen<input type="file" accept=".xml,application/xml,text/xml" data-erechnung hidden></label>' +
      '<details style="margin-top:12px"><summary class="unterzeile">oder Text einfügen</summary><label class="feld"><textarea name="xml" style="min-height:140px;font-size:12px"></textarea></label>' +
      '<button type="submit" class="knopf breit">Anzeigen</button></details>', (fd) => {
      try { const r = SuS.eRechnungLesen(String(fd.get('xml') || '')); setTimeout(() => zeigen(r), 0); return true; } catch (x) { SuS.melde(x.message, true); return false; }
    }, 'Anzeigen');
  };
  document.addEventListener('change', (ev) => {
    if (!ev.target.matches('[data-erechnung]')) return;
    const datei = ev.target.files[0]; if (!datei) return;
    if (datei.size > 5000000) { SuS.melde('Datei zu groß.', true); return; }
    const r = new FileReader();
    r.onload = () => { try { const daten = SuS.eRechnungLesen(String(r.result || '')); SuS.blattZu(); setTimeout(() => zeigen(daten), 0); } catch (x) { SuS.melde(x.message, true); } };
    r.readAsText(datei);
  });
})();
