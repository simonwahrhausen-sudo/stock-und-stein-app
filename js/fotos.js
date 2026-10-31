/* Stock und Stein – Fotos je Baustelle (vorher/nachher, Mängel, Nachweise). Gespeichert verkleinert (max. 1600 px, JPEG)
   in der Datenbank des Browsers auf dem Gerät (IndexedDB) – nie im Internet. Derselbe Speicher hält die Dateien zu Ausgaben
   („a“ + id) und Dokumenten („u“ + id): Bilder verkleinert, PDF-Dateien unverändert (höchstens 10 MB) mit kleinem Vorschaubild. Im App-Fenster des Orchestrators ist diese
   Datenbank gesperrt; dort erscheint ein Hinweis. Optional Teil der verschlüsselten Sicherung. */
'use strict';

(function () {
  const e = SuS.esc, A = SuS.aktionen;
  const DB = 'sus-fotos', STORE = 'fotos', VORHER = 'vorher', MAX = 1600;
  let dbVersprechen = null;
  const db = () => {
    if (dbVersprechen) return dbVersprechen;
    dbVersprechen = new Promise((ok, fehl) => {
      try {
        if (!window.indexedDB) throw new Error('kein IndexedDB');
        const r = indexedDB.open(DB, 2);
        r.onupgradeneeded = () => {
          const d = r.result;
          if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' }).createIndex('projekt', 'projektId');
          if (!d.objectStoreNames.contains(VORHER)) d.createObjectStore(VORHER, { keyPath: 'id' });  // Fotostand vor dem Wiederherstellen
        };
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehl(r.error || new Error('Datenbank nicht verfügbar'));
      } catch (x) { fehl(x); }
    });
    dbVersprechen.catch(() => { dbVersprechen = null; });
    return dbVersprechen;
  };
  const vorgang = async (modus, fn) => {
    const d = await db();
    return new Promise((ok, fehl) => {
      const t = d.transaction(STORE, modus), s = t.objectStore(STORE);
      let erg; const r = fn(s); if (r) r.onsuccess = () => { erg = r.result; };
      t.oncomplete = () => ok(erg); t.onerror = () => fehl(t.error); t.onabort = () => fehl(t.error || new Error('abgebrochen'));
    });
  };
  SuS.fotosVerfuegbar = async () => { try { await db(); return true; } catch (x) { return false; } };
  SuS.fotosVon = (pid) => vorgang('readonly', (s) => s.index('projekt').getAll(pid)).then((l) => (l || []).sort((a, b) => b.datum.localeCompare(a.datum)));
  SuS.fotoLoeschen = (id) => vorgang('readwrite', (s) => s.delete(id));
  SuS.fotosAlle = () => vorgang('readonly', (s) => s.getAll()).then((l) => l || []);
  SuS.fotoSpeichern = (foto) => vorgang('readwrite', (s) => s.put(foto));
  SuS.fotosVonLoeschen = async (pid) => { for (const f of await SuS.fotosVon(pid)) await SuS.fotoLoeschen(f.id); };
  /* Ganzen Bildspeicher in den Vorher-Speicher kopieren bzw. beide tauschen (für „Vorherigen Stand zurückholen“). */
  const alleAus = async (store) => { const d = await db(); return new Promise((ok, fehl) => { const r = d.transaction(store).objectStore(store).getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => fehl(r.error); }); };
  const ersetzeIn = async (store, liste) => {
    const d = await db();
    return new Promise((ok, fehl) => {
      const t = d.transaction(store, 'readwrite'), s = t.objectStore(store);
      s.clear(); liste.forEach((f) => s.put(f));
      t.oncomplete = () => ok(liste.length); t.onerror = () => fehl(t.error); t.onabort = () => fehl(t.error || new Error('abgebrochen'));
    });
  };
  SuS.fotosVorherMerken = async () => ersetzeIn(VORHER, await alleAus(STORE));
  SuS.fotosVorherTauschen = async () => {
    const jetzt = await alleAus(STORE), vorher = await alleAus(VORHER);
    await ersetzeIn(STORE, vorher); await ersetzeIn(VORHER, jetzt);
    return vorher.length;
  };

  /* Bild verkleinern und als JPEG-Blob zurückgeben (dabei verschwinden auch eingebettete Standortdaten). */
  SuS.fotoVerkleinern = (datei) => new Promise((ok, fehl) => {
    const url = URL.createObjectURL(datei), img = new Image();
    img.onload = () => {
      const f = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(img.naturalWidth * f); c.height = Math.round(img.naturalHeight * f);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? ok(b) : fehl(new Error('Bild konnte nicht umgewandelt werden.'))), 'image/jpeg', 0.78);
    };
    img.onerror = () => { URL.revokeObjectURL(url); fehl(new Error('Kein lesbares Bild.')); };
    img.src = url;
  });

  /* Datei ablegen: PDF unverändert (geprüft am Dateianfang „%PDF-“) mit Vorschaubild der ersten Seite, sonst Bild verkleinert.
     extra: { datum, notiz, vorschau } – vorschau (JPEG-Blob) kann der Aufrufer schon haben (aus der Texterkennung). */
  SuS.PDF_MAX = 10 * 1024 * 1024;
  /* „%PDF-“ in den ersten 1024 Byte (so lässt es die PDF-Norm zu) – dieselbe Prüfung beim Ablegen und beim Wiederherstellen (Fund Codex R1) */
  SuS.pdfKopfOk = (b) => {
    for (let i = 0; i + 4 < Math.min(b.length, 1024 + 5); i++) if (b[i] === 0x25 && b[i + 1] === 0x50 && b[i + 2] === 0x44 && b[i + 3] === 0x46 && b[i + 4] === 0x2D) return true;
    return false;
  };
  SuS.istPdfDatei = async (datei) => !!(datei && datei.size) && SuS.pdfKopfOk(new Uint8Array(await datei.slice(0, 1029).arrayBuffer()));
  const dateiName = (n) => String(n || '').replace(/[^\wÄÖÜäöüß.\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  SuS.dateiAblegen = async (pid, datei, extra) => {
    const x = extra || {}, eintrag = { id: SuS.id(), projektId: pid, datum: x.datum || SuS.heute(), notiz: x.notiz || '' };
    if (await SuS.istPdfDatei(datei)) {
      if (datei.size > SuS.PDF_MAX) throw new Error('PDF ist größer als 10 MB – bitte verkleinert speichern oder als Foto erfassen.');
      let vorschau = x.vorschau || null;
      if (!vorschau && SuS.pdfLesen) { try { vorschau = (await SuS.pdfLesen(datei)).vorschau; } catch (f) { vorschau = null; } }
      Object.assign(eintrag, { typ: 'pdf', name: dateiName(datei.name) || 'Dokument.pdf', bild: new Blob([await datei.arrayBuffer()], { type: 'application/pdf' }) }, vorschau ? { vorschau } : {});
    } else eintrag.bild = x.bild || await SuS.fotoVerkleinern(datei);
    await SuS.fotoSpeichern(eintrag);
    return eintrag;
  };

  /* Abschnitt in der Baustelle füllen (wird nach dem Zeichnen der Seite aufgerufen). */
  const urls = [];
  SuS.fotosZeichnen = async (pid) => {
    const ziel = document.getElementById('fotos-' + pid);
    if (!ziel) return;
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    if (!(await SuS.fotosVerfuegbar())) { ziel.innerHTML = '<p class="unterzeile">Fotos gehen in der Handy-App (im Orchestrator-Fenster ist der Bildspeicher gesperrt).</p>'; return; }
    const liste = await SuS.fotosVon(pid);
    if (!document.getElementById('fotos-' + pid)) return;  // inzwischen weiternavigiert
    /* Ausgaben und Dokumente: Foto oder Datei (PDF) – ohne „capture“, damit das Handy Kamera, Fotos oder Dateien anbietet */
    const dateien = ziel.hasAttribute('data-dateien');
    ziel.innerHTML = (dateien ? '<label class="knopf zweit breit" style="margin-bottom:10px">📎 Foto oder Datei (PDF) hinzufügen<input type="file" accept="image/*,application/pdf,.pdf" multiple data-foto="' + e(pid) + '" hidden></label>'
      : '<label class="knopf zweit breit" style="margin-bottom:10px">📷 Foto aufnehmen oder wählen<input type="file" accept="image/*" capture="environment" multiple data-foto="' + e(pid) + '" hidden></label>') +
      (liste.length ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' + liste.map((f) => {
        const bild = f.typ === 'pdf' ? f.vorschau : f.bild;
        const u = bild ? URL.createObjectURL(bild) : ''; if (u) urls.push(u);
        return '<button type="button" data-a="fotoZeigen" data-id="' + e(f.id) + '" style="border:0;padding:0;background:none;cursor:pointer;position:relative">' +
          (u ? '<img src="' + e(u) + '" alt="' + e(f.notiz || f.name || 'Foto') + '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block;background:#fff">'
            : '<span class="datei-kachel">PDF</span>') +
          (f.typ === 'pdf' ? '<span class="datei-marke">PDF</span>' : '') + '<small class="unterzeile">' + SuS.datum(f.datum) + '</small></button>';
      }).join('') + '</div>' : '<p class="unterzeile">' + (dateien ? 'Noch keine Datei. Foto des Belegs oder PDF aus der Mail.' : 'Noch keine Fotos. Vorher/nachher, Mängel und Nachweise für Nachträge.') + '</p>');
  };
  document.addEventListener('change', async (ev) => {
    const el = ev.target.closest('[data-foto]');
    if (!el || !el.files.length) return;
    const pid = el.dataset.foto;
    let n = 0;
    for (const datei of Array.from(el.files).slice(0, 20)) {
      try { await SuS.dateiAblegen(pid, datei, {}); n++; }
      catch (x) { SuS.melde('Datei nicht gespeichert: ' + x.message, true); }
    }
    if (n) SuS.melde(n + ' Datei(en) gespeichert.');
    SuS.fotosZeichnen(pid);
  });
  A.fotoZeigen = async (el) => {
    const alle = await SuS.fotosAlle(), f = alle.find((x) => x.id === el.dataset.id);
    if (!f) return;
    if (f.typ === 'pdf') { SuS.pdfZeigen(f); return; }
    const u = URL.createObjectURL(f.bild);
    const form = SuS.blatt('Foto vom ' + SuS.datum(f.datum), '<img src="' + e(u) + '" alt="Foto" style="width:100%;border-radius:12px;margin-bottom:10px">' +
      SuS.feld('notiz', 'Notiz', f.notiz, { platz: 'z. B. Mangel Randstein, vorher' }) +
      '<button type="button" class="knopf gefahr breit" data-a="fotoWeg" data-id="' + e(f.id) + '">Foto löschen</button>', async (fd) => {
      f.notiz = String(fd.get('notiz') || '').trim().slice(0, 200); await SuS.fotoSpeichern(f); URL.revokeObjectURL(u); SuS.fotosZeichnen(f.projektId); return true;
    }, 'Sichern');
    void form;
  };
  A.fotoWeg = async (el) => {
    if (!SuS.sicher(el)) return;
    const alle = await SuS.fotosAlle(), f = alle.find((x) => x.id === el.dataset.id);
    await SuS.fotoLoeschen(el.dataset.id); SuS.blattZu(); if (f) SuS.fotosZeichnen(f.projektId);
  };

  /* PDF ansehen: Seiten werden auf dem Gerät als Bilder gezeichnet (pdf.js); „Öffnen / Teilen“ gibt die Originaldatei weiter. */
  SuS.pdfZeigen = (f) => {
    const form = SuS.blatt(f.name || 'PDF', '<div class="pdf-seiten"><p class="unterzeile">Wird angezeigt …</p></div>' +
      '<button type="button" class="knopf breit" data-a="dateiOeffnen" data-id="' + e(f.id) + '">PDF öffnen / teilen</button>' +
      SuS.feld('notiz', 'Notiz', f.notiz, { platz: 'z. B. Original im Ordner Fahrzeuge' }) +
      '<button type="button" class="knopf gefahr breit" data-a="fotoWeg" data-id="' + e(f.id) + '">Datei löschen</button>', async (fd) => {
      f.notiz = String(fd.get('notiz') || '').trim().slice(0, 200); await SuS.fotoSpeichern(f); SuS.fotosZeichnen(f.projektId); return true;
    }, 'Sichern');
    const ziel = form.querySelector('.pdf-seiten');
    (async () => {
      try {
        const bilder = await SuS.pdfSeitenBilder(f.bild, 6, () => ziel.isConnected);
        if (!ziel.isConnected) { bilder.urls.forEach((u) => URL.revokeObjectURL(u)); return; }
        ziel.innerHTML = bilder.urls.map((u, i) => '<img src="' + e(u) + '" alt="Seite ' + (i + 1) + '">').join('') +
          (bilder.seiten > bilder.urls.length ? '<p class="unterzeile">Gezeigt: ' + bilder.urls.length + ' von ' + bilder.seiten + ' Seiten – alle über „PDF öffnen / teilen“.</p>' : '');
        /* Sobald ein Bild gezeichnet ist, wird seine Adresse nicht mehr gebraucht – sofort freigeben (Speicher) */
        ziel.querySelectorAll('img').forEach((img, i) => { const frei = () => URL.revokeObjectURL(bilder.urls[i]); if (img.complete) frei(); else { img.onload = frei; img.onerror = frei; } });
      } catch (x) { if (ziel.isConnected) ziel.innerHTML = '<p class="unterzeile">Vorschau nicht möglich (' + e(x.message) + '). Die Datei ist trotzdem gespeichert.</p>'; }
    })();
  };
  A.dateiOeffnen = async (el) => {
    const f = (await SuS.fotosAlle()).find((x) => x.id === el.dataset.id);
    if (!f) return;
    SuS.dateiTeilen(f.name || 'Dokument.pdf', f.bild, 'application/pdf', f.name || 'Dokument', f.name || 'PDF');
  };

  /* Für die Sicherung: Fotos und Dateien als Base64 (nur wenn gewünscht) und zurück. Bilder als „jpeg“ (wie bisher),
     PDF-Dateien als „pdf“ mit Name und Vorschaubild. */
  const b64 = async (blob) => {
    const b = new Uint8Array(await blob.arrayBuffer());
    let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  };
  SuS.fotosExport = async () => {
    const alle = await SuS.fotosAlle(), out = [];
    for (const f of alle) {
      if (f.typ === 'pdf') out.push(Object.assign({ id: f.id, projektId: f.projektId, datum: f.datum, notiz: f.notiz, name: f.name, pdf: await b64(f.bild) }, f.vorschau ? { vorschau: await b64(f.vorschau) } : {}));
      else out.push({ id: f.id, projektId: f.projektId, datum: f.datum, notiz: f.notiz, jpeg: await b64(f.bild) });
    }
    return out;
  };
  /* Bildspeicher durch die Fotos der Sicherung ersetzen. Gibt {ok, fehler} zurück – die App meldet Abweichungen. */
  /* Ersetzen in EINEM Vorgang (leeren + alle neuen Einträge): nie ein halber Stand. Mit getrennten Vorgängen waren in WebKit
     nach dem Wiederherstellen einzelne Dateien nicht mehr lesbar (Bedientest 31.10., nach vorherigem Löschen von Dateien). */
  SuS.fotosErsetzen = async (liste) => {
    const eintraege = fotosLesen(liste);
    await ersetzeIn(STORE, eintraege);
    return { ok: eintraege.length, fehler: (Array.isArray(liste) ? liste.length : 0) - eintraege.length };
  };
  SuS.fotosImport = async (liste) => {
    if (!Array.isArray(liste) || !(await SuS.fotosVerfuegbar())) return 0;
    let n = 0;
    for (const basis of fotosLesen(liste)) { try { await SuS.fotoSpeichern(basis); n++; } catch (x) { /* einzelnes Foto überspringen */ } }
    return n;
  };
  /* Einträge der Sicherung prüfen und in Speicher-Einträge umwandeln (nur JPEG bzw. PDF, Größen begrenzt) */
  function fotosLesen(liste) {
    const aus = [];
    for (const f of Array.isArray(liste) ? liste : []) {
      if (!f || !/^[a-z0-9]{4,40}$/.test(String(f.id))) continue;
      const pdf = typeof f.pdf === 'string';
      if (pdf ? f.pdf.length > Math.ceil(SuS.PDF_MAX * 4 / 3) + 8 : typeof f.jpeg !== 'string' || f.jpeg.length > 8000000) continue;
      try {
        const roh = (t) => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
        const u = roh(pdf ? f.pdf : f.jpeg);
        const istJpeg = (b) => b[0] === 0xFF && b[1] === 0xD8;
        if (pdf ? !SuS.pdfKopfOk(u) : !istJpeg(u)) continue;  // nur JPEG bzw. PDF
        const basis = { id: f.id, projektId: String(f.projektId || '').slice(0, 40), datum: /^\d{4}-\d{2}-\d{2}$/.test(f.datum) ? f.datum : SuS.heute(), notiz: String(f.notiz || '').slice(0, 200) };
        if (pdf) {
          const v = typeof f.vorschau === 'string' && f.vorschau.length < 2000000 ? roh(f.vorschau) : null;
          Object.assign(basis, { typ: 'pdf', name: dateiName(f.name) || 'Dokument.pdf', bild: new Blob([u], { type: 'application/pdf' }) }, v && istJpeg(v) ? { vorschau: new Blob([v], { type: 'image/jpeg' }) } : {});
        } else basis.bild = new Blob([u], { type: 'image/jpeg' });
        aus.push(basis);
      } catch (x) { /* einzelnes Foto überspringen */ }
    }
    return aus;
  }
})();
