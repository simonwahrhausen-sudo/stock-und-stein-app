/* Stock und Stein – E-Rechnung im Format XRechnung 3.0 (UBL 2.1, CIUS der EN 16931) für Firmenkunden.
   Geprüft mit dem offiziellen KoSIT-Validator (Konfiguration XRechnung 3.0.2). Eigene Umsetzung nach den
   öffentlichen Spezifikationen; keine Fremdbibliotheken. */
'use strict';

(function () {
  const x = (t) => String(t == null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[c]))
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const betrag = (cent) => ((cent || 0) / 100).toFixed(2);
  /* Menge mit voller Genauigkeit (bis 6 Nachkommastellen), damit Menge × Preis den Positionsbetrag ergibt (PEPPOL-EN16931-R120) */
  const menge = (n) => String(Number((Number(n) || 0).toFixed(6)));
  /* Einheiten nach UN/ECE Empfehlung 20 */
  const EINHEIT = { 'm²': 'MTK', 'qm': 'MTK', 'm2': 'MTK', 'm': 'MTR', 'lfm': 'MTR', 'm³': 'MTQ', 'cbm': 'MTQ', 'm3': 'MTQ', 'Stk': 'H87', 'Stück': 'H87',
    'Std': 'HUR', 'h': 'HUR', 'psch': 'LS', 'pauschal': 'LS', 'Tag': 'DAY', 't': 'TNE', 'kg': 'KGM', 'Sack': 'XSA', 'l': 'LTR' };
  SuS.einheitCode = (e) => EINHEIT[String(e || '').trim()] || 'C62';

  /* Was fehlt für eine gültige XRechnung? (Pflichtangaben der XRechnung über die normale Rechnung hinaus) */
  SuS.xrechnungFehlt = (dok) => {
    const f = SuS.firmaVon(dok), k = SuS.kundeVon(dok), s = SuS.summen(dok), fehlt = [];
    if (!SuS.istRechnung(dok) || !dok.fest) fehlt.push('Nur gestellte Rechnungen');
    if (dok.typ === 'storno' && (dok.abschlaege || []).length) fehlt.push('Storno einer Schlussrechnung bitte als PDF senden');
    if (!f.email) fehlt.push('E-Mail-Adresse der Firma (Pflicht in der XRechnung)');
    if (!f.telefon) fehlt.push('Telefon der Firma (Pflicht in der XRechnung)');
    if (!f.inhaber) fehlt.push('Ansprechpartner/Inhaber der Firma');
    if (!f.iban) fehlt.push('IBAN');
    if (!f.ustid && !f.steuernummer) fehlt.push('USt-IdNr. oder Steuernummer');
    if (!k) fehlt.push('Kunde');
    else {
      if (!k.email) fehlt.push('E-Mail-Adresse des Kunden (Pflicht in der XRechnung)');
      if (!k.strasse || !k.plz || !k.ort) fehlt.push('Anschrift des Kunden');
      if (s.modus === '13b' && !k.ustid) fehlt.push('USt-IdNr. des Kunden (bei § 13b Pflicht)');
    }
    if (s.modus === '13b' && !f.ustid) fehlt.push('Eigene USt-IdNr. (bei § 13b Pflicht)');
    return fehlt;
  };

  /* Baustelle als Lieferanschrift nur, wenn „Straße, PLZ Ort“ erkennbar ist (BR-DE-10/11 verlangen Ort und PLZ). */
  const ortTeile = (text) => /^\s*(.+?),\s*(\d{5})\s+(.+?)\s*$/.exec(String(text || ''));
  function lieferort(text) {
    const m = ortTeile(text);
    if (!m) return '';
    return '<cac:Delivery><cac:DeliveryLocation><cac:Address><cbc:StreetName>' + x(m[1]) + '</cbc:StreetName><cbc:CityName>' + x(m[3]) + '</cbc:CityName><cbc:PostalZone>' + m[2] +
      '</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:Address></cac:DeliveryLocation></cac:Delivery>';
  }

  /* Zahlungsbedingungen; Skonto im XRechnung-Format „#SKONTO#TAGE=n#PROZENT=p.pp#“ (eigene Zeile mit Zeilenende),
     Basis ist der Zahlbetrag (BASISBETRAG nur, wenn er vom Rechnungsbetrag abweicht, z. B. Schlussrechnung). */
  function skontoText(dok) {
    const sk = SuS.skonto(dok), s = SuS.summen(dok);
    if (!sk) return 'Zahlbar ohne Abzug bis ' + SuS.datum(SuS.faellig(dok));
    return 'Zahlbar bis ' + SuS.datum(SuS.faellig(dok)) + '; bei Zahlung bis ' + SuS.datum(sk.bis) + ' ' + sk.prozent.toFixed(2).replace('.', ',') + ' % Skonto.\n' +
      '#SKONTO#TAGE=' + sk.tage + '#PROZENT=' + sk.prozent.toFixed(2) + '#' + (s.zahlbetrag !== s.brutto ? 'BASISBETRAG=' + (s.zahlbetrag / 100).toFixed(2) + '#' : '') + '\n';
  }
  SuS.xrechnung = (dok) => {
    const fehlt = SuS.xrechnungFehlt(dok);
    if (fehlt.length) throw new Error('Für die E-Rechnung fehlt noch: ' + fehlt.join(', ') + '.');
    const f = SuS.firmaVon(dok), k = SuS.kundeVon(dok), roh = SuS.summen(dok);
    /* Storno → Gutschrift (CreditNote, Typ 381) mit positiven Beträgen und Verweis auf die Originalrechnung */
    const gutschrift = dok.typ === 'storno', vz = gutschrift ? -1 : 1;
    const s = Object.assign({}, roh, { zwischen: vz * roh.zwischen, rabatt: vz * roh.rabatt, netto: vz * roh.netto, mwst: vz * roh.mwst, brutto: vz * roh.brutto, zahlbetrag: vz * roh.zahlbetrag });
    const orig = gutschrift ? SuS.dok(dok.vonId) : null;
    const kat = s.modus === 'klein' ? 'E' : s.modus === '13b' ? 'AE' : 'S';
    const satz = kat === 'S' ? String(s.satz) : '0';
    const grund = kat === 'E' ? 'Kleinunternehmer gemäß § 19 UStG' : kat === 'AE' ? 'Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)' : '';
    const steuerKat = (tag) => '<cac:' + tag + '><cbc:ID>' + kat + '</cbc:ID><cbc:Percent>' + satz + '</cbc:Percent>' +
      (tag === 'TaxCategory' && grund ? '<cbc:TaxExemptionReason>' + x(grund) + '</cbc:TaxExemptionReason>' : '') + '<cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:' + tag + '>';
    const typ = gutschrift ? '381' : dok.typ === 'abschlag' ? '326' : '380';
    const Wurzel = gutschrift ? 'CreditNote' : 'Invoice', Zeile = gutschrift ? 'CreditNoteLine' : 'InvoiceLine', Menge = gutschrift ? 'CreditedQuantity' : 'InvoicedQuantity';
    const adresse = (strasse, plz, ort) => '<cac:PostalAddress><cbc:StreetName>' + x(strasse) + '</cbc:StreetName><cbc:CityName>' + x(ort) + '</cbc:CityName><cbc:PostalZone>' + x(plz) +
      '</cbc:PostalZone><cac:Country><cbc:IdentificationCode>DE</cbc:IdentificationCode></cac:Country></cac:PostalAddress>';
    const notizen = [];
    if (dok.betreff) notizen.push(dok.betreff);
    if (dok.baustelle) notizen.push('Bauvorhaben: ' + dok.baustelle);
    if (grund) notizen.push(grund);
    for (const a of s.abzuege) notizen.push('Abgezogener bezahlter Abschlag ' + a.nummer + ' vom ' + SuS.datum(a.datum) + ': netto ' + betrag(a.netto) + ' EUR, USt ' + betrag(a.mwst) + ' EUR, brutto ' + betrag(a.brutto) + ' EUR');
    const von = dok.leistungVon || dok.datum, bis = dok.leistungBis || von;
    const steuerAngabe = (f.ustid ? '<cac:PartyTaxScheme><cbc:CompanyID>' + x(f.ustid.replace(/\s+/g, '')) + '</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>' : '') +
      (f.steuernummer ? '<cac:PartyTaxScheme><cbc:CompanyID>' + x(f.steuernummer) + '</cbc:CompanyID><cac:TaxScheme><cbc:ID>FC</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>' : '');
    const zeilen = [];
    let n = 0;
    for (const p of dok.positionen) {
      if (p.typ !== 'pos' || p.bedarf) continue;
      n++;
      if (SuS.runde(Number(menge(p.menge)) * p.preis) !== SuS.posBetrag(p)) throw new Error('Position „' + p.text + '“: Menge zu ungenau für die E-Rechnung – bitte runden.');
      zeilen.push('<cac:' + Zeile + '><cbc:ID>' + n + '</cbc:ID><cbc:' + Menge + ' unitCode="' + SuS.einheitCode(p.einheit) + '">' + menge(vz * p.menge) + '</cbc:' + Menge + '>' +
        '<cbc:LineExtensionAmount currencyID="EUR">' + betrag(vz * SuS.posBetrag(p)) + '</cbc:LineExtensionAmount><cac:Item>' +
        (p.beschreibung ? '<cbc:Description>' + x(p.beschreibung) + '</cbc:Description>' : '') + '<cbc:Name>' + x(p.text || 'Leistung') + '</cbc:Name>' +
        steuerKat('ClassifiedTaxCategory') + '</cac:Item><cac:Price><cbc:PriceAmount currencyID="EUR">' + betrag(p.preis) + '</cbc:PriceAmount></cac:Price></cac:' + Zeile + '>');
    }
    if (!n) throw new Error('Die Rechnung hat keine Positionen.');
    const prepaid = s.brutto - s.zahlbetrag;
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<ubl:' + Wurzel + ' xmlns:ubl="urn:oasis:names:specification:ubl:schema:xsd:' + Wurzel + '-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">' +
      '<cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</cbc:CustomizationID>' +
      '<cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>' +
      '<cbc:ID>' + x(dok.nummer) + '</cbc:ID><cbc:IssueDate>' + dok.datum + '</cbc:IssueDate>' + (gutschrift ? '' : '<cbc:DueDate>' + SuS.faellig(dok) + '</cbc:DueDate>') +
      '<cbc:' + (gutschrift ? 'CreditNote' : 'Invoice') + 'TypeCode>' + typ + '</cbc:' + (gutschrift ? 'CreditNote' : 'Invoice') + 'TypeCode>' + notizen.map((t) => '<cbc:Note>' + x(t) + '</cbc:Note>').join('') +
      '<cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode><cbc:BuyerReference>' + x(k.referenz || ('Kunden-Nr. ' + (k.nr || '-'))) + '</cbc:BuyerReference>' +
      '<cac:InvoicePeriod><cbc:StartDate>' + von + '</cbc:StartDate><cbc:EndDate>' + bis + '</cbc:EndDate></cac:InvoicePeriod>' +
      (orig ? '<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>' + x(orig.nummer) + '</cbc:ID><cbc:IssueDate>' + orig.datum + '</cbc:IssueDate></cac:InvoiceDocumentReference></cac:BillingReference>' : '') +
      /* Schlussrechnung: bezahlte Abschläge zusätzlich als strukturierte Vorbelege (BG-3, Fund Cursor) */
      (!gutschrift ? s.abzuege.map((a) => '<cac:BillingReference><cac:InvoiceDocumentReference><cbc:ID>' + x(a.nummer) + '</cbc:ID>' + (a.datum ? '<cbc:IssueDate>' + a.datum + '</cbc:IssueDate>' : '') +
        '</cac:InvoiceDocumentReference></cac:BillingReference>').join('') : '') +
      '<cac:AccountingSupplierParty><cac:Party><cbc:EndpointID schemeID="EM">' + x(f.email) + '</cbc:EndpointID>' +
      /* Ohne USt-IdNr. braucht der Verkäufer eine Kennung (BR-CO-26) – dann die Steuernummer */
      (!f.ustid && f.steuernummer ? '<cac:PartyIdentification><cbc:ID>' + x(f.steuernummer) + '</cbc:ID></cac:PartyIdentification>' : '') +
      '<cac:PartyName><cbc:Name>' + x(f.name) + '</cbc:Name></cac:PartyName>' + adresse(f.strasse, f.plz, f.ort) + steuerAngabe +
      '<cac:PartyLegalEntity><cbc:RegistrationName>' + x(f.name + (f.inhaber ? ', Inh. ' + f.inhaber : '')) + '</cbc:RegistrationName></cac:PartyLegalEntity>' +
      '<cac:Contact><cbc:Name>' + x(f.inhaber) + '</cbc:Name><cbc:Telephone>' + x(f.telefon) + '</cbc:Telephone><cbc:ElectronicMail>' + x(f.email) + '</cbc:ElectronicMail></cac:Contact>' +
      '</cac:Party></cac:AccountingSupplierParty>' +
      '<cac:AccountingCustomerParty><cac:Party><cbc:EndpointID schemeID="EM">' + x(k.email) + '</cbc:EndpointID>' +
      (k.nr ? '<cac:PartyIdentification><cbc:ID>' + x(k.nr) + '</cbc:ID></cac:PartyIdentification>' : '') +
      '<cac:PartyName><cbc:Name>' + x(k.name) + '</cbc:Name></cac:PartyName>' + adresse(k.strasse, k.plz, k.ort) +
      (k.ustid ? '<cac:PartyTaxScheme><cbc:CompanyID>' + x(k.ustid.replace(/\s+/g, '')) + '</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:PartyTaxScheme>' : '') +
      '<cac:PartyLegalEntity><cbc:RegistrationName>' + x(k.name) + '</cbc:RegistrationName></cac:PartyLegalEntity>' +
      (k.ansprechpartner ? '<cac:Contact><cbc:Name>' + x(k.ansprechpartner) + '</cbc:Name></cac:Contact>' : '') +
      '</cac:Party></cac:AccountingCustomerParty>' +
      lieferort(dok.baustelle) +
      '<cac:PaymentMeans><cbc:PaymentMeansCode>58</cbc:PaymentMeansCode><cbc:PaymentID>' + x(dok.nummer) + '</cbc:PaymentID><cac:PayeeFinancialAccount><cbc:ID>' +
        x(f.iban.replace(/\s+/g, '')) + '</cbc:ID><cbc:Name>' + x(f.name) + '</cbc:Name>' + (f.bic ? '<cac:FinancialInstitutionBranch><cbc:ID>' + x(f.bic.replace(/\s+/g, '')) + '</cbc:ID></cac:FinancialInstitutionBranch>' : '') +
        '</cac:PayeeFinancialAccount></cac:PaymentMeans>' +
      '<cac:PaymentTerms><cbc:Note>' + x(gutschrift ? 'Gutschrift zur Rechnung ' + (orig ? orig.nummer : '') + '; bereits gezahlte Beträge werden erstattet oder verrechnet.' : skontoText(dok)) + '</cbc:Note></cac:PaymentTerms>' +
      (s.rabatt ? '<cac:AllowanceCharge><cbc:ChargeIndicator>false</cbc:ChargeIndicator><cbc:AllowanceChargeReason>Nachlass</cbc:AllowanceChargeReason>' +
        '<cbc:MultiplierFactorNumeric>' + s.rabattProzent + '</cbc:MultiplierFactorNumeric><cbc:Amount currencyID="EUR">' + betrag(s.rabatt) + '</cbc:Amount>' +
        '<cbc:BaseAmount currencyID="EUR">' + betrag(s.zwischen) + '</cbc:BaseAmount>' + steuerKat('TaxCategory').replace(/<cbc:TaxExemptionReason>.*?<\/cbc:TaxExemptionReason>/, '') + '</cac:AllowanceCharge>' : '') +
      '<cac:TaxTotal><cbc:TaxAmount currencyID="EUR">' + betrag(s.mwst) + '</cbc:TaxAmount><cac:TaxSubtotal><cbc:TaxableAmount currencyID="EUR">' + betrag(s.netto) +
        '</cbc:TaxableAmount><cbc:TaxAmount currencyID="EUR">' + betrag(s.mwst) + '</cbc:TaxAmount>' + steuerKat('TaxCategory') + '</cac:TaxSubtotal></cac:TaxTotal>' +
      '<cac:LegalMonetaryTotal><cbc:LineExtensionAmount currencyID="EUR">' + betrag(s.zwischen) + '</cbc:LineExtensionAmount>' +
        '<cbc:TaxExclusiveAmount currencyID="EUR">' + betrag(s.netto) + '</cbc:TaxExclusiveAmount><cbc:TaxInclusiveAmount currencyID="EUR">' + betrag(s.brutto) + '</cbc:TaxInclusiveAmount>' +
        (s.rabatt ? '<cbc:AllowanceTotalAmount currencyID="EUR">' + betrag(s.rabatt) + '</cbc:AllowanceTotalAmount>' : '') +
        (prepaid ? '<cbc:PrepaidAmount currencyID="EUR">' + betrag(prepaid) + '</cbc:PrepaidAmount>' : '') +
        '<cbc:PayableAmount currencyID="EUR">' + betrag(s.zahlbetrag) + '</cbc:PayableAmount></cac:LegalMonetaryTotal>' +
      zeilen.join('') + '</ubl:' + Wurzel + '>\n';
  };

  /* ---------- ZUGFeRD/Factur-X: dieselbe Rechnung als CII-XML (UN/CEFACT D16B), Profil XRECHNUNG – sie wird in das
     PDF/A-3 eingebettet (siehe pdf.js). Beträge und Regeln wie oben; Reihenfolge der Elemente nach dem CII-Schema. */
  const tag = (d) => '<udt:DateTimeString format="102">' + String(d).replace(/-/g, '') + '</udt:DateTimeString>';
  SuS.zugferdXml = (dok) => {
    const fehlt = SuS.xrechnungFehlt(dok);
    if (fehlt.length) throw new Error('Für die E-Rechnung fehlt noch: ' + fehlt.join(', ') + '.');
    const f = SuS.firmaVon(dok), k = SuS.kundeVon(dok), roh = SuS.summen(dok);
    const gutschrift = dok.typ === 'storno', vz = gutschrift ? -1 : 1;
    const s = Object.assign({}, roh, { zwischen: vz * roh.zwischen, rabatt: vz * roh.rabatt, netto: vz * roh.netto, mwst: vz * roh.mwst, brutto: vz * roh.brutto, zahlbetrag: vz * roh.zahlbetrag });
    const orig = gutschrift ? SuS.dok(dok.vonId) : null;
    const kat = s.modus === 'klein' ? 'E' : s.modus === '13b' ? 'AE' : 'S';
    const satz = kat === 'S' ? String(s.satz) : '0';
    const grund = kat === 'E' ? 'Kleinunternehmer gemäß § 19 UStG' : kat === 'AE' ? 'Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)' : '';
    const eur = (c) => betrag(c);
    const steuer = (mitBetrag) => '<ram:ApplicableTradeTax>' + (mitBetrag ? '<ram:CalculatedAmount>' + eur(s.mwst) + '</ram:CalculatedAmount>' : '') + '<ram:TypeCode>VAT</ram:TypeCode>' +
      (mitBetrag && grund ? '<ram:ExemptionReason>' + x(grund) + '</ram:ExemptionReason>' : '') + (mitBetrag ? '<ram:BasisAmount>' + eur(s.netto) + '</ram:BasisAmount>' : '') +
      '<ram:CategoryCode>' + kat + '</ram:CategoryCode><ram:RateApplicablePercent>' + satz + '</ram:RateApplicablePercent></ram:ApplicableTradeTax>';
    const adresse = (strasse, plz, ort) => '<ram:PostalTradeAddress><ram:PostcodeCode>' + x(plz) + '</ram:PostcodeCode><ram:LineOne>' + x(strasse) + '</ram:LineOne><ram:CityName>' + x(ort) +
      '</ram:CityName><ram:CountryID>DE</ram:CountryID></ram:PostalTradeAddress>';
    const notizen = [];
    if (dok.betreff) notizen.push(dok.betreff);
    if (dok.baustelle) notizen.push('Bauvorhaben: ' + dok.baustelle);
    if (grund) notizen.push(grund);
    for (const a of s.abzuege) notizen.push('Abgezogener bezahlter Abschlag ' + a.nummer + ' vom ' + SuS.datum(a.datum) + ': netto ' + betrag(a.netto) + ' EUR, USt ' + betrag(a.mwst) + ' EUR, brutto ' + betrag(a.brutto) + ' EUR');
    const von = dok.leistungVon || dok.datum, bis = dok.leistungBis || von;
    const zeilen = [];
    let n = 0;
    for (const p of dok.positionen) {
      if (p.typ !== 'pos' || p.bedarf) continue;
      n++;
      if (SuS.runde(Number(menge(p.menge)) * p.preis) !== SuS.posBetrag(p)) throw new Error('Position „' + p.text + '“: Menge zu ungenau für die E-Rechnung – bitte runden.');
      zeilen.push('<ram:IncludedSupplyChainTradeLineItem><ram:AssociatedDocumentLineDocument><ram:LineID>' + n + '</ram:LineID></ram:AssociatedDocumentLineDocument>' +
        '<ram:SpecifiedTradeProduct><ram:Name>' + x(p.text || 'Leistung') + '</ram:Name>' + (p.beschreibung ? '<ram:Description>' + x(p.beschreibung) + '</ram:Description>' : '') + '</ram:SpecifiedTradeProduct>' +
        '<ram:SpecifiedLineTradeAgreement><ram:NetPriceProductTradePrice><ram:ChargeAmount>' + eur(p.preis) + '</ram:ChargeAmount></ram:NetPriceProductTradePrice></ram:SpecifiedLineTradeAgreement>' +
        '<ram:SpecifiedLineTradeDelivery><ram:BilledQuantity unitCode="' + SuS.einheitCode(p.einheit) + '">' + menge(vz * p.menge) + '</ram:BilledQuantity></ram:SpecifiedLineTradeDelivery>' +
        '<ram:SpecifiedLineTradeSettlement>' + steuer(false) + '<ram:SpecifiedTradeSettlementLineMonetarySummation><ram:LineTotalAmount>' + eur(vz * SuS.posBetrag(p)) +
        '</ram:LineTotalAmount></ram:SpecifiedTradeSettlementLineMonetarySummation></ram:SpecifiedLineTradeSettlement></ram:IncludedSupplyChainTradeLineItem>');
    }
    if (!n) throw new Error('Die Rechnung hat keine Positionen.');
    const prepaid = s.brutto - s.zahlbetrag, m = ortTeile(dok.baustelle);
    const vorbelege = (gutschrift && orig ? [{ nummer: orig.nummer, datum: orig.datum }] : s.abzuege);
    return '<?xml version="1.0" encoding="UTF-8"?>\n' +
      '<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100" xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"' +
      ' xmlns:qdt="urn:un:unece:uncefact:data:standard:QualifiedDataType:100" xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">' +
      '<rsm:ExchangedDocumentContext><ram:BusinessProcessSpecifiedDocumentContextParameter><ram:ID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</ram:ID></ram:BusinessProcessSpecifiedDocumentContextParameter>' +
      '<ram:GuidelineSpecifiedDocumentContextParameter><ram:ID>urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0</ram:ID></ram:GuidelineSpecifiedDocumentContextParameter></rsm:ExchangedDocumentContext>' +
      '<rsm:ExchangedDocument><ram:ID>' + x(dok.nummer) + '</ram:ID><ram:TypeCode>' + (gutschrift ? '381' : dok.typ === 'abschlag' ? '326' : '380') + '</ram:TypeCode>' +
      '<ram:IssueDateTime>' + tag(dok.datum) + '</ram:IssueDateTime>' + notizen.map((t) => '<ram:IncludedNote><ram:Content>' + x(t) + '</ram:Content></ram:IncludedNote>').join('') + '</rsm:ExchangedDocument>' +
      '<rsm:SupplyChainTradeTransaction>' + zeilen.join('') +
      '<ram:ApplicableHeaderTradeAgreement><ram:BuyerReference>' + x(k.referenz || ('Kunden-Nr. ' + (k.nr || '-'))) + '</ram:BuyerReference>' +
      '<ram:SellerTradeParty>' + (!f.ustid && f.steuernummer ? '<ram:ID>' + x(f.steuernummer) + '</ram:ID>' : '') + '<ram:Name>' + x(f.name + (f.inhaber ? ', Inh. ' + f.inhaber : '')) + '</ram:Name>' +
      '<ram:DefinedTradeContact><ram:PersonName>' + x(f.inhaber) + '</ram:PersonName><ram:TelephoneUniversalCommunication><ram:CompleteNumber>' + x(f.telefon) + '</ram:CompleteNumber></ram:TelephoneUniversalCommunication>' +
      '<ram:EmailURIUniversalCommunication><ram:URIID>' + x(f.email) + '</ram:URIID></ram:EmailURIUniversalCommunication></ram:DefinedTradeContact>' +
      adresse(f.strasse, f.plz, f.ort) + '<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + x(f.email) + '</ram:URIID></ram:URIUniversalCommunication>' +
      (f.ustid ? '<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">' + x(f.ustid.replace(/\s+/g, '')) + '</ram:ID></ram:SpecifiedTaxRegistration>' : '') +
      (f.steuernummer ? '<ram:SpecifiedTaxRegistration><ram:ID schemeID="FC">' + x(f.steuernummer) + '</ram:ID></ram:SpecifiedTaxRegistration>' : '') + '</ram:SellerTradeParty>' +
      '<ram:BuyerTradeParty>' + (k.nr ? '<ram:ID>' + x(k.nr) + '</ram:ID>' : '') + '<ram:Name>' + x(k.name) + '</ram:Name>' +
      (k.ansprechpartner ? '<ram:DefinedTradeContact><ram:PersonName>' + x(k.ansprechpartner) + '</ram:PersonName></ram:DefinedTradeContact>' : '') +
      adresse(k.strasse, k.plz, k.ort) + '<ram:URIUniversalCommunication><ram:URIID schemeID="EM">' + x(k.email) + '</ram:URIID></ram:URIUniversalCommunication>' +
      (k.ustid ? '<ram:SpecifiedTaxRegistration><ram:ID schemeID="VA">' + x(k.ustid.replace(/\s+/g, '')) + '</ram:ID></ram:SpecifiedTaxRegistration>' : '') + '</ram:BuyerTradeParty>' +
      '</ram:ApplicableHeaderTradeAgreement>' +
      '<ram:ApplicableHeaderTradeDelivery>' + (m ? '<ram:ShipToTradeParty>' + adresse(m[1], m[2], m[3]) + '</ram:ShipToTradeParty>' : '') + '</ram:ApplicableHeaderTradeDelivery>' +
      '<ram:ApplicableHeaderTradeSettlement><ram:PaymentReference>' + x(dok.nummer) + '</ram:PaymentReference><ram:InvoiceCurrencyCode>EUR</ram:InvoiceCurrencyCode>' +
      '<ram:SpecifiedTradeSettlementPaymentMeans><ram:TypeCode>58</ram:TypeCode><ram:PayeePartyCreditorFinancialAccount><ram:IBANID>' + x(f.iban.replace(/\s+/g, '')) + '</ram:IBANID>' +
      '<ram:AccountName>' + x(f.name) + '</ram:AccountName></ram:PayeePartyCreditorFinancialAccount>' +
      (f.bic ? '<ram:PayeeSpecifiedCreditorFinancialInstitution><ram:BICID>' + x(f.bic.replace(/\s+/g, '')) + '</ram:BICID></ram:PayeeSpecifiedCreditorFinancialInstitution>' : '') + '</ram:SpecifiedTradeSettlementPaymentMeans>' +
      steuer(true) +
      '<ram:BillingSpecifiedPeriod><ram:StartDateTime>' + tag(von) + '</ram:StartDateTime><ram:EndDateTime>' + tag(bis) + '</ram:EndDateTime></ram:BillingSpecifiedPeriod>' +
      (s.rabatt ? '<ram:SpecifiedTradeAllowanceCharge><ram:ChargeIndicator><udt:Indicator>false</udt:Indicator></ram:ChargeIndicator><ram:CalculationPercent>' + s.rabattProzent + '</ram:CalculationPercent>' +
        '<ram:BasisAmount>' + eur(s.zwischen) + '</ram:BasisAmount><ram:ActualAmount>' + eur(s.rabatt) + '</ram:ActualAmount><ram:Reason>Nachlass</ram:Reason>' +
        '<ram:CategoryTradeTax><ram:TypeCode>VAT</ram:TypeCode><ram:CategoryCode>' + kat + '</ram:CategoryCode><ram:RateApplicablePercent>' + satz + '</ram:RateApplicablePercent></ram:CategoryTradeTax></ram:SpecifiedTradeAllowanceCharge>' : '') +
      '<ram:SpecifiedTradePaymentTerms><ram:Description>' + x(gutschrift ? 'Gutschrift zur Rechnung ' + (orig ? orig.nummer : '') + '; bereits gezahlte Beträge werden erstattet oder verrechnet.' : skontoText(dok)) + '</ram:Description>' +
      (gutschrift ? '' : '<ram:DueDateDateTime>' + tag(SuS.faellig(dok)) + '</ram:DueDateDateTime>') + '</ram:SpecifiedTradePaymentTerms>' +
      '<ram:SpecifiedTradeSettlementHeaderMonetarySummation><ram:LineTotalAmount>' + eur(s.zwischen) + '</ram:LineTotalAmount>' + (s.rabatt ? '<ram:AllowanceTotalAmount>' + eur(s.rabatt) + '</ram:AllowanceTotalAmount>' : '') +
      '<ram:TaxBasisTotalAmount>' + eur(s.netto) + '</ram:TaxBasisTotalAmount><ram:TaxTotalAmount currencyID="EUR">' + eur(s.mwst) + '</ram:TaxTotalAmount><ram:GrandTotalAmount>' + eur(s.brutto) + '</ram:GrandTotalAmount>' +
      (prepaid ? '<ram:TotalPrepaidAmount>' + eur(prepaid) + '</ram:TotalPrepaidAmount>' : '') + '<ram:DuePayableAmount>' + eur(s.zahlbetrag) + '</ram:DuePayableAmount></ram:SpecifiedTradeSettlementHeaderMonetarySummation>' +
      vorbelege.map((a) => '<ram:InvoiceReferencedDocument><ram:IssuerAssignedID>' + x(a.nummer) + '</ram:IssuerAssignedID>' + (a.datum ? '<ram:FormattedIssueDateTime><qdt:DateTimeString format="102">' + String(a.datum).replace(/-/g, '') + '</qdt:DateTimeString></ram:FormattedIssueDateTime>' : '') + '</ram:InvoiceReferencedDocument>').join('') +
      '</ram:ApplicableHeaderTradeSettlement></rsm:SupplyChainTradeTransaction></rsm:CrossIndustryInvoice>\n';
  };
})();
