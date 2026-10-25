/* Stock und Stein – PDF direkt in der App erzeugen (ohne Fremdbibliotheken), damit Angebote, Rechnungen und Mahnungen
   über das Teilen-Menü per Mail oder WhatsApp verschickt werden können. A4, DIN-5008-ähnlicher Aufbau wie der Ausdruck,
   Standardschriften Helvetica/Helvetica-Bold (WinAnsi, inkl. Umlaute und €), Tabelle mit Seitenumbruch, GiroCode als
   Vektorgrafik, Unterschrift als JPEG. Gleiche Texte wie im Ausdruck (SuS.druckHilfe). */
'use strict';

(function () {
  const MM = 72 / 25.4, W = 595.28, H = 841.89;
  const RAND_L = 22 * MM, RAND_R = 18 * MM, OBEN = 14 * MM, UNTEN = 30 * MM;
  const BREITE = W - RAND_L - RAND_R;

  /* ---------- Zeichen und Breiten (Helvetica-AFM, WinAnsi) ---------- */
  const WIN = { 0x20AC: 0x80, 0x201A: 0x82, 0x201E: 0x84, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94,
    0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99, 0x2212: 0x2D, 0x202F: 0x20, 0x2009: 0x20, 0x00A0: 0x20 };
  const zeichen = (ch) => {
    const c = ch.codePointAt(0);
    if (WIN[c] != null) return WIN[c];
    if (c >= 0x20 && c < 0x7F) return c;
    if (c >= 0xA0 && c <= 0xFF) return c;
    return 0x3F;  // nicht darstellbar → „?“
  };
  const tabelle = (basis, extra) => { const t = new Array(256).fill(556); basis.forEach((w, i) => { t[32 + i] = w; }); Object.keys(extra).forEach((k) => { t[k] = extra[k]; }); return t; };
  const REG = tabelle([278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944,
    667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556,
    500, 722, 500, 500, 500, 334, 260, 334, 584],
  { 0x80: 556, 0x82: 222, 0x84: 333, 0x85: 1000, 0x91: 222, 0x92: 222, 0x93: 333, 0x94: 333, 0x95: 350, 0x96: 556, 0x97: 1000, 0x99: 1000,
    0xA7: 556, 0xA9: 737, 0xAB: 556, 0xAE: 737, 0xB0: 400, 0xB1: 584, 0xB2: 333, 0xB3: 333, 0xB5: 556, 0xB7: 278, 0xBB: 556, 0xC4: 667, 0xC7: 722,
    0xC9: 667, 0xD6: 778, 0xD7: 584, 0xDC: 722, 0xDF: 611, 0xE4: 556, 0xE7: 500, 0xE9: 556, 0xF6: 556, 0xFC: 556 });
  const FETT = tabelle([278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944,
    667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611,
    556, 778, 556, 556, 500, 389, 280, 389, 584],
  { 0x80: 556, 0x82: 278, 0x84: 500, 0x85: 1000, 0x91: 278, 0x92: 278, 0x93: 500, 0x94: 500, 0x95: 350, 0x96: 556, 0x97: 1000, 0xA7: 556,
    0xB0: 400, 0xB2: 333, 0xB3: 333, 0xB7: 278, 0xC4: 722, 0xC9: 667, 0xD6: 778, 0xD7: 584, 0xDC: 722, 0xDF: 611, 0xE4: 556, 0xE9: 556, 0xF6: 611, 0xFC: 611 });
  /* Mit eingebetteter Schrift (pdfa-daten.js, PDF/A) gelten deren Laufweiten – Arimo ist laufweitengleich zu Helvetica. */
  const PDFA = SuS.PDFA || null;
  if (PDFA) { PDFA.reg.breiten.forEach((w, i) => { if (i >= 32 && w) REG[i] = w; }); PDFA.fett.breiten.forEach((w, i) => { if (i >= 32 && w) FETT[i] = w; }); }
  SuS.pdfBreite = (text, fett, groesse) => {
    const t = fett ? FETT : REG;
    let w = 0;
    for (const ch of String(text)) w += t[zeichen(ch)];
    return w * groesse / 1000;
  };
  const pdfText = (text) => {
    let o = '';
    for (const ch of String(text)) {
      const c = zeichen(ch);
      if (c === 0x28 || c === 0x29 || c === 0x5C) o += '\\' + String.fromCharCode(c);
      else if (c < 0x80) o += String.fromCharCode(c);
      else o += '\\' + c.toString(8).padStart(3, '0');
    }
    return '(' + o + ')';
  };
  const zahl = (n) => (Math.round(n * 100) / 100).toString();
  /* Zeichen außerhalb von WinAnsi (z. B. ł, ć, kyrillisch) erscheinen im PDF als „?“ – vorher melden (Fund Cursor). */
  /* Text als Windows-1252-Bytes (z. B. für den DATEV-Import) */
  SuS.winAnsi = (t) => Uint8Array.from(Array.from(String(t)), zeichen);
  SuS.pdfFremdzeichen = (dok) => {
    const f = SuS.firmaVon(dok), k = SuS.kundeVon(dok) || {};
    const texte = [f.name, f.inhaber, f.strasse, f.ort, k.name, k.strasse, k.ort, k.ansprechpartner, dok.betreff, dok.baustelle, dok.einleitung, dok.schluss]
      .concat(dok.positionen.map((p) => (p.text || '') + ' ' + (p.beschreibung || '')));
    const fremd = new Set();
    for (const t of texte) for (const ch of String(t || '')) if (zeichen(ch) === 0x3F && ch !== '?') fremd.add(ch);
    return [...fremd].slice(0, 10);
  };

  /* Umbrechen nach Wörtern; zu lange Wörter werden hart getrennt. */
  SuS.pdfUmbruch = (text, breite, fett, groesse) => {
    const zeilen = [];
    for (const absatz of String(text == null ? '' : text).split('\n')) {
      let zeile = '';
      for (const wort of absatz.split(/\s+/).filter(Boolean)) {
        const probe = zeile ? zeile + ' ' + wort : wort;
        if (SuS.pdfBreite(probe, fett, groesse) <= breite) { zeile = probe; continue; }
        if (zeile) zeilen.push(zeile);
        let rest = wort;
        while (SuS.pdfBreite(rest, fett, groesse) > breite) {
          let n = rest.length;
          while (n > 1 && SuS.pdfBreite(rest.slice(0, n), fett, groesse) > breite) n--;
          zeilen.push(rest.slice(0, n)); rest = rest.slice(n);
        }
        zeile = rest;
      }
      zeilen.push(zeile);
    }
    return zeilen;
  };

  /* ---------- Seitenaufbau ---------- */
  const FARBE = { text: [0.11, 0.106, 0.094], grau: [0.37, 0.353, 0.333], moos: [0.31, 0.42, 0.227], rot: [0.70, 0.15, 0.12],
    sand: [0.957, 0.937, 0.902], linie: [0.886, 0.859, 0.812], moosHell: [0.953, 0.965, 0.937], grauHell: [0.965, 0.957, 0.941] };
  class Dokument {
    constructor() { this.seiten = []; this.bilder = []; this.neueSeite(); }
    neueSeite() { this.ops = []; this.seiten.push(this.ops); this.y = OBEN; }
    platz(h) { if (this.y + h > H - UNTEN) { this.neueSeite(); if (this.beiNeuerSeite) this.beiNeuerSeite(); return true; } return false; }
    farbe(c, fuellen) { return c.map(zahl).join(' ') + (fuellen ? ' rg' : ' RG'); }
    text(x, y, t, o) {
      const g = o.groesse || 9.6, f = o.fett ? 'F2' : 'F1';
      let xx = x;
      if (o.rechts) xx = x - SuS.pdfBreite(t, o.fett, g);
      /* Betrachter zeichnen „€“ oft breiter als die Standardmaße: ein zusätzliches Leerzeichen danach verhindert Kleben. */
      const tt = PDFA ? String(t) : String(t).replace(/€ (?=\S)/g, '€  ');  // eingebettete Schrift: Maße stimmen exakt
      this.ops.push('BT ' + this.farbe(o.farbe || FARBE.text, true) + ' /' + f + ' ' + zahl(g) + ' Tf ' + zahl(xx) + ' ' + zahl(H - y) + ' Td ' + pdfText(tt) + ' Tj ET');
    }
    linie(x1, y1, x2, y2, staerke, c) { this.ops.push(zahl(staerke || 0.5) + ' w ' + this.farbe(c || FARBE.linie) + ' ' + zahl(x1) + ' ' + zahl(H - y1) + ' m ' + zahl(x2) + ' ' + zahl(H - y2) + ' l S'); }
    rechteck(x, y, w, h, c) { this.ops.push(this.farbe(c, true) + ' ' + zahl(x) + ' ' + zahl(H - y - h) + ' ' + zahl(w) + ' ' + zahl(h) + ' re f'); }
    /* Absatz mit Umbruch; Teile [{text, fett, farbe}] werden fortlaufend gesetzt. */
    absatz(x, breite, teile, o) {
      const g = o.groesse || 9.6, zh = g * (o.zeilenhoehe || 1.42);
      const woerter = [];
      for (const t of teile) for (const w of String(t.text || '').split(/\s+/).filter(Boolean)) woerter.push({ w, fett: !!t.fett, farbe: t.farbe });
      let zeile = [], breiteZeile = 0;
      const setze = () => {
        this.platz(zh);
        /* Gleich formatierte Wörter als ein Stück setzen – der Betrachter verteilt die Leerzeichen selbst (sonst klebt z. B.
           „€“ am nächsten Wort, wenn seine Schrift das Zeichen breiter zeichnet als die Standardmaße). */
        const stuecke = [];
        for (const z of zeile) {
          const letzt = stuecke[stuecke.length - 1];
          if (letzt && letzt.fett === z.fett && letzt.farbe === z.farbe) letzt.t += ' ' + z.w;
          else stuecke.push({ t: z.w, fett: z.fett, farbe: z.farbe });
        }
        let xx = x;
        for (const st of stuecke) { this.text(xx, this.y + g, st.t, { groesse: g, fett: st.fett, farbe: st.farbe || o.farbe }); xx += SuS.pdfBreite(st.t + ' ', st.fett, g); }
        this.y += zh; zeile = []; breiteZeile = 0;
      };
      for (const wort of woerter) {
        const wb = SuS.pdfBreite(wort.w, wort.fett, g), sp = zeile.length ? SuS.pdfBreite(' ', wort.fett, g) : 0;
        if (zeile.length && breiteZeile + sp + wb > breite) setze();
        zeile.push(wort); breiteZeile += (zeile.length > 1 ? sp : 0) + wb;
      }
      if (zeile.length) setze();
    }
    jpeg(bytes, breitePx, hoehePx) { this.bilder.push({ bytes, breitePx, hoehePx }); return 'Im' + this.bilder.length; }
    bild(name, x, y, w, h) { this.ops.push('q ' + zahl(w) + ' 0 0 ' + zahl(h) + ' ' + zahl(x) + ' ' + zahl(H - y - h) + ' cm /' + name + ' Do Q'); }
    pfad(ops) { this.ops.push(ops); }

    /* PDF zusammensetzen. Mit eingebetteter Schrift als PDF/A-3b (Langzeitarchiv: Schrift, Farbprofil, XMP-Metadaten,
       Dokumentkennung); anhang = {name, daten, beschreibung} bettet z. B. die ZUGFeRD-XML als „Alternative“ ein. */
    bytes(titel, anhang) {
      const latin = (s) => { const b = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i) & 0xFF; return b; };
      const ausB64 = (t) => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
      const utf16 = (t) => { let h = '<FEFF'; const s = String(t); for (let i = 0; i < s.length; i++) h += s.charCodeAt(i).toString(16).padStart(4, '0').toUpperCase(); return h + '>'; };
      const xml = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
      const teile = [], offsets = [];
      let laenge = 0, zaehler = 0;
      const neu = () => ++zaehler;
      const schreib = (b) => { teile.push(b); laenge += b.length; };
      const obj = (nr, kopf, strom) => {
        offsets[nr] = laenge;
        if (strom) { schreib(latin(nr + ' 0 obj\n' + kopf.replace('%LEN%', strom.length) + '\nstream\n')); schreib(strom); schreib(latin('\nendstream\nendobj\n')); }
        else schreib(latin(nr + ' 0 obj\n' + kopf + '\nendobj\n'));
      };
      /* Zeitstempel mit Zeitzone – Info und XMP müssen übereinstimmen */
      const j = new Date(), zw = (n) => String(n).padStart(2, '0'), off = -j.getTimezoneOffset(), vz = off >= 0 ? '+' : '-';
      const oh = zw(Math.floor(Math.abs(off) / 60)), om = zw(Math.abs(off) % 60);
      const pdfDatum = 'D:' + j.getFullYear() + zw(j.getMonth() + 1) + zw(j.getDate()) + zw(j.getHours()) + zw(j.getMinutes()) + zw(j.getSeconds()) + vz + oh + "'" + om + "'";
      const xmpDatum = j.getFullYear() + '-' + zw(j.getMonth() + 1) + '-' + zw(j.getDate()) + 'T' + zw(j.getHours()) + ':' + zw(j.getMinutes()) + ':' + zw(j.getSeconds()) + vz + oh + ':' + om;
      const A = PDFA, WER = 'Stock und Stein Buero';
      schreib(latin((A ? '%PDF-1.7' : '%PDF-1.4') + '\n%\xE2\xE3\xCF\xD3\n'));
      const katalog = neu(), seitenNr = neu(), f1 = neu(), f2 = neu();
      const sch = A ? { fd1: neu(), ff1: neu(), fd2: neu(), ff2: neu(), meta: neu(), oi: neu(), icc: neu() } : null;
      const bildNr = this.bilder.map(() => neu());
      const seiten = this.seiten.map(() => ({ seite: neu(), inhalt: neu() }));
      const anh = A && anhang ? { ef: neu(), fs: neu() } : null;
      const info = neu();
      obj(katalog, '<< /Type /Catalog /Pages ' + seitenNr + ' 0 R' + (A ? ' /Metadata ' + sch.meta + ' 0 R /OutputIntents [' + sch.oi + ' 0 R]' : '') +
        (anh ? ' /Names << /EmbeddedFiles << /Names [' + pdfText(anhang.name) + ' ' + anh.fs + ' 0 R] >> >> /AF [' + anh.fs + ' 0 R]' : '') + ' >>');
      obj(seitenNr, '<< /Type /Pages /Count ' + seiten.length + ' /Kids [' + seiten.map((x) => x.seite + ' 0 R').join(' ') + '] >>');
      if (A) {
        const schrift = (nr, fd, ff, s) => {
          obj(nr, '<< /Type /Font /Subtype /TrueType /BaseFont /' + s.name + ' /FirstChar 32 /LastChar 255 /Widths [' + s.breiten.slice(32).join(' ') + '] /Encoding /WinAnsiEncoding /FontDescriptor ' + fd + ' 0 R >>');
          obj(fd, '<< /Type /FontDescriptor /FontName /' + s.name + ' /Flags 32 /FontBBox [' + s.bbox.join(' ') + '] /ItalicAngle ' + (s.italic || 0) + ' /Ascent ' + s.ascent + ' /Descent ' + s.descent +
            ' /CapHeight ' + s.capHeight + ' /StemV ' + s.stemV + ' /FontFile2 ' + ff + ' 0 R >>');
          obj(ff, '<< /Length %LEN% /Length1 ' + s.laenge + ' /Filter /FlateDecode >>', ausB64(s.daten));
        };
        schrift(f1, sch.fd1, sch.ff1, A.reg); schrift(f2, sch.fd2, sch.ff2, A.fett);
        const fx = anh ? '<rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#"><fx:DocumentType>INVOICE</fx:DocumentType><fx:DocumentFileName>' + xml(anhang.name) +
          '</fx:DocumentFileName><fx:Version>1.0</fx:Version><fx:ConformanceLevel>' + xml(anhang.profil || 'XRECHNUNG') + '</fx:ConformanceLevel></rdf:Description>' +
          '<rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">' +
          '<pdfaExtension:schemas><rdf:Bag><rdf:li rdf:parseType="Resource"><pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>' +
          '<pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI><pdfaSchema:prefix>fx</pdfaSchema:prefix><pdfaSchema:property><rdf:Seq>' +
          [['DocumentFileName', 'Name of the embedded XML invoice file'], ['DocumentType', 'INVOICE'], ['Version', 'Version of the Factur-X XML schema'], ['ConformanceLevel', 'Conformance level of the embedded invoice']].map(([n, b]) =>
            '<rdf:li rdf:parseType="Resource"><pdfaProperty:name>' + n + '</pdfaProperty:name><pdfaProperty:valueType>Text</pdfaProperty:valueType><pdfaProperty:category>external</pdfaProperty:category><pdfaProperty:description>' + b + '</pdfaProperty:description></rdf:li>').join('') +
          '</rdf:Seq></pdfaSchema:property></rdf:li></rdf:Bag></pdfaExtension:schemas></rdf:Description>' : '';
        const xmp = '<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>\n<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">' +
          '<rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/"><pdfaid:part>3</pdfaid:part><pdfaid:conformance>B</pdfaid:conformance></rdf:Description>' +
          '<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:format>application/pdf</dc:format><dc:title><rdf:Alt><rdf:li xml:lang="x-default">' + xml(titel) + '</rdf:li></rdf:Alt></dc:title></rdf:Description>' +
          '<rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/"><xmp:CreatorTool>' + WER + '</xmp:CreatorTool><xmp:CreateDate>' + xmpDatum + '</xmp:CreateDate><xmp:ModifyDate>' + xmpDatum + '</xmp:ModifyDate></rdf:Description>' +
          '<rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/"><pdf:Producer>' + WER + '</pdf:Producer></rdf:Description>' + fx +
          '</rdf:RDF></x:xmpmeta>\n<?xpacket end="w"?>';
        obj(sch.meta, '<< /Type /Metadata /Subtype /XML /Length %LEN% >>', new TextEncoder().encode(xmp));
        obj(sch.oi, '<< /Type /OutputIntent /S /GTS_PDFA1 /OutputConditionIdentifier (sRGB IEC61966-2.1) /RegistryName (http://www.color.org) /Info (sRGB IEC61966-2.1) /DestOutputProfile ' + sch.icc + ' 0 R >>');
        obj(sch.icc, '<< /N 3 /Length %LEN% /Filter /FlateDecode >>', ausB64(A.icc.daten));
      } else {
        obj(f1, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
        obj(f2, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
      }
      const xobj = bildNr.map((nr, i) => '/Im' + (i + 1) + ' ' + nr + ' 0 R').join(' ');
      this.bilder.forEach((b, i) => obj(bildNr[i], '<< /Type /XObject /Subtype /Image /Width ' + b.breitePx + ' /Height ' + b.hoehePx +
        ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %LEN% >>', b.bytes));
      this.seiten.forEach((ops, i) => {
        obj(seiten[i].seite, '<< /Type /Page /Parent ' + seitenNr + ' 0 R /MediaBox [0 0 ' + W + ' ' + H + '] /Resources << /Font << /F1 ' + f1 + ' 0 R /F2 ' + f2 + ' 0 R >>' +
          (xobj ? ' /XObject << ' + xobj + ' >>' : '') + ' >> /Contents ' + seiten[i].inhalt + ' 0 R >>');
        obj(seiten[i].inhalt, '<< /Length %LEN% >>', latin(ops.join('\n')));
      });
      if (anh) {
        obj(anh.ef, '<< /Type /EmbeddedFile /Subtype /text#2Fxml /Params << /Size ' + anhang.daten.length + ' /ModDate (' + pdfDatum + ') >> /Length %LEN% >>', anhang.daten);
        obj(anh.fs, '<< /Type /Filespec /F ' + pdfText(anhang.name) + ' /UF ' + pdfText(anhang.name) + ' /Desc ' + pdfText(anhang.beschreibung || anhang.name) +
          ' /AFRelationship /Alternative /EF << /F ' + anh.ef + ' 0 R /UF ' + anh.ef + ' 0 R >> >>');
      }
      obj(info, '<< /Title ' + utf16(titel) + ' /Creator (' + WER + ') /Producer (' + WER + ') /CreationDate (' + pdfDatum + ') /ModDate (' + pdfDatum + ') >>');
      const kennung = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).join('').toUpperCase();
      const xref = laenge;
      let x = 'xref\n0 ' + (zaehler + 1) + '\n0000000000 65535 f \n';
      for (let i = 1; i <= zaehler; i++) x += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
      x += 'trailer\n<< /Size ' + (zaehler + 1) + ' /Root ' + katalog + ' 0 R /Info ' + info + ' 0 R /ID [<' + kennung + '> <' + kennung + '>] >>\nstartxref\n' + xref + '\n%%EOF\n';
      schreib(latin(x));
      const out = new Uint8Array(laenge);
      let p = 0;
      for (const t of teile) { out.set(t, p); p += t.length; }
      return out;
    }
  }

  /* ---------- Unterschrift: PNG (data:) → JPEG-Bytes über eine Zeichenfläche (nur im Browser) ---------- */
  function jpegAus(dataUrl) {
    return new Promise((ok) => {
      if (typeof document === 'undefined' || typeof Image === 'undefined') { ok(null); return; }
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
          const b64 = c.toDataURL('image/jpeg', 0.85).split(',')[1];
          const bin = atob(b64), bytes = new Uint8Array(bin.length);
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
          ok({ bytes, breite: c.width, hoehe: c.height });
        } catch (e) { ok(null); }
      };
      img.onerror = () => ok(null);
      img.src = dataUrl;
    });
  }

  /* ---------- Inhalt ---------- */
  const platz = (wert, ersatz) => (wert ? { text: wert } : { text: '[' + ersatz + ']', farbe: FARBE.rot });
  const cent = (c) => SuS.centText(c);

  /* zugferd: true → E-Rechnung (CII, Profil XRECHNUNG) als factur-x.xml eingebettet (nur gestellte Firmenrechnungen). */
  SuS.dokumentPdf = async (dok, variante, zugferd) => {
    variante = variante || '';
    const hilfe = SuS.druckHilfe, f = SuS.firmaVon(dok), k = SuS.kundeVon(dok), s = SuS.summen(dok);
    const d = new Dokument();
    const erinnerung = variante === 'erinnerung' || variante === 'mahnung';
    const titelBasis = hilfe.titelVon(dok, variante);
    let titel = titelBasis + (['auftrag', 'erinnerung', 'mahnung'].includes(variante) ? '' : ' ' + (dok.nummer || ''));
    if (!variante && SuS.istRechnung(dok) && !dok.fest) titel = 'ENTWURF – ' + titel;

    /* Briefkopf (nur Seite 1): Zeichen als Vektor, Name, Zusatz */
    /* Rechtsbündig am Satzspiegel: Breite aus Name/Zusatz (Fund Bewertung: Name ragte über den rechten Rand). */
    const zusatzGross = String(f.zusatz || '').toUpperCase();
    let nameGr = 17;
    while (nameGr > 11 && SuS.pdfBreite(f.name, true, nameGr) > 70 * MM) nameGr -= 0.5;
    const markeB = 18 * MM + Math.max(SuS.pdfBreite(f.name, true, nameGr), SuS.pdfBreite(zusatzGross, false, 7.6));
    const lx = W - RAND_R - markeB, ly = OBEN + 2 * MM, sk = 15 * MM / 64;
    const P = (x, y) => zahl(lx + x * sk) + ' ' + zahl(H - (ly + y * sk));
    d.pfad('0.541 0.506 0.471 rg ' + P(4, 56) + ' ' + zahl(46 * sk) + ' ' + zahl(16 * sk) + ' re f');
    d.pfad('0.31 0.42 0.227 rg ' + P(4, 43) + ' m ' + P(50, 43) + ' l ' + P(50, 40) + ' l ' + P(4, 40) + ' l f');
    d.pfad(zahl(4 * sk) + ' w 1 J 0.37 0.353 0.333 RG ' + P(14, 38) + ' m ' + P(52, 8) + ' l ' + P(36, 21) + ' m ' + P(52, 24) + ' l ' + P(26, 29) + ' m ' + P(28, 15) + ' l S 0 J');
    d.text(lx + 18 * MM, ly + 8 * MM, f.name, { groesse: nameGr, fett: true, farbe: FARBE.moos });
    d.text(lx + 18 * MM, ly + 12.5 * MM, zusatzGross, { groesse: 7.6, farbe: FARBE.grau });

    /* Absender, Anschrift, Infoblock */
    const absender = [f.name, f.strasse, ((f.plz || '') + ' ' + (f.ort || '')).trim()].filter(Boolean).join(' · ');
    const yA = 45 * MM;
    d.text(RAND_L, yA, absender, { groesse: 6.8, farbe: FARBE.grau });
    d.linie(RAND_L, yA + 1.5 * MM, RAND_L + 85 * MM, yA + 1.5 * MM, 0.5, [0.54, 0.51, 0.47]);
    const anschrift = k ? [k.name, k.art === 'firma' && k.ansprechpartner ? 'z. Hd. ' + k.ansprechpartner : '', k.strasse, ((k.plz || '') + ' ' + (k.ort || '')).trim()].filter(Boolean) : ['[Kunde wählen]'];
    anschrift.forEach((z, i) => d.text(RAND_L, yA + 7 * MM + i * 4.6 * MM, z, { groesse: 10, farbe: k ? FARBE.text : FARBE.rot }));
    const info = [];
    const m = (dok.mahnungen || []).slice(-1)[0];
    if (erinnerung) info.push(['Datum', SuS.datum(variante === 'mahnung' && m ? m.datum : SuS.heute())], ['Rechnung Nr.', dok.nummer], ['Rechnung vom', SuS.datum(dok.datum)]);
    else {
      info.push(['Datum', SuS.datum(variante === 'auftrag' ? SuS.heute() : dok.datum)]);
      info.push([variante === 'auftrag' ? 'zum Angebot' : dok.typ === 'angebot' ? 'Angebot Nr.' : 'Rechnung Nr.', dok.nummer || '[beim Stellen]']);
    }
    if (k && k.nr) info.push(['Kunden-Nr.', k.nr]);
    if (SuS.istRechnung(dok) && !erinnerung) {
      const von = dok.leistungVon, bis = dok.leistungBis;
      info.push([bis && bis !== von ? 'Leistungszeitraum' : 'Leistungsdatum', von ? SuS.datum(von) + (bis && bis !== von ? ' – ' + SuS.datum(bis) : '') : '[fehlt]']);
    }
    if (dok.typ === 'angebot' && !variante) info.push(['Gültig bis', SuS.datum(SuS.plusTage(dok.datum, dok.gueltigTage || f.gueltigTage))]);
    if (f.inhaber) info.push(['Ansprechpartner', f.inhaber]);
    if (f.telefon) info.push(['Telefon', f.telefon]);
    const ix = RAND_L + 102 * MM, ir = W - RAND_R;
    info.forEach(([a, b], i) => {
      const y = yA + i * 4.4 * MM;
      d.text(ix, y, a, { groesse: 8.6, farbe: FARBE.grau });
      d.text(ir, y, b, { groesse: 8.6, fett: true, rechts: true, farbe: /^\[/.test(b) ? FARBE.rot : FARBE.text });
    });
    d.y = Math.max(yA + 34 * MM, yA + info.length * 4.4 * MM + 8 * MM);

    /* Titel, Betreff, Bauvorhaben, Anrede, Einleitung */
    d.text(RAND_L, d.y + 6 * MM, titel, { groesse: 16, fett: true }); d.y += 10 * MM;
    if (dok.betreff) { d.absatz(RAND_L, BREITE, [{ text: dok.betreff, fett: true }], {}); }
    if (dok.baustelle) { d.absatz(RAND_L, BREITE, [{ text: 'Bauvorhaben: ' + dok.baustelle }], { farbe: FARBE.grau }); }
    d.y += 3 * MM;
    d.absatz(RAND_L, BREITE, [{ text: hilfe.anrede(k) }], {}); d.y += 1.5 * MM;

    if (erinnerung) {
      const e = hilfe.erinnerung(dok, s, variante);
      d.absatz(RAND_L, BREITE, [{ text: e.einleitung }], {}); d.y += 3 * MM;
      summen(d, e.zeilen.map(([a, b]) => [a, b, '']).concat([['Bitte überweisen', e.gesamt, 'ges']]), 100 * MM);
      d.y += 3 * MM; d.absatz(RAND_L, BREITE, [{ text: e.schluss }], {});
    } else {
      const einl = (dok.einleitung || '').trim() || hilfe.einleitung(dok, variante, k);
      if (einl) { d.absatz(RAND_L, BREITE, [{ text: einl }], {}); d.y += 2 * MM; }
      positionen(d, dok);
      d.y += 2 * MM;
      summen(d, summenZeilen(dok, s), 82 * MM);
      for (const [i, h] of hilfe.hinweise(dok, s, k, variante).entries()) kasten(d, h, i === 0 ? FARBE.moos : [0.54, 0.51, 0.47], i === 0 ? FARBE.moosHell : FARBE.grauHell);
      const schl = (dok.schluss || '').trim() || hilfe.schluss(dok, variante);
      if (schl) { d.y += 4 * MM; d.absatz(RAND_L, BREITE, [{ text: schl }], {}); }
    }
    giroCode(d, dok, s, f, variante);
    d.platz(18 * MM);
    d.y += 6 * MM;
    d.absatz(RAND_L, BREITE, [{ text: 'Mit freundlichen Grüßen' }], {}); d.y += 3 * MM;
    d.absatz(RAND_L, BREITE, [{ text: f.inhaber || f.name }], {});
    if (dok.typ === 'angebot' && dok.unterschrift) {
      d.platz(32 * MM); d.y += 5 * MM;
      d.absatz(RAND_L, BREITE, [{ text: 'Auftrag erteilt ', fett: true }, { text: 'am ' + SuS.datum(dok.unterschrift.datum) + ' durch ' + dok.unterschrift.name + ':' }], {});
      const j = await jpegAus(dok.unterschrift.bild);
      if (j) { const name = d.jpeg(j.bytes, j.breite, j.hoehe), h = 18 * MM, w = h * j.breite / j.hoehe; d.bild(name, RAND_L, d.y + 1 * MM, Math.min(w, 80 * MM), h); d.y += h + 2 * MM; }
      else d.absatz(RAND_L, BREITE, [{ text: '(digital unterschrieben)' }], { farbe: FARBE.grau });
    }

    /* Fußzeile und Seitenzahl auf jeder Seite */
    const ort = (f.plz || f.ort) ? ((f.plz || '') + ' ' + (f.ort || '')).trim() : '';
    const spalten = [
      [{ text: f.name, fett: true }, f.zusatz ? { text: f.zusatz } : null, f.inhaber ? { text: 'Inhaber: ' + f.inhaber } : null, platz(f.strasse, 'Straße Nr.'), platz(ort, 'PLZ Ort')],
      [platz(f.telefon ? 'Tel. ' + f.telefon : '', 'Telefon'), platz(f.email, 'E-Mail'), f.web ? { text: f.web } : null],
      [f.bank ? { text: f.bank } : null, f.iban ? { text: 'IBAN ' + f.iban } : { text: 'IBAN [IBAN]', farbe: FARBE.rot }, f.bic ? { text: 'BIC ' + f.bic } : null,
        f.ustid ? { text: 'USt-IdNr. ' + f.ustid } : f.steuernummer ? { text: 'Steuernr. ' + f.steuernummer } : { text: '[Steuernummer]', farbe: FARBE.rot },
        f.ustid && f.steuernummer ? { text: 'Steuernr. ' + f.steuernummer } : null]
    ];
    const n = d.seiten.length;
    d.seiten.forEach((ops, i) => {
      d.ops = ops;
      const y0 = H - UNTEN + 6 * MM;
      d.linie(RAND_L, y0 - 3 * MM, W - RAND_R, y0 - 3 * MM, 0.6, [0.54, 0.51, 0.47]);
      const xs = [RAND_L, RAND_L + 58 * MM, RAND_L + 108 * MM];
      spalten.forEach((sp, j) => sp.filter(Boolean).forEach((z, r) => d.text(xs[j], y0 + r * 3.3 * MM, z.text, { groesse: 7.2, fett: !!z.fett, farbe: z.farbe || FARBE.grau })));
      if (n > 1) d.text(W - RAND_R, y0 + 16 * MM, 'Seite ' + (i + 1) + ' von ' + n, { groesse: 7.2, rechts: true, farbe: FARBE.grau });
    });
    if (zugferd) {
      if (!PDFA) throw new Error('ZUGFeRD braucht die eingebettete Schrift (pdfa-daten.js).');
      return d.bytes(titel + ' – ' + f.name, { name: 'factur-x.xml', daten: new TextEncoder().encode(SuS.zugferdXml(dok)), beschreibung: 'E-Rechnung (ZUGFeRD/Factur-X, Profil XRECHNUNG)', profil: 'XRECHNUNG' });  // DocumentType bleibt INVOICE, auch bei Gutschrift (ZUGFeRD-Regel, mit Mustang geprüft)
    }
    return d.bytes(titel + ' – ' + f.name);
  };

  function kasten(d, h, balken, hinter) {
    const g = 8.6, zh = g * 1.42, breite = BREITE - 7 * MM;
    const zeilen = SuS.pdfUmbruch((h.fett || '') + h.text, breite, false, g).length;
    const hoehe = zeilen * zh + 4 * MM;
    d.platz(hoehe + 3 * MM);
    d.y += 3 * MM;
    d.rechteck(RAND_L, d.y, BREITE, hoehe, hinter);
    d.rechteck(RAND_L, d.y, 0.9 * MM, hoehe, balken);
    const y = d.y; d.y += 2 * MM;
    d.absatz(RAND_L + 3.5 * MM, breite, [{ text: h.fett, fett: true }, { text: h.text }], { groesse: g });
    d.y = y + hoehe;
  }

  function summenZeilen(dok, s) {
    const z = [];
    if (s.rabatt) { z.push(['Zwischensumme', cent(s.zwischen) + ' €', '']); z.push(['abzüglich ' + SuS.zahl(s.rabattProzent, 2) + ' % Nachlass', '−' + cent(s.rabatt) + ' €', '']); }
    if (s.modus === 'regel') { z.push(['Nettobetrag', cent(s.netto) + ' €', '']); z.push(['zzgl. ' + SuS.zahl(s.satz, 1) + ' % Umsatzsteuer', cent(s.mwst) + ' €', '']); }
    if (s.modus === '13b') { z.push(['Nettobetrag', cent(s.netto) + ' €', '']); z.push(['Umsatzsteuer 0 % (§ 13b UStG)', cent(0) + ' €', '']); }
    z.push([s.modus === 'regel' ? 'Gesamtbetrag' : dok.typ === 'angebot' ? 'Angebotssumme' : 'Rechnungsbetrag', SuS.euro(s.brutto), 'ges']);
    for (const a of s.abzuege) {
      const plus = a.brutto < 0;
      z.push([(plus ? 'Rücknahme Abzug ' : 'abzgl. bezahlter Abschlag ') + a.nummer + ' vom ' + SuS.datum(a.datum), (plus ? '+' + cent(-a.brutto) : '−' + cent(a.brutto)) + ' €', '']);
      /* § 14 Abs. 5 UStG: Steueranteil der vereinnahmten Teilentgelte ausweisen (Fund Codex) */
      if (s.modus === 'regel') z.push(['   davon netto ' + cent(Math.abs(a.netto)) + ' € + USt ' + cent(Math.abs(a.mwst)) + ' €', '', 'klein']);
    }
    if (s.abzuege.length) z.push([dok.typ === 'storno' ? 'Storno gesamt' : 'Noch zu zahlen', SuS.euro(s.zahlbetrag), 'zahl']);
    return z;
  }

  function summen(d, zeilen, breite) {
    const x = W - RAND_R - breite, r = W - RAND_R;
    const fett = (stil) => stil === 'ges' || stil === 'zahl';
    const groesse = (stil) => (stil === 'klein' ? 8 : fett(stil) ? 10.6 : 9.4);
    /* Gesamthöhe vorab genau berechnen – der Block bleibt zusammen (Fund Codex) */
    const umbruch = (a, b, stil) => SuS.pdfUmbruch(a, breite - SuS.pdfBreite(b, fett(stil), groesse(stil)) - 4 * MM, fett(stil), groesse(stil));
    const hoehe = zeilen.reduce((h, [a, b, stil]) => h + 5 * MM + (umbruch(a, b, stil).length - 1) * 4 * MM + (fett(stil) ? 2.6 * MM : 0), 0);
    d.platz(hoehe + 4 * MM);
    for (const [a, b, stil] of zeilen) {
      const g = groesse(stil);
      if (stil === 'ges') { d.linie(x, d.y + 0.8 * MM, r, d.y + 0.8 * MM, 1.1, FARBE.text); d.y += 1.6 * MM; }
      if (stil === 'zahl') d.rechteck(x - 2 * MM, d.y + 0.6 * MM, breite + 2 * MM, 6.4 * MM, FARBE.sand);
      const zeilenA = umbruch(a, b, stil), farbe = stil === 'klein' ? FARBE.grau : FARBE.text;
      zeilenA.forEach((t, i) => d.text(x, d.y + 4.4 * MM + i * 4 * MM, t, { groesse: g, fett: fett(stil), farbe }));
      if (b) d.text(r, d.y + 4.4 * MM, b, { groesse: g, fett: fett(stil), rechts: true });
      d.y += (stil === 'klein' ? 4 * MM : 5 * MM) + (zeilenA.length - 1) * 4 * MM + (fett(stil) ? 1 * MM : 0);
    }
  }

  function positionen(d, dok) {
    const cols = { pos: RAND_L, text: RAND_L + 10 * MM, menge: RAND_L + 117 * MM, einh: RAND_L + 119 * MM, ep: RAND_L + 147 * MM, gp: W - RAND_R };
    const textBreite = cols.menge - cols.text - 18 * MM;
    const kopf = () => {
      const y = d.y + 4 * MM, o = { groesse: 7.4, fett: true, farbe: FARBE.grau };
      d.text(cols.pos, y, 'POS.', o); d.text(cols.text, y, 'LEISTUNG', o); d.text(cols.menge, y, 'MENGE', Object.assign({ rechts: true }, o));
      d.text(cols.einh, y, 'EINH.', o); d.text(cols.ep, y, 'EP €', Object.assign({ rechts: true }, o)); d.text(cols.gp, y, 'GP €', Object.assign({ rechts: true }, o));
      d.linie(RAND_L, d.y + 5.6 * MM, W - RAND_R, d.y + 5.6 * MM, 0.9, FARBE.text);
      d.y += 7 * MM;
    };
    d.platz(20 * MM); kopf();
    d.beiNeuerSeite = kopf;
    const nrn = SuS.nummeriere(dok.positionen);
    let summeTitel = null, titelName = '', titelNr = '';
    const titelEnde = () => {
      if (summeTitel == null) return;
      d.platz(7 * MM);
      d.text(cols.text, d.y + 4.4 * MM, 'Summe ' + titelNr + ' ' + titelName, { groesse: 9.2, fett: true });
      d.text(cols.gp, d.y + 4.4 * MM, cent(summeTitel), { groesse: 9.2, fett: true, rechts: true });
      d.linie(RAND_L, d.y + 6.4 * MM, W - RAND_R, d.y + 6.4 * MM, 0.8, [0.81, 0.78, 0.72]);
      d.y += 7.4 * MM; summeTitel = null;
    };
    dok.positionen.forEach((p, i) => {
      if (p.typ === 'titel') {
        titelEnde(); summeTitel = 0; titelName = p.text; titelNr = nrn[i];
        d.platz(12 * MM);
        d.rechteck(RAND_L, d.y + 0.6 * MM, BREITE, 6.6 * MM, FARBE.sand);
        d.text(cols.pos, d.y + 5 * MM, nrn[i], { groesse: 9.4, fett: true }); d.text(cols.text, d.y + 5 * MM, p.text, { groesse: 9.4, fett: true });
        d.y += 8 * MM; return;
      }
      if (p.typ === 'text') { d.absatz(cols.text, BREITE - 10 * MM, [{ text: p.text }], { groesse: 8.8, farbe: FARBE.grau }); d.y += 1 * MM; return; }
      const gp = SuS.posBetrag(p);
      if (!p.bedarf && summeTitel != null) summeTitel += gp;
      const zeilenT = SuS.pdfUmbruch(p.text, textBreite, true, 9.2);
      const besch = [p.beschreibung, p.bedarf ? 'Bedarfsposition – nur Einheitspreis, nicht in der Summe enthalten' : ''].filter(Boolean).join('\n');
      const zeilenB = besch ? SuS.pdfUmbruch(besch, textBreite, false, 8) : [];
      const hoehe = zeilenT.length * 4.2 * MM + zeilenB.length * 3.5 * MM + 3 * MM;
      const farbe = p.bedarf ? FARBE.grau : FARBE.text;
      /* Kopfzeile der Position mit Beträgen; sehr lange Positionen laufen zeilenweise auf der nächsten Seite weiter (Fund Codex) */
      d.platz(Math.min(hoehe, 4.2 * MM * zeilenT.length + 3 * MM));
      const y = d.y + 4.2 * MM;
      d.text(cols.pos, y, nrn[i], { groesse: 9, farbe });
      d.text(cols.menge, y, SuS.zahl(p.menge, 3), { groesse: 9, rechts: true, farbe });
      d.text(cols.einh, y, p.einheit || '', { groesse: 9, farbe });
      d.text(cols.ep, y, cent(p.preis), { groesse: 9, rechts: true, farbe });
      d.text(cols.gp, y, p.bedarf ? '(' + cent(gp) + ')' : cent(gp), { groesse: 9, rechts: true, farbe });
      zeilenT.forEach((t) => { d.platz(4.2 * MM); d.text(cols.text, d.y + 4.2 * MM, t, { groesse: 9.2, fett: true, farbe }); d.y += 4.2 * MM; });
      zeilenB.forEach((t) => { d.platz(3.5 * MM); d.text(cols.text, d.y + 2.9 * MM, t, { groesse: 8, farbe: FARBE.grau }); d.y += 3.5 * MM; });
      d.y += 3 * MM;
      d.linie(RAND_L, d.y - 0.8 * MM, W - RAND_R, d.y - 0.8 * MM, 0.4, FARBE.linie);
    });
    titelEnde();
    d.beiNeuerSeite = null;
  }

  function giroCode(d, dok, s, f, variante) {
    if (!SuS.istRechnung(dok) || dok.typ === 'storno' || dok.status === 'storniert' || dok.status === 'bezahlt' || !SuS.giroCode) return;
    const betrag = dok.fest ? SuS.offenerBetrag(dok) : s.zahlbetrag;
    const code = SuS.giroCode(f.name, f.iban, f.bic, betrag, (dok.nummer ? 'Rechnung ' + dok.nummer : 'Rechnung') + ' ' + f.name);
    if (!code) return;
    let mx;
    try { mx = SuS.qrMatrix(code); } catch (e) { return; }
    const groesse = 24 * MM, modul = groesse / (mx.length + 8);
    d.platz(groesse + 6 * MM);
    d.y += 4 * MM;
    const x0 = RAND_L, y0 = d.y;
    let ops = '0 0 0 rg';
    mx.forEach((zeile, y) => zeile.forEach((dunkel, x) => {
      if (dunkel) ops += ' ' + zahl(x0 + (x + 4) * modul) + ' ' + zahl(H - (y0 + (y + 5) * modul)) + ' ' + zahl(modul + 0.01) + ' ' + zahl(modul + 0.01) + ' re';
    }));
    d.pfad(ops + ' f');
    const yText = d.y; d.y += 7 * MM;
    d.absatz(x0 + groesse + 4 * MM, BREITE - groesse - 4 * MM, [{ text: 'Bequem bezahlen: ', fett: true },
      { text: 'Code mit der Banking-App scannen (GiroCode). Empfänger, IBAN, Betrag ' + SuS.euro(betrag) + ' und Verwendungszweck sind schon ausgefüllt.' }], { groesse: 8.6 });
    d.y = Math.max(d.y, yText + groesse);
  }

  SuS.pdfDateiname = (dok, variante) => {
    const art = SuS.druckHilfe.titelVon(dok, variante);
    return (art + ' ' + (dok.nummer || 'Entwurf')).replace(/[^\wäöüÄÖÜß.\- ]+/g, '').replace(/\s+/g, '-') + '.pdf';
  };
})();
