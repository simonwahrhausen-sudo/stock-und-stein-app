/* Stock und Stein – Fotos je Baustelle (vorher/nachher, Mängel, Nachweise). Gespeichert verkleinert (max. 1600 px, JPEG)
   in der Datenbank des Browsers auf dem Gerät (IndexedDB) – nie im Internet. Im App-Fenster des Orchestrators ist diese
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

  /* Abschnitt in der Baustelle füllen (wird nach dem Zeichnen der Seite aufgerufen). */
  const urls = [];
  SuS.fotosZeichnen = async (pid) => {
    const ziel = document.getElementById('fotos-' + pid);
    if (!ziel) return;
    urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
    if (!(await SuS.fotosVerfuegbar())) { ziel.innerHTML = '<p class="unterzeile">Fotos gehen in der Handy-App (im Orchestrator-Fenster ist der Bildspeicher gesperrt).</p>'; return; }
    const liste = await SuS.fotosVon(pid);
    ziel.innerHTML = '<label class="knopf zweit breit" style="margin-bottom:10px">📷 Foto aufnehmen oder wählen<input type="file" accept="image/*" capture="environment" multiple data-foto="' + e(pid) + '" hidden></label>' +
      (liste.length ? '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">' + liste.map((f) => {
        const u = URL.createObjectURL(f.bild); urls.push(u);
        return '<button type="button" data-a="fotoZeigen" data-id="' + e(f.id) + '" style="border:0;padding:0;background:none;cursor:pointer"><img src="' + e(u) + '" alt="' + e(f.notiz || 'Foto') +
          '" style="width:100%;aspect-ratio:1;object-fit:cover;border-radius:10px;display:block"><small class="unterzeile">' + SuS.datum(f.datum) + '</small></button>';
      }).join('') + '</div>' : '<p class="unterzeile">Noch keine Fotos. Vorher/nachher, Mängel und Nachweise für Nachträge.</p>');
  };
  document.addEventListener('change', async (ev) => {
    const el = ev.target.closest('[data-foto]');
    if (!el || !el.files.length) return;
    const pid = el.dataset.foto;
    let n = 0;
    for (const datei of Array.from(el.files).slice(0, 20)) {
      try { const bild = await SuS.fotoVerkleinern(datei); await SuS.fotoSpeichern({ id: SuS.id(), projektId: pid, datum: SuS.heute(), notiz: '', bild }); n++; }
      catch (x) { SuS.melde('Foto nicht gespeichert: ' + x.message, true); }
    }
    if (n) SuS.melde(n + ' Foto(s) gespeichert.');
    SuS.fotosZeichnen(pid);
  });
  A.fotoZeigen = async (el) => {
    const alle = await SuS.fotosAlle(), f = alle.find((x) => x.id === el.dataset.id);
    if (!f) return;
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

  /* Für die Sicherung: Fotos als Base64 (nur wenn gewünscht) und zurück. */
  SuS.fotosExport = async () => {
    const alle = await SuS.fotosAlle(), out = [];
    for (const f of alle) {
      const b = new Uint8Array(await f.bild.arrayBuffer());
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
      out.push({ id: f.id, projektId: f.projektId, datum: f.datum, notiz: f.notiz, jpeg: btoa(s) });
    }
    return out;
  };
  /* Bildspeicher durch die Fotos der Sicherung ersetzen. Gibt {ok, fehler} zurück – die App meldet Abweichungen. */
  SuS.fotosErsetzen = async (liste) => {
    await ersetzeIn(STORE, []);
    const ok = await SuS.fotosImport(liste);
    return { ok, fehler: liste.length - ok };
  };
  SuS.fotosImport = async (liste) => {
    if (!Array.isArray(liste) || !(await SuS.fotosVerfuegbar())) return 0;
    let n = 0;
    for (const f of liste) {
      if (!f || typeof f.jpeg !== 'string' || !/^[a-z0-9]{4,40}$/.test(String(f.id)) || f.jpeg.length > 8000000) continue;
      try {
        const s = atob(f.jpeg), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
        if (u[0] !== 0xFF || u[1] !== 0xD8) continue;  // nur JPEG
        await SuS.fotoSpeichern({ id: f.id, projektId: String(f.projektId || '').slice(0, 40), datum: /^\d{4}-\d{2}-\d{2}$/.test(f.datum) ? f.datum : SuS.heute(),
          notiz: String(f.notiz || '').slice(0, 200), bild: new Blob([u], { type: 'image/jpeg' }) });
        n++;
      } catch (x) { /* einzelnes Foto überspringen */ }
    }
    return n;
  };
})();
