/* Stock und Stein – „Paket für den Steuerberater“ (Auftrag Simon 25.10.2026): je Monat oder Quartal ein ZIP mit
   Ausgangsrechnungen (PDF), Belegfotos (benannt Datum_Lieferant_Betrag), CSV-Listen und DATEV-Buchungsstapel – über
   „Teilen“ (Mail, Drive …). Alles entsteht auf dem Gerät. Große Pakete werden in Teile zu höchstens 18 MB aufgeteilt
   (übliche Mail-Grenze 20–25 MB). ZIP ohne Kompression („stored“): Fotos und PDFs sind bereits komprimiert. */
'use strict';

(function () {
  SuS.PAKET_TEIL_MAX = 18 * 1024 * 1024;  // je Teil höchstens 18 MB (Mail-Grenzen 20–25 MB)

  /* ---------------- ZIP schreiben (reine Funktion, auch in Node testbar) ---------------- */
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  const crc32 = (b) => { let c = 0xFFFFFFFF; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  /* Lokaler Kopf und Eintrag im zentralen Verzeichnis einer Datei (Methode „stored“, UTF-8-Namen) */
  const enc = new TextEncoder();
  function koepfe(e, off) {
    const name = enc.encode(e.name), m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e.datum || '') || [0, 2026, 1, 1];
    const zeit = 12 << 11, datum = ((Number(m[1]) - 1980) << 9) | (Number(m[2]) << 5) | Number(m[3]);
    const lh = new DataView(new ArrayBuffer(30));
    lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(10, zeit, true); lh.setUint16(12, datum, true);
    lh.setUint32(14, e.crc, true); lh.setUint32(18, e.groesse, true); lh.setUint32(22, e.groesse, true); lh.setUint16(26, name.length, true);
    const ch = new DataView(new ArrayBuffer(46));
    ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
    ch.setUint16(12, zeit, true); ch.setUint16(14, datum, true); ch.setUint32(16, e.crc, true); ch.setUint32(20, e.groesse, true); ch.setUint32(24, e.groesse, true);
    ch.setUint16(28, name.length, true); ch.setUint32(42, off, true);
    return { lokal: [new Uint8Array(lh.buffer), name], zentral: [new Uint8Array(ch.buffer), name] };
  }
  const ende = (anzahl, zGroesse, zOff) => {
    const v = new DataView(new ArrayBuffer(22));
    v.setUint32(0, 0x06054b50, true); v.setUint16(8, anzahl, true); v.setUint16(10, anzahl, true); v.setUint32(12, zGroesse, true); v.setUint32(16, zOff, true);
    return new Uint8Array(v.buffer);
  };
  /* Exakte ZIP-Größe einer Liste (lokaler Kopf + Name + Daten + zentraler Eintrag + Name, dazu 22 Byte Abschluss) */
  SuS.zipGroesse = (liste) => liste.reduce((s, e) => s + 76 + 2 * enc.encode(e.name).length + e.groesse, 22);
  /* Einträge: { name, crc, groesse, inhalt: Blob | Uint8Array, datum } → Blob (Fotos bleiben Blobs aus dem Bildspeicher,
     nichts wird für das ZIP doppelt in den Arbeitsspeicher kopiert) */
  SuS.zipBlob = (liste) => {
    const teile = [], zentral = [];
    let off = 0;
    for (const e of liste) {
      const k = koepfe(e, off);
      teile.push(...k.lokal, e.inhalt); zentral.push(...k.zentral);
      off += 30 + k.lokal[1].length + e.groesse;
    }
    const zGroesse = zentral.reduce((s, x) => s + x.length, 0);
    return new Blob(teile.concat(zentral, [ende(liste.length, zGroesse, off)]), { type: 'application/zip' });
  };
  /* Einfache Fassung für kleine Inhalte und Tests: [{ name, daten: Uint8Array, datum }] → Uint8Array */
  SuS.zipBauen = (dateien) => {
    const liste = dateien.map((f) => ({ name: f.name, datum: f.datum, crc: crc32(f.daten), groesse: f.daten.length, inhalt: f.daten }));
    const teile = [], zentral = [];
    let off = 0;
    for (const e of liste) { const k = koepfe(e, off); teile.push(...k.lokal, e.inhalt); zentral.push(...k.zentral); off += 30 + k.lokal[1].length + e.groesse; }
    const alle = teile.concat(zentral, [ende(liste.length, zentral.reduce((s, x) => s + x.length, 0), off)]);
    const out = new Uint8Array(alle.reduce((s, x) => s + x.length, 0));
    let p = 0; for (const x of alle) { out.set(x, p); p += x.length; }
    return out;
  };

  /* Dateiname-Baustein: nur Buchstaben, Ziffern, Bindestrich */
  const sauber = (t) => String(t || '').normalize('NFKD').replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/Ä/g, 'Ae').replace(/Ö/g, 'Oe')
    .replace(/Ü/g, 'Ue').replace(/ß/g, 'ss').replace(/[^A-Za-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'Beleg';
  SuS.belegDateiname = (a, nr) => a.datum + '_' + sauber(a.lieferant || a.text) + '_' + ((a.brutto || 0) / 100).toFixed(2).replace('.', ',') + 'EUR' + (nr ? '_' + (nr + 1) : '') + '.jpg';

  /* Zeiträume: letzte 15 Monate und die Quartale dieses und des letzten Jahres */
  SuS.paketZeitraeume = (heute) => {
    const h = heute || SuS.heute(), j = Number(h.slice(0, 4)), m = Number(h.slice(5, 7)), aus = [];
    for (let i = 0; i < 15; i++) {
      const d = new Date(Date.UTC(j, m - 1 - i, 1)), jj = d.getUTCFullYear(), mm = d.getUTCMonth() + 1;
      const letzter = new Date(Date.UTC(jj, mm, 0)).getUTCDate(), p = (n) => String(n).padStart(2, '0');
      aus.push({ wert: 'm' + jj + '-' + p(mm), titel: SuS.MONATE[mm - 1] + ' ' + jj, von: jj + '-' + p(mm) + '-01', bis: jj + '-' + p(mm) + '-' + p(letzter), kurz: jj + '-' + p(mm) });
    }
    for (const jj of [j, j - 1]) for (let q = 4; q >= 1; q--) {
      if (jj === j && (q - 1) * 3 + 1 > m) continue;
      const p = (n) => String(n).padStart(2, '0'), bisM = q * 3, letzter = new Date(Date.UTC(jj, bisM, 0)).getUTCDate();
      aus.push({ wert: 'q' + jj + '-' + q, titel: q + '. Quartal ' + jj, von: jj + '-' + p(bisM - 2) + '-01', bis: jj + '-' + p(bisM) + '-' + p(letzter), kurz: jj + '-Q' + q });
    }
    return aus;
  };

  /* Paket zusammenstellen → { teile: [{ name, blob, groesse, anzahl }] } – Teile höchstens SuS.PAKET_TEIL_MAX (exakt gerechnet);
     eine einzelne größere Datei bekommt ein eigenes Teil (mit Hinweis). Fotos werden einzeln gelesen (nur für die Prüfsumme). */
  SuS.steuerPaket = async (z, fortschritt) => {
    const drin = (d) => d >= z.von && d <= z.bis, info = [], meldung = fortschritt || (() => {});
    const namen = new Set();
    const eindeutig = (name) => {  // gleiche Namen (z. B. zwei gleiche Belege an einem Tag) bekommen _2, _3 … (Fund Codex)
      if (!namen.has(name)) { namen.add(name); return name; }
      const punkt = name.lastIndexOf('.');
      for (let i = 2; ; i++) { const n = name.slice(0, punkt) + '_' + i + name.slice(punkt); if (!namen.has(n)) { namen.add(n); return n; } }
    };
    const eintrag = async (name, inhalt, datum) => {
      const bytes = inhalt instanceof Uint8Array ? inhalt : new Uint8Array(await inhalt.arrayBuffer());
      return { name: eindeutig(name), crc: crc32(bytes), groesse: bytes.length, inhalt: inhalt instanceof Uint8Array ? new Blob([inhalt]) : inhalt, datum };
    };
    const klein = [], gross = [];
    const rechnungen = SuS.daten.dokumente.filter((d) => SuS.istRechnung(d) && d.fest && drin(d.datum)).sort((a, b) => a.nummer.localeCompare(b.nummer));
    for (let i = 0; i < rechnungen.length; i++) {
      meldung('Rechnung ' + (i + 1) + ' von ' + rechnungen.length + ' als PDF …');
      const d = rechnungen[i];
      gross.push(await eintrag('Ausgangsrechnungen/' + SuS.pdfDateiname(d, ''), new Uint8Array(await SuS.dokumentPdf(d, '', false)), d.datum));
    }
    const ausgaben = SuS.daten.ausgaben.filter((a) => drin(a.datum)).sort((a, b) => a.datum.localeCompare(b.datum));
    let fotos = 0;
    const mitFoto = new Set();
    if (SuS.fotosVerfuegbar && await SuS.fotosVerfuegbar()) {
      for (const a of ausgaben) {
        meldung('Belegfotos … ' + a.datum);
        const liste = await SuS.fotosVon('a' + a.id);
        for (let i = 0; i < liste.length; i++) {
          gross.push(await eintrag('Belege/' + SuS.belegDateiname(a, liste.length > 1 ? i : 0), liste[i].bild, a.datum));
          fotos++; mitFoto.add(a.id);
        }
      }
    } else info.push('Belegfotos: auf diesem Gerät nicht verfügbar (z. B. im Orchestrator-Fenster).');
    klein.push(await eintrag('Ausgaben.csv', enc.encode(SuS.ausgabenCsv(null, drin)), z.bis));
    klein.push(await eintrag('Ausgangsrechnungen.csv', enc.encode(SuS.ausgangsbuchCsv(null, drin)), z.bis));
    if (z.von.slice(0, 4) === z.bis.slice(0, 4)) {
      try {
        klein.push(await eintrag('DATEV/EXTF_Buchungsstapel_' + z.kurz + '.csv', new Uint8Array(SuS.winAnsi(SuS.datevBuchungsstapel(z.von.slice(0, 4), z.von, z.bis))), z.bis));
        const i = SuS.datevInfo || {};
        if (i.vonHand) info.push('DATEV: ' + i.vonHand + ' Beleg(e) mit mehreren Steuersätzen bitte von Hand buchen.');
      } catch (x) { info.push('DATEV-Datei fehlt: ' + x.message); }
    }
    for (const g of gross) if (SuS.zipGroesse([g]) > SuS.PAKET_TEIL_MAX) info.push(g.name + ' ist größer als ' + Math.round(SuS.PAKET_TEIL_MAX / 1048576) + ' MB und steht allein in einem Teil.');
    const ohneFoto = ausgaben.length - mitFoto.size;
    const lies = ['Paket für den Steuerberater – ' + z.titel + ' (' + SuS.datum(z.von) + ' bis ' + SuS.datum(z.bis) + ')',
      'Firma: ' + (SuS.daten.firma.name || ''), 'Erstellt: ' + SuS.datum(SuS.heute()), '',
      'Ausgangsrechnungen (PDF): ' + rechnungen.length, 'Ausgaben (Liste Ausgaben.csv): ' + ausgaben.length, 'Belegfotos: ' + fotos +
      (ohneFoto > 0 ? ' (' + ohneFoto + ' Ausgabe(n) ohne Foto)' : ''), 'Dateinamen der Belege: Datum_Lieferant_Betrag.jpg', ''].concat(info.length ? ['Hinweise:'].concat(info.map((x) => '- ' + x)) : [])
      .concat(['', 'Papierbelege bitte trotzdem aufbewahren. Erstellt mit der App „Stock und Stein · Büro“.']).join('\r\n') + '\r\n';
    klein.unshift(await eintrag('LIES-MICH.txt', enc.encode(lies), z.bis));
    /* Aufteilen mit exakter Größe: Teil 1 enthält die Listen */
    const teile = [[...klein]];
    for (const g of gross) {
      const akt = teile[teile.length - 1];
      if (akt.length && SuS.zipGroesse(akt.concat([g])) > SuS.PAKET_TEIL_MAX) teile.push([g]); else akt.push(g);
    }
    meldung('ZIP wird erstellt …');
    const basis = 'Steuerberater_' + sauber(SuS.daten.firma.name || 'Betrieb') + '_' + z.kurz;
    return { teile: teile.map((liste, i) => ({ name: basis + (teile.length > 1 ? '_Teil' + (i + 1) + 'von' + teile.length : '') + '.zip',
      blob: SuS.zipBlob(liste), groesse: SuS.zipGroesse(liste), anzahl: liste.length })), rechnungen: rechnungen.length, ausgaben: ausgaben.length, fotos, info };
  };

  if (typeof document === 'undefined') return;  // ab hier nur im Browser

  const e = SuS.esc, A = SuS.aktionen;
  let teile = [];
  A.steuerPaketBlatt = () => {
    const z = SuS.paketZeitraeume();
    SuS.blatt('Paket für den Steuerberater',
      '<p class="unterzeile">Ein ZIP mit Ausgangsrechnungen (PDF), Belegfotos, Listen (CSV) und DATEV-Datei für den gewählten Zeitraum – zum Teilen per Mail oder Drive.</p>' +
      SuS.feld('zeitraum', 'Zeitraum', z[1] ? z[1].wert : z[0].wert, { typ: 'select', optionen: z.map((x) => [x.wert, x.titel]) }) +
      '<div class="paket-status unterzeile" aria-live="polite"></div>',
      async (fd, form) => {
        const wahl = SuS.paketZeitraeume().find((x) => x.wert === fd.get('zeitraum'));
        const status = form.querySelector('.paket-status');
        if (!wahl) return false;
        let erg;
        try { erg = await SuS.steuerPaket(wahl, (t) => { status.textContent = t; }); }
        catch (x) { SuS.melde('Paket konnte nicht erstellt werden: ' + x.message, true); return false; }
        teile = erg.teile;
        if (window.parent !== window) { SuS.melde('Im Orchestrator-Fenster ist Teilen gesperrt – bitte in der Handy-App erstellen.', true); return true; }
        const text = 'Unterlagen ' + wahl.titel + ': ' + erg.rechnungen + ' Ausgangsrechnungen, ' + erg.ausgaben + ' Ausgaben, ' + erg.fotos + ' Belegfotos, Listen und DATEV-Datei.';
        if (teile.length === 1) { setTimeout(() => SuS.dateiTeilen(teile[0].name, teile[0].blob, 'application/zip', text, 'Paket für den Steuerberater – ' + wahl.titel), 0); return true; }
        setTimeout(() => SuS.blatt('Paket in ' + teile.length + ' Teilen',
          '<p class="unterzeile">Zu groß für eine Mail – bitte die Teile nacheinander teilen (' + e(text) + ')</p>' +
          teile.map((t, i) => '<button type="button" class="knopf breit" data-a="paketTeilTeilen" data-i="' + i + '">Teil ' + (i + 1) + ' teilen (' + Math.max(1, Math.round(t.groesse / 1048576)) + ' MB, ' + t.anzahl + ' Dateien)</button>').join('') +
          (erg.info.length ? '<div class="hinweis">' + erg.info.map(e).join('<br>') + '</div>' : '')), 0);
        return true;
      }, 'Erstellen');
  };
  A.paketTeilTeilen = async (el) => {
    const t = teile[Number(el.dataset.i)];
    if (!t) return;
    const datei = new File([t.blob], t.name, { type: 'application/zip' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [datei] })) { await navigator.share({ files: [datei], title: t.name }); el.textContent = '✓ ' + el.textContent.replace(/^✓ /, ''); return; }
    } catch (x) { if (x && x.name === 'AbortError') return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(datei); a.download = t.name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  };
})();
