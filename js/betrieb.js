/* Stock und Stein – Betriebsabläufe (Ausbau nach Orientierung an Branchen-Software, siehe ORIENTIERUNG.md):
   Baustellen, Stunden und Material (Regie) in die Rechnung, Termine, Mitarbeiter, Zahlungen und Teilzahlungen,
   Mahnstufen, Pflegeverträge mit wiederkehrenden Rechnungen, Export für den Steuerberater. Alle Beträge in Cent. */
'use strict';

(function () {
  /* ---------- Nachschlagen ---------- */
  SuS.projekt = (id) => SuS.daten.projekte.find((p) => p.id === id) || null;
  SuS.mitarbeiterVon = (id) => SuS.daten.mitarbeiter.find((m) => m.id === id) || null;
  SuS.vertrag = (id) => SuS.daten.vertraege.find((v) => v.id === id) || null;
  SuS.PSTATUS = { anfrage: 'Anfrage', geplant: 'Geplant', laufend: 'In Arbeit', fertig: 'Fertig', abgerechnet: 'Abgerechnet' };
  SuS.ROLLEN = { facharbeiter: 'Facharbeiter', helfer: 'Helfer' };
  SuS.INTERVALLE = { 1: 'monatlich', 3: 'vierteljährlich', 6: 'halbjährlich', 12: 'jährlich' };

  SuS.neuesProjekt = (kundeId, titel) => {
    const k = SuS.kunde(kundeId);
    const p = {
      id: SuS.id(), nr: SuS.naechsteNummer('projekt'), titel: titel || 'Neue Baustelle', kundeId: kundeId || '',
      adresse: k ? [k.strasse, [k.plz, k.ort].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '',
      status: 'anfrage', notiz: '', erstellt: new Date().toISOString()
    };
    SuS.daten.projekte.unshift(p);
    return p;
  };
  SuS.projektBelege = (pid) => SuS.daten.dokumente.filter((d) => d.projektId === pid);
  SuS.projektAufwand = (pid) => SuS.daten.aufwand.filter((a) => a.projektId === pid).sort((a, b) => b.datum.localeCompare(a.datum));
  SuS.projektTermine = (pid) => SuS.daten.termine.filter((t) => t.projektId === pid).sort((a, b) => (a.datum + a.von).localeCompare(b.datum + b.von));

  /* ---------- Aufwand → Rechnung (Regie) ---------- */
  /* Stundensatz je Rolle: Leistung mit genau diesem Namen, sonst eine Stundenleistung, deren Name die Rolle enthält. */
  const leistungNach = (name, rolle) => SuS.daten.leistungen.find((l) => l.text === name)
    || SuS.daten.leistungen.find((l) => /^std/i.test(l.einheit) && l.text.toLowerCase().includes(SuS.ROLLEN[rolle].toLowerCase())) || null;
  SuS.STUNDEN_LEISTUNG = { facharbeiter: 'Facharbeiter (Stunde)', helfer: 'Helfer (Stunde)' };

  /* Offener (noch nicht abgerechneter) Aufwand: ohne Beleg, Beleg gelöscht oder storniert, oder die zugehörige
     Position wurde aus dem Entwurf entfernt (Funde Codex/Cursor). */
  SuS.aufwandAbgerechnet = (a) => {
    const d = a.dokId && SuS.dok(a.dokId);
    if (!d || d.status === 'storniert') return null;
    if (!d.fest && a.posId && !d.positionen.some((p) => p.id === a.posId)) return null;
    return d;
  };
  SuS.offenerAufwand = (pid) => SuS.projektAufwand(pid).filter((a) => !SuS.aufwandAbgerechnet(a));

  /* Fügt ausgewählte Einträge als Positionen in einen Rechnungsentwurf ein: Stunden je Rolle zusammengefasst
     (Satz aus dem Leistungskatalog), Material je Eintrag. Markiert die Einträge mit dem Beleg. */
  SuS.aufwandInRechnung = (dok, eintraege) => {
    if (dok.fest) throw new Error('Rechnung ist schon gestellt.');
    const zeiten = eintraege.filter((a) => a.typ === 'zeit'), material = eintraege.filter((a) => a.typ === 'material');
    const neu = [];
    if (zeiten.length) neu.push({ id: SuS.id(), typ: 'titel', text: 'Arbeiten nach Aufwand' });
    for (const rolle of Object.keys(SuS.ROLLEN)) {
      const teil = zeiten.filter((a) => (SuS.mitarbeiterVon(a.mitarbeiterId) || { rolle: 'facharbeiter' }).rolle === rolle);
      if (!teil.length) continue;
      const stunden = Math.round(teil.reduce((x, a) => x + a.stunden, 0) * 100) / 100;
      const l = leistungNach(SuS.STUNDEN_LEISTUNG[rolle], rolle);
      if (!l || !(l.preis > 0)) {  // nie stillschweigend 0 € je Stunde (Fund Cursor)
        throw new Error('Für ' + SuS.ROLLEN[rolle] + ' fehlt ein Stundensatz: unter „Mehr → Leistungen & Preise“ eine Leistung „' + SuS.STUNDEN_LEISTUNG[rolle] + '“ mit Preis anlegen.');
      }
      const tage = [...new Set(teil.map((a) => SuS.datum(a.datum)))].sort();
      const was = [...new Set(teil.map((a) => a.taetigkeit).filter(Boolean))].slice(0, 4).join(', ');
      const pos = {
        id: SuS.id(), typ: 'pos', text: 'Arbeitsstunden ' + SuS.ROLLEN[rolle], einheit: 'Std', menge: stunden,
        preis: l.preis, art: 'lohn', lohnanteil: null, leistungId: l.id,
        beschreibung: (tage.length > 3 ? tage[0] + ' – ' + tage[tage.length - 1] : tage.join(', ')) + (was ? ': ' + was : '')
      };
      neu.push(pos);
      teil.forEach((a) => { a.posId = pos.id; });
    }
    if (material.length) neu.push({ id: SuS.id(), typ: 'titel', text: 'Material' });
    for (const m of material) {
      const l = m.leistungId ? SuS.leistung(m.leistungId) : null;
      if (!(m.preis || (l && l.preis))) throw new Error('Material „' + (m.text || (l ? l.text : '?')) + '“ hat keinen Preis – bitte im Eintrag oder im Katalog einen Preis eintragen.');
      const posId = SuS.id();
      m.posId = posId;
      neu.push({ id: posId,
        typ: 'pos', text: m.text || (l ? l.text : 'Material'), einheit: m.einheit || (l ? l.einheit : 'Stk'),
        menge: m.menge, preis: m.preis || (l ? l.preis : 0), art: l ? l.art : 'material', lohnanteil: l ? l.lohnanteil : null,
        leistungId: l ? l.id : '', beschreibung: 'geliefert am ' + SuS.datum(m.datum)
      });
    }
    dok.positionen.push(...neu);
    const daten = eintraege.map((a) => a.datum).sort();
    if (daten.length) {
      if (!dok.leistungVon || daten[0] < dok.leistungVon) dok.leistungVon = daten[0];
      if (daten[daten.length - 1] > (dok.leistungBis || dok.leistungVon)) dok.leistungBis = daten[daten.length - 1];
    }
    eintraege.forEach((a) => { a.dokId = dok.id; });
    return neu.length;
  };

  /* ---------- Zahlungen, Teilzahlungen ---------- */
  /* Bereits gezahlt: Summe der Zahlungen; ältere Daten mit Status „bezahlt“ ohne Einzelzahlungen gelten als voll bezahlt. */
  SuS.bezahltSumme = (dok) => {
    const z = (dok.zahlungen || []).reduce((x, p) => x + p.betrag, 0);
    if (!z && dok.status === 'bezahlt') return SuS.summen(dok).zahlbetrag;
    return z;
  };
  /* Offen = Rechnungsbetrag + Mahngebühren − Zahlungen (Gebühren lassen sich mitbezahlen, Funde Codex/Cursor). */
  SuS.offenerBetrag = (dok) => Math.max(0, SuS.summen(dok).zahlbetrag + SuS.mahnGebuehren(dok) - SuS.bezahltSumme(dok));
  SuS.ueberzahlung = (dok) => Math.max(0, SuS.bezahltSumme(dok) - SuS.summen(dok).zahlbetrag - SuS.mahnGebuehren(dok));

  /* Skonto (nur Rechnung und Schlussrechnung): Abzug vom Zahlbetrag bei Zahlung innerhalb der Frist. */
  SuS.skonto = (dok) => {
    if (!dok.skonto || !['rechnung', 'schluss'].includes(dok.typ)) return null;
    const zb = SuS.summen(dok).zahlbetrag;
    if (zb <= 0) return null;
    const betrag = SuS.runde(zb * dok.skonto.prozent / 100);
    return { prozent: dok.skonto.prozent, tage: dok.skonto.tage, bis: SuS.plusTage(dok.datum, dok.skonto.tage), betrag, zahlbar: zb - betrag };
  };
  SuS.skontoGenutzt = (dok) => (dok.zahlungen || []).filter((z) => z.art === 'skonto').reduce((x, z) => x + z.betrag, 0);
  /* mitSkonto: der nach der Zahlung verbleibende Rest wird als Skonto ausgebucht (höchstens der Skontobetrag + 1 Cent). */
  SuS.zahlungErfassen = (dok, betrag, datum, mitSkonto) => {
    if (!dok.fest || dok.typ === 'storno' || dok.status === 'storniert') throw new Error('Zahlungen nur für gestellte Rechnungen.');
    if (!Number.isInteger(betrag) || betrag <= 0) throw new Error('Bitte einen Betrag eingeben.');
    if (!dok.zahlungen) dok.zahlungen = [];
    if (!dok.zahlungen.length && dok.status === 'bezahlt') throw new Error('Diese Rechnung ist schon bezahlt.');
    if (betrag > SuS.offenerBetrag(dok)) throw new Error('Mehr als der offene Betrag (' + SuS.euro(SuS.offenerBetrag(dok)) + ').');
    const tag = datum || SuS.heute();
    if (mitSkonto) {
      const sk = SuS.skonto(dok);
      if (!sk) throw new Error('Für diese Rechnung ist kein Skonto vereinbart.');
      if (SuS.skontoGenutzt(dok)) throw new Error('Skonto wurde schon abgezogen.');
      /* Rest nach der Zahlung (Mahngebühren sind darin enthalten und müssen voll bezahlt sein – Skonto gilt nur für die
         Rechnung; Fund Cursor: die Gebühr wurde doppelt abgezogen) */
      const rest = SuS.offenerBetrag(dok) - betrag;
      if (rest <= 0) throw new Error('Kein Rest, der als Skonto ausgebucht werden müsste.');
      if (rest > sk.betrag + 1) throw new Error('Der Rest (' + SuS.euro(rest) + ') ist größer als das Skonto (' + SuS.euro(sk.betrag) + ') – bitte als Teilzahlung erfassen.');
      dok.zahlungen.push({ id: SuS.id(), datum: tag, betrag, art: 'zahlung' }, { id: SuS.id(), datum: tag, betrag: rest, art: 'skonto' });
    } else dok.zahlungen.push({ id: SuS.id(), datum: tag, betrag, art: 'zahlung' });
    if (SuS.offenerBetrag(dok) === 0) { dok.status = 'bezahlt'; dok.bezahltAm = tag; }
  };
  SuS.letzteZahlungZurueck = (dok) => {
    if (dok.zahlungen && dok.zahlungen.length && dok.zahlungen[dok.zahlungen.length - 1].art === 'skonto') dok.zahlungen.pop();  // Skonto gehört zur Zahlung davor
    if (dok.zahlungen && dok.zahlungen.length) dok.zahlungen.pop();
    if (SuS.offenerBetrag(dok) > 0 || !(dok.zahlungen || []).length) { dok.status = 'offen'; dok.bezahltAm = ''; }
  };

  /* Teilweise bezahlter Abschlag: stornieren und einen neuen Abschlag über genau den erhaltenen Betrag stellen
     (so steht nur vereinnahmtes Entgelt in der Abschlagskette – Vorgehen wie bei verbreiteter Handwerker-Software). */
  SuS.abschlagKorrigieren = (abschlag) => {
    const bezahlt = SuS.bezahltSumme(abschlag);
    if (abschlag.typ !== 'abschlag' || !abschlag.fest || abschlag.status === 'bezahlt' || abschlag.status === 'storniert' || bezahlt <= 0) {
      throw new Error('Nur für teilweise bezahlte Abschläge.');
    }
    const auftrag = SuS.dok(abschlag.vonId);
    if (!auftrag) throw new Error('Zugehöriges Angebot fehlt.');
    const st = SuS.steuer(abschlag);
    /* Nettobetrag so wählen, dass Netto + Steuer genau den erhaltenen Betrag ergeben (sonst den nächstliegenden). */
    const best = SuS.runde(bezahlt * 100 / (100 + st.satz));  // Netto; die Steuer ergibt sich als Rest (Bruttovorgabe)
    const storno = SuS.stornoAus(abschlag);
    SuS.festschreiben(storno);
    storno.status = 'storno';
    abschlag.status = 'storniert';
    const neu = SuS.abschlagAus(auftrag, 0, best);
    neu.steuerVorgabe = st;
    neu.bruttoVorgabe = bezahlt;  // genau der erhaltene Betrag, Steuer = Brutto − Netto
    neu.projektId = abschlag.projektId || auftrag.projektId || '';
    neu.leistungVon = abschlag.leistungVon || SuS.heute();
    neu.positionen[0].beschreibung += ' – ersetzt ' + abschlag.nummer + ' (erhaltener Betrag)';
    SuS.festschreiben(neu);
    const brutto = SuS.summen(neu).zahlbetrag;
    /* Die erhaltenen Zahlungen wandern unverändert (Betrag und Datum) zum neuen Abschlag (Fund Codex). */
    neu.zahlungen = (abschlag.zahlungen || []).map((z) => Object.assign({}, z));
    neu.status = 'bezahlt'; neu.bezahltAm = neu.zahlungen.slice(-1)[0].datum;
    abschlag.zahlungen = [];
    abschlag.umgebucht = neu.nummer;
    return { storno, neu, differenz: bezahlt - brutto };
  };

  /* ---------- Mahnwesen ---------- */
  SuS.MAHNSTUFEN = ['Zahlungserinnerung', '1. Mahnung', '2. Mahnung'];
  SuS.mahnstufe = (dok) => (dok.mahnungen || []).length;
  SuS.MAHNFRIST = [10, 10, 7];  // Tage Zahlungsfrist je Stufe
  /* Vorschlag für die Gebühr: erst ab der 1. Mahnung, nur bei Firmenkunden (bei Privatkunden im Zweifel keine Pauschale). */
  SuS.mahnGebuehrVorschlag = (dok) => {
    const k = SuS.kundeVon(dok);
    return SuS.mahnstufe(dok) >= 1 && k && k.art === 'firma' ? (SuS.daten.firma.mahngebuehr || 0) : 0;
  };
  /* Nächste Mahnstufe frühestens, wenn die Frist der vorigen abgelaufen ist (Fund Codex). */
  SuS.naechsteMahnungAb = (dok) => {
    const m = (dok.mahnungen || []).slice(-1)[0];
    return m ? SuS.plusTage(m.datum, SuS.MAHNFRIST[m.stufe - 1] + 1) : SuS.plusTage(SuS.faellig(dok), 1);
  };
  SuS.mahnen = (dok, gebuehr) => {
    if (!dok.fest || dok.status === 'bezahlt' || dok.status === 'storniert' || dok.typ === 'storno') throw new Error('Nur offene, gestellte Rechnungen.');
    if (SuS.faellig(dok) >= SuS.heute()) throw new Error('Die Rechnung ist noch nicht fällig.');
    if (SuS.mahnstufe(dok) >= 3) throw new Error('Alle Mahnstufen sind ausgeschöpft – weiter nur über ein gerichtliches Mahnverfahren oder Inkasso.');
    if (SuS.naechsteMahnungAb(dok) > SuS.heute()) throw new Error('Die Frist der letzten Mahnung läuft noch bis ' + SuS.datum(SuS.plusTage(SuS.naechsteMahnungAb(dok), -1)) + '.');
    if (!dok.mahnungen) dok.mahnungen = [];
    const stufe = dok.mahnungen.length + 1;
    const g = gebuehr == null ? SuS.mahnGebuehrVorschlag(dok) : gebuehr;
    if (!Number.isInteger(g) || g < 0 || g > 10000 || (stufe === 1 && g > 0)) throw new Error('Ungültige Mahngebühr (Erinnerung immer ohne Gebühr, höchstens 100 €).');
    dok.mahnungen.push({ stufe, datum: SuS.heute(), gebuehr: g });
    return stufe;
  };
  SuS.mahnGebuehren = (dok) => (dok.mahnungen || []).reduce((x, m) => x + (m.gebuehr || 0), 0);

  /* ---------- Pflegeverträge ---------- */
  SuS.plusMonate = (iso, n) => {
    const [j, m, t] = iso.split('-').map(Number);
    const d = new Date(j, m - 1 + n, 1);
    const letzter = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    d.setDate(Math.min(t, letzter));
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  };
  SuS.faelligeVertraege = (bis) => SuS.daten.vertraege.filter((v) => v.aktiv && v.naechstes <= (bis || SuS.heute()));
  /* Rechnungsentwurf für den nächsten Zeitraum anlegen und den Vertrag weiterschalten. */
  SuS.vertragAbrechnen = (v) => {
    const r = SuS.neuesDokument('rechnung', v.kundeId);
    const ende = SuS.plusTage(SuS.plusMonate(v.naechstes, v.intervall), -1);
    Object.assign(r, {
      betreff: v.titel + ' (' + SuS.datum(v.naechstes) + ' – ' + SuS.datum(ende) + ')', projektId: v.projektId || '',
      positionen: SuS.kopierePositionen(v.positionen), leistungVon: v.naechstes, leistungBis: ende, vertragId: v.id, vertragAb: v.naechstes
    });
    const p = v.projektId ? SuS.projekt(v.projektId) : null;
    if (p) r.baustelle = p.adresse;
    v.naechstes = SuS.plusMonate(v.naechstes, v.intervall);
    return r;
  };

  /* Pflegeaufgaben im Jahreslauf: Vorschläge für den Vertrag und was in einem Monat ansteht (für den Wochenplan).
     Heckenschnitt: zwischen 1. März und 30. September nur Form- und Pflegeschnitt (§ 39 Abs. 5 BNatSchG). */
  SuS.PFLEGE_AUFGABEN = [
    { text: 'Rasen mähen', monate: [4, 5, 6, 7, 8, 9, 10] }, { text: 'Beete jäten, Unkraut', monate: [4, 5, 6, 7, 8, 9] },
    { text: 'Hecke Formschnitt', monate: [6, 9] }, { text: 'Gehölze/Obstbäume schneiden', monate: [2, 3] },
    { text: 'Rasen vertikutieren/düngen', monate: [4, 9] }, { text: 'Frühjahrsputz Beete und Wege', monate: [3] },
    { text: 'Laub entfernen', monate: [10, 11] }, { text: 'Winterschutz, Einwintern', monate: [11] }
  ];
  SuS.MONATE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  /* ym = 'JJJJ-MM'. Gibt je aktivem Vertrag mit Aufgaben in diesem Monat {v, aufgaben, eingeplant} zurück. */
  SuS.pflegeImMonat = (ym) => {
    const m = Number(ym.slice(5, 7));
    return SuS.daten.vertraege.filter((v) => v.aktiv && (v.aufgaben || []).some((a) => a.monate.includes(m))).map((v) => ({
      v, aufgaben: v.aufgaben.filter((a) => a.monate.includes(m)).map((a) => a.text),
      eingeplant: SuS.daten.termine.filter((t) => t.vertragId === v.id && t.datum.slice(0, 7) === ym).map((t) => t.datum).sort()
    }));
  };

  /* Gelöschter Vertrags-Entwurf: war es der jüngste Zeitraum, springt der Vertrag zurück; sonst Hinweis auf die Lücke
     (Funde Codex/Cursor). Gibt einen Hinweistext zurück oder ''. */
  SuS.vertragsEntwurfGeloescht = (dok) => {
    const v = dok.vertragId && SuS.vertrag(dok.vertragId);
    if (!v || !dok.vertragAb) return '';
    if (SuS.plusMonate(dok.vertragAb, v.intervall) === v.naechstes) { v.naechstes = dok.vertragAb; return 'Pflegevertrag steht wieder auf ' + SuS.datum(v.naechstes) + '.'; }
    return 'Achtung: Der Zeitraum ab ' + SuS.datum(dok.vertragAb) + ' ist jetzt nicht abgerechnet. Im Pflegevertrag „Nächste Rechnung ab“ anpassen oder eine Rechnung von Hand stellen.';
  };

  /* ---------- Nachkalkulation je Baustelle (Soll gegen Ist, alles netto zu Verkaufspreisen) ---------- */
  SuS.nachkalkulation = (pid) => {
    const belege = SuS.projektBelege(pid);
    /* Soll: angenommene Angebote; gibt es keins, nur das jüngste – sonst zählten Angebotsfassungen doppelt (Fund Cursor). */
    const alleAngebote = belege.filter((d) => d.typ === 'angebot' && d.status !== 'abgelehnt');
    const angenommen = alleAngebote.filter((d) => d.status === 'angenommen');
    const angebote = angenommen.length ? angenommen : alleAngebote.sort((a, b) => (b.datum + (b.nummer || '')).localeCompare(a.datum + (a.nummer || ''))).slice(0, 1);
    const soll = angebote.reduce((x, d) => { const s = SuS.summen(d); return { netto: x.netto + s.netto, lohn: x.lohn + s.lohnNetto }; }, { netto: 0, lohn: 0 });
    let stunden = 0, lohnIst = 0, materialIst = 0, ohnePreis = 0;
    for (const a of SuS.projektAufwand(pid)) {
      if (a.typ === 'zeit') {
        const rolle = (SuS.mitarbeiterVon(a.mitarbeiterId) || { rolle: 'facharbeiter' }).rolle;
        const l = SuS.daten.leistungen.find((x) => x.text === SuS.STUNDEN_LEISTUNG[rolle]);
        stunden += a.stunden;
        if (l && l.preis) lohnIst += SuS.runde(a.stunden * l.preis); else ohnePreis++;
      } else {
        const l = a.leistungId ? SuS.leistung(a.leistungId) : null, preis = a.preis || (l ? l.preis : 0);
        if (preis) materialIst += SuS.runde(a.menge * preis); else ohnePreis++;
      }
    }
    const abgerechnet = belege.filter((d) => SuS.istRechnung(d) && d.fest && d.typ !== 'storno' && d.status !== 'storniert' && d.typ !== 'abschlag')
      .reduce((x, d) => x + SuS.summen(d).netto, 0);
    const einkauf = SuS.daten.ausgaben.filter((a) => a.projektId === pid).reduce((x, a) => x + SuS.ausgabeNetto(a), 0);
    return { soll, stunden: Math.round(stunden * 100) / 100, lohnIst, materialIst, ist: lohnIst + materialIst, abgerechnet, ohnePreis,
      lohnDifferenz: soll.lohn - lohnIst, hatAngebot: angebote.length > 0, einkauf, rohertrag: abgerechnet - einkauf };
  };

  /* ---------- Stundenzettel als Datei zwischen Handys (Mitarbeiter → Chef, ohne Server) ---------- */
  SuS.stundenExport = (pid, nurOffen) => {
    const p = SuS.projekt(pid);
    const eintraege = (nurOffen ? SuS.offenerAufwand(pid) : SuS.projektAufwand(pid)).map((a) => {
      const m = SuS.mitarbeiterVon(a.mitarbeiterId), l = a.leistungId ? SuS.leistung(a.leistungId) : null;
      return { id: a.id, typ: a.typ, datum: a.datum, stunden: a.stunden, taetigkeit: a.taetigkeit, mitarbeiter: m ? { name: m.name, rolle: m.rolle } : null,
        text: a.text || (l ? l.text : ''), menge: a.menge, einheit: a.einheit || (l ? l.einheit : ''), preis: a.preis || (l ? l.preis : 0) };  // tatsächlicher Preis (Fund Codex)
    });
    return JSON.stringify({ app: 'stock-und-stein-stunden', v: 1, erstellt: new Date().toISOString(), absender: SuS.daten.firma.inhaber || '',
      baustelle: { nr: p.nr, titel: p.titel, adresse: p.adresse }, eintraege });
  };
  /* Import in eine Baustelle: unbekannte Mitarbeiter werden angelegt, schon vorhandene Einträge übersprungen – gleiche
     Kennung oder gleicher Inhalt (Datum, Person, Stunden, Tätigkeit bzw. Material und Menge), damit nichts doppelt
     abgerechnet wird (Funde Codex/Cursor). Einträge ohne gültige Kennung werden abgewiesen. Gehört die Datei zu einer
     anderen Baustelle, bricht der Import ab, außer es ist ausdrücklich bestätigt (trotzdem).
     Gibt {neu, doppelt, fehlerhaft, rollen} zurück (rollen = Namen, deren Rolle hier anders eingetragen ist). */
  const fingerabdruck = (a) => {
    const name = a.typ === 'zeit' ? ((SuS.mitarbeiterVon(a.mitarbeiterId) || {}).name || '') : ((a.leistungId && SuS.leistung(a.leistungId) || {}).text || a.text || '');
    return [a.typ, a.datum, name.trim().toLowerCase(), a.typ === 'zeit' ? Number(a.stunden).toFixed(2) + '|' + String(a.taetigkeit || '').trim().toLowerCase() : Number(a.menge).toFixed(3)].join('|');
  };
  SuS.stundenImport = (pid, text, trotzdem) => {
    let d;
    try { d = JSON.parse(text); } catch (e) { throw new Error('Das ist keine Stundenzettel-Datei.'); }
    if (!d || d.app !== 'stock-und-stein-stunden' || !Array.isArray(d.eintraege)) throw new Error('Das ist keine Stundenzettel-Datei dieser App.');
    if (d.eintraege.length > 500) throw new Error('Zu viele Einträge in einer Datei.');
    const p = SuS.projekt(pid), b = d.baustelle && typeof d.baustelle === 'object' ? d.baustelle : {};
    if (!trotzdem && p && b.nr && String(b.nr) !== p.nr) {
      throw Object.assign(new Error('Die Datei gehört zur Baustelle ' + String(b.nr).slice(0, 20) + (b.titel ? ' „' + String(b.titel).slice(0, 60) + '“' : '') + ', nicht zu ' + p.nr + '.'), { andereBaustelle: true });
    }
    let neu = 0, doppelt = 0, fehlerhaft = 0;
    const rollen = [];
    const ID = /^[a-z0-9]{4,40}$/, DATUM = /^\d{4}-\d{2}-\d{2}$/, txt = (t, n) => String(t == null ? '' : t).slice(0, n);
    const vorhanden = new Set(SuS.daten.aufwand.filter((a) => a.projektId === pid).map(fingerabdruck));
    for (const x of d.eintraege) {
      if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !ID.test(x.id)) { fehlerhaft++; continue; }
      const id = x.id;
      if (SuS.daten.aufwand.some((a) => a.id === id)) { doppelt++; continue; }
      const eintrag = { id, projektId: pid, typ: x.typ === 'material' ? 'material' : 'zeit', datum: typeof x.datum === 'string' && DATUM.test(x.datum) ? x.datum : SuS.heute(),
        mitarbeiterId: '', stunden: Math.max(0, Math.min(24, Number(x.stunden) || 0)), taetigkeit: txt(x.taetigkeit, 200), leistungId: '', text: txt(x.text, 200),
        menge: Number(x.menge) || 0, einheit: txt(x.einheit, 12), preis: Math.max(0, Math.round(Number(x.preis) || 0)), dokId: '' };
      if (eintrag.typ === 'zeit') {
        if (!(eintrag.stunden > 0)) { fehlerhaft++; continue; }
        const m = x.mitarbeiter && typeof x.mitarbeiter === 'object' ? x.mitarbeiter : null, name = m ? txt(m.name, 60).trim() : '';
        if (name) {
          const rolle = m.rolle === 'helfer' ? 'helfer' : 'facharbeiter';
          let ma = SuS.daten.mitarbeiter.find((y) => y.name.toLowerCase() === name.toLowerCase());
          if (!ma) { ma = { id: SuS.id(), name, rolle, aktiv: true }; SuS.daten.mitarbeiter.push(ma); }
          else if (ma.rolle !== rolle && !rollen.includes(ma.name)) rollen.push(ma.name);
          eintrag.mitarbeiterId = ma.id;
        }
      } else {
        if (!(eintrag.menge > 0)) { fehlerhaft++; continue; }
        const l = SuS.daten.leistungen.find((y) => y.text.toLowerCase() === eintrag.text.toLowerCase());
        if (l) { eintrag.leistungId = l.id; eintrag.text = ''; }
      }
      const fa = fingerabdruck(eintrag);
      if (vorhanden.has(fa)) { doppelt++; continue; }
      vorhanden.add(fa);
      SuS.daten.aufwand.push(eintrag); neu++;
    }
    return { neu, doppelt, fehlerhaft, rollen };
  };

  /* ---------- Eigene Vorlagen (Positionen eines Angebots als Schnellpaket speichern) ---------- */
  SuS.vorlageSpeichern = (dok, name) => {
    if (!Array.isArray(SuS.daten.vorlagen)) SuS.daten.vorlagen = [];
    const v = { id: SuS.id(), name: String(name || '').trim().slice(0, 80) || (dok.betreff || 'Vorlage'), positionen: SuS.kopierePositionen(dok.positionen) };
    SuS.daten.vorlagen.push(v);
    return v;
  };

  /* ---------- Wiedervorlage: Angebote nachfassen ---------- */
  SuS.NACHFASSEN_TAGE = 14;
  SuS.nachfassen = () => {
    const grenze = SuS.plusTage(SuS.heute(), -SuS.NACHFASSEN_TAGE);
    return SuS.daten.dokumente.filter((d) => d.typ === 'angebot' && d.status === 'versendet' && !d.beispiel && (d.nachgefasst || d.datum) <= grenze)
      .sort((a, b) => a.datum.localeCompare(b.datum));
  };

  /* ---------- Alle Katalogpreise um x % anpassen (z. B. jährliche Preiserhöhung) ---------- */
  SuS.preiseAnpassen = (prozent, rundung) => {
    const p = Number(prozent), r = [1, 10, 50, 100].includes(Number(rundung)) ? Number(rundung) : 10;
    if (!Number.isFinite(p) || p < -50 || p > 100 || p === 0) throw new Error('Bitte eine Änderung zwischen −50 und +100 % angeben.');
    let n = 0;
    SuS.daten.leistungen.forEach((l) => {
      if (!l.preis) return;
      const neu = Math.max(r, Math.round(l.preis * (100 + p) / 100 / r) * r);
      if (neu !== l.preis) { l.preis = neu; n++; }
      if (l.ek != null && l.aufschlag != null) l.ek = Math.round(l.ek * (100 + p) / 100);
    });
    return n;
  };

  /* ---------- Termine für den Handy-Kalender (iCalendar, RFC 5545) ---------- */
  SuS.termineIcs = (liste) => {
    const esc = (t) => String(t || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
    const falten = (z) => { const out = []; let rest = z; while (rest.length > 70) { out.push(rest.slice(0, 70)); rest = ' ' + rest.slice(70); } out.push(rest); return out.join('\r\n'); };
    const zeit = (d, u) => d.replace(/-/g, '') + 'T' + u.replace(':', '') + '00';
    const jetzt = new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
    const z = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Stock und Stein//Buero//DE', 'CALSCALE:GREGORIAN'];
    for (const t of liste) {
      const p = t.projektId ? SuS.projekt(t.projektId) : null;
      const namen = t.mitarbeiter.map((id) => (SuS.mitarbeiterVon(id) || {}).name).filter(Boolean).join(', ');
      z.push('BEGIN:VEVENT', 'UID:' + t.id + '@stock-und-stein.local', 'DTSTAMP:' + jetzt);
      if (t.von) {
        z.push('DTSTART:' + zeit(t.datum, t.von));
        z.push('DTEND:' + (t.bis && t.bis > t.von ? zeit(t.datum, t.bis) : zeit(t.datum, String(Math.min(23, Number(t.von.slice(0, 2)) + 1)).padStart(2, '0') + t.von.slice(2))));
      } else {
        z.push('DTSTART;VALUE=DATE:' + t.datum.replace(/-/g, ''), 'DTEND;VALUE=DATE:' + SuS.plusTage(t.datum, 1).replace(/-/g, ''));
      }
      z.push(falten('SUMMARY:' + esc(t.text || (p ? p.titel : 'Termin'))));
      if (p && p.adresse) z.push(falten('LOCATION:' + esc(p.adresse)));
      if (namen || p) z.push(falten('DESCRIPTION:' + esc([p ? p.nr + ' ' + p.titel : '', namen ? 'Wer: ' + namen : ''].filter(Boolean).join('\n'))));
      z.push('END:VEVENT');
    }
    z.push('END:VCALENDAR');
    return z.join('\r\n') + '\r\n';
  };

  /* ---------- Ausgaben (Eingangsbelege): Material, Sprit, Kippe, Miete … ---------- */
  SuS.ausgabeNetto = (a) => a.brutto - SuS.ausgabeSteuer(a);
  /* Vorsteuer: genau laut Beleg, wenn bekannt (z. B. aus einer E-Rechnung mit mehreren Steuersätzen), sonst aus dem Satz. */
  SuS.ausgabeSteuer = (a) => (a.vorsteuer != null ? a.vorsteuer : SuS.runde(a.brutto * a.satz / (100 + a.satz)));
  /* Weicht die Vorsteuer laut Beleg vom Satz ab, passt keine automatische Buchung (DATEV würde aus dem Satz rechnen). */
  SuS.ausgabeAbweichend = (a) => a.gemischt || (a.vorsteuer != null && Math.abs(a.vorsteuer - SuS.runde(a.brutto * a.satz / (100 + a.satz))) > 2);
  SuS.neueAusgabe = (vorgabe) => Object.assign({ id: SuS.id(), datum: SuS.heute(), lieferant: '', nummer: '', text: '', brutto: 0, satz: 19, art: 'material', projektId: '', bezahlt: true }, vorgabe || {});
  SuS.ausgabenSumme = (liste) => liste.reduce((x, a) => ({ brutto: x.brutto + a.brutto, netto: x.netto + SuS.ausgabeNetto(a), steuer: x.steuer + SuS.ausgabeSteuer(a) }), { brutto: 0, netto: 0, steuer: 0 });

  /* ---------- Export für den Steuerberater ---------- */
  const csvFeld = (x) => {
    let t = String(x == null ? '' : x);
    if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;  // keine Formeln in Tabellenprogrammen (CSV-Einschleusung)
    return '"' + t.replace(/"/g, '""') + '"';
  };
  const centFeld = (c) => ((c || 0) / 100).toFixed(2).replace('.', ',');
  SuS.ausgangsbuchCsv = (jahr) => {
    const zeilen = [['Rechnungsnummer', 'Art', 'Datum', 'Leistung von', 'Leistung bis', 'Kunde', 'Netto', 'USt-Satz', 'USt', 'Brutto', 'Abzüge Abschläge', 'Zahlbetrag', 'Mahngebühren', 'Bezahlt', 'davon Skonto', 'Offen', 'Status'].map(csvFeld).join(';')];
    SuS.daten.dokumente.filter((d) => SuS.istRechnung(d) && d.fest && (!jahr || d.datum.slice(0, 4) === String(jahr)))
      .sort((a, b) => a.nummer.localeCompare(b.nummer))
      .forEach((d) => {
        const s = SuS.summen(d), k = SuS.kundeVon(d);
        zeilen.push([d.nummer, SuS.TYPEN[d.typ].name, SuS.datum(d.datum), SuS.datum(d.leistungVon), SuS.datum(d.leistungBis), k ? k.name : '',
          centFeld(s.netto), String(s.satz).replace('.', ','), centFeld(s.mwst), centFeld(s.brutto), centFeld(s.brutto - s.zahlbetrag),
          centFeld(s.zahlbetrag), centFeld(SuS.mahnGebuehren(d)), centFeld(SuS.bezahltSumme(d)), centFeld(SuS.skontoGenutzt(d)), centFeld(SuS.offenerBetrag(d)), SuS.status(d).text].map(csvFeld).join(';'));
      });
    return '﻿' + zeilen.join('\r\n') + '\r\n';
  };
  SuS.ausgabenCsv = (jahr) => {
    const zeilen = [['Datum', 'Lieferant', 'Belegnummer', 'Was', 'Art', 'Baustelle', 'Netto', 'USt-Satz', 'Vorsteuer', 'Brutto', 'Bezahlt'].map(csvFeld).join(';')];
    SuS.daten.ausgaben.filter((a) => !jahr || a.datum.slice(0, 4) === String(jahr)).sort((a, b) => a.datum.localeCompare(b.datum)).forEach((a) => {
      const p = a.projektId ? SuS.projekt(a.projektId) : null;
      zeilen.push([SuS.datum(a.datum), a.lieferant, a.nummer, a.text, SuS.AUSGABE_ARTEN[a.art], p ? p.nr + ' ' + p.titel : '', centFeld(SuS.ausgabeNetto(a)),
        String(a.satz), centFeld(SuS.ausgabeSteuer(a)), centFeld(a.brutto), a.bezahlt ? 'ja' : 'nein'].map(csvFeld).join(';'));
    });
    return '﻿' + zeilen.join('\r\n') + '\r\n';
  };

  /* DATEV-Buchungsstapel (Format EXTF 700) – Vorschlag zum Import beim Steuerberater. Enthält:
     • Ausgangsrechnungen: Zahlbetrag auf den Sammeldebitor gegen das Erlöskonto (Automatikkonto mit Steuer). Abschläge wie
       Erlöse, die Schlussrechnung mit dem Restbetrag – in Summe stimmen Erlös und Steuer.
     • Zahlungseingänge: Bank an Debitor. • Genutztes Skonto: Konto „Gewährte Skonti“ an Debitor (Steuer wird über das
       Automatikkonto korrigiert). • Ausgaben: Aufwandskonto an Bank (bezahlt) bzw. Sammelkreditor, Vorsteuer über
       BU-Schlüssel 9 (19 %) / 8 (7 %) oder Automatikkonto. Belege mit mehreren Steuersätzen oder abweichender Vorsteuer bleiben draußen (von Hand buchen).
     Konten nach Standardkontenrahmen SKR 03/04; Abweichungen stimmt der Steuerberater ab. */
  SuS.DATEV_KONTEN = {
    '03': { 19: '8400', 7: '8300', '13b': '8337', klein: '8195', frei: '8200', bank: '1200', skonto19: '8736', skonto7: '8731', skonto: '8730', mahn: '2700',
      aufwand: { material: { 19: '3400', 7: '3300', 0: '3200' }, fremd: '3100', maschinen: '4960', fahrzeug: '4530', entsorgung: '4969', werkzeug: '4985', buero: '4930', sonstiges: '4900' } },
    '04': { 19: '4400', 7: '4300', '13b': '4337', klein: '4185', frei: '4200', bank: '1800', skonto19: '4736', skonto7: '4731', skonto: '4730', mahn: '4830',
      aufwand: { material: { 19: '5400', 7: '5300', 0: '5200' }, fremd: '5900', maschinen: '6835', fahrzeug: '6530', entsorgung: '6859', werkzeug: '6845', buero: '6815', sonstiges: '6300' } }
  };
  SuS.datevKonto = (s, skr) => {
    const k = SuS.DATEV_KONTEN[skr] || SuS.DATEV_KONTEN['03'];
    return s.modus === '13b' ? k['13b'] : s.modus === 'klein' ? k.klein : k[s.satz] || k.frei;
  };
  /* Aufwandskonto und BU-Schlüssel einer Ausgabe; Wareneingang 19/7 % sind Automatikkonten (ohne BU-Schlüssel). */
  SuS.datevAufwand = (a, skr) => {
    const k = (SuS.DATEV_KONTEN[skr] || SuS.DATEV_KONTEN['03']).aufwand, eintrag = k[a.art] || k.sonstiges;
    if (typeof eintrag === 'object') return { konto: eintrag[a.satz] || eintrag[0], bu: '' };
    return { konto: eintrag, bu: a.satz === 19 ? '9' : a.satz === 7 ? '8' : '' };
  };
  SuS.datevBuchungsstapel = (jahr) => {
    const f = SuS.daten.firma, j = String(jahr), K = SuS.DATEV_KONTEN[f.skr] || SuS.DATEV_KONTEN['03'];
    if (!/^\d{4,7}$/.test(f.beraterNr) || Number(f.beraterNr) < 1001 || !/^\d{1,5}$/.test(f.mandantNr) || !Number(f.mandantNr))
      throw new Error('Bitte zuerst Berater- und Mandantennummer eintragen (gibt der Steuerberater).');
    const q = (t) => '"' + String(t == null ? '' : t).replace(/"/g, '""') + '"';
    const jetzt = new Date(), zwei = (n) => String(n).padStart(2, '0');
    const stempel = jetzt.getFullYear() + zwei(jetzt.getMonth() + 1) + zwei(jetzt.getDate()) + zwei(jetzt.getHours()) + zwei(jetzt.getMinutes()) + zwei(jetzt.getSeconds()) + '000';
    const kopf = ['"EXTF"', 700, 21, '"Buchungsstapel"', 13, stempel, '', '"RE"', '""', '""', f.beraterNr, f.mandantNr, j + '0101', 4, j + '0101', j + '1231',
      q('Stock und Stein ' + j), '""', 1, 0, 0, '"EUR"', '', '""', '', '', q(f.skr), '', '', '""', '""'].join(';');
    const spalten = ['Umsatz (ohne Soll/Haben-Kz)', 'Soll/Haben-Kennzeichen', 'WKZ Umsatz', 'Kurs', 'Basis-Umsatz', 'WKZ Basis-Umsatz', 'Konto',
      'Gegenkonto (ohne BU-Schlüssel)', 'BU-Schlüssel', 'Belegdatum', 'Belegfeld 1', 'Belegfeld 2', 'Skonto', 'Buchungstext'].join(';');
    const zeilen = [kopf, spalten], beleg = (t) => q(String(t || '').replace(/[^A-Za-z0-9$&%*+\-/]/g, '').slice(0, 36));
    const zeile = (betragCent, konto, gegen, bu, datum, belegNr, text) => zeilen.push([centFeld(Math.abs(betragCent)), q(betragCent > 0 ? 'S' : 'H'), q('EUR'), '', '', '""', konto, gegen, q(bu || ''),
      datum.slice(8, 10) + datum.slice(5, 7), beleg(belegNr), '""', '', q(String(text || '').trim().slice(0, 60))].join(';'));
    const bank = f.bankKonto || K.bank, info = { rechnungen: 0, zahlungen: 0, skonto: 0, ausgaben: 0, vonHand: 0 };
    SuS.daten.dokumente.filter((d) => SuS.istRechnung(d) && d.fest).sort((a, b) => a.nummer.localeCompare(b.nummer)).forEach((d) => {
      const s = SuS.summen(d), k = SuS.kundeVon(d), name = k ? k.name : '';
      if (d.datum.slice(0, 4) === j && s.zahlbetrag) { zeile(s.zahlbetrag, f.debitor, SuS.datevKonto(s, f.skr), '', d.datum, d.nummer, name + ' ' + SuS.TYPEN[d.typ].name); info.rechnungen++; }
      /* Mahngebühren: eigene Forderung (nicht umsatzsteuerbar) – sonst stünde die mitbezahlte Gebühr ohne Gegenbuchung (Fund Cursor) */
      for (const m of d.mahnungen || []) if (m.gebuehr && m.datum.slice(0, 4) === j) zeile(m.gebuehr, f.debitor, K.mahn, '', m.datum, d.nummer, 'Mahngebühr ' + name);
      for (const z of d.zahlungen || []) {
        if (z.datum.slice(0, 4) !== j) continue;
        if (z.art === 'skonto') {
          const sk = s.modus === 'regel' && s.satz === 19 ? K.skonto19 : s.modus === 'regel' && s.satz === 7 ? K.skonto7 : K.skonto;
          zeile(z.betrag, sk, f.debitor, '', z.datum, d.nummer, 'Skonto ' + name); info.skonto++;
        } else { zeile(z.betrag, bank, f.debitor, '', z.datum, d.nummer, 'Zahlung ' + name); info.zahlungen++; }
      }
    });
    SuS.daten.ausgaben.filter((a) => a.datum.slice(0, 4) === j).sort((a, b) => a.datum.localeCompare(b.datum)).forEach((a) => {
      if (SuS.ausgabeAbweichend(a)) { info.vonHand++; return; }
      const auf = SuS.datevAufwand(a, f.skr);
      zeile(a.brutto, auf.konto, a.bezahlt ? bank : f.kreditor, auf.bu, a.datum, a.nummer, (a.lieferant + ' ' + a.text).trim()); info.ausgaben++;
    });
    SuS.datevInfo = info;
    return zeilen.join('\r\n') + '\r\n';
  };
})();
