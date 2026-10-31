/* Stock und Stein – Belege automatisch erfassen (Auftrag Simon 25.10.2026): Foto → Bild verbessern (Drehung, Zuschnitt,
   Kontrast) → Texterkennung AUF DEM GERÄT (Tesseract.js, deutsche Sprachdaten, alles aus dem Ordner ocr/, kein Netz) →
   Vorschläge für Datum, Lieferant, Brutto, MwSt-Satz/-Betrag, Netto und Kategorie. Vorschläge sind gelb markiert; ein Tipp
   auf das Feld bestätigt. Die zuletzt bestätigte Kategorie je Lieferant wird gemerkt. Das Foto wird verkleinert gespeichert. */
'use strict';

(function () {
  /* ---------------- Text auswerten (reine Funktionen, auch in Node testbar) ---------------- */
  const KETTEN = [
    ['BAUHAUS', /bauhaus/i, 'material'], ['OBI', /\bobi\b/i, 'material'], ['Hornbach', /hornbach/i, 'material'],
    ['toom Baumarkt', /\btoom\b/i, 'material'], ['hagebaumarkt', /hagebau/i, 'material'], ['Hellweg', /hellweg/i, 'material'],
    ['Globus Baumarkt', /globus/i, 'material'], ['Bauking', /bauking/i, 'material'], ['Raiffeisen', /raiffeisen/i, 'material'],
    ['Würth', /w[uü]rth/i, 'werkzeug'], ['Aral', /\baral\b/i, 'fahrzeug'], ['Shell', /\bshell\b/i, 'fahrzeug'], ['Esso', /\besso\b/i, 'fahrzeug'],
    ['TotalEnergies', /total\s?energies/i, 'fahrzeug'], ['JET', /\bjet\b/i, 'fahrzeug'], ['AVIA', /\bavia\b/i, 'fahrzeug'],
    ['ENI', /\beni\b|\bagip\b/i, 'fahrzeug'], ['HEM', /\bhem\b/i, 'fahrzeug'], ['Westfalen', /westfalen\s*tank|tankstelle\s*westfalen/i, 'fahrzeug'],
    ['Remondis', /remondis/i, 'entsorgung'], ['ALBA', /\balba\b/i, 'entsorgung']
  ];
  const WORTE = {
    fahrzeug: /diesel|super\s?(e5|e10|plus)?|\be10\b|benzin|kraftstoff|zapfs|tankstelle|adblue|\bltr\b|liter|\bl\s*x\s*\d/i,
    entsorgung: /deponie|entsorg|gr[uü]nschnitt|bauschutt|wertstoff|recycling|kompost|annahme|abfall|erdaushub|container|kippe/i,
    werkzeug: /werkzeug|bohrer|s[aä]ge|akku|schrauber|\bbits?\b|spaten|schaufel|hammer|zange|makita|hilti|metabo|einhell|handschuh|cuttermesser|wasserwaage/i,
    material: /splitt|\bkies|\bsand\b|pflaster|beton|zement|m[oö]rtel|\berde\b|mulch|rasen|\bholz|schotter|stein|platte|kantenst|vlies|saatgut|d[uü]nger|pflanz|baustoff|fugen|sack|palette/i
  };
  const SUMME = [
    [/zu\s*zahlen|zahlbetrag|endbetrag|gesamtbetrag|rechnungsbetrag|bruttobetrag|gesamt\s*brutto|endsumme|gutschriftsbetrag/i, 5], [/\bsumme\b|\bgesamt\b|\btotal\b/i, 4], [/\bbetrag\b/i, 3],
    [/ec[- ]?karte|girocard|kartenzahlung|maestro|visa|mastercard|\bbar\b|\bkarte\b/i, 2]
  ];
  const KEIN_BRUTTO = /netto|mwst|ust|steuer|r[uü]ckgeld|gegeben|wechselgeld|rabatt|pfand|\bnr\b|tel/i;

  /* Beträge einer Zeile in Cent: 12,34 · 1.234,56 · 12.34 (OCR-Fehler: Leerzeichen um das Komma) */
  const BETRAG = /(-\s?)?(\d{1,3}(?:\.\d{3})+|\d{1,6})\s?[,.]\s?(\d{2})(?![\d%])(\s?-(?!\d))?/g;
  const betraegeVz = (z) => [...z.matchAll(BETRAG)].map((m) => (m[1] || m[4] ? -1 : 1) * (Number(m[2].replace(/\./g, '')) * 100 + Number(m[3])));
  const betraege = (z) => betraegeVz(z).map(Math.abs);  // Beträge ohne Vorzeichen (Vorzeichen wertet belegLesen aus)
  /* Gutschrift nur als eigene Überschrift-Zeile (nicht „Rückgabe nur mit Kassenbon“) – Fund Codex R2 */
  const GUTSCHRIFT = /^\W*(gutschrift|r[uü]ckgabe|retoure|storno|erstattung)(beleg|bon)?\W*(nr\.?\s*\d+)?\W*$/i;
  const isoHeute = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  /* OCR-Verwechslungen bei Ziffern im Datum (9/8 statt 0, O/o statt 0, l/I statt 1) */
  const ziffern = (t) => t.replace(/[Oo]/g, '0').replace(/[lI|]/g, '1');
  function datumKandidaten(z, min, max) {
    const aus = [];
    const pruefe = (tt, mm, jj) => {
      const varianten = (x) => [x, x.replace(/^9/, '0'), x.replace(/^8/, '0')];
      const jahre = jj.length === 2 ? ['20' + jj] : [jj, jj.slice(0, 1) + '0' + jj.slice(2), '20' + jj.slice(2)];
      for (const t of varianten(tt)) for (const m of varianten(mm)) for (const j of jahre) {
        const T = Number(t), M = Number(m), J = Number(j);
        if (M < 1 || M > 12 || T < 1 || T > 31) continue;
        const iso = J + '-' + String(M).padStart(2, '0') + '-' + String(T).padStart(2, '0'), d = new Date(iso + 'T12:00:00Z');
        if (!isNaN(d) && d.getUTCDate() === T && iso >= min && iso <= max) return iso;
      }
      return '';
    };
    const zz = ziffern(z);
    for (const m of zz.matchAll(/(?<!\d)(\d{1,2})\s*[.,\-/]\s*(\d{1,2})\s*[.,\-/]\s*(\d{4}|\d{2})(?!\d)/g)) { const iso = pruefe(m[1], m[2], m[3]); if (iso) aus.push(iso); }
    for (const m of zz.matchAll(/(?<!\d)(\d{1,2})\s+(\d{1,2})\s*[.\-/]\s*(\d{4})(?!\d)/g)) { const iso = pruefe(m[1], m[2], m[3]); if (iso) aus.push(iso); }
    const iso = /(?<!\d)(20\d{2})-(\d{2})-(\d{2})(?!\d)/.exec(zz);
    if (iso && iso[0] >= min && iso[0] <= max) aus.push(iso[0]);
    return aus;
  }
  function datumFinden(zeilen, heute) {
    const h = heute || isoHeute(), min = String(Number(h.slice(0, 4)) - 3) + h.slice(4);
    const max = new Date(new Date(h + 'T12:00:00Z').getTime() + 2 * 86400000).toISOString().slice(0, 10);
    /* zuerst beim Rechnungs-/Belegdatum (Eingangsrechnungen nennen oft auch Liefer- und Fälligkeitsdatum), dann bei
       „Datum“ (auch über zwei Zeilen verteilt), dann überall */
    for (let i = 0; i < zeilen.length; i++) if (/(rechnungs|beleg|gutschrifts)-?\s?datum|datum\s+der\s+rechnung/i.test(zeilen[i])) {
      const k = datumKandidaten(zeilen[i] + ' ' + (zeilen[i + 1] || ''), min, max);
      if (k.length) return k[0];
    }
    for (let i = 0; i < zeilen.length; i++) if (/dat(um|e)/i.test(zeilen[i]) && !/(liefer|leistungs|f[aä]llig)/i.test(zeilen[i])) {
      const k = datumKandidaten(zeilen[i] + ' ' + (zeilen[i + 1] || ''), min, max);
      if (k.length) return k[0];
    }
    for (let i = 0; i < zeilen.length; i++) { const k = datumKandidaten(zeilen[i], min, max); if (k.length) return k[0]; }
    for (let i = 0; i + 1 < zeilen.length; i++) { const k = datumKandidaten(zeilen[i] + ' ' + zeilen[i + 1], min, max); if (k.length) return k[0]; }
    return '';
  }

  /* Prüfsumme: gibt es Netto + MwSt = Brutto (19 % oder 7 %)? */
  function pruefsumme(B, alle) {
    for (const s of [19, 7]) {
      const m = Math.round(B * s / (100 + s));
      if (alle.some((x) => Math.abs(x - m) <= 1) && alle.some((x) => Math.abs(x - (B - m)) <= 1)) return { satz: s, steuer: alle.find((x) => Math.abs(x - m) <= 1) };
    }
    return null;
  }
  /* Gemischte Sätze: Teilbeträge b1 (7 %) + b2 (19 %) = B, beide Steuerbeträge auf dem Beleg */
  function gemischtFinden(B, alle) {
    for (const b1 of alle) {
      const b2 = B - b1;
      if (b1 <= 0 || b2 <= 0 || !alle.some((x) => Math.abs(x - b2) <= 1)) continue;
      const m1 = Math.round(b1 * 7 / 107), m2 = Math.round(b2 * 19 / 119);
      if (alle.some((x) => Math.abs(x - m1) <= 1) && alle.some((x) => Math.abs(x - m2) <= 1)) return m1 + m2;
    }
    return null;
  }

  function bruttoFinden(zeilen) {
    const alle = zeilen.flatMap(betraege), haeufig = new Map();
    for (const x of alle) haeufig.set(x, (haeufig.get(x) || 0) + 1);
    const punkte = new Map();
    const plus = (x, p) => punkte.set(x, (punkte.get(x) || 0) + p);
    zeilen.forEach((z, i) => {
      const treffer = SUMME.find(([re]) => re.test(z));
      if (!treffer || (/netto|mwst\b|steuer/i.test(z) && !/zu\s*zahlen|gesamt|summe/i.test(z)) || /r[uü]ckgeld|gegeben|wechselgeld/i.test(z)) return;
      const nah = betraege(z).concat(zeilen[i + 1] && !KEIN_BRUTTO.test(zeilen[i + 1]) ? betraege(zeilen[i + 1]) : [], zeilen[i + 2] && !KEIN_BRUTTO.test(zeilen[i + 2]) ? betraege(zeilen[i + 2]) : []);
      nah.forEach((x, k) => plus(x, treffer[1] * 10 - k));
    });
    const max = alle.length ? Math.max(...alle) : 0;
    for (const x of new Set(alle)) {
      if (x <= 0) continue;
      plus(x, (haeufig.get(x) - 1) * 6 + (x === max ? 3 : 0));
      if (pruefsumme(x, alle) || gemischtFinden(x, alle) != null) plus(x, 25);
    }
    let best = null;
    for (const [x, p] of punkte) if (!best || p > best.p || (p === best.p && x > best.x)) best = { x, p };
    return best ? { wert: best.x, sicher: best.p >= 30, alle } : { wert: 0, sicher: false, alle };
  }

  /* Steuerzeilen strukturiert: je Zeile mit „x %“ den Satz und den dazu passenden Steuerbetrag (passt zu einem Netto- oder
     Bruttobetrag derselben Zeile). Ergebnis je Satz der erste Treffer. */
  function steuerZeilenLesen(zeilen, brutto) {
    const reihen = [];
    zeilen.forEach((z, i) => {
      const m = /(?:^|[^\d,.])(19|7|0)\s?(?:[,.]\s?0{1,2})?\s?%/.exec(z);
      if (!m) return;
      const r = Number(m[1]), rest = z.slice(m.index + m[0].length);
      let b = betraege(rest);
      if (b.length < 2 && zeilen[i + 1] && !/%/.test(zeilen[i + 1])) b = b.concat(betraege(zeilen[i + 1]));
      if (r === 0) { reihen.push({ r, st: 0, br: b.length ? Math.max(...b) : 0 }); return; }
      const st = b.find((x) => b.some((y) => y !== x && (Math.abs(x - Math.round(y * r / 100)) <= 1 || Math.abs(x - Math.round(y * r / (100 + r))) <= 1)));
      if (st != null) reihen.push({ r, st, br: Math.max(...b) });
    });
    /* Mehrere Zeilen desselben Satzes summieren, wenn die Zeilen zusammen den Gesamtbetrag ergeben (Fund Codex R3);
       sonst je Satz nur die erste Zeile (z. B. eine wiederholte Steuerangabe unter der Tabelle) */
    const summe = (liste) => liste.reduce((s2, x) => s2 + x.br, 0);
    const erste = reihen.filter((x, i) => reihen.findIndex((y) => y.r === x.r) === i);
    const gewaehlt = brutto && reihen.length > erste.length && Math.abs(summe(reihen) - brutto) <= 2 * reihen.length ? reihen : erste;
    const saetze = new Map();
    for (const x of gewaehlt) saetze.set(x.r, (saetze.get(x.r) || 0) + x.st);
    return saetze;
  }

  const hat19Text = (text) => /\b19\s?[,.]?\s?0{0,2}\s?%|%\s?19\b|mwst\.?\s*19|ust\.?\s*19/i.test(text);
  const hat7Text = (text) => /(^|[^\d,.])7\s?[,.]?\s?0{0,2}\s?%|mwst\.?\s*7\b|ust\.?\s*7\b/im.test(text);
  function steuerFinden(zeilen, brutto, alle) {
    const text = zeilen.join('\n');
    const zeilenSaetze = steuerZeilenLesen(zeilen, brutto);
    const steuerfrei = /steuerfrei|ohne\s+(mwst|ust)|ust\.?-?frei|§\s?19|kleinunternehmer|§\s?4\s?nr/i.test(text);
    const echte = [...zeilenSaetze.keys()].filter((r) => r > 0);
    const steuerHinweis = /mwst|ust\b|umsatzst|netto|vorsteuer|steuer/i.test(text) || zeilenSaetze.size > 0;
    /* Ohne jeden Steuerhinweis wird keine Vorsteuer abgeleitet – auch nicht über eine zufällige Prüfsumme (Fund Codex R2) */
    if (!steuerHinweis && !hat19Text(text) && !hat7Text(text)) return { satz: 0, steuer: 0, gefunden: false, satzGefunden: false, gemischt: false, keinAusweis: true };
    if (zeilenSaetze.size >= 2 && echte.length >= 1) {  // gemischte Sätze laut Steuerzeilen, auch 0 % + 19 % (Funde Codex R1/R2)
      return { satz: 19, steuer: echte.reduce((s2, r) => s2 + zeilenSaetze.get(r), 0), gefunden: true, satzGefunden: true, gemischt: true };
    }
    if (!echte.length && (zeilenSaetze.has(0) || steuerfrei)) return { satz: 0, steuer: 0, gefunden: true, satzGefunden: true, gemischt: false };
    if (echte.length === 1) {
      const r = echte[0], st = zeilenSaetze.get(r);
      if (!brutto || Math.abs(st - Math.round(brutto * r / (100 + r))) <= 1) return { satz: r, steuer: st, gefunden: true, satzGefunden: true, gemischt: false };
    }
    const hat19 = /\b19\s?[,.]?\s?0{0,2}\s?%|%\s?19\b|mwst\.?\s*19|ust\.?\s*19/i.test(text);
    const hat7 = /(^|[^\d,.])7\s?[,.]?\s?0{0,2}\s?%|mwst\.?\s*7\b|ust\.?\s*7\b/im.test(text);
    const g = brutto ? gemischtFinden(brutto, alle) : null;
    if (g != null && (hat7 || !pruefsumme(brutto, alle))) return { satz: 19, steuer: g, gefunden: true, satzGefunden: true, gemischt: true };
    const p = brutto ? pruefsumme(brutto, alle) : null;
    if (p) return { satz: p.satz, steuer: p.steuer, gefunden: true, satzGefunden: true, gemischt: hat19 && hat7 };
    const satz = hat19 || !hat7 ? 19 : 7;
    /* Steuertabelle vorhanden, Satz unlesbar: 19 % als unsicherer Vorschlag (ohne jeden Steuerhinweis endet die Funktion oben) */
    const erwartet = Math.round(brutto * satz / (100 + satz));
    /* ohne Prüfsumme nur einen exakt passenden Betrag übernehmen – sonst lieber aus dem Satz rechnen (OCR verliest Ziffern) */
    const passend = alle.filter((b) => b > 0 && b < brutto && Math.abs(b - erwartet) <= 1)[0];
    return { satz, steuer: passend != null ? passend : erwartet, gefunden: passend != null, satzGefunden: hat19 || hat7 || steuerHinweis, gemischt: hat19 && hat7, unsicher: !(hat19 || hat7) };
  }

  const GESCHAEFT = /kompostwerk|deponie|recycling|wertstoff|baustoff|bau-?\s?markt|gartenmarkt|markt\b|handel|gmbh|\bkg\b|\bag\b|tankstelle|station|niederlassung|agrar|abfall|entsorgung|werk\b/i;
  const KEIN_NAME = /kasse|beleg|rechnung|quittung|datum|uhrzeit|tel\b|telefon|www\.|@|str\.|stra(ss|ß)e|\b\d{5}\b|filiale|willkommen|kundenbeleg|steuer|bon|annahme|wiegeschein/i;
  function lieferantFinden(zeilen, eigen) {
    /* Die eigene Firma steht auf Eingangsrechnungen im Empfängerfeld – sie ist nie der Lieferant */
    const eig = SuS.lieferantSchluessel(eigen);
    const fremd = (z) => !eig || eig.length < 4 || !SuS.lieferantSchluessel(z).includes(eig);
    zeilen = zeilen.filter(fremd);
    for (const [name, re, art] of KETTEN) if (zeilen.slice(0, 12).some((z) => re.test(z))) return { name, art, kette: true };
    /* Absenderzeile über dem Anschriftfeld: „Firma GmbH · Straße 1 · 12345 Ort“ – nur der erste Teil */
    zeilen = zeilen.map((z) => z.split(/\s[·•|]\s|\s[-–]\s(?=.*\d)/)[0].trim()).filter(Boolean);
    const kandidaten = zeilen.slice(0, 8).map((z, i) => {
      const buchst = (z.match(/[A-Za-zÄÖÜäöüß]/g) || []).length;
      if (buchst < 4 || buchst < z.length * 0.5 || !/[A-Za-zÄÖÜäöüß]{4,}/.test(z) || KEIN_NAME.test(z) && !GESCHAEFT.test(z)) return null;
      return { z, p: (GESCHAEFT.test(z) ? 10 : 0) - i };
    }).filter(Boolean).sort((x, y) => y.p - x.p);
    if (!kandidaten.length) return { name: '', art: '', kette: false };
    let name = kandidaten[0].z.replace(/[^\wÄÖÜäöüß&+.\- ]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
    if (name === name.toUpperCase()) name = name.toLowerCase().replace(/(^|[\s\-])\S/g, (x) => x.toUpperCase()).replace(/\bGmbh\b/g, 'GmbH').replace(/\bKg\b/g, 'KG');
    return { name, art: '', kette: false };
  }

  SuS.lieferantSchluessel = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9äöüß]/g, '').slice(0, 40);

  /* Belegart und Belegnummer aus dem Text (Vorschlag): '' = kein klarer Hinweis (die App nimmt dann Kassenbon beim Foto,
     Eingangsrechnung bei PDF-Dateien); Kassenwörter ergeben „kassenbon“ – auch bei einem eingescannten Bon als PDF */
  function belegartFinden(zeilen, gutschrift) {
    const kopf = zeilen.slice(0, 30).join('\n');
    if (gutschrift || /^\W*gutschrift\b/im.test(kopf)) return 'gutschrift';
    if (/^\W*lieferschein\b/im.test(kopf) && !/^\W*rechnung\b/im.test(kopf)) return 'lieferschein';
    if (/kassenbon|bon-?nr|\bkasse\s*:?\s*\d|kassierer|bar\s*gegeben|r[uü]ckgeld|ec-?karte|girocard/i.test(kopf + '\n' + zeilen.join('\n'))) return 'kassenbon';
    if (/^\W*rechnung\b|rechnungs-?\s?(nummer|nr\b|nr\.|datum)|rechnung\s+nr\.?/im.test(kopf)) return 'eingangsrechnung';
    return '';
  }
  function nummerFinden(zeilen) {
    for (const z of zeilen.slice(0, 40)) {
      const m = /(?:rechnungs|beleg|gutschrifts?|lieferschein)-?\s?(?:nummer|nr\.?)\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-/.]{1,29})/i.exec(z) ||
        /(?:^|\s)rechnung\s+nr\.?\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-/.]{1,29})/i.exec(z);
      if (m && /\d/.test(m[1]) && !/^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(m[1])) return m[1].replace(/[.\-/]+$/, '');
    }
    return '';
  }

  /* PDF-Text (pdf.js-Textstücke mit Position) zu Zeilen: gleiche Höhe = eine Zeile, links nach rechts; Seiten von oben nach unten */
  SuS.pdfZeilen = (items) => {
    const stuecke = (items || []).filter((x) => x && typeof x.str === 'string' && x.str.trim() && Array.isArray(x.transform))
      .map((x) => ({ t: x.str.replace(/\s+/g, ' ').trim(), x: x.transform[4], y: x.transform[5], h: Math.max(1, Math.abs(x.height || x.transform[3] || 10)), w: Math.max(0, x.width || 0) }));
    stuecke.sort((a, b) => b.y - a.y || a.x - b.x);
    const zeilen = [];
    for (const s of stuecke) {
      const z = zeilen.length ? zeilen[zeilen.length - 1] : null;
      if (z && Math.abs(z.y - s.y) <= 0.5 * Math.max(z.h, s.h)) z.teile.push(s); else zeilen.push({ y: s.y, h: s.h, teile: [s] });
    }
    return zeilen.map((z) => z.teile.sort((a, b) => a.x - b.x).map((s) => s.t).join(' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  };

  /* Haupteinstieg: Text → Vorschläge. gelernt = { lieferantSchlüssel: art } (zuletzt bestätigte Kategorie je Lieferant). */
  SuS.belegLesen = (roh, gelernt, heute) => {
    const zeilen = String(roh || '').replace(/\r/g, '').split('\n').map((z) => z.replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
    const datum = datumFinden(zeilen, heute);
    const b = bruttoFinden(zeilen);
    const st = steuerFinden(zeilen, b.wert, b.alle);
    const l = lieferantFinden(zeilen, SuS.daten && SuS.daten.firma && SuS.daten.firma.name);
    const text = zeilen.join('\n');
    let art = (gelernt && l.name && gelernt[SuS.lieferantSchluessel(l.name)]) || '';
    const artQuelle = art ? 'gelernt' : '';
    if (!art) {
      /* Stichwörter zählen; die bekannte Branche einer Kette zählt doppelt */
      const punkte = Object.keys(WORTE).map((k) => [k, (text.match(new RegExp(WORTE[k].source, 'gi')) || []).length + (l.art === k ? 2 : 0)]).sort((x, y) => y[1] - x[1]);
      art = punkte[0][1] > 0 ? punkte[0][0] : (l.art || 'sonstiges');
    }
    /* Gutschrift: Brutto steht mit Minus auf dem Beleg oder der Beleg heißt Gutschrift/Rückgabe → Beträge negativ (Fund Codex) */
    /* Vorzeichen nur aus der Summenzeile (bzw. der Zeile danach) oder einer Gutschrift-Überschrift – eine negative
       Einzelposition (Rabatt, Pfand, Storno einer Position) macht den Beleg nicht zur Gutschrift (Fund Codex R3) */
    const summenZeilen = zeilen.flatMap((z, i) => (SUMME.some(([re]) => re.test(z)) && !/netto|mwst|steuer/i.test(z) ? [z, zeilen[i + 1] || ''] : []));
    const vz = b.wert && (summenZeilen.some((z) => betraegeVz(z).includes(-b.wert)) || zeilen.some((z) => GUTSCHRIFT.test(z))) ? -1 : 1;
    const steuer = b.wert ? st.steuer : 0;
    return { datum, lieferant: l.name, brutto: vz * b.wert, satz: st.satz, steuer: vz * steuer, netto: vz * (b.wert - steuer),
      art, gemischt: st.gemischt, belegart: belegartFinden(zeilen, vz < 0), nummer: nummerFinden(zeilen),
      gutschrift: vz < 0, satzUnsicher: !!st.unsicher, keinAusweis: !!st.keinAusweis, sicher: { datum: !!datum, lieferant: l.kette, brutto: b.sicher, steuer: st.gefunden, satz: st.satzGefunden, art: !!artQuelle } };
  };

  if (typeof document === 'undefined') return;  // ab hier nur im Browser

  /* ---------------- Bild verbessern ---------------- */
  const ladeBild = (blob) => new Promise((ok, fehl) => {
    const url = URL.createObjectURL(blob), img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); ok(img); };
    img.onerror = () => { URL.revokeObjectURL(url); fehl(new Error('Kein lesbares Bild.')); };
    img.src = url;
  });

  /* Drehung (0/90/180/270), Zuschnitt auf das helle Papier, Graustufen mit Kontrastdehnung. Liefert das Bild für die
     Erkennung und eine verkleinerte Farbfassung (JPEG) zum Speichern. */
  SuS.belegVorbereiten = async (datei, drehung) => {
    const img = await ladeBild(datei);
    const w0 = img.naturalWidth, h0 = img.naturalHeight, f = Math.min(1, 2200 / Math.max(w0, h0));
    const quer = drehung === 90 || drehung === 270;
    const w = Math.round((quer ? h0 : w0) * f), h = Math.round((quer ? w0 : h0) * f);
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.translate(w / 2, h / 2); g.rotate((drehung || 0) * Math.PI / 180);
    g.drawImage(img, -w0 * f / 2, -h0 * f / 2, w0 * f, h0 * f);
    const px = g.getImageData(0, 0, w, h), d = px.data, n = w * h, grau = new Uint8ClampedArray(n), hist = new Array(256).fill(0);
    for (let i = 0; i < n; i++) { const v = (d[i * 4] * 299 + d[i * 4 + 1] * 587 + d[i * 4 + 2] * 114) / 1000 | 0; grau[i] = v; hist[v]++; }
    /* Otsu-Schwelle: Papier (hell) gegen Untergrund */
    let summe = 0; for (let i = 0; i < 256; i++) summe += i * hist[i];
    let sB = 0, wB = 0, best = 0, schwelle = 128;
    for (let t = 0; t < 256; t++) {
      wB += hist[t]; if (!wB) continue; const wF = n - wB; if (!wF) break;
      sB += t * hist[t]; const mB = sB / wB, mF = (summe - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
      if (v > best) { best = v; schwelle = t; }
    }
    const zeileHell = (y) => { let k = 0; for (let x = 0; x < w; x++) if (grau[y * w + x] > schwelle) k++; return k / w; };
    const spalteHell = (x) => { let k = 0; for (let y = 0; y < h; y++) if (grau[y * w + x] > schwelle) k++; return k / h; };
    let y0 = 0, y1 = h - 1, x0 = 0, x1 = w - 1;
    while (y0 < h / 3 && zeileHell(y0) < 0.25) y0++;
    while (y1 > h * 2 / 3 && zeileHell(y1) < 0.25) y1--;
    while (x0 < w / 3 && spalteHell(x0) < 0.25) x0++;
    while (x1 > w * 2 / 3 && spalteHell(x1) < 0.25) x1--;
    const rand = Math.round(Math.min(w, h) * 0.015);
    x0 = Math.max(0, x0 - rand); y0 = Math.max(0, y0 - rand); x1 = Math.min(w - 1, x1 + rand); y1 = Math.min(h - 1, y1 + rand);
    const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
    /* Kontrast: 2 %- und 98 %-Perzentil im Ausschnitt auf Schwarz/Weiß dehnen */
    const hh = new Array(256).fill(0);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) hh[grau[y * w + x]]++;
    const anz = cw * ch; let lo = 0, hi = 255, acc = 0;
    for (let i = 0; i < 256; i++) { acc += hh[i]; if (acc >= anz * 0.02) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hh[i]; if (acc >= anz * 0.02) { hi = i; break; } }
    const spanne = Math.max(1, hi - lo);
    const ocr = document.createElement('canvas'); ocr.width = cw; ocr.height = ch;
    const og = ocr.getContext('2d'), out = og.createImageData(cw, ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
      const v = Math.max(0, Math.min(255, (grau[(y + y0) * w + x + x0] - lo) * 255 / spanne)), o = (y * cw + x) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = v; out.data[o + 3] = 255;
    }
    og.putImageData(out, 0, 0);
    /* Schräglage (bis ±8°) über das Zeilenprofil schätzen: Steigung, bei der die dunklen Pixel die schärfsten Zeilen bilden */
    const schritt = Math.max(1, Math.round(cw / 700)), dunkel = [];
    for (let y = 0; y < ch; y += schritt) for (let x = 0; x < cw; x += schritt) if (out.data[(y * cw + x) * 4] < 110) dunkel.push(x, y);
    let steigung = 0, bestV = -1;
    for (let grad = -8; grad <= 8.001; grad += 0.5) {
      const t = Math.tan(grad * Math.PI / 180), bins = new Map();
      for (let i = 0; i < dunkel.length; i += 2) { const k = Math.round((dunkel[i + 1] - dunkel[i] * t) / schritt); bins.set(k, (bins.get(k) || 0) + 1); }
      let v = 0; for (const n of bins.values()) v += n * n;
      if (v > bestV) { bestV = v; steigung = t; }
    }
    let ocrBild = ocr;
    const winkel = Math.atan(steigung);
    if (Math.abs(winkel) > 0.4 * Math.PI / 180) {
      const c2 = document.createElement('canvas'), cos = Math.abs(Math.cos(winkel)), sin = Math.abs(Math.sin(winkel));
      c2.width = Math.round(cw * cos + ch * sin); c2.height = Math.round(ch * cos + cw * sin);
      const g2 = c2.getContext('2d'); g2.fillStyle = '#fff'; g2.fillRect(0, 0, c2.width, c2.height);
      g2.translate(c2.width / 2, c2.height / 2); g2.rotate(-winkel); g2.drawImage(ocr, -cw / 2, -ch / 2);
      ocrBild = c2;
    }
    /* Zum Speichern: der begradigte, kontrastverstärkte Ausschnitt in Graustufen, höchstens 1200 px, JPEG 0,55. Zweistufig
       verkleinert (glättet Bildrauschen, das sonst die Datei aufbläht) – gut lesbar und klein (Speicherplatz) */
    const fs = Math.min(1, 1200 / Math.max(ocrBild.width, ocrBild.height));
    const zw = document.createElement('canvas'); zw.width = Math.max(1, Math.round(ocrBild.width * fs * 0.75)); zw.height = Math.max(1, Math.round(ocrBild.height * fs * 0.75));
    const zg = zw.getContext('2d'); zg.imageSmoothingQuality = 'high'; zg.drawImage(ocrBild, 0, 0, zw.width, zw.height);
    const sp = document.createElement('canvas'); sp.width = Math.round(ocrBild.width * fs); sp.height = Math.round(ocrBild.height * fs);
    const spg = sp.getContext('2d'); spg.imageSmoothingQuality = 'high'; spg.drawImage(zw, 0, 0, sp.width, sp.height);
    const speicher = await new Promise((ok) => sp.toBlob(ok, 'image/jpeg', 0.55));
    return { ocr: ocrBild, speicher, zuschnitt: [x0, y0, cw, ch], schraeg: Math.round(winkel * 1800 / Math.PI) / 10 };
  };

  /* ---------------- Texterkennung auf dem Gerät ---------------- */
  const SIMD = new Uint8Array([0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11]);
  const simd = () => { try { return WebAssembly.validate(SIMD); } catch (e) { return false; } };
  const abs = (pfad) => new URL(pfad, document.baseURI).href;  // Pfade im Worker sind sonst relativ zu ocr/worker.min.js
  const skript = (src) => new Promise((ok, fehl) => {
    if (window.Tesseract) { ok(); return; }
    const s = document.createElement('script'); s.src = src; s.onload = () => ok();
    s.onerror = () => fehl(new Error('Die Texterkennung konnte nicht geladen werden.')); document.head.appendChild(s);
  });
  let worker = null;
  SuS.belegFortschritt = null;
  SuS.belegWorker = () => {
    if (!worker) {
      worker = (async () => {
        if (typeof WebAssembly !== 'object') throw new Error('Dieses Gerät kann die Texterkennung nicht ausführen.');
        await skript('ocr/tesseract.min.js');
        const w = await window.Tesseract.createWorker('deu', 1, {
          workerPath: abs('ocr/worker.min.js'), corePath: abs(simd() ? 'ocr/tesseract-core-simd-lstm.wasm.js' : 'ocr/tesseract-core-lstm.wasm.js'),
          langPath: abs('ocr'), gzip: false, cacheMethod: 'none', workerBlobURL: false,
          logger: (m) => { if (SuS.belegFortschritt) SuS.belegFortschritt(m); }
        });
        await w.setParameters({ tessedit_pageseg_mode: SuS.belegSeitenModus || '11', preserve_interword_spaces: '1' });  // 11: verstreuter Text (Spalten auf Bons)
        return w;
      })().catch((x) => { worker = null; throw x; });
    }
    return worker;
  };
  /* Zeilen aus Wortpositionen wieder aufbauen: Wörter von links nach rechts der Zeile zuordnen, deren letztes Wort in
     derselben Höhe liegt (das Bild ist begradigt). */
  SuS.belegZeilen = (daten) => {
    const woerter = [];
    for (const b of daten.blocks || []) for (const p of b.paragraphs || []) for (const l of p.lines || []) for (const w of l.words || []) {
      if (!w.text || !w.text.trim()) continue;
      woerter.push({ t: w.text.trim(), x0: w.bbox.x0, x1: w.bbox.x1, yc: (w.bbox.y0 + w.bbox.y1) / 2, h: Math.max(1, w.bbox.y1 - w.bbox.y0) });
    }
    if (!woerter.length) return '';
    woerter.sort((a, b) => a.x0 - b.x0);
    const zeilen = [];
    for (const w of woerter) {
      let beste = null, bestDy = Infinity;
      for (const z of zeilen) {
        const l = z[z.length - 1], dy = Math.abs(l.yc - w.yc);
        if (l.x1 <= w.x0 + w.h * 0.6 && dy < 0.55 * Math.max(l.h, w.h) && dy < bestDy) { beste = z; bestDy = dy; }
      }
      if (beste) beste.push(w); else zeilen.push([w]);
    }
    zeilen.sort((a, b) => a.reduce((s, w) => s + w.yc, 0) / a.length - b.reduce((s, w) => s + w.yc, 0) / b.length);
    return zeilen.map((z) => z.map((w) => w.t).join(' ')).join('\n');
  };

  /* Erkennen; ist das Ergebnis schwach (kein Betrag, geringe Sicherheit), werden 90° und 270° probiert (liegend fotografiert). */
  SuS.belegErkennen = async (datei, drehung) => {
    const w = await SuS.belegWorker();
    const versuche = drehung != null ? [drehung] : [0, 90, 270];
    let bestes = null;
    for (const dr of versuche) {
      const bild = await SuS.belegVorbereiten(datei, dr);
      const r = await w.recognize(bild.ocr, {}, { text: true, blocks: true });
      r.data.text = SuS.belegZeilen(r.data) || r.data.text;  // Zeilen aus den Wortpositionen (Modus 11 liefert Wortgruppen)
      const v = SuS.belegLesen(r.data.text, SuS.daten && SuS.daten.lieferantArt);
      const guete = (r.data.confidence || 0) + (v.brutto ? 30 : 0) + (v.datum ? 10 : 0);
      if (!bestes || guete > bestes.guete) bestes = { guete, vorschlag: v, text: r.data.text, bild, drehung: dr, sicherheit: r.data.confidence };
      if (v.brutto && (r.data.confidence || 0) >= 50) break;
    }
    return bestes;
  };
})();
