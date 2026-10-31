/* Stock und Stein – Belege und Dokumente überall sammeln (Auftrag Simon 31.10.2026):
   • „Beleg erfassen“ von der Startseite: Foto aufnehmen oder Datei/PDF wählen → Ausgabe (mit Betrag) oder Dokument.
   • PDF-Dateien lesen AUF DEM GERÄT mit pdf.js (Mozilla, Apache-2.0, Ordner ocr/pdfjs/): Text der Seiten für die
     Vorschläge, Vorschaubild der ersten Seite; eingescannte PDFs ohne Text gehen durch die Texterkennung (beleg.js).
   • Bereich „Dokumente“ (Mehr): Unterlagen ohne Betrag mit Bereich, Datum, Notiz, optional Baustelle/Kunde, durchsuchbar.
     Dateien liegen im Bildspeicher unter „u“ + id (siehe fotos.js), in der Sicherung und im Paket für den Steuerberater. */
'use strict';

(function () {
  if (typeof document === 'undefined') return;  // nur im Browser
  const e = SuS.esc, A = SuS.aktionen;
  const abs = (pfad) => new URL(pfad, document.baseURI).href;

  /* ---------------- PDF lesen (pdf.js) ---------------- */
  let bibliothek = null;
  SuS.pdfBibliothek = () => {
    if (!bibliothek) {
      bibliothek = import(abs('ocr/pdfjs/pdf.min.js')).then((m) => { m.GlobalWorkerOptions.workerSrc = abs('ocr/pdfjs/pdf.worker.min.js'); return m; })
        .catch(() => { bibliothek = null; throw new Error('Der PDF-Leser konnte nicht geladen werden'); });
    }
    return bibliothek;
  };
  const oeffnen = async (datei) => {
    const m = await SuS.pdfBibliothek();
    let aufgabe = null;
    try {
      /* isEvalSupported: false – kein eval (strenge Sicherheitsregel der App) */
      aufgabe = m.getDocument({ data: new Uint8Array(await datei.arrayBuffer()), isEvalSupported: false, verbosity: 0 });
      return await mitFrist(aufgabe.promise, 30000, 'Zeitüberschreitung');
    } catch (x) {
      if (aufgabe) aufgabe.destroy().catch(() => {});  // Ladevorgang samt Worker beenden (Fund Codex R2)
      throw new Error(x && x.name === 'PasswordException' ? 'Das PDF ist mit einem Passwort geschützt' : 'Das PDF ist nicht lesbar' + (x && x.message === 'Zeitüberschreitung' ? ' (Zeitüberschreitung)' : ''));
    }
  };
  /* Zeitgrenze: ein PDF, das nicht fertig wird, darf das Formular nicht festhalten */
  const mitFrist = (versprechen, ms, text) => Promise.race([versprechen, new Promise((_, f) => setTimeout(() => f(new Error(text)), ms))]);
  /* Seite als JPEG-Blob, längste Seite höchstens max Pixel (weißer Grund). intent 'print': ohne requestAnimationFrame –
     sonst wartet das Zeichnen, solange die App im Hintergrund ist (im WebKit-Test hing es dort ganz) */
  const seiteBild = async (seite, max, guete) => {
    const v1 = seite.getViewport({ scale: 1 }), f = Math.min(4, max / Math.max(v1.width, v1.height)), v = seite.getViewport({ scale: f });
    const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(v.width)); c.height = Math.max(1, Math.round(v.height));
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await mitFrist(seite.render({ canvasContext: g, viewport: v, intent: 'print' }).promise, 30000, 'Seite konnte nicht gezeichnet werden');
    const blob = await new Promise((ok) => c.toBlob(ok, 'image/jpeg', guete));
    c.width = c.height = 1;  // Speicher sofort freigeben (iPhone)
    if (!blob) throw new Error('Seite konnte nicht gezeichnet werden');
    return blob;
  };
  /* → { seiten, text, vorschau (JPEG ≤ 900 px), scan, gross (JPEG ≤ 2000 px, nur bei scan && mitScan) } */
  SuS.pdfLesen = async (datei, mitScan) => {
    const doc = await oeffnen(datei);
    try {
      const zeilen = [];
      for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
        const s = await doc.getPage(i);
        zeilen.push(...SuS.pdfZeilen((await mitFrist(s.getTextContent(), 30000, 'Text des PDF nicht lesbar')).items));
      }
      const text = zeilen.join('\n'), erste = await doc.getPage(1);
      const scan = text.replace(/\s/g, '').length < 40;
      const vorschau = await seiteBild(erste, 900, 0.6).catch(() => null);
      return { seiten: doc.numPages, text, vorschau, scan, gross: scan && mitScan ? await seiteBild(erste, 2000, 0.92) : null };
    } finally { doc.destroy(); }
  };
  /* Zum Ansehen: die ersten max Seiten als Bild-Adressen. weiter() → false bricht ab (Blatt geschlossen); dann und bei einem
     Fehler werden die schon erzeugten Adressen freigegeben (Fund Codex R1: Speicher auf dem iPhone) */
  SuS.pdfSeitenBilder = async (blob, max, weiter) => {
    const doc = await oeffnen(blob), urls = [];
    try {
      for (let i = 1; i <= Math.min(doc.numPages, max); i++) {
        if (weiter && !weiter()) throw new Error('abgebrochen');
        urls.push(URL.createObjectURL(await seiteBild(await doc.getPage(i), 1400, 0.8)));
      }
      return { seiten: doc.numPages, urls };
    } catch (x) { urls.forEach((u) => URL.revokeObjectURL(u)); throw x; } finally { doc.destroy(); }
  };

  /* Beleg aus Foto ODER Datei erkennen. PDF mit Text: Vorschläge direkt aus dem Text (schnell, fehlerfrei gelesen);
     eingescanntes PDF: erste Seite durch die Texterkennung. Ergebnis wie SuS.belegErkennen, dazu pdf/vorschau/textPdf. */
  SuS.belegAusDatei = async (datei, drehung) => {
    if (SuS.istPdfDatei && await SuS.istPdfDatei(datei)) {
      if (datei.size > SuS.PDF_MAX) throw new Error('PDF größer als 10 MB');
      const p = await SuS.pdfLesen(datei, true);
      if (!p.scan) {
        const v = SuS.belegLesen(p.text, SuS.daten && SuS.daten.lieferantArt);
        return { vorschlag: v, text: p.text, pdf: true, textPdf: true, vorschau: p.vorschau, seiten: p.seiten, drehung: 0 };
      }
      const r = await SuS.belegErkennen(p.gross, drehung);
      return Object.assign(r, { pdf: true, textPdf: false, vorschau: p.vorschau, seiten: p.seiten });
    }
    return SuS.belegErkennen(datei, drehung);
  };

  /* ---------------- Startseite: „Beleg erfassen“ ---------------- */
  A.belegErfassen = () => {
    SuS.blatt('Beleg erfassen',
      '<p class="unterzeile" style="margin-top:0">Foto aufnehmen oder Datei wählen – z. B. die PDF-Rechnung aus der Mail. Alles bleibt auf diesem Gerät.</p>' +
      '<div class="feld"><span>Was ist es?</span>' +
      '<label class="schalter"><input type="radio" name="ziel" value="ausgabe" checked><span><b>Ausgabe mit Betrag</b><small>Kassenbon, Eingangsrechnung, Gutschrift – Felder werden ausgefüllt</small></span></label>' +
      '<label class="schalter"><input type="radio" name="ziel" value="dokument"><span><b>Dokument ohne Betrag</b><small>Lieferschein, Vertrag, Versicherung, Fahrzeug, Sonstiges</small></span></label></div>' +
      '<label class="knopf haupt breit gross">📷 Foto aufnehmen<input type="file" accept="image/*" capture="environment" data-erfassen hidden></label>' +
      '<label class="knopf breit gross">📄 Datei oder PDF wählen<input type="file" accept="image/*,application/pdf,.pdf" data-erfassen hidden></label>');
  };
  document.addEventListener('change', (ev) => {
    const el = ev.target.closest('[data-erfassen]');
    if (!el || !el.files || !el.files[0]) return;
    const datei = el.files[0], form = el.closest('form');
    const ziel = form && form.querySelector('[name="ziel"]:checked') ? form.querySelector('[name="ziel"]:checked').value : 'ausgabe';
    SuS.blattZu();
    if (ziel === 'dokument') { SuS.ablageVorgabe = { dateien: [datei] }; A.ablageBearbeiten({ dataset: {} }); }
    else { SuS.ausgabeDatei = datei; A.ausgabeBearbeiten({ dataset: {} }); }
  });

  /* ---------------- Bereich „Dokumente“ ---------------- */
  let artFilter = 'alle';
  const suchText = (u) => {
    const p = u.projektId ? SuS.projekt(u.projektId) : null, k = u.kundeId ? SuS.kunde(u.kundeId) : null;
    return [u.titel, u.notiz, SuS.ABLAGE_ARTEN[u.art], SuS.datum(u.datum), p ? p.nr + ' ' + p.titel : '', k ? k.name : '', u.suchtext].join(' ').toLowerCase();
  };
  SuS.ablageSuchen = (q, art) => {
    const woerter = String(q || '').toLowerCase().split(/\s+/).filter(Boolean);
    return SuS.daten.ablage.filter((u) => (!art || art === 'alle' || u.art === art) && woerter.every((w) => suchText(u).includes(w)))
      .sort((a, b) => b.datum.localeCompare(a.datum) || a.titel.localeCompare(b.titel));
  };
  SuS.seiten.ablage = () => {
    const q = SuS.ansicht.suche, liste = SuS.ablageSuchen(q, artFilter);
    const zahl = (k) => SuS.daten.ablage.filter((u) => k === 'alle' || u.art === k).length;
    SuS.zeige('<button class="zurueck" data-a="zurueck" data-ziel="#/mehr">‹ Mehr</button><div class="kopf"><div><h1>Dokumente</h1><p>Unterlagen ohne Betrag</p></div>' +
      '<button class="knopf haupt klein" data-a="ablageBearbeiten">+ Neu</button></div>' +
      '<input class="suche" type="search" placeholder="Suchen: Titel, Notiz, Kunde, Baustelle" value="' + e(q) + '" data-suche>' +
      '<div class="filter">' + [['alle', 'Alle']].concat(Object.entries(SuS.ABLAGE_ARTEN)).map(([k, t]) =>
        '<button type="button" data-a="ablageFilter" data-art="' + e(k) + '" class="' + (k === artFilter ? 'an' : '') + '">' + e(t) + ' (' + zahl(k) + ')</button>').join('') + '</div>' +
      (liste.length ? '<ul class="liste">' + liste.map((u) => {
        const p = u.projektId ? SuS.projekt(u.projektId) : null, k = u.kundeId ? SuS.kunde(u.kundeId) : null;
        return '<li><button class="zeile" data-a="ablageBearbeiten" data-id="' + e(u.id) + '"><div class="haupt"><div class="titel">' + e(u.titel) + '</div><div class="klein">' +
          e([SuS.datum(u.datum), SuS.ABLAGE_ARTEN[u.art], p ? p.titel : '', k ? k.name : ''].filter(Boolean).join(' · ')) + '</div></div><span aria-hidden="true">›</span></button></li>';
      }).join('') + '</ul>'
        : '<div class="karte leer"><p>' + (SuS.daten.ablage.length ? 'Nichts gefunden.' : 'Noch keine Dokumente. Tipp: Lieferschein gleich auf der Baustelle fotografieren oder die Versicherungspolice als PDF ablegen.') + '</p></div>') +
      '<p class="unterzeile">Die Dateien liegen nur auf diesem Gerät – in der verschlüsselten Datensicherung („Fotos und Dateien mitsichern“) und im Paket für den Steuerberater sind sie enthalten.</p>');
  };
  A.ablageFilter = (el) => { artFilter = el.dataset.art; SuS.neuZeichnen(); };

  A.ablageBearbeiten = (el) => {
    const alt = el.dataset.id ? SuS.daten.ablage.find((u) => u.id === el.dataset.id) : null;
    const vorgabe = SuS.ablageVorgabe || {}; SuS.ablageVorgabe = null;
    const x = alt || { id: SuS.id(), titel: '', art: vorgabe.art || 'sonstiges', datum: SuS.heute(), notiz: '', projektId: el.dataset.p || '', kundeId: '', suchtext: '' };
    const gewaehlt = [];        // neue Dateien (nur beim Anlegen)
    const gelesen = new Map();  // Datei → { vorschau, text } aus dem PDF
    const laeufe = new Set();   // laufendes Prüfen/Lesen – Sichern wartet darauf (Fund Codex R1)
    const wahl = '<div class="datei-wahl"><label class="knopf haupt">📷 Foto<input type="file" accept="image/*" capture="environment" data-ablage-datei hidden></label>' +
      '<label class="knopf">📄 Datei / PDF<input type="file" accept="image/*,application/pdf,.pdf" multiple data-ablage-datei hidden></label></div>' +
      '<div class="datei-liste unterzeile" aria-live="polite">Noch keine Datei gewählt (geht auch ohne).</div>';
    const form = SuS.blatt(alt ? 'Dokument' : 'Neues Dokument', (alt ? '' : wahl) +
      SuS.feld('titel', 'Titel', x.titel, { platz: 'z. B. Kfz-Versicherung Pritsche 2026' }) +
      '<div class="zwei">' + SuS.feld('art', 'Bereich', x.art, { typ: 'select', optionen: Object.entries(SuS.ABLAGE_ARTEN) }) + SuS.feld('datum', 'Datum', x.datum, { typ: 'date' }) + '</div>' +
      SuS.feld('projekt', 'Baustelle (optional)', x.projektId, { typ: 'select', optionen: [['', '– keine –']].concat(SuS.daten.projekte.map((p) => [p.id, p.nr + ' ' + p.titel])) }) +
      SuS.feld('kunde', 'Kunde (optional)', x.kundeId, { typ: 'select', optionen: [['', '– keiner –']].concat(SuS.daten.kunden.slice().sort((a, b) => a.name.localeCompare(b.name)).map((k) => [k.id, k.name])) }) +
      SuS.feld('notiz', 'Notiz', x.notiz, { typ: 'textarea', platz: 'z. B. Vertragsnummer, Laufzeit, Kündigungsfrist, wo das Original liegt' }) +
      (alt ? '<h3 style="margin:10px 0 6px">Dateien</h3><div id="fotos-u' + e(x.id) + '" data-dateien><p class="unterzeile">Wird geladen …</p></div>' +
        '<button type="button" class="knopf gefahr breit" data-a="ablageLoeschen" data-id="' + e(x.id) + '">Dokument löschen</button>' : ''),
    async (fd) => {
      const werte = { titel: String(fd.get('titel') || '').trim().slice(0, 120), art: String(fd.get('art') || 'sonstiges'), datum: String(fd.get('datum') || '') || SuS.heute(),
        projektId: String(fd.get('projekt') || ''), kundeId: String(fd.get('kunde') || ''), notiz: String(fd.get('notiz') || '').trim().slice(0, 1000) };
      if (!Object.prototype.hasOwnProperty.call(SuS.ABLAGE_ARTEN, werte.art)) werte.art = 'sonstiges';
      if (laeufe.size) SuS.melde('PDF wird noch gelesen …');
      while (laeufe.size) await Promise.all([...laeufe]);  // auch Dateien, die während des Wartens dazukommen (Fund Codex R2)
      const dateien = gewaehlt.slice();  // fester Stand: genau diese Dateien und ihr Text
      if (!werte.titel) werte.titel = dateien.length ? titelAus(dateien[0]) : '';
      if (!werte.titel) { SuS.melde('Bitte einen Titel eingeben oder eine Datei wählen.', true); return false; }
      if (!alt) werte.suchtext = dateien.map((d) => (gelesen.get(d) || {}).text || '').join('\n').replace(/\s+/g, ' ').trim().slice(0, 1500);
      if (!(await SuS.transaktionSicher(() => {
        const ziel = alt ? SuS.daten.ablage.find((u) => u.id === x.id) : x;
        if (!ziel) throw new Error('Dokument nicht mehr vorhanden');
        Object.assign(ziel, werte);
        if (!alt) SuS.daten.ablage.push(ziel);
      }))) { SuS.melde('Speichern fehlgeschlagen.', true); return false; }
      /* Dateien erst nach bestätigter Ablage (wie bei den Ausgaben) */
      let fehler = 0;
      if (dateien.length && !(await SuS.fotosVerfuegbar())) { SuS.melde('Dokument gespeichert – die Dateien gehen nur in der Handy-App (Bildspeicher hier gesperrt).', true); SuS.neuZeichnen(); return true; }
      for (const d of dateien) {
        try { await SuS.dateiAblegen('u' + x.id, d, { datum: werte.datum, vorschau: gelesen.has(d) ? gelesen.get(d).vorschau : null }); }
        catch (f) { fehler++; SuS.melde('Datei „' + d.name + '“ nicht gespeichert: ' + f.message, true); }
      }
      if (!fehler) SuS.melde('Dokument gespeichert' + (dateien.length ? ' (' + dateien.length + ' Datei' + (dateien.length > 1 ? 'en' : '') + ').' : '.'));
      SuS.neuZeichnen(); return true;
    }, 'Sichern');
    if (alt) { setTimeout(() => SuS.fotosZeichnen('u' + x.id), 0); return; }
    const anzeige = form.querySelector('.datei-liste');
    const zeigen = () => {
      anzeige.innerHTML = gewaehlt.length ? gewaehlt.map((d, i) => '<span class="datei-chip">' + e(d.name || 'Foto') + (gelesen.has(d) && gelesen.get(d).seiten ? ' · ' + gelesen.get(d).seiten + ' S.' : '') +
        ' <button type="button" data-weg="' + i + '" aria-label="Entfernen">×</button></span>').join('') : 'Noch keine Datei gewählt (geht auch ohne).';
    };
    /* Alle gewählten Dateien sofort übernehmen; PDFs werden danach der Reihe nach geprüft und gelesen */
    const dazu = (dateien) => {
      const neu = dateien.slice(0, Math.max(0, 20 - gewaehlt.length));
      gewaehlt.push(...neu);
      const titel = form.querySelector('[name="titel"]');
      if (neu.length && !titel.value.trim()) titel.value = titelAus(neu[0]);
      zeigen();
      const lauf = (async () => {
        for (const d of neu) {
          if (!gewaehlt.includes(d) || !(await SuS.istPdfDatei(d))) continue;
          if (d.size > SuS.PDF_MAX) { SuS.melde('„' + d.name + '“ ist größer als 10 MB – wird nicht gespeichert.', true); if (gewaehlt.includes(d)) gewaehlt.splice(gewaehlt.indexOf(d), 1); zeigen(); continue; }
          let g;
          try { const p = await SuS.pdfLesen(d); g = { vorschau: p.vorschau, text: p.text, seiten: p.seiten }; } catch (f) { g = { vorschau: null, text: '', seiten: 0 }; }
          if (gewaehlt.includes(d)) gelesen.set(d, g);  // inzwischen entfernt: Ergebnis verwerfen (Fund Codex R1)
          if (form.isConnected) zeigen();
        }
      })().catch(() => {});
      laeufe.add(lauf); lauf.then(() => laeufe.delete(lauf));
    };
    form.addEventListener('change', (ev) => {
      const el2 = ev.target.closest('[data-ablage-datei]');
      if (!el2 || !el2.files.length) return;
      const neu = Array.from(el2.files); el2.value = '';
      dazu(neu);
    });
    form.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-weg]');
      if (!b) return;
      ev.preventDefault();
      const [weg] = gewaehlt.splice(Number(b.dataset.weg), 1);
      if (weg) gelesen.delete(weg);  // Text der entfernten Datei nicht in den Suchtext (Fund Codex R1)
      zeigen();
    });
    if (vorgabe.dateien && vorgabe.dateien.length) dazu(vorgabe.dateien);
  };
  const titelAus = (d) => {
    const n = String(d && d.name || '').replace(/\.[a-z0-9]{2,4}$/i, '').replace(/[_]+/g, ' ').trim();
    return /^(img|image|dsc|pxl|foto|photo|scan)[\s_-]*\d*$/i.test(n) || !n ? 'Foto vom ' + SuS.datum(SuS.heute()) : n.slice(0, 120);
  };
  A.ablageLoeschen = async (el) => {
    if (!SuS.sicher(el)) return;
    const id = el.dataset.id;
    const ok = await SuS.transaktionSicher(() => { SuS.daten.ablage = SuS.daten.ablage.filter((u) => u.id !== id); });
    SuS.blattZu(); SuS.neuZeichnen();
    if (!ok) { SuS.melde('Speichern fehlgeschlagen – das Dokument bleibt.', true); return; }
    SuS.melde('Dokument gelöscht.');
    try { if (await SuS.fotosVerfuegbar()) await SuS.fotosVonLoeschen('u' + id); } catch (x) { /* Dateien bleiben dann liegen */ }
  };
})();
