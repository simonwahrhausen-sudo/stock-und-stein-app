/* Stock und Stein – QR-Code (Byte-Modus, Fehlerkorrektur M nach ISO/IEC 18004) und GiroCode (EPC-QR) für Rechnungen.
   Übertragen aus qr.py des Orchestrators (Verfahren wie Project Nayuki, MIT-Lizenz); dort per macOS-QR-Leser geprüft. */
'use strict';

(function () {
  const ECC = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26,
    26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28];
  const BLOCKS = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14,
    16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49];
  const MASKEN = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => x * y % 2 + x * y % 3 === 0,
    (x, y) => (x * y % 2 + x * y % 3) % 2 === 0, (x, y) => ((x + y) % 2 + x * y % 3) % 2 === 0
  ];

  function rohModule(v) {
    let r = (16 * v + 128) * v + 64;
    if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
    return r;
  }
  const datenWorte = (v) => Math.floor(rohModule(v) / 8) - ECC[v] * BLOCKS[v];
  function gfMal(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) { z = (z << 1) ^ ((z >>> 7) * 0x11D); z ^= ((y >>> i) & 1) * x; }
    return z;
  }
  function rsTeiler(grad) {
    const r = new Array(grad - 1).fill(0).concat([1]);
    let wurzel = 1;
    for (let k = 0; k < grad; k++) {
      for (let j = 0; j < grad; j++) { r[j] = gfMal(r[j], wurzel); if (j + 1 < grad) r[j] ^= r[j + 1]; }
      wurzel = gfMal(wurzel, 0x02);
    }
    return r;
  }
  function rsRest(daten, teiler) {
    const r = new Array(teiler.length).fill(0);
    for (const b of daten) {
      const f = b ^ r.shift(); r.push(0);
      teiler.forEach((c, i) => { r[i] ^= gfMal(c, f); });
    }
    return r;
  }
  function ausrichtung(v, groesse) {
    if (v === 1) return [];
    const n = Math.floor(v / 7) + 2;
    const schritt = Math.floor((v * 8 + n * 3 + 5) / (n * 4 - 4)) * 2;
    const p = [];
    for (let i = 0; i < n - 1; i++) p.push(groesse - 7 - i * schritt);
    return [6].concat(p.sort((a, b) => a - b));
  }

  function codewoerter(daten) {
    let v = 1, kap = 0, zaehl = 8;
    for (; v <= 40; v++) {
      kap = datenWorte(v) * 8; zaehl = v < 10 ? 8 : 16;
      if (4 + zaehl + daten.length * 8 <= kap) break;
    }
    if (v > 40) throw new Error('Zu viele Daten für einen QR-Code.');
    const bits = [];
    const an = (wert, laenge) => { for (let i = laenge - 1; i >= 0; i--) bits.push((wert >>> i) & 1); };
    an(0b0100, 4); an(daten.length, zaehl);
    for (const b of daten) an(b, 8);
    an(0, Math.min(4, kap - bits.length));
    an(0, (8 - bits.length % 8) % 8);
    for (let pad = 0xEC; bits.length < kap; pad ^= 0xEC ^ 0x11) an(pad, 8);
    const worte = [];
    for (let i = 0; i < bits.length; i += 8) worte.push(parseInt(bits.slice(i, i + 8).join(''), 2));
    const anzahl = BLOCKS[v], eccLaenge = ECC[v], roh = Math.floor(rohModule(v) / 8);
    const kurzAnzahl = anzahl - roh % anzahl, kurzLaenge = Math.floor(roh / anzahl);
    const teiler = rsTeiler(eccLaenge), bloecke = [];
    let pos = 0;
    for (let i = 0; i < anzahl; i++) {
      const teil = worte.slice(pos, pos + kurzLaenge - eccLaenge + (i < kurzAnzahl ? 0 : 1));
      pos += teil.length;
      const ecc = rsRest(teil, teiler);
      if (i < kurzAnzahl) teil.push(0);
      bloecke.push(teil.concat(ecc));
    }
    const erg = [];
    for (let i = 0; i < bloecke[0].length; i++) {
      bloecke.forEach((b, j) => { if (i !== kurzLaenge - eccLaenge || j >= kurzAnzahl) erg.push(b[i]); });
    }
    return [v, erg];
  }

  function strafe(m) {
    const n = m.length; let s = 0;
    const linien = m.map((z) => z.slice());
    for (let x = 0; x < n; x++) linien.push(m.map((z) => z[x]));
    const f1 = '10111010000', f2 = '00001011101';
    for (const l of linien) {
      let lauf = 1;
      for (let i = 1; i <= n; i++) {
        if (i < n && l[i] === l[i - 1]) lauf++;
        else { if (lauf >= 5) s += 3 + lauf - 5; lauf = 1; }
      }
      const t = l.map((b) => (b ? '1' : '0')).join('');
      for (let i = 0; i < n - 10; i++) { const w = t.substr(i, 11); if (w === f1 || w === f2) s += 40; }
    }
    for (let y = 0; y < n - 1; y++) for (let x = 0; x < n - 1; x++) {
      const c = m[y][x]; if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) s += 3;
    }
    let dunkel = 0; m.forEach((z) => z.forEach((b) => { if (b) dunkel++; }));
    const gesamt = n * n;
    s += (Math.floor((Math.abs(dunkel * 20 - gesamt * 10) + gesamt - 1) / gesamt) - 1) * 10;
    return s;
  }

  /* Module als Feld aus Zeilen (true = dunkel), ohne Ruhezone. */
  function matrix(text) {
    const [v, worte] = codewoerter(Array.from(new TextEncoder().encode(text)));
    const n = v * 4 + 17;
    const mod = Array.from({ length: n }, () => new Array(n).fill(false));
    const fkt = Array.from({ length: n }, () => new Array(n).fill(false));
    const setze = (x, y, d) => { mod[y][x] = d; fkt[y][x] = true; };
    for (let i = 0; i < n; i++) { setze(6, i, i % 2 === 0); setze(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [n - 4, 3], [3, n - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        if (cx + dx >= 0 && cx + dx < n && cy + dy >= 0 && cy + dy < n) {
          const d = Math.max(Math.abs(dx), Math.abs(dy)); setze(cx + dx, cy + dy, d !== 2 && d !== 4);
        }
      }
    }
    const pos = ausrichtung(v, n), letzt = pos.length - 1;
    pos.forEach((x, i) => pos.forEach((y, j) => {
      if ((i === 0 && j === 0) || (i === 0 && j === letzt) || (i === letzt && j === 0)) return;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setze(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }));
    function format(maske) {
      const daten = (0 << 3) | maske; let rest = daten;
      for (let i = 0; i < 10; i++) rest = (rest << 1) ^ ((rest >>> 9) * 0x537);
      const bits = ((daten << 10) | rest) ^ 0x5412, b = (i) => ((bits >>> i) & 1) === 1;
      for (let i = 0; i < 6; i++) setze(8, i, b(i));
      setze(8, 7, b(6)); setze(8, 8, b(7)); setze(7, 8, b(8));
      for (let i = 9; i < 15; i++) setze(14 - i, 8, b(i));
      for (let i = 0; i < 8; i++) setze(n - 1 - i, 8, b(i));
      for (let i = 8; i < 15; i++) setze(8, n - 15 + i, b(i));
      setze(8, n - 8, true);
    }
    format(0);
    if (v >= 7) {
      let rest = v;
      for (let i = 0; i < 12; i++) rest = (rest << 1) ^ ((rest >>> 11) * 0x1F25);
      const bits = (v << 12) | rest;
      for (let i = 0; i < 18; i++) { const d = ((bits >>> i) & 1) === 1, a = n - 11 + i % 3, b = Math.floor(i / 3); setze(a, b, d); setze(b, a, d); }
    }
    let index = 0;
    for (let rechts = n - 1; rechts >= 1; rechts -= 2) {
      if (rechts === 6) rechts = 5;
      for (let senk = 0; senk < n; senk++) for (let j = 0; j < 2; j++) {
        const x = rechts - j, hoch = ((rechts + 1) & 2) === 0, y = hoch ? n - 1 - senk : senk;
        if (!fkt[y][x] && index < worte.length * 8) { mod[y][x] = ((worte[index >>> 3] >>> (7 - (index & 7))) & 1) === 1; index++; }
      }
    }
    let bestes = null;
    for (let m = 0; m < 8; m++) {
      format(m);
      const k = mod.map((z, y) => z.map((d, x) => (!fkt[y][x] && MASKEN[m](x, y) ? !d : d)));
      const s = strafe(k);
      if (!bestes || s < bestes[0]) bestes = [s, k];
    }
    return bestes[1];
  }

  /* QR als SVG (mit Ruhezone von 4 Modulen). */
  SuS.qrSvg = (text, mm) => {
    const m = matrix(text), n = m.length, r = 4, g = n + 2 * r;
    let pfad = '';
    m.forEach((z, y) => z.forEach((d, x) => { if (d) pfad += 'M' + (x + r) + ' ' + (y + r) + 'h1v1h-1z'; }));
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + g + ' ' + g + '" width="' + mm + 'mm" height="' + mm + 'mm" shape-rendering="crispEdges">' +
      '<rect width="' + g + '" height="' + g + '" fill="#fff"/><path d="' + pfad + '" fill="#000"/></svg>';
  };
  SuS.qrMatrix = matrix;

  /* GiroCode nach EPC069-12 (Version 002, UTF-8, SEPA-Überweisung). Leer, wenn Angaben fehlen oder ungültig sind. */
  SuS.giroCode = (name, iban, bic, cent, zweck) => {
    const ib = String(iban || '').replace(/\s+/g, '').toUpperCase();
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$/.test(ib) || !name || !(cent > 0) || cent > 99999999999) return '';
    const bc = String(bic || '').replace(/\s+/g, '').toUpperCase();
    /* Keine Steuerzeichen (ein Zeilenumbruch würde die Felder verschieben) und höchstens 331 Bytes insgesamt (EPC069-12,
       sonst lehnen Banking-Apps ab) – Funde Prüfrunde 2. */
    const sauber = (t, max) => Array.from(String(t || '').replace(/[\u0000-\u001f\u007f-\u009f]+/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('');
    let nm = sauber(name, 70), zw = sauber(zweck, 140);
    if (!nm) return '';
    const bauen = () => ['BCD', '002', '1', 'SCT', /^[A-Z0-9]{8}([A-Z0-9]{3})?$/.test(bc) ? bc : '', nm, ib, 'EUR' + (cent / 100).toFixed(2), '', '', zw].join('\n');
    const bytes = (t) => new TextEncoder().encode(t).length;
    let code = bauen();
    while (bytes(code) > 331 && zw) { zw = Array.from(zw).slice(0, -1).join('').trim(); code = bauen(); }
    while (bytes(code) > 331 && nm.length > 1) { nm = Array.from(nm).slice(0, -1).join('').trim(); code = bauen(); }
    return bytes(code) <= 331 ? code : '';
  };
})();
