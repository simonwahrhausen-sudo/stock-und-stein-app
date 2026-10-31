/* Stock und Stein – Ansichten des Ausbaus: Baustellen (Projektmappe), Stunden/Material, Wochenplan, Mitarbeiter,
   Offene Posten, Pflegeverträge, Export. Eigene Gestaltung; Funktionen nach Orientierung an Branchen-Software. */
'use strict';

(function () {
  const e = SuS.esc, A = SuS.aktionen;
  const gespeichert = () => SuS.speichern();
  let filterP = 'aktiv';

  const statusChip = (s) => '<span class="chip ' + ({ anfrage: 'entwurf', geplant: 'offen', laufend: 'offen', fertig: 'gut', abgerechnet: 'aus' }[s] || 'entwurf') + '">' + SuS.PSTATUS[s] + '</span>';
  const kundeName = (id) => (SuS.kunde(id) || { name: 'Ohne Kunde' }).name;

  /* ---------- Baustellen ---------- */
  SuS.seiten.baustellen = () => {
    const q = SuS.ansicht.suche.toLowerCase();
    let liste = SuS.daten.projekte.filter((p) => filterP === 'alle' || (filterP === 'aktiv' ? !['fertig', 'abgerechnet'].includes(p.status) : ['fertig', 'abgerechnet'].includes(p.status)));
    if (q) liste = liste.filter((p) => [p.nr, p.titel, p.adresse, kundeName(p.kundeId)].join(' ').toLowerCase().includes(q));
    SuS.zeige('<div class="kopf"><div><h1>Baustellen</h1><p>Alles zu einem Auftrag an einem Ort</p></div><button class="knopf haupt klein" data-a="baustelleNeu">+ Neu</button></div>' +
      '<input class="suche" type="search" placeholder="Suchen: Kunde, Ort, Nummer" value="' + e(SuS.ansicht.suche) + '" data-suche>' +
      '<div class="filter">' + [['aktiv', 'Laufend'], ['fertig', 'Fertig'], ['alle', 'Alle']].map(([k, t]) => '<button type="button" data-a="filterP" data-wert="' + k + '" class="' + (k === filterP ? 'an' : '') + '">' + t + '</button>').join('') + '</div>' +
      (liste.length ? '<ul class="liste">' + liste.map((p) => {
        const offen = SuS.offenerAufwand(p.id).length;
        return '<li><a class="zeile" href="#/baustelle/' + e(p.id) + '"><div class="haupt"><div class="titel">' + e(p.titel) + '</div><div class="klein">' +
          e([p.nr, kundeName(p.kundeId), p.adresse].filter(Boolean).join(' · ')) + '</div></div><div style="text-align:right">' + statusChip(p.status) +
          (offen ? '<div class="klein" style="color:var(--gelb);font-weight:700;margin-top:4px">' + offen + ' offen</div>' : '') + '</div></a></li>';
      }).join('') + '</ul>'
        : '<div class="karte leer"><p>' + (q ? 'Nichts gefunden.' : 'Noch keine Baustellen. Eine Baustelle sammelt Angebot, Rechnungen, Stunden, Material, Termine und Notizen.') + '</p>' +
          (q ? '' : '<button class="knopf zweit" data-a="baustelleNeu">Erste Baustelle anlegen</button>') + '</div>'));
  };
  A.filterP = (el) => { filterP = el.dataset.wert; SuS.neuZeichnen(); };

  A.baustelleNeu = (el) => {
    const kunden = SuS.daten.kunden.slice().sort((a, b) => a.name.localeCompare(b.name, 'de'));
    SuS.blatt('Neue Baustelle', SuS.feld('titel', 'Bezeichnung', '', { auto: true, platz: 'z. B. Terrasse Meier' }) +
      SuS.feld('kunde', 'Kunde', el.dataset.kunde || '', { typ: 'select', optionen: [['', '– später wählen –']].concat(kunden.map((k) => [k.id, k.name])) }) +
      '<p class="unterzeile">Neuer Kunde? Erst unter „Mehr → Kunden“ anlegen oder später in der Baustelle wählen.</p>',
    async (fd) => {
      const titel = String(fd.get('titel') || '').trim();
      if (!titel) { SuS.melde('Bitte eine Bezeichnung eingeben.', true); return false; }
      let p = null;
      const marke = SuS.navMarke();
      if (!(await SuS.transaktionSicher(() => { p = SuS.neuesProjekt(String(fd.get('kunde') || ''), titel); }))) { SuS.melde('Speichern fehlgeschlagen.', true); return false; }
      SuS.gehZu('#/baustelle/' + p.id, marke); return true;
    }, 'Anlegen');
  };

  SuS.seiten.baustelle = (id) => {
    const p = SuS.projekt(id);
    if (!p) { location.hash = '#/baustellen'; return; }
    const belege = SuS.projektBelege(id), aufwand = SuS.projektAufwand(id), termine = SuS.projektTermine(id);
    const offen = SuS.offenerAufwand(id);
    const stunden = aufwand.filter((a) => a.typ === 'zeit').reduce((x, a) => x + a.stunden, 0);
    const k = SuS.kunde(p.kundeId);
    const zeileAufwand = (a) => {
      const m = SuS.mitarbeiterVon(a.mitarbeiterId), l = a.leistungId ? SuS.leistung(a.leistungId) : null;
      const ab = SuS.aufwandAbgerechnet(a);
      const titel = a.typ === 'zeit' ? SuS.zahl(a.stunden, 2) + ' Std · ' + (m ? m.name : 'ohne Mitarbeiter') : SuS.zahl(a.menge) + ' ' + (a.einheit || (l && l.einheit) || '') + ' ' + (a.text || (l ? l.text : 'Material'));
      return '<li><button class="zeile" data-a="aufwandBearbeiten" data-id="' + e(a.id) + '"><div class="haupt"><div class="titel">' + e(titel) + '</div><div class="klein">' +
        e(SuS.datum(a.datum) + (a.taetigkeit ? ' · ' + a.taetigkeit : '')) + '</div></div>' +
        (ab ? '<span class="chip gut">' + e(ab.nummer || 'im Entwurf') + '</span>' : '<span class="chip offen">offen</span>') + '</button></li>';
    };
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/baustellen">‹ Baustellen</button>' +
      '<div class="dokkopf"><div><h1>' + e(p.titel) + '</h1><div class="unterzeile">' + e(p.nr) + '</div></div>' + statusChip(p.status) + '</div>' +
      '<div class="karte" style="margin-top:14px"><div class="drei" style="text-align:center">' +
        '<div><div class="kachel-wert">' + belege.length + '</div><div class="unterzeile">Belege</div></div>' +
        '<div><div class="kachel-wert">' + SuS.zahl(stunden, 1) + '</div><div class="unterzeile">Stunden</div></div>' +
        '<div><div class="kachel-wert"' + (offen.length ? ' style="color:var(--gelb)"' : '') + '>' + offen.length + '</div><div class="unterzeile">nicht abgerechnet</div></div></div></div>' +
      '<div class="knopfreihe"><button class="knopf haupt" data-a="zeitNeu" data-p="' + e(p.id) + '">+ Stunden</button><button class="knopf zweit" data-a="materialNeu" data-p="' + e(p.id) + '">+ Material</button>' +
      '<button class="knopf" data-a="terminNeu" data-p="' + e(p.id) + '">+ Termin</button></div>' +
      '<h2>Angaben</h2><div class="karte">' +
        SuS.feld('titel', 'Bezeichnung', p.titel, {}) .replace('name="titel"', 'name="titel" data-pfeld="titel"') +
        SuS.feld('kunde', 'Kunde', p.kundeId, { typ: 'select', optionen: [['', '– kein Kunde –']].concat(SuS.daten.kunden.slice().sort((a, b) => a.name.localeCompare(b.name, 'de')).map((x) => [x.id, x.name])) }).replace('name="kunde"', 'name="kunde" data-pfeld="kundeId"') +
        SuS.feld('adresse', 'Adresse der Baustelle', p.adresse, {}).replace('name="adresse"', 'name="adresse" data-pfeld="adresse"') +
        SuS.feld('status', 'Stand', p.status, { typ: 'select', optionen: Object.keys(SuS.PSTATUS).map((s) => [s, SuS.PSTATUS[s]]) }).replace('name="status"', 'name="status" data-pfeld="status"') +
        (k && k.telefon ? '<a class="knopf klein" href="tel:' + e(k.telefon.replace(/[^\d+]/g, '')) + '">Kunde anrufen</a> ' : '') +
        (p.adresse && window.parent === window ? '<a class="knopf klein" href="https://maps.apple.com/?q=' + encodeURIComponent(p.adresse) + '" target="_blank" rel="noopener">Route</a>' : '') +
      '</div>' +
      '<h2>Belege</h2>' + (belege.length ? '<ul class="liste">' + belege.map(SuS.dokZeile).join('') + '</ul>' : '<p class="unterzeile">Noch keine.</p>') +
      '<div class="knopfreihe"><button class="knopf" data-a="belegFuerBaustelle" data-typ="angebot" data-p="' + e(p.id) + '">+ Angebot</button>' +
      '<button class="knopf" data-a="belegFuerBaustelle" data-typ="rechnung" data-p="' + e(p.id) + '">+ Rechnung</button></div>' +
      '<h2>Stunden und Material</h2>' +
      (offen.length ? '<div class="hinweis info"><b>' + offen.length + ' Einträge noch nicht abgerechnet.</b><div class="knopfreihe"><button class="knopf haupt klein" data-a="aufwandAbrechnen" data-p="' + e(p.id) + '">In Rechnung übernehmen</button></div></div>' : '') +
      (aufwand.length ? '<ul class="liste">' + aufwand.map(zeileAufwand).join('') + '</ul>' : '<p class="unterzeile">Noch nichts erfasst. Stunden und Material lassen sich später mit einem Tipp abrechnen.</p>') +
      nachkalkulationKarte(p.id) +
      '<div class="knopfreihe"><button class="knopf klein" data-a="stundenSenden" data-p="' + e(p.id) + '">Stunden als Datei senden</button>' +
      '<label class="knopf klein">Stunden-Datei einlesen<input type="file" accept=".json,application/json" data-stundendatei="' + e(p.id) + '" hidden></label></div>' +
      '<h2>Fotos</h2><div id="fotos-' + e(p.id) + '"><p class="unterzeile">Fotos werden geladen …</p></div>' +
      '<h2>Termine</h2>' + (termine.length ? '<ul class="liste">' + termine.map(terminZeile).join('') + '</ul>' : '<p class="unterzeile">Keine Termine.</p>') +
      '<h2>Notizen</h2><div class="karte"><label class="feld"><span>Nur intern (Zugang, Absprachen, Maße …)</span><textarea data-pfeld="notiz" style="min-height:110px">' + e(p.notiz) + '</textarea></label></div>' +
      '<button class="knopf gefahr breit" style="margin-top:12px" data-a="baustelleLoeschen" data-id="' + e(p.id) + '">Baustelle löschen</button>');
    SuS.aktuelleBaustelle = p;
    if (SuS.fotosZeichnen) setTimeout(() => SuS.fotosZeichnen(p.id), 0);
  };

  function nachkalkulationKarte(pid) {
    const n = SuS.nachkalkulation(pid);
    if (!n.hatAngebot && !n.stunden && !n.ist && !n.einkauf) return '<div class="knopfreihe"><button class="knopf klein" data-a="ausgabeBearbeiten" data-p="' + e(pid) + '">+ Ausgabe (Beleg)</button></div>';
    const zeile = (a, b, stil) => '<div' + (stil ? ' class="' + stil + '"' : '') + '><span>' + a + '</span><span>' + b + '</span></div>';
    const diff = n.lohnDifferenz, gut = diff >= 0;
    return '<h2>Nachkalkulation</h2><div class="karte summen">' +
      (n.hatAngebot ? zeile('Angebot netto (Soll)', SuS.euro(n.soll.netto)) + zeile('davon Lohn laut Angebot', SuS.euro(n.soll.lohn)) : '') +
      zeile('Erfasste Stunden', SuS.zahl(n.stunden, 2) + ' Std') + zeile('Lohn laut Stunden (Ist, zu Ihren Sätzen)', SuS.euro(n.lohnIst)) +
      zeile('Material laut Erfassung', SuS.euro(n.materialIst)) + zeile('Abgerechnet (ohne Abschläge)', SuS.euro(n.abgerechnet)) +
      (n.einkauf ? zeile('Einkauf laut Belegen (netto)', SuS.euro(n.einkauf)) + zeile('Abgerechnet minus Einkauf', SuS.euro(n.rohertrag)) : '') +
      (n.hatAngebot ? zeile(gut ? 'Lohn: noch Luft' : 'Lohn: mehr Stunden als angeboten', (gut ? '' : '−') + SuS.euro(Math.abs(diff)), 'gesamt') : '') +
      (n.ohnePreis ? '<div class="unterzeile">' + n.ohnePreis + ' Einträge ohne Preis – nicht mitgerechnet.</div>' : '') +
      '<div class="unterzeile">Hilft beim Prüfen der eigenen Preise: Reicht der angebotene Lohn für die tatsächlichen Stunden?</div>' +
      '<div class="knopfreihe"><button class="knopf klein" data-a="ausgabeBearbeiten" data-p="' + e(pid) + '">+ Ausgabe (Beleg)</button></div></div>';
  }
  A.stundenSenden = (el) => {
    const p = SuS.projekt(el.dataset.p);
    SuS.dateiTeilen('stunden-' + p.nr + '-' + SuS.heute() + '.json', SuS.stundenExport(p.id, true), 'application/json',
      'Stunden und Material für ' + p.titel + ' (' + p.nr + '). Bitte in der App unter Baustelle → „Stunden-Datei einlesen“ öffnen.', 'Stundenzettel ' + p.nr);
  };
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-stundendatei]');
    if (!el || !el.files[0]) return;
    const pid = el.dataset.stundendatei, r = new FileReader();
    if (el.files[0].size > 2000000) { SuS.melde('Datei zu groß.', true); return; }
    const einlesen = async (text, trotzdem) => {
      try {
        let erg = null;
        if (!(await SuS.transaktionSicher(() => { erg = SuS.stundenImport(pid, text, trotzdem); }))) { SuS.melde('Speichern fehlgeschlagen.', true); SuS.neuZeichnen(); return; }
        SuS.melde(erg.neu + ' Einträge übernommen' + (erg.doppelt ? ', ' + erg.doppelt + ' waren schon da' : '') + (erg.fehlerhaft ? ', ' + erg.fehlerhaft + ' fehlerhaft (nicht übernommen)' : '') + '.' +
          (erg.rollen.length ? ' Achtung: ' + erg.rollen.join(', ') + ' ist hier mit anderer Rolle eingetragen – Stundensatz prüfen.' : ''), erg.fehlerhaft > 0 || erg.rollen.length > 0);
        SuS.neuZeichnen();
      } catch (x) {
        SuS.neuZeichnen();  // transaktion() hat frische Objekte geladen
        if (x.andereBaustelle) {
          SuS.blatt('Andere Baustelle', '<div class="hinweis">' + e(x.message) + '</div><p>Trotzdem in diese Baustelle (' + e(SuS.projekt(pid).nr) + ') einlesen?</p>' +
            '<button type="submit" class="knopf haupt breit">Ja, hier einlesen</button>', () => { setTimeout(() => einlesen(text, true), 0); return true; }, 'Einlesen');
        } else SuS.melde(x.message, true);
      }
    };
    r.onload = () => einlesen(String(r.result || ''), false);
    r.readAsText(el.files[0]);
  });
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-pfeld]');
    if (!el || !SuS.aktuelleBaustelle) return;
    const p = SuS.projekt(SuS.aktuelleBaustelle.id);  // frisch auflösen (nach einer Rücknahme, Fund Cursor R12)
    if (!p) return;
    p[el.dataset.pfeld] = el.value; SuS.aktuelleBaustelle = p;
    gespeichert();
    if (el.dataset.pfeld === 'status' || el.dataset.pfeld === 'kundeId') SuS.neuZeichnen();
  });
  A.baustelleLoeschen = async (el) => {
    const id = el.dataset.id, marke = SuS.navMarke();
    if (SuS.projektBelege(id).some((d) => d.fest)) { SuS.melde('Zu dieser Baustelle gibt es gestellte Rechnungen – sie bleibt erhalten. Stand auf „Abgerechnet“ setzen.', true); return; }
    if (!SuS.sicher(el)) return;
    const ok = await SuS.transaktionSicher(() => {
      SuS.daten.projekte = SuS.daten.projekte.filter((p) => p.id !== id);
      SuS.daten.aufwand = SuS.daten.aufwand.filter((a) => a.projektId !== id);
      SuS.daten.termine = SuS.daten.termine.filter((t) => t.projektId !== id);
      SuS.daten.dokumente.forEach((d) => { if (d.projektId === id) d.projektId = ''; });
      SuS.daten.ausgaben.forEach((a) => { if (a.projektId === id) a.projektId = ''; });
      SuS.daten.ablage.forEach((u) => { if (u.projektId === id) u.projektId = ''; });
      SuS.daten.vertraege.forEach((v) => { if (v.projektId === id) v.projektId = ''; });
    });
    if (!ok) { SuS.melde('Speichern fehlgeschlagen – die Baustelle bleibt.', true); SuS.neuZeichnen(); return; }
    SuS.melde('Baustelle gelöscht.'); SuS.gehZu('#/baustellen', marke);
    /* Fotos erst nach bestätigter Ablage löschen (Fund Cursor R9), nicht verwaist liegen lassen (Fund Cursor) */
    if (SuS.fotosVonLoeschen) SuS.fotosVerfuegbar().then((ja) => ja && SuS.fotosVonLoeschen(id)).catch(() => {});
  };
  A.belegFuerBaustelle = async (el) => {
    const p = SuS.projekt(el.dataset.p), marke = SuS.navMarke();
    let dok = null;
    if (!(await SuS.transaktionSicher(() => {
      dok = SuS.neuesDokument(el.dataset.typ, p.kundeId);
      dok.projektId = p.id; dok.baustelle = p.adresse; dok.betreff = p.titel;
      if (el.dataset.typ !== 'angebot') dok.leistungVon = SuS.heute();
    }))) { SuS.melde('Speichern fehlgeschlagen – nichts angelegt.', true); SuS.neuZeichnen(); return; }
    SuS.gehZu('#/dok/' + dok.id, marke);
  };

  /* ---------- Stunden und Material ---------- */
  const mitarbeiterOptionen = (wert) => [['', '– ohne –']].concat(SuS.daten.mitarbeiter.filter((m) => m.aktiv || m.id === wert).map((m) => [m.id, m.name + ' (' + SuS.ROLLEN[m.rolle] + ')']));
  function aufwandBlatt(a, neu) {
    const zeit = a.typ === 'zeit', ab = SuS.aufwandAbgerechnet(a), fest = !!(ab && ab.fest);
    const html = zeit
      ? '<div class="zwei">' + SuS.feld('datum', 'Datum', a.datum, { typ: 'date' }) + SuS.feld('stunden', 'Stunden', a.stunden ? SuS.zahlFeld(a.stunden) : '', { dezimal: true, auto: neu, platz: 'z. B. 7,5', hilfe: 'oder unten Beginn/Ende' }) + '</div>' +
        '<div class="drei">' + SuS.feld('von', 'Beginn', '', { typ: 'time' }) + SuS.feld('bis', 'Ende', '', { typ: 'time' }) + SuS.feld('pause', 'Pause (Min.)', '', { dezimal: true, platz: '30' }) + '</div>' +
        (neu && SuS.daten.mitarbeiter.filter((m) => m.aktiv).length > 1
          ? '<div class="feld"><span>Wer? (mehrere möglich – je Person ein Eintrag)</span>' + SuS.daten.mitarbeiter.filter((m) => m.aktiv).map((m) =>
            '<label class="schalter" style="padding:6px 0"><input type="checkbox" name="mehrere" value="' + e(m.id) + '"><span>' + e(m.name) + ' <small style="display:inline">(' + SuS.ROLLEN[m.rolle] + ')</small></span></label>').join('') + '</div>'
          : SuS.feld('mitarbeiter', 'Mitarbeiter', a.mitarbeiterId, { typ: 'select', optionen: mitarbeiterOptionen(a.mitarbeiterId) })) +
        (SuS.daten.mitarbeiter.length ? '' : '<p class="unterzeile">Tipp: Mitarbeiter unter „Mehr → Mitarbeiter“ anlegen – dann wird nach Facharbeiter/Helfer abgerechnet.</p>') +
        SuS.feld('taetigkeit', 'Tätigkeit', a.taetigkeit, { platz: 'z. B. Pflaster verlegt' })
      : '<div class="zwei">' + SuS.feld('datum', 'Datum', a.datum, { typ: 'date' }) + SuS.feld('menge', 'Menge', a.menge ? SuS.zahlFeld(a.menge) : '', { auto: neu, platz: 'z. B. 12 oder 4*3' }) + '</div>' +
        SuS.feld('leistung', 'Aus dem Katalog', a.leistungId, { typ: 'select', optionen: [['', '– freie Angabe –']].concat(SuS.daten.leistungen.map((l) => [l.id, l.text + ' (' + SuS.euro(l.preis) + ' je ' + l.einheit + ')'])) }) +
        '<div class="zwei">' + SuS.feld('text', 'oder Bezeichnung', a.text, { platz: 'z. B. Granitsteine grau' }) + SuS.feld('einheit', 'Einheit', a.einheit, { liste: 'einheiten' }) + '</div>' + SuS.einheitenListe() +
        SuS.feld('preis', 'Preis je Einheit (netto, leer = Katalogpreis)', a.preis ? SuS.centText(a.preis) : '', { dezimal: true });
    const form = SuS.blatt(zeit ? (neu ? 'Stunden erfassen' : 'Stunden') : (neu ? 'Material erfassen' : 'Material'),
      (fest ? '<div class="gesperrt">Schon in Rechnung ' + e(SuS.dok(a.dokId).nummer) + ' abgerechnet – nicht mehr änderbar.</div>' : '') + html +
      (!neu && !fest ? '<button type="button" class="knopf gefahr breit" data-a="aufwandLoeschen" data-id="' + e(a.id) + '">Eintrag löschen</button>' : ''),
    fest ? null : (fd) => {
      a.datum = String(fd.get('datum') || SuS.heute());
      if (zeit) {
        let std = SuS.leseZahl(fd.get('stunden'));
        const von = String(fd.get('von') || ''), bis = String(fd.get('bis') || '');
        if (!Number.isFinite(std) && von && bis) {
          const [h1, m1] = von.split(':').map(Number), [h2, m2] = bis.split(':').map(Number);
          const pause = SuS.leseZahl(fd.get('pause') || '0') || 0;
          std = Math.round(((h2 * 60 + m2) - (h1 * 60 + m1) - pause) / 60 * 100) / 100;
        }
        if (!Number.isFinite(std) || std <= 0 || std > 24) { SuS.melde('Bitte Stunden (z. B. 7,5) oder Beginn und Ende eingeben.', true); return false; }
        const mehrere = fd.getAll('mehrere');
        Object.assign(a, { stunden: std, mitarbeiterId: mehrere[0] || String(fd.get('mitarbeiter') || ''), taetigkeit: String(fd.get('taetigkeit') || '').trim() });
        if (neu && mehrere.length > 1) {  // ganze Kolonne: je weitere Person ein eigener Eintrag
          mehrere.slice(1).forEach((mid) => SuS.daten.aufwand.push(Object.assign({}, a, { id: SuS.id(), mitarbeiterId: mid })));
        }
      } else {
        const menge = SuS.rechne(String(fd.get('menge') || ''));
        const lid = String(fd.get('leistung') || ''), text = String(fd.get('text') || '').trim();
        if (!Number.isFinite(menge) || menge <= 0) { SuS.melde('Bitte eine Menge eingeben.', true); return false; }
        if (!lid && !text) { SuS.melde('Bitte aus dem Katalog wählen oder eine Bezeichnung eingeben.', true); return false; }
        const preis = String(fd.get('preis') || '').trim() ? SuS.leseCent(fd.get('preis')) : 0;
        if (!Number.isFinite(preis) || preis < 0) { SuS.melde('Preis bitte als Zahl.', true); return false; }
        const l = lid ? SuS.leistung(lid) : null;
        Object.assign(a, { menge, leistungId: lid, text, einheit: String(fd.get('einheit') || '').trim() || (l ? l.einheit : 'Stk'), preis });
      }
      if (neu) SuS.daten.aufwand.push(a);
      gespeichert(); SuS.neuZeichnen(); SuS.melde('Gespeichert.'); return true;
    }, neu ? 'Sichern' : 'Ändern');
    if (fest) form.querySelectorAll('input, select, textarea').forEach((x) => { x.disabled = true; });
  }
  A.zeitNeu = (el) => aufwandBlatt({ id: SuS.id(), projektId: el.dataset.p, typ: 'zeit', datum: SuS.heute(), mitarbeiterId: '', stunden: 0, taetigkeit: '', dokId: '' }, true);
  A.materialNeu = (el) => aufwandBlatt({ id: SuS.id(), projektId: el.dataset.p, typ: 'material', datum: SuS.heute(), leistungId: '', text: '', menge: 0, einheit: '', preis: 0, dokId: '' }, true);
  A.aufwandBearbeiten = (el) => { const a = SuS.daten.aufwand.find((x) => x.id === el.dataset.id); if (a) aufwandBlatt(a, false); };
  A.aufwandLoeschen = (el) => {
    if (!SuS.sicher(el)) return;
    SuS.daten.aufwand = SuS.daten.aufwand.filter((x) => x.id !== el.dataset.id);
    gespeichert(); SuS.blattZu(); SuS.neuZeichnen();
  };
  A.aufwandAbrechnen = (el) => {
    const p = SuS.projekt(el.dataset.p), offen = SuS.offenerAufwand(p.id);
    const entwuerfe = SuS.projektBelege(p.id).filter((d) => !d.fest && (d.typ === 'rechnung' || d.typ === 'schluss'));
    SuS.blatt('In Rechnung übernehmen', '<p class="unterzeile" style="margin-top:0">Haken entfernen, was noch nicht abgerechnet werden soll.</p><ul class="liste">' +
      offen.map((a) => {
        const m = SuS.mitarbeiterVon(a.mitarbeiterId), l = a.leistungId ? SuS.leistung(a.leistungId) : null;
        const t = a.typ === 'zeit' ? SuS.zahl(a.stunden, 2) + ' Std ' + (m ? m.name : '') : SuS.zahl(a.menge) + ' ' + (a.einheit || '') + ' ' + (a.text || (l ? l.text : ''));
        return '<li><label class="zeile"><input type="checkbox" name="a" value="' + e(a.id) + '" checked style="width:22px;height:22px;accent-color:var(--moos)"><div class="haupt"><div class="titel">' + e(t) + '</div><div class="klein">' + e(SuS.datum(a.datum) + (a.taetigkeit ? ' · ' + a.taetigkeit : '')) + '</div></div></label></li>';
      }).join('') + '</ul><div style="height:12px"></div>' +
      SuS.feld('ziel', 'In welche Rechnung?', entwuerfe[0] ? entwuerfe[0].id : '', { typ: 'select', optionen: entwuerfe.map((d) => [d.id, 'Entwurf: ' + (d.betreff || SuS.TYPEN[d.typ].name)]).concat([['', 'Neue Rechnung']]) }),
    async (fd) => {
      const marke = SuS.navMarke(), ids = fd.getAll('a');
      if (!ids.length) { SuS.melde('Nichts ausgewählt.', true); return false; }
      let dok = SuS.dok(String(fd.get('ziel') || ''));
      if (!dok) {
        dok = SuS.neuesDokument('rechnung', p.kundeId); Object.assign(dok, { projektId: p.id, baustelle: p.adresse, betreff: p.titel });
        SuS.daten.dokumente = SuS.daten.dokumente.filter((x) => x.id !== dok.id);  // erst in der Transaktion einfügen
      }
      let n = 0;
      try {
        if (!(await SuS.transaktionSicher(() => {  // Erfolg/Navigation erst nach bestätigter Ablage (Fund Cursor R11)
          if (!SuS.dok(dok.id)) SuS.daten.dokumente.unshift(dok);
          n = SuS.aufwandInRechnung(SuS.dok(dok.id), SuS.daten.aufwand.filter((a) => ids.includes(a.id)));
        }))) { SuS.melde('Speichern fehlgeschlagen.', true); return false; }
      } catch (x) { SuS.melde(x.message, true); SuS.neuZeichnen(); return false; }
      SuS.melde(n + ' Positionen übernommen – bitte prüfen.'); SuS.gehZu('#/dok/' + dok.id, marke); return true;
    }, 'Übernehmen');
  };

  /* ---------- Termine und Wochenplan ---------- */
  function terminZeile(t) {
    const p = t.projektId ? SuS.projekt(t.projektId) : null;
    const namen = t.mitarbeiter.map((id) => (SuS.mitarbeiterVon(id) || {}).name).filter(Boolean).join(', ');
    return '<li><button class="zeile" data-a="terminBearbeiten" data-id="' + e(t.id) + '"><div style="min-width:54px;font-weight:700;font-variant-numeric:tabular-nums">' +
      e(t.von || 'ganzt.') + (t.bis ? '<div class="klein">' + e(t.bis) + '</div>' : '') + '</div><div class="haupt"><div class="titel">' + e(t.text || (p ? p.titel : 'Termin')) + '</div><div class="klein">' +
      e([SuS.datum(t.datum), p ? p.titel : '', namen].filter(Boolean).join(' · ')) + '</div></div></button></li>';
  }
  SuS.terminZeile = terminZeile;
  function terminBlatt(t, neu) {
    SuS.blatt(neu ? 'Neuer Termin' : 'Termin', SuS.feld('text', 'Was?', t.text, { auto: neu, platz: 'z. B. Aufmaß, Pflasterarbeiten, Rollrasen' }) +
      SuS.feld('datum', 'Datum', t.datum, { typ: 'date' }) + '<div class="zwei">' + SuS.feld('von', 'Von', t.von, { typ: 'time' }) + SuS.feld('bis', 'Bis', t.bis, { typ: 'time' }) + '</div>' +
      SuS.feld('projekt', 'Baustelle', t.projektId, { typ: 'select', optionen: [['', '– keine –']].concat(SuS.daten.projekte.map((p) => [p.id, p.titel])) }) +
      (SuS.daten.mitarbeiter.length ? '<div class="feld"><span>Wer?</span>' + SuS.daten.mitarbeiter.filter((m) => m.aktiv || t.mitarbeiter.includes(m.id)).map((m) =>
        '<label class="schalter" style="padding:6px 0"><input type="checkbox" name="m" value="' + e(m.id) + '"' + (t.mitarbeiter.includes(m.id) ? ' checked' : '') + '><span>' + e(m.name) + '</span></label>').join('') + '</div>' : '') +
      (neu ? '' : '<button type="button" class="knopf gefahr breit" data-a="terminLoeschen" data-id="' + e(t.id) + '">Termin löschen</button>'),
    (fd) => {
      Object.assign(t, { text: String(fd.get('text') || '').trim(), datum: String(fd.get('datum') || SuS.heute()), von: String(fd.get('von') || ''),
        bis: String(fd.get('bis') || ''), projektId: String(fd.get('projekt') || ''), mitarbeiter: fd.getAll('m') });
      if (!t.text && !t.projektId) { SuS.melde('Bitte angeben, worum es geht.', true); return false; }
      if (neu) SuS.daten.termine.push(t);
      gespeichert(); SuS.neuZeichnen(); return true;
    }, 'Sichern');
  }
  A.terminNeu = (el) => terminBlatt({ id: SuS.id(), projektId: el.dataset.p || '', datum: el.dataset.datum || SuS.heute(), von: '07:00', bis: '', text: '', mitarbeiter: [], vertragId: '' }, true);
  /* Pflegeeinsatz aus dem Vertrag einplanen: Text und Baustelle vorbelegt, Termin gehört zum Vertrag. */
  A.pflegeEinplanen = (el) => {
    const v = SuS.vertrag(el.dataset.v);
    if (!v) return;
    terminBlatt({ id: SuS.id(), projektId: v.projektId || '', datum: el.dataset.datum || SuS.heute(), von: '07:00', bis: '', text: (el.dataset.text || 'Pflege') + ' – ' + v.titel,
      mitarbeiter: [], vertragId: v.id }, true);
  };
  A.terminBearbeiten = (el) => { const t = SuS.daten.termine.find((x) => x.id === el.dataset.id); if (t) terminBlatt(t, false); };
  A.terminLoeschen = (el) => {
    if (!SuS.sicher(el)) return;
    SuS.daten.termine = SuS.daten.termine.filter((x) => x.id !== el.dataset.id);
    gespeichert(); SuS.blattZu(); SuS.neuZeichnen();
  };

  let wochenStart = null, wocheMa = '';
  A.wocheMa = (el) => { wocheMa = el.dataset.id; SuS.neuZeichnen(); };
  const montag = (iso) => { const [j, m, t] = iso.split('-').map(Number); const d = new Date(j, m - 1, t); const w = (d.getDay() + 6) % 7; return SuS.plusTage(iso, -w); };
  const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
  SuS.seiten.woche = () => {
    if (!wochenStart) wochenStart = montag(SuS.heute());
    const tage = [0, 1, 2, 3, 4, 5, 6].map((i) => SuS.plusTage(wochenStart, i));
    const [j, m, t] = wochenStart.split('-').map(Number);
    const kw = (() => { const d = new Date(Date.UTC(j, m - 1, t + 3)); const erst = new Date(Date.UTC(d.getUTCFullYear(), 0, 4)); return 1 + Math.round(((d - erst) / 86400000 - 3 + ((erst.getUTCDay() + 6) % 7)) / 7); })();
    SuS.zeige('<div class="kopf"><div><h1>Woche ' + kw + '</h1><p>' + SuS.datum(tage[0]) + ' – ' + SuS.datum(tage[6]) + '</p></div><button class="knopf haupt klein" data-a="terminNeu">+ Termin</button></div>' +
      '<div class="knopfreihe eng"><button class="knopf klein" data-a="woche" data-um="-7">‹ Vorige</button><button class="knopf klein" data-a="woche" data-um="0">Heute</button><button class="knopf klein" data-a="woche" data-um="7">Nächste ›</button>' +
        '<button class="knopf klein" data-a="kalenderExport" title="Termine der nächsten 8 Wochen in den Handy-Kalender">📅 In Kalender</button></div>' +
      pflegeKarte(tage) +
      (SuS.daten.mitarbeiter.some((m) => m.aktiv) ? '<div class="filter">' + [['', 'Alle']].concat(SuS.daten.mitarbeiter.filter((m) => m.aktiv).map((m) => [m.id, m.name])).map(([id, n]) =>
        '<button type="button" data-a="wocheMa" data-id="' + e(id) + '" class="' + (id === wocheMa ? 'an' : '') + '">' + e(n) + '</button>').join('') + '</div>' : '') +
      tage.map((tag, i) => {
        const liste = SuS.daten.termine.filter((x) => x.datum === tag && (!wocheMa || x.mitarbeiter.includes(wocheMa))).sort((a, b) => (a.von || '').localeCompare(b.von || ''));
        if (i >= 5 && !liste.length) return '';
        return '<h2' + (tag === SuS.heute() ? ' style="color:var(--moos)"' : '') + '>' + TAGE[i] + ' <span class="unterzeile" style="font-family:Inter">' + SuS.datum(tag) + '</span></h2>' +
          (liste.length ? '<ul class="liste">' + liste.map(terminZeile).join('') + '</ul>' : '<button class="knopf klein" data-a="terminNeu" data-datum="' + tag + '" style="color:var(--leise)">frei – Termin eintragen</button>');
      }).join(''));
  };
  /* Pflege im Monat dieser Woche (Monat des Donnerstags, wie bei der Kalenderwoche) */
  function pflegeKarte(tage) {
    const ym = tage[3].slice(0, 7), liste = SuS.pflegeImMonat(ym);
    if (!liste.length) return '';
    const vorschlag = tage.slice(0, 5).find((t) => t.slice(0, 7) === ym && t >= SuS.heute()) || tage.find((t) => t.slice(0, 7) === ym);
    return '<details class="karte" style="margin-top:12px"' + (liste.some((x) => !x.eingeplant.length) ? ' open' : '') + '><summary><b>Pflege im ' + SuS.MONATE[Number(ym.slice(5)) - 1] + '</b> · ' +
      liste.filter((x) => x.eingeplant.length).length + ' von ' + liste.length + ' eingeplant</summary><ul class="liste" style="box-shadow:none;margin-top:8px">' + liste.map((x) =>
      '<li class="zeile" style="cursor:default"><div class="haupt"><div class="titel">' + e(x.v.titel) + '</div><div class="klein">' + e(x.aufgaben.join(', ')) + '</div></div>' +
      (x.eingeplant.length ? '<span class="chip gut">' + e(x.eingeplant.map((d) => SuS.datum(d).slice(0, 6)).join(', ')) + '</span>'
        : '<button class="knopf klein" data-a="pflegeEinplanen" data-v="' + e(x.v.id) + '" data-datum="' + e(vorschlag) + '" data-text="' + e(x.aufgaben.join(', ')) + '">Einplanen</button>') + '</li>').join('') +
      '</ul></details>';
  }
  A.kalenderExport = () => {
    const von = wochenStart || montag(SuS.heute()), bis = SuS.plusTage(von, 56);
    const liste = SuS.daten.termine.filter((t) => t.datum >= von && t.datum < bis && (!wocheMa || t.mitarbeiter.includes(wocheMa)));
    if (!liste.length) { SuS.melde('In den nächsten 8 Wochen sind keine Termine eingetragen.', true); return; }
    const ics = SuS.termineIcs(liste), name = 'termine-' + von + '.ics';
    if (window.parent !== window) { SuS.textZeigen('Kalender (.ics)', ics); return; }
    SuS.dateiTeilen(name, ics, 'text/calendar', liste.length + ' Termine ab ' + SuS.datum(von) + ' – Datei öffnen, um sie in den Kalender zu übernehmen.', 'Termine ab ' + SuS.datum(von));
  };
  A.woche = (el) => { const um = Number(el.dataset.um); wochenStart = um ? SuS.plusTage(wochenStart, um) : montag(SuS.heute()); SuS.neuZeichnen(); };

  /* ---------- Mitarbeiter ---------- */
  SuS.seiten.mitarbeiter = () => {
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><h1>Mitarbeiter</h1><button class="knopf haupt klein" data-a="mitarbeiterBearbeiten">+ Neu</button></div>' +
      '<p class="unterzeile">Nur Name und Rolle – die Rolle bestimmt den Stundensatz beim Abrechnen (Leistungen „Facharbeiter (Stunde)“ und „Helfer (Stunde)“).</p>' +
      (SuS.daten.mitarbeiter.length ? '<ul class="liste">' + SuS.daten.mitarbeiter.map((m) => '<li><button class="zeile" data-a="mitarbeiterBearbeiten" data-id="' + e(m.id) + '"><div class="haupt"><div class="titel">' + e(m.name) + '</div><div class="klein">' +
        SuS.ROLLEN[m.rolle] + (m.aktiv ? '' : ' · nicht mehr aktiv') + '</div></div></button></li>').join('') + '</ul>' : '<div class="karte leer"><p>Noch keine Mitarbeiter.</p></div>'));
  };
  A.mitarbeiterBearbeiten = (el) => {
    const m = el.dataset.id ? SuS.mitarbeiterVon(el.dataset.id) : null, x = m || { name: '', rolle: 'facharbeiter', aktiv: true };
    SuS.blatt(m ? 'Mitarbeiter' : 'Neuer Mitarbeiter', SuS.feld('name', 'Name', x.name, { auto: !m }) +
      SuS.feld('rolle', 'Rolle', x.rolle, { typ: 'select', optionen: Object.keys(SuS.ROLLEN).map((r) => [r, SuS.ROLLEN[r]]) }) +
      '<label class="schalter"><input type="checkbox" name="aktiv"' + (x.aktiv ? ' checked' : '') + '><span><b>Aktiv</b><small>Ausgeschiedene bleiben für alte Einträge erhalten.</small></span></label>',
    (fd) => {
      const name = String(fd.get('name') || '').trim();
      if (!name) { SuS.melde('Bitte einen Namen eingeben.', true); return false; }
      const z = m || { id: SuS.id() };
      Object.assign(z, { name, rolle: String(fd.get('rolle')), aktiv: fd.get('aktiv') === 'on' });
      if (!m) SuS.daten.mitarbeiter.push(z);
      gespeichert(); SuS.neuZeichnen(); return true;
    }, 'Sichern');
  };

  /* ---------- Offene Posten ---------- */
  SuS.seiten.posten = () => {
    const liste = SuS.daten.dokumente.filter((d) => SuS.istRechnung(d) && d.fest && d.typ !== 'storno' && d.status !== 'storniert' && SuS.offenerBetrag(d) > 0)
      .sort((a, b) => SuS.faellig(a).localeCompare(SuS.faellig(b)));
    const summe = liste.reduce((x, d) => x + SuS.offenerBetrag(d), 0);
    const ueber = liste.filter((d) => SuS.faellig(d) < SuS.heute());
    SuS.zeige(SuS.belegReiter('posten') + '<div class="kacheln"><div class="kachel"><div class="name">Offen gesamt (' + liste.length + ')</div><div class="wert">' + SuS.euro(summe) + '</div></div>' +
      '<div class="kachel' + (ueber.length ? ' warn' : '') + '"><div class="name">Davon überfällig (' + ueber.length + ')</div><div class="wert">' + SuS.euro(ueber.reduce((x, d) => x + SuS.offenerBetrag(d), 0)) + '</div></div></div>' +
      (liste.length ? '<ul class="liste">' + liste.map((d) => {
        const k = SuS.kundeVon(d), tage = Math.round((Date.parse(SuS.heute()) - Date.parse(SuS.faellig(d))) / 86400000), st = SuS.status(d);
        return '<li><a class="zeile" href="#/dok/' + e(d.id) + '"><div class="haupt"><div class="titel">' + e(k ? k.name : 'Ohne Kunde') + '</div><div class="klein">' +
          e(d.nummer + ' · fällig ' + SuS.datum(SuS.faellig(d)) + (tage > 0 ? ' · ' + tage + ' Tage überfällig' : '')) + '</div></div><div><div class="betrag">' + SuS.euro(SuS.offenerBetrag(d)) +
          '</div><div style="text-align:right"><span class="chip ' + st.klasse + '">' + st.text + '</span></div></div></a></li>';
      }).join('') + '</ul>' : '<div class="karte leer"><p>Keine offenen Rechnungen. 👍</p></div>'));
  };

  /* ---------- Pflegeverträge ---------- */
  SuS.seiten.vertraege = () => {
    const faellig = SuS.faelligeVertraege();
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><div><h1>Pflegeverträge</h1><p>Wiederkehrende Leistungen, Rechnungen auf Knopfdruck</p></div><button class="knopf haupt klein" data-a="vertragBearbeiten">+ Neu</button></div>' +
      (faellig.length ? '<div class="hinweis info"><b>' + faellig.length + ' Rechnung(en) fällig.</b><div class="knopfreihe"><button class="knopf haupt klein" data-a="vertraegeAbrechnen">Entwürfe erstellen</button></div></div>' : '') +
      (SuS.daten.vertraege.length ? '<ul class="liste">' + SuS.daten.vertraege.map((v) => {
        const netto = v.positionen.reduce((x, p) => x + SuS.posBetrag(p), 0);
        return '<li><button class="zeile" data-a="vertragBearbeiten" data-id="' + e(v.id) + '"><div class="haupt"><div class="titel">' + e(v.titel) + '</div><div class="klein">' +
          e([kundeName(v.kundeId), SuS.INTERVALLE[v.intervall], v.aktiv ? 'nächste Rechnung ' + SuS.datum(v.naechstes) : 'pausiert'].join(' · ')) + '</div></div><div class="betrag">' + SuS.euro(netto) + '<div class="klein" style="font-weight:400">netto</div></div></button></li>';
      }).join('') + '</ul>' : '<div class="karte leer"><p>Noch keine Pflegeverträge. Beispiel: Gartenpflege monatlich pauschal, Heckenschnitt zweimal im Jahr.</p></div>'));
  };
  A.vertragBearbeiten = (el) => {
    const v = el.dataset.id ? SuS.vertrag(el.dataset.id) : null;
    const x = v || { titel: '', kundeId: '', projektId: '', intervall: 1, naechstes: SuS.heute(), aktiv: true, positionen: [] };
    const pos = x.positionen[0] || { text: 'Gartenpflege pauschal', menge: 1, einheit: 'psch', preis: 0, art: 'lohn' };
    SuS.blatt(v ? 'Pflegevertrag' : 'Neuer Pflegevertrag', SuS.feld('titel', 'Bezeichnung', x.titel, { auto: !v, platz: 'z. B. Gartenpflege Familie Meier' }) +
      SuS.feld('kunde', 'Kunde', x.kundeId, { typ: 'select', optionen: [['', '– wählen –']].concat(SuS.daten.kunden.map((k) => [k.id, k.name])) }) +
      SuS.feld('projekt', 'Baustelle (optional)', x.projektId, { typ: 'select', optionen: [['', '– keine –']].concat(SuS.daten.projekte.map((p) => [p.id, p.titel])) }) +
      '<div class="zwei">' + SuS.feld('intervall', 'Abrechnung', x.intervall, { typ: 'select', optionen: Object.keys(SuS.INTERVALLE).map((k) => [k, SuS.INTERVALLE[k]]) }) +
      SuS.feld('naechstes', 'Nächste Rechnung ab', x.naechstes, { typ: 'date' }) + '</div>' +
      '<h3 style="margin:8px 0">Leistung je Zeitraum</h3>' + SuS.feld('ptext', 'Bezeichnung', pos.text) +
      '<div class="drei">' + SuS.feld('pmenge', 'Menge', SuS.zahlFeld(pos.menge), { dezimal: true }) + SuS.feld('peinheit', 'Einheit', pos.einheit, { liste: 'einheiten' }) +
      SuS.feld('ppreis', 'Preis netto', pos.preis ? SuS.centText(pos.preis) : '', { dezimal: true }) + '</div>' + SuS.einheitenListe() +
      (x.positionen.length > 1 ? '<p class="unterzeile">Dieser Vertrag hat ' + x.positionen.length + ' Positionen; hier wird nur die erste geändert.</p>' : '') +
      '<h3 style="margin:12px 0 4px">Aufgaben im Jahr</h3><p class="unterzeile" style="margin-top:0">Erscheinen im Wochenplan im passenden Monat zum Einplanen.</p>' +
      aufgabenListe(x.aufgaben || []).map((a, i) => '<label class="schalter" style="padding:6px 0"><input type="checkbox" name="aufgabe" value="' + i + '"' + (a.an ? ' checked' : '') + '><span>' + e(a.text) +
        '<small>' + a.monate.map((m) => SuS.MONATE[m - 1]).join(', ') + '</small></span></label>').join('') +
      '<div class="zwei">' + SuS.feld('eigenText', 'Weitere Aufgabe', '', { platz: 'z. B. Teich reinigen' }) + SuS.feld('eigenMonate', 'Monate (Zahlen)', '', { platz: 'z. B. 4, 9' }) + '</div>' +
      '<label class="schalter"><input type="checkbox" name="aktiv"' + (x.aktiv ? ' checked' : '') + '><span><b>Aktiv</b><small>Pausierte Verträge erzeugen keine Rechnungen.</small></span></label>' +
      (v ? '<button type="button" class="knopf gefahr breit" data-a="vertragLoeschen" data-id="' + e(v.id) + '">Vertrag löschen</button>' : ''),
    (fd) => {
      const titel = String(fd.get('titel') || '').trim(), kunde = String(fd.get('kunde') || '');
      const menge = SuS.leseZahl(fd.get('pmenge')), preis = SuS.leseCent(fd.get('ppreis'));
      if (!titel || !kunde) { SuS.melde('Bitte Bezeichnung und Kunde angeben.', true); return false; }
      if (!Number.isFinite(menge) || !Number.isFinite(preis) || preis <= 0) { SuS.melde('Bitte Menge und Preis eingeben.', true); return false; }
      const z = v || { id: SuS.id(), positionen: [] };
      const erste = Object.assign({}, z.positionen[0] || { id: SuS.id(), typ: 'pos', art: 'lohn', lohnanteil: null, beschreibung: '' },
        { text: String(fd.get('ptext') || '').trim() || titel, menge, einheit: String(fd.get('peinheit') || 'psch'), preis });
      const auswahl = aufgabenListe(x.aufgaben || []), an = fd.getAll('aufgabe').map(Number);
      const aufgaben = auswahl.filter((a, i) => an.includes(i)).map((a) => ({ text: a.text, monate: a.monate }));
      const eigen = String(fd.get('eigenText') || '').trim().slice(0, 80);
      const monate = [...new Set(String(fd.get('eigenMonate') || '').split(/[^0-9]+/).map(Number).filter((m) => m >= 1 && m <= 12))].sort((a, b) => a - b);
      if (eigen && !monate.length) { SuS.melde('Bitte für die weitere Aufgabe die Monate angeben (1–12).', true); return false; }
      if (eigen) aufgaben.push({ text: eigen, monate });
      Object.assign(z, { titel, kundeId: kunde, projektId: String(fd.get('projekt') || ''), intervall: Number(fd.get('intervall')) || 1,
        naechstes: String(fd.get('naechstes') || SuS.heute()), aktiv: fd.get('aktiv') === 'on', positionen: [erste].concat(z.positionen.slice(1)), aufgaben });
      if (!v) SuS.daten.vertraege.push(z);
      gespeichert(); SuS.neuZeichnen(); return true;
    }, 'Sichern');
  };
  /* Vorschläge plus eigene Aufgaben des Vertrags; vorhandene sind angehakt */
  function aufgabenListe(vorhanden) {
    const liste = SuS.PFLEGE_AUFGABEN.map((a) => { const da = vorhanden.find((x) => x.text === a.text); return { text: a.text, monate: da ? da.monate : a.monate, an: !!da }; });
    vorhanden.forEach((a) => { if (!liste.some((x) => x.text === a.text)) liste.push({ text: a.text, monate: a.monate, an: true }); });
    return liste;
  }
  A.vertragLoeschen = (el) => {
    if (!SuS.sicher(el)) return;
    SuS.daten.vertraege = SuS.daten.vertraege.filter((v) => v.id !== el.dataset.id);
    gespeichert(); SuS.blattZu(); SuS.neuZeichnen();
  };
  A.vertraegeAbrechnen = async () => {
    let n = 0;
    const marke = SuS.navMarke();
    const ok = await SuS.transaktionSicher(() => {
      /* Je Vertrag höchstens 12 Zeiträume auf einmal (lange nicht geöffnet → nicht endlos viele Entwürfe). */
      for (const v of SuS.faelligeVertraege()) for (let i = 0; i < 12 && v.aktiv && v.naechstes <= SuS.heute(); i++) { SuS.vertragAbrechnen(v); n++; }
    });
    if (!ok) { SuS.melde('Speichern fehlgeschlagen.', true); return; }
    SuS.melde(n + ' Rechnungsentwürfe erstellt – unter „Rechnungen → Entwürfe“ prüfen und stellen.');
    SuS.ansicht.filterR = 'entwurf'; SuS.gehZu('#/rechnungen', marke);
  };

  /* ---------- Export ---------- */
  SuS.seiten.export = () => {
    const f = SuS.daten.firma;
    const jahre = [...new Set(SuS.daten.dokumente.filter((d) => d.fest).map((d) => d.datum.slice(0, 4)).concat(SuS.daten.ausgaben.map((a) => a.datum.slice(0, 4))))].sort().reverse();
    if (!jahre.length) jahre.push(String(new Date().getFullYear()));
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><h1>Für den Steuerberater</h1></div>' +
      SuS.feld('jahr', 'Jahr', jahre[0], { typ: 'select', optionen: jahre.map((j) => [j, j]) }).replace('name="jahr"', 'name="jahr" id="exportJahr"') +
      '<div class="karte"><h3>Rechnungsausgangsbuch</h3><p style="margin-top:0">Tabelle (CSV, öffnet in Excel und Numbers): Nummer, Datum, Kunde, Netto, Steuer, Brutto, Zahlungen, offen.</p>' +
      '<div class="knopfreihe"><button class="knopf haupt" data-a="exportDatei" data-art="ausgang">Teilen / speichern</button><button class="knopf" data-a="exportText" data-art="ausgang">Als Text</button></div></div>' +
      '<div class="karte"><h3>Ausgaben</h3><p style="margin-top:0">' + SuS.daten.ausgaben.length + ' erfasste Belege mit Netto, Vorsteuer, Brutto und Baustelle.</p>' +
      '<div class="knopfreihe"><button class="knopf" data-a="exportDatei" data-art="ausgaben">Teilen / speichern</button><button class="knopf" data-a="exportText" data-art="ausgaben">Als Text</button></div></div>' +
      '<div class="karte"><h3>DATEV-Buchungsstapel</h3><p style="margin-top:0">Ausgangsrechnungen als Datei im DATEV-Format zum Einlesen beim Steuerberater. Nummern und Kontenrahmen gibt der Steuerberater.</p>' +
      '<form id="datevForm" novalidate><div class="zwei">' + SuS.feld('beraterNr', 'Beraternummer', f.beraterNr, { dezimal: true, platz: 'z. B. 1234567' }) +
      SuS.feld('mandantNr', 'Mandantennummer', f.mandantNr, { dezimal: true, platz: 'z. B. 10001' }) + '</div><div class="zwei">' +
      SuS.feld('skr', 'Kontenrahmen', f.skr, { typ: 'select', optionen: [['03', 'SKR 03'], ['04', 'SKR 04']] }) + SuS.feld('debitor', 'Sammel-Debitor', f.debitor, { dezimal: true }) + '</div><div class="zwei">' +
      SuS.feld('kreditor', 'Sammel-Kreditor', f.kreditor, { dezimal: true }) + SuS.feld('bankKonto', 'Bankkonto (leer = 1200/1800)', f.bankKonto, { dezimal: true }) + '</div></form>' +
      '<div class="knopfreihe"><button class="knopf" data-a="exportDatev">DATEV-Datei erstellen</button></div>' +
      '<p class="unterzeile">Enthält Ausgangsrechnungen (Erlöskonten, z. B. SKR 03 8400/8300), Zahlungseingänge (Bank an Debitor), genutztes Skonto und die Ausgaben (Aufwand mit Vorsteuer). Vor der ersten Nutzung bitte einmal vom Steuerberater probehalber einlesen lassen.</p></div>' +
      '<p class="unterzeile">Die Rechnungen selbst bitte zusätzlich als PDF ablegen (Aufbewahrung 8 Jahre).</p>');
    const form = document.getElementById('datevForm');
    form.addEventListener('change', () => {
      const fd = new FormData(form);
      Object.assign(f, { beraterNr: String(fd.get('beraterNr') || '').replace(/\D/g, '').slice(0, 7), mandantNr: String(fd.get('mandantNr') || '').replace(/\D/g, '').slice(0, 5),
        skr: fd.get('skr') === '04' ? '04' : '03', debitor: String(fd.get('debitor') || '').replace(/\D/g, '').slice(0, 9) || '10000',
        kreditor: String(fd.get('kreditor') || '').replace(/\D/g, '').slice(0, 9) || '70000', bankKonto: String(fd.get('bankKonto') || '').replace(/\D/g, '').slice(0, 8) });
      gespeichert();
    });
  };
  const exportJahr = () => (document.getElementById('exportJahr') || {}).value || String(new Date().getFullYear());
  const exportInhalt = (art) => (art === 'ausgaben' ? SuS.ausgabenCsv(exportJahr()) : SuS.ausgangsbuchCsv(exportJahr()));
  const exportName = (art) => (art === 'ausgaben' ? 'ausgaben-' : 'rechnungsausgang-') + exportJahr() + '.csv';
  A.exportDatei = (el) => {
    const art = el.dataset.art || 'ausgang';
    if (window.parent !== window) { A.exportText(el); return; }
    SuS.dateiTeilen(exportName(art), exportInhalt(art), 'text/csv', (art === 'ausgaben' ? 'Ausgaben ' : 'Rechnungsausgangsbuch ') + exportJahr() + ' (Tabelle).', exportName(art));
  };
  A.exportText = (el) => SuS.textZeigen(el.dataset.art === 'ausgaben' ? 'Ausgaben' : 'Rechnungsausgangsbuch', exportInhalt(el.dataset.art || 'ausgang'));
  A.exportDatev = () => {
    let text;
    try { text = SuS.datevBuchungsstapel(exportJahr()); } catch (x) { SuS.melde(x.message, true); return; }
    const i = SuS.datevInfo || {}, name = 'EXTF_Buchungsstapel_' + exportJahr() + '.csv';
    SuS.melde(i.rechnungen + ' Rechnungen, ' + i.zahlungen + ' Zahlungen, ' + i.skonto + ' Skonto, ' + i.ausgaben + ' Ausgaben' + (i.vonHand ? ' – ' + i.vonHand + ' Beleg(e) mit mehreren Steuersätzen bitte von Hand buchen' : '') + '.', !!i.vonHand);
    if (window.parent !== window) { SuS.textZeigen('DATEV-Buchungsstapel', text); return; }
    SuS.dateiTeilen(name, SuS.winAnsi(text), 'text/csv', 'DATEV-Buchungsstapel ' + exportJahr() + ' (Rechnungen, Zahlungen, Ausgaben) zum Einlesen.', name);
  };
})();
