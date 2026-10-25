/* Stock und Stein – Leistungskatalog, Schnellpakete und Beispieldaten.
   Alle Preise sind RICHTWERTE (netto) für den Raum Hildesheim / Niedersachsen, Stand Oktober 2026, recherchiert aus
   öffentlichen Quellen (Tarif GaLaBau ab 07/2026: Ecklohn 20,91 €; Verrechnungssätze Innungsbetriebe 45–65 € netto;
   ZAH Hildesheim: Grünschnitt-Abholung bis 3 m³ 48 €, Bodenaushub Deponie ca. 15 €/t; Pflaster, Rasen, Hecke, Zaun aus
   aktuellen Preisspannen). Sie müssen vor dem ersten echten Angebot durch die eigenen Preise ersetzt werden. */
'use strict';

(function () {
  const L = (gruppe, text, einheit, euro, art, lohnanteil, beschreibung) => ({
    gruppe, text, einheit, preis: Math.round(euro * 100), art, lohnanteil: lohnanteil == null ? null : lohnanteil,
    beschreibung: beschreibung || ''
  });

  const LEISTUNGEN = [
    L('Allgemein', 'Baustelleneinrichtung', 'psch', 110, 'maschine', null, 'An- und Abtransport von Maschinen und Geräten, Einrichten und Räumen der Baustelle'),
    L('Allgemein', 'Anfahrt', 'psch', 30, 'maschine', null, 'je Einsatztag'),
    L('Allgemein', 'Facharbeiter (Stunde)', 'Std', 52, 'lohn'),
    L('Allgemein', 'Helfer (Stunde)', 'Std', 42, 'lohn'),
    L('Allgemein', 'Minibagger mit Fahrer', 'Std', 78, 'maschine'),
    L('Allgemein', 'Rüttelplatte (Tagesmiete)', 'Tag', 55, 'maschine'),
    L('Erdarbeiten', 'Oberboden abtragen und seitlich lagern', 'm²', 8, 'lohn', null, 'bis ca. 20 cm Stärke'),
    L('Erdarbeiten', 'Boden ausheben für Unterbau', 'm²', 16, 'lohn', null, 'bis ca. 30 cm Tiefe, Planum herstellen und verdichten'),
    L('Erdarbeiten', 'Bodenaushub laden und entsorgen', 'm³', 38, 'entsorgung', null, 'unbelasteter Boden, inkl. Deponiegebühr'),
    L('Erdarbeiten', 'Mutterboden liefern und einbauen', 'm³', 58, 'gemischt', 40),
    L('Wege & Terrassen', 'Schottertragschicht liefern, einbauen, verdichten', 'm²', 20, 'gemischt', 45, 'Mineralgemisch 0/32, ca. 20 cm verdichtet'),
    L('Wege & Terrassen', 'Pflaster verlegen', 'm²', 40, 'lohn', null, 'auf Splittbett 3–5 cm, inkl. Abrütteln und Verfugen'),
    L('Wege & Terrassen', 'Betonpflaster liefern', 'm²', 27, 'material', null, 'Format und Farbe nach Bemusterung'),
    L('Wege & Terrassen', 'Pflastersplitt 2/5 liefern', 'm²', 4, 'material', null, 'für Bettung, ca. 4 cm'),
    L('Wege & Terrassen', 'Randstein in Beton setzen', 'm', 30, 'gemischt', 60, 'Tiefbord 100/25/8 inkl. Betonfundament und Rückenstütze'),
    L('Wege & Terrassen', 'Terrassenplatten verlegen', 'm²', 50, 'lohn', null, 'auf Splitt- oder Drainmörtelbett'),
    L('Wege & Terrassen', 'Altes Pflaster aufnehmen und entsorgen', 'm²', 14, 'gemischt', 70),
    L('Rasen', 'Boden lockern, planieren, feinplanieren', 'm²', 5.5, 'lohn'),
    L('Rasen', 'Rollrasen liefern', 'm²', 4.9, 'material', null, 'Gebrauchsrasen, frisch geschält'),
    L('Rasen', 'Rollrasen verlegen und anwalzen', 'm²', 4.5, 'lohn', null, 'inkl. Startdüngung und erstem Wässern'),
    L('Rasen', 'Rasen ansäen', 'm²', 3.2, 'gemischt', 70, 'inkl. Saatgut und Startdünger'),
    L('Pflanzen', 'Pflanzen liefern', 'Stk', 0, 'material', null, 'Art und Größe laut Pflanzliste'),
    L('Pflanzen', 'Pflanzen setzen', 'Stk', 7, 'lohn', null, 'Pflanzloch, Pflanzerde, Angießen'),
    L('Pflanzen', 'Heckenpflanzen setzen', 'm', 13, 'lohn', null, 'Pflanzgraben, 3–4 Pflanzen je Meter'),
    L('Pflanzen', 'Rindenmulch liefern und verteilen', 'm²', 6.5, 'gemischt', 50, 'ca. 5–7 cm Schicht'),
    L('Pflege', 'Gartenpflege', 'Std', 45, 'lohn'),
    L('Pflege', 'Hecke schneiden', 'm', 5, 'lohn', null, 'beidseitig und oben, bis ca. 2 m Höhe'),
    L('Pflege', 'Grünschnitt laden und entsorgen', 'm³', 28, 'entsorgung'),
    L('Pflege', 'Wurzelstock ausfräsen', 'Stk', 110, 'maschine', null, 'bis ca. 40 cm Durchmesser'),
    L('Zäune & Mauern', 'Doppelstabmattenzaun setzen', 'm', 72, 'gemischt', 40, 'Höhe 1,23 m, anthrazit, Pfosten in Beton'),
    L('Zäune & Mauern', 'Palisaden setzen', 'm', 58, 'gemischt', 50, 'Beton-Palisaden in Betonfundament')
  ];

  /* Schnellpakete: fragen nach wenigen Werten (Fläche, Länge …) und fügen fertige Positionen ein.
     menge ist eine Formel mit den gefragten Werten. */
  const PAKETE = [
    {
      name: 'Terrasse oder Weg pflastern',
      fragen: [{ k: 'A', text: 'Fläche', einheit: 'm²' }, { k: 'U', text: 'Randsteine', einheit: 'm' }],
      titel: 'Pflasterfläche',
      positionen: [
        ['Baustelleneinrichtung', '1'],
        ['Boden ausheben für Unterbau', 'A'],
        ['Bodenaushub laden und entsorgen', 'A*0,3'],
        ['Schottertragschicht liefern, einbauen, verdichten', 'A'],
        ['Pflastersplitt 2/5 liefern', 'A'],
        ['Betonpflaster liefern', 'A*1,05'],
        ['Pflaster verlegen', 'A'],
        ['Randstein in Beton setzen', 'U']
      ]
    },
    {
      name: 'Rollrasen anlegen',
      fragen: [{ k: 'A', text: 'Rasenfläche', einheit: 'm²' }],
      titel: 'Rasenfläche',
      positionen: [
        ['Anfahrt', '1'],
        ['Boden lockern, planieren, feinplanieren', 'A'],
        ['Rollrasen liefern', 'A*1,05'],
        ['Rollrasen verlegen und anwalzen', 'A']
      ]
    },
    {
      name: 'Hecke schneiden',
      fragen: [{ k: 'L', text: 'Heckenlänge', einheit: 'm' }],
      titel: 'Heckenschnitt',
      positionen: [
        ['Anfahrt', '1'],
        ['Hecke schneiden', 'L'],
        ['Grünschnitt laden und entsorgen', 'L*0,1']
      ]
    },
    {
      name: 'Hecke pflanzen',
      fragen: [{ k: 'L', text: 'Heckenlänge', einheit: 'm' }],
      titel: 'Heckenpflanzung',
      positionen: [
        ['Anfahrt', '1'],
        ['Pflanzen liefern', 'L*3'],
        ['Heckenpflanzen setzen', 'L'],
        ['Rindenmulch liefern und verteilen', 'L*0,8']
      ]
    },
    {
      name: 'Zaun setzen',
      fragen: [{ k: 'L', text: 'Zaunlänge', einheit: 'm' }],
      titel: 'Zaunbau',
      positionen: [
        ['Baustelleneinrichtung', '1'],
        ['Doppelstabmattenzaun setzen', 'L']
      ]
    },
    {
      name: 'Gartenpflege nach Stunden',
      fragen: [{ k: 'N', text: 'Stunden', einheit: 'Std' }],
      titel: 'Gartenpflege',
      positionen: [
        ['Anfahrt', '1'],
        ['Gartenpflege', 'N'],
        ['Grünschnitt laden und entsorgen', '1']
      ]
    }
  ];

  SuS.katalog = {
    leistungen: () => LEISTUNGEN.map((l) => Object.assign({ id: SuS.id() }, l)),
    STAND: 'Richtwerte Raum Hildesheim, Oktober 2026',
    /* Richtwerte auf vorhandene Katalogeinträge gleichen Namens übertragen (nur solange Simon/der Betrieb die Preise
       nicht als eigene bestätigt hat). Gibt die Zahl geänderter Einträge zurück. */
    richtwerteUebernehmen() {
      if (SuS.daten.firma.preiseGeprueft) return 0;
      let n = 0;
      for (const l of SuS.daten.leistungen) {
        const r = LEISTUNGEN.find((x) => x.text === l.text);
        if (r && r.preis && r.preis !== l.preis) { l.preis = r.preis; n++; }
      }
      return n;
    },
    pakete: PAKETE,

    /* Paket in Positionen umsetzen. Unbekannte Leistungen (vom Nutzer gelöscht) werden übersprungen und gemeldet. */
    paketPositionen(paket, werte) {
      const ergebnis = [], fehlt = [];
      if (paket.titel) ergebnis.push({ id: SuS.id(), typ: 'titel', text: paket.titel });
      for (const [name, formel] of paket.positionen) {
        const l = SuS.daten.leistungen.find((x) => x.text === name);
        if (!l) { fehlt.push(name); continue; }
        const menge = SuS.rechne(formel, werte);
        ergebnis.push({
          id: SuS.id(), typ: 'pos', text: l.text, beschreibung: l.beschreibung, einheit: l.einheit,
          menge: Math.round(menge * 100) / 100, preis: l.preis, art: l.art, lohnanteil: l.lohnanteil, leistungId: l.id
        });
      }
      return { positionen: ergebnis, fehlt };
    },

    /* Beispiel zum Ausprobieren: ein Kunde und ein Angebot (Fantasiedaten). */
    beispiel() {
      const d = SuS.daten;
      const kunde = {
        id: SuS.id(), nr: 'K-001', art: 'privat', name: 'Familie Beispiel', ansprechpartner: '',
        strasse: 'Musterweg 12', plz: '31171', ort: 'Nordstemmen', telefon: '', email: '', notiz: 'Beispielkunde (Fantasie)', beispiel: true
      };
      d.kunden.push(kunde);
      const a = SuS.neuesDokument('angebot', kunde.id);
      a.beispiel = true;
      a.betreff = 'Neue Terrasse hinter dem Haus';
      a.baustelle = 'Musterweg 12, 31171 Nordstemmen';
      const paket = SuS.katalog.paketPositionen(PAKETE[0], { A: 24, U: 14 });
      const rasen = SuS.katalog.paketPositionen(PAKETE[1], { A: 40 });
      a.positionen = paket.positionen.concat(rasen.positionen.filter((p) => p.text !== 'Anfahrt'));
      a.positionen.push({ id: SuS.id(), typ: 'pos', bedarf: true, text: 'Wurzelstock ausfräsen', beschreibung: 'nur falls beim Aushub nötig', einheit: 'Stk', menge: 1, preis: 12000, art: 'maschine' });
      /* Ausbau: Beispiel-Baustelle mit Stunden, Material und einem Termin heute (Fantasiedaten) */
      if (SuS.neuesProjekt) {
        const p = SuS.neuesProjekt(kunde.id, 'Terrasse und Rasen Beispiel');
        p.beispiel = true; p.status = 'laufend'; a.projektId = p.id;
        const jan = { id: SuS.id(), name: 'Jan (Beispiel)', rolle: 'facharbeiter', aktiv: true, beispiel: true };
        const tom = { id: SuS.id(), name: 'Tom (Beispiel)', rolle: 'helfer', aktiv: true, beispiel: true };
        d.mitarbeiter.push(jan, tom);
        const gestern = SuS.plusTage(SuS.heute(), -1);
        d.aufwand.push(
          { id: SuS.id(), projektId: p.id, typ: 'zeit', datum: gestern, mitarbeiterId: jan.id, stunden: 8, taetigkeit: 'Aushub und Schotter', dokId: '', beispiel: true },
          { id: SuS.id(), projektId: p.id, typ: 'zeit', datum: gestern, mitarbeiterId: tom.id, stunden: 7.5, taetigkeit: 'Aushub', dokId: '', beispiel: true },
          { id: SuS.id(), projektId: p.id, typ: 'material', datum: gestern, leistungId: (d.leistungen.find((l) => l.text === 'Pflastersplitt 2/5 liefern') || {}).id || '', text: '', menge: 24, einheit: 'm²', preis: 0, dokId: '', beispiel: true });
        d.termine.push({ id: SuS.id(), projektId: p.id, datum: SuS.heute(), von: '07:30', bis: '16:00', text: 'Pflaster verlegen', mitarbeiter: [jan.id, tom.id], beispiel: true });
      }
      SuS.speichern();
      return a;
    }
  };
})();
