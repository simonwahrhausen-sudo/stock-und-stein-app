/* Stock und Stein – PDF/E-Rechnung teilen (Mail, WhatsApp, Drucken über das Teilen-Menü) und verschlüsselte Sicherung.
   Teilen läuft zweistufig: erst Datei erzeugen, dann „Teilen“ antippen – Safari erlaubt das Teilen-Menü nur direkt
   nach einem Tippen. Verschlüsselung mit der Web-Crypto-Schnittstelle des Browsers (PBKDF2-SHA-256 + AES-GCM-256). */
'use strict';

(function () {
  const e = SuS.esc, A = SuS.aktionen;
  const imAppFenster = () => window.parent !== window;
  let bereit = null;  // { datei, text, betreff, empfaenger }

  SuS.teilenText = (dok, variante) => {
    const f = SuS.firmaVon(dok), k = SuS.kundeVon(dok), s = SuS.summen(dok);
    const art = SuS.druckHilfe.titelVon(dok, variante);
    const betrag = variante === 'erinnerung' || variante === 'mahnung' ? SuS.euro(SuS.offenerBetrag(dok)) : SuS.euro(s.zahlbetrag);
    const gruss = SuS.druckHilfe.anrede(k);
    const zeile = variante === 'auftrag' ? 'anbei unsere Auftragsbestätigung zum Angebot ' + dok.nummer + '.'
      : 'anbei ' + (dok.typ === 'angebot' && !variante ? 'unser Angebot ' : 'unsere ' + art + ' ') + (dok.nummer || '') + ' über ' + betrag + '.';
    return gruss + '\n\n' + zeile + (dok.betreff ? '\nBetreff: ' + dok.betreff : '') + '\n\nBei Fragen erreichen Sie uns' + (f.telefon ? ' unter ' + f.telefon : '') +
      '.\n\nMit freundlichen Grüßen\n' + (f.inhaber ? f.inhaber + '\n' : '') + f.name;
  };

  function blattBereit(titel, hinweis) {
    let d = bereit.datei;
    let kannTeilen = !!(navigator.canShare && navigator.canShare({ files: [d] }));
    /* Manche Geräte teilen XML/JSON nicht – dann als Textdatei versuchen (Fund Cursor). */
    if (!kannTeilen && navigator.canShare && /xml|json/.test(d.type)) {
      const alt = new File([d], d.name, { type: 'text/plain' });
      if (navigator.canShare({ files: [alt] })) { bereit.datei = d = alt; kannTeilen = true; }
    }
    const mail = bereit.empfaenger ? 'mailto:' + encodeURIComponent(bereit.empfaenger) + '?subject=' + encodeURIComponent(bereit.betreff) + '&body=' + encodeURIComponent(bereit.text) : '';
    SuS.blatt(titel, '<div class="vorschau-betrag"><span>' + e(d.name) + '</span><span>' + Math.max(1, Math.round(d.size / 1024)) + ' KB</span></div>' +
      (hinweis ? '<div class="hinweis info">' + hinweis + '</div>' : '') +
      (kannTeilen ? '<button type="button" class="knopf haupt breit" data-a="jetztTeilen">Teilen – Mail, WhatsApp, Drucken …</button>' +
        '<p class="unterzeile">Drucken am Handy: im Teilen-Menü „Drucken“ wählen.</p>' : '') +
      (!imAppFenster() ? '<div class="knopfreihe"><button type="button" class="knopf" data-a="dateiSpeichern">Datei speichern/öffnen</button>' +
        (mail ? '<a class="knopf" href="' + e(mail) + '">E-Mail vorbereiten</a>' : '') + '</div>' +
        (mail && !kannTeilen ? '<p class="unterzeile">Bei „E-Mail vorbereiten“ die gespeicherte Datei bitte selbst anhängen.</p>' : '') : '') +
      (imAppFenster() ? '<div class="hinweis">Im App-Fenster des Orchestrators sind Teilen und Speichern gesperrt. In der eigenständigen App auf dem Handy geht beides; hier bitte „Drucken / PDF“ nutzen.</div>' : '') +
      '<details style="margin-top:10px"><summary class="unterzeile">Nachrichtentext</summary><label class="feld"><textarea readonly style="min-height:150px">' + e(bereit.text) + '</textarea></label></details>');
  }

  SuS.pdfTeilen = async (dok, variante, zugferd) => {
    if (zugferd) { const fehlt = SuS.xrechnungFehlt(dok); if (fehlt.length) { SuS.melde('Für die E-Rechnung fehlt noch: ' + fehlt.join(', ') + '.', true); return; } }
    const fremd = SuS.pdfFremdzeichen ? SuS.pdfFremdzeichen(dok) : [];
    SuS.melde(fremd.length ? 'Achtung: Diese Zeichen kann das PDF nicht darstellen und zeigt „?“: ' + fremd.join(' ') : 'PDF wird erstellt …', fremd.length > 0);
    let bytes;
    try { bytes = await SuS.dokumentPdf(dok, variante, zugferd); } catch (x) { SuS.melde('PDF konnte nicht erstellt werden: ' + x.message, true); return; }
    const k = SuS.kundeVon(dok);
    bereit = { datei: new File([bytes], SuS.pdfDateiname(dok, variante), { type: 'application/pdf' }), text: SuS.teilenText(dok, variante),
      betreff: SuS.druckHilfe.titelVon(dok, variante) + ' ' + (dok.nummer || '') + ' – ' + SuS.firmaVon(dok).name, empfaenger: k && k.email ? k.email : '' };
    if (zugferd) {
      bereit.text += '\n\n(Die PDF-Datei enthält die E-Rechnung im Format ZUGFeRD/XRechnung.)';
      blattBereit('E-Rechnung (ZUGFeRD) ist bereit', 'PDF mit eingebetteter E-Rechnung (ZUGFeRD, Profil XRECHNUNG) – lesbar für Menschen und Buchhaltungsprogramme, erfüllt die E-Rechnungspflicht. Bitte als Datei senden, nicht ausdrucken.');
    } else blattBereit('PDF ist bereit');
  };
  /* Beliebige Datei teilen (z. B. Stundenzettel an den Chef) */
  SuS.dateiTeilen = (name, inhalt, typ, text, titel) => {
    bereit = { datei: new File([inhalt], name, { type: typ }), text, betreff: titel, empfaenger: '' };
    blattBereit(titel);
  };
  SuS.xrechnungTeilen = (dok) => {
    let xml;
    try { xml = SuS.xrechnung(dok); } catch (x) { SuS.melde(x.message, true); return; }
    const k = SuS.kundeVon(dok);
    bereit = { datei: new File([xml], 'XRechnung-' + dok.nummer + '.xml', { type: 'application/xml' }),
      text: SuS.teilenText(dok, '') + '\n\n(E-Rechnung im Format XRechnung 3.0 im Anhang)', betreff: 'E-Rechnung ' + dok.nummer + ' – ' + SuS.firmaVon(dok).name,
      empfaenger: k && k.email ? k.email : '' };
    blattBereit('E-Rechnung ist bereit', 'XRechnung 3.0 (UBL) für Firmenkunden – erfüllt die E-Rechnungspflicht. Das PDF kann zusätzlich als Lesefassung mitgeschickt werden.');
  };
  A.jetztTeilen = async () => {
    if (!bereit) return;
    try {
      await navigator.share({ files: [bereit.datei], title: bereit.betreff, text: bereit.text });
      if (bereit.sicherung) gesichert();
      SuS.blattZu(); SuS.melde(bereit.sicherung ? 'Sicherung abgelegt.' : 'Geteilt.');
    }
    catch (x) { if (x && x.name !== 'AbortError') SuS.melde('Teilen nicht möglich: ' + x.message, true); }
  };
  A.dateiSpeichern = () => {
    if (!bereit) return;
    const url = URL.createObjectURL(bereit.datei), a = document.createElement('a');
    a.href = url; a.download = bereit.datei.name; a.target = '_blank'; a.rel = 'noopener';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (bereit.sicherung) gesichert();
  };
  /* Erst wenn die Sicherung wirklich das Gerät verlassen hat bzw. gespeichert wurde, zählt sie (Fund Codex). */
  function gesichert() { SuS.daten.letzteSicherung = new Date().toISOString(); SuS.speichern(); }
  A.textGesichert = () => { gesichert(); SuS.blattZu(); SuS.melde('Danke – Sicherung vermerkt.'); };

  /* ---------- Verschlüsselte Sicherung ---------- */
  const b64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = (t) => { const s = atob(t), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u; };
  const RUNDEN = 600000;
  async function schluessel(passwort, salz, runden) {
    const roh = await crypto.subtle.importKey('raw', new TextEncoder().encode(passwort), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt: salz, iterations: runden }, roh, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  SuS.verschluesseln = async (text, passwort) => {
    const salz = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
    const k = await schluessel(passwort, salz, RUNDEN);
    const daten = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, new TextEncoder().encode(text)));
    return JSON.stringify({ app: 'stock-und-stein-buero', verschluesselt: 1, kdf: 'PBKDF2-SHA256', runden: RUNDEN, salz: b64(salz), iv: b64(iv), daten: b64(daten) });
  };
  SuS.entschluesseln = async (json, passwort) => {
    let h;
    try { h = typeof json === 'string' ? JSON.parse(json) : json; } catch (x) { throw new Error('Keine gültige Sicherung.'); }
    if (!h || h.verschluesselt !== 1 || typeof h.salz !== 'string' || typeof h.iv !== 'string' || typeof h.daten !== 'string') throw new Error('Keine verschlüsselte Sicherung.');
    /* Nur das eigene Format – eine präparierte Datei darf keine Rechenlast vorgeben (Fund Cursor). */
    if (Number(h.runden) !== RUNDEN || h.kdf !== 'PBKDF2-SHA256') throw new Error('Unbekanntes Sicherungsformat.');
    try {
      const salz = unb64(h.salz), iv = unb64(h.iv), daten = unb64(h.daten);
      if (salz.length !== 16 || iv.length !== 12) throw new Error('Format');
      const k = await schluessel(passwort, salz, RUNDEN);
      return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, k, daten));
    } catch (x) { throw new Error('Passwort falsch oder Datei beschädigt.'); }
  };
  SuS.istVerschluesselt = (text) => { try { return JSON.parse(text).verschluesselt === 1; } catch (x) { return false; } };

  A.sichernVerschluesselt = () => {
    if (!window.crypto || !crypto.subtle) { SuS.melde('Verschlüsselung ist in diesem Browser nicht verfügbar.', true); return; }
    SuS.blatt('Verschlüsselte Sicherung', '<p class="unterzeile" style="margin-top:0">Die Sicherung wird mit einem Passwort verschlüsselt. Ohne Passwort kann niemand sie lesen – auch wir nicht. <b>Passwort gut aufschreiben</b>, sonst ist die Sicherung verloren. Tipp: mehrere Wörter, z. B. „Kies Hecke Mai 1974 Spaten“.</p>' +
      SuS.feld('p1', 'Passwort (mindestens 10 Zeichen)', '', { typ: 'password', auto: true, autocomplete: 'new-password' }) + SuS.feld('p2', 'Passwort wiederholen', '', { typ: 'password', autocomplete: 'new-password' }) +
      '<label class="schalter"><input type="checkbox" name="fotos" checked><span><b>Fotos mitsichern</b><small>Größere Datei, dafür sind die Baustellenfotos nach einem Gerätewechsel wieder da.</small></span></label>',
    async (fd, form) => {
      const p1 = String(fd.get('p1') || ''), p2 = String(fd.get('p2') || '');
      if (p1.length < 10) { SuS.melde('Bitte mindestens 10 Zeichen.', true); return false; }
      if (p1 !== p2) { SuS.melde('Die Passwörter stimmen nicht überein.', true); return false; }
      form.querySelector('[type=submit]').disabled = true;
      SuS.melde('Wird verschlüsselt …');
      try {
        let klar = SuS.sicherungText();
        if (fd.get('fotos') === 'on' && SuS.fotosExport && (await SuS.fotosVerfuegbar())) {
          const daten = JSON.parse(klar); daten.fotos = await SuS.fotosExport(); klar = JSON.stringify(daten);
        }
        const inhalt = await SuS.verschluesseln(klar, p1);
        bereit = { sicherung: true, datei: new File([inhalt], 'stock-und-stein-sicherung-' + SuS.heute() + '.sicherung.json', { type: 'application/json' }),
          text: 'Verschlüsselte Datensicherung Stock und Stein vom ' + SuS.datum(SuS.heute()), betreff: 'Datensicherung Stock und Stein', empfaenger: '' };
        setTimeout(() => blattBereit('Sicherung ist bereit', 'Am besten an einem zweiten Ort ablegen: z. B. per Teilen in iCloud Drive/Google Drive („In Dateien sichern“) oder per Mail an sich selbst.' +
          (imAppFenster() ? '' : '')), 0);
        if (imAppFenster()) setTimeout(() => SuS.blatt('Sicherung als Text', '<p class="unterzeile">Im App-Fenster geht kein Download: alles markieren, kopieren und sicher ablegen. Der Text ist verschlüsselt.</p><label class="feld"><textarea readonly style="min-height:200px;font-size:11px">' + e(inhalt) + '</textarea></label>' +
          '<button type="button" class="knopf haupt breit" data-a="textGesichert">Habe ich kopiert und abgelegt</button>'), 0);
      } catch (x) { SuS.melde('Verschlüsseln fehlgeschlagen: ' + x.message, true); return false; }
      return true;
    }, 'Verschlüsseln');
  };
  /* Beim Wiederherstellen: verschlüsselte Datei erkennen und nach dem Passwort fragen. */
  SuS.entschluesselnUndFrage = (text, weiter) => {
    SuS.blatt('Passwort der Sicherung', SuS.feld('p', 'Passwort', '', { typ: 'password', auto: true, autocomplete: 'current-password' }), async (fd) => {
      try { const klar = await SuS.entschluesseln(text, String(fd.get('p') || '')); setTimeout(() => weiter(klar), 0); return true; }
      catch (x) { SuS.melde(x.message, true); return false; }
    }, 'Entschlüsseln');
  };
})();
