/* Stock und Stein – Start: Daten laden, Seiten über die Adresse (#/…) wählen, Klicks verteilen. */
'use strict';

(function () {
  SuS.laden();
  /* Zweite Ablage (IndexedDB) abgleichen, BEVOR die Oberfläche bedienbar ist: ist dort ein neuerer Stand (z. B. weil
     localStorage voll war), wird er übernommen (Funde Codex/Cursor: sonst könnte eine frühe Änderung ihn überschreiben). */
  SuS.startFertig = false;
  SuS.bereit = SuS.speicherAbgleich(SuS.daten.gespeichertUm || 0).then(() => {
    SuS.startFertig = true;
    if (SuS.ausDatenbank) SuS.melde('Neuerer Stand aus der Datenbank des Browsers geladen.');
  });

  /* Eigenständige App (nicht im Orchestrator-Fenster): offline zwischenspeichern und dauerhaften Speicher anfordern,
     damit der Browser die Daten nicht von sich aus löscht. */
  SuS.eigenstaendig = window.parent === window;
  SuS.installiert = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  /* Nur die gebaute Fassung (dist/, erkennbar an der CSP) hat einen fertigen Service Worker (Fund Cursor). */
  const gebaut = !!document.querySelector('meta[http-equiv="Content-Security-Policy"]');
  if (SuS.eigenstaendig && gebaut && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    /* Nach einem Update übernimmt der neue Service Worker sofort; dann einmal neu laden, damit nicht alter Code weiterläuft
       (Fund Cursor). Beim allerersten Installieren nicht. Ist gerade ein Eingabefenster offen oder klappt das Speichern
       nicht, wird gewartet, bis das Fenster zu ist (Funde Codex/Cursor: sonst gingen Eingaben verloren). */
    const hatteSteuerung = !!navigator.serviceWorker.controller;
    let neuGeladen = false, hinweis = false;
    SuS.updatePruefen = async () => {
      if (neuGeladen || !SuS.updateWartet) return;
      const warten = () => { if (!hinweis) { hinweis = true; SuS.melde('Neue Version bereit – sie startet, sobald dieses Fenster geschlossen ist.'); } };
      if (!document.getElementById('blatt').hidden || !document.getElementById('druck').hidden) { warten(); return; }
      /* Erst neu laden, wenn die Ablage wirklich bestätigt ist – auch eine ausstehende Datenbank-Ablage (Fund Cursor). */
      if (!(await SuS.speichernAbwarten())) { warten(); return; }
      /* Während des Wartens kann ein Fenster aufgegangen sein (Fund Codex): dann weiter warten, beim Schließen erneut prüfen. */
      if (!document.getElementById('blatt').hidden || !document.getElementById('druck').hidden) { warten(); return; }
      neuGeladen = true; location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (hatteSteuerung) { SuS.updateWartet = true; SuS.updatePruefen(); } });
    const zu = SuS.blattZu, druckZu = SuS.schliesseDruck;
    SuS.blattZu = () => { zu(); if (SuS.updateWartet) setTimeout(SuS.updatePruefen, 400); };
    if (druckZu) SuS.schliesseDruck = (...a) => { const r = druckZu(...a); if (SuS.updateWartet) setTimeout(SuS.updatePruefen, 400); return r; };
    navigator.serviceWorker.register('sw.js').then((r) => r.update && r.update()).catch(() => {});
  }
  if (SuS.eigenstaendig && navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((ja) => { SuS.speicherDauerhaft = ja; if (SuS.letzteSeite === 'installieren' || SuS.letzteSeite === 'start') SuS.neuZeichnen(); }).catch(() => {});
  }

  function route() {
    if (!SuS.startFertig) { SuS.bereit.then(route); return; }
    /* Während „Wird gesichert …“ keine Navigation (Zurück, Wischgeste): nach dem Ende der Sperre nachholen (Fund Cursor R11) */
    if (SuS.gesperrt && SuS.gesperrt()) { SuS.routeWartet = true; return; }
    const teile = (location.hash || '#/start').replace(/^#\/?/, '').split('/');
    const seite = teile[0] || 'start', id = teile[1] || '';
    if (seite !== 'dok' && SuS.letzteSeite !== seite) SuS.ansicht.suche = '';
    SuS.letzteSeite = seite;
    SuS.blattZu();
    if (!document.getElementById('druck').hidden) SuS.schliesseDruck();
    const tab = { dok: 'belege', angebote: 'belege', rechnungen: 'belege', posten: 'belege', baustelle: 'baustellen', kunden: 'mehr', kunde: 'mehr', firma: 'mehr',
      leistungen: 'mehr', sicherung: 'mehr', hilfe: 'mehr', mitarbeiter: 'mehr', vertraege: 'mehr', export: 'mehr', installieren: 'mehr' }[seite] || seite;
    if (seite !== 'baustelle') SuS.aktuelleBaustelle = null;
    document.querySelectorAll('.leiste a[data-tab]').forEach((a) => a.classList.toggle('aktiv', a.dataset.tab === tab));
    const f = SuS.seiten[seite];
    if (f) f(id); else SuS.seiten.start();
  }
  SuS.neuZeichnen = route;
  /* Navigationszähler: eine automatische Weiterleitung nach einer Wartezeit gilt nur, wenn der Nutzer währenddessen nicht
     selbst navigiert hat (Fund Codex R12). */
  SuS.navZaehler = 0;
  SuS.navMarke = () => SuS.navZaehler;
  SuS.gehZu = (hash, marke) => { if (marke == null || marke === SuS.navZaehler) location.hash = hash; };
  window.addEventListener('hashchange', () => { SuS.navZaehler++; });
  window.addEventListener('hashchange', route);

  document.addEventListener('click', (ev) => {
    const el = ev.target.closest('[data-a]');
    if (!el || el.disabled || !SuS.startFertig || (SuS.gesperrt && SuS.gesperrt())) return;  // während „Wird gesichert …“ keine Aktion
    const f = SuS.aktionen[el.dataset.a];
    if (!f) return;
    if (el.tagName === 'BUTTON') ev.preventDefault();
    f(el, ev);
  });

  /* Zum Ausprobieren: #beispiel lädt das Beispiel, falls noch nichts da ist. */
  const bsp = /^#beispiel(?:=(.*))?$/.exec(location.hash);
  if (bsp) {
    const a = SuS.daten.dokumente.length ? SuS.daten.dokumente[0] : SuS.katalog.beispiel();
    const ziel = bsp[1] || '';
    const p0 = SuS.daten.projekte[0];
    location.replace(ziel === 'baustelle' && p0 ? '#/baustelle/' + p0.id : ziel && ziel !== 'druck' ? '#' + ziel : '#/dok/' + a.id);
    /* Beispiel: erst nach dem Abgleich (route wartet selbst) */
    route();
    if (ziel === 'druck') SuS.bereit.then(() => setTimeout(() => SuS.zeigeDruck(a, ''), 150));
    return;
  }
  route();
})();
