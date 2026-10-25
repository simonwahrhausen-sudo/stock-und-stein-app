/* Stock und Stein – Offline-Betrieb: alle App-Dateien werden beim Installieren zwischengespeichert; danach läuft die App
   ohne Netz. Kundendaten liegen nicht hier, sondern im Speicher der App (localStorage) auf dem Gerät. */
'use strict';
const VERSION = 'sus-buero-2651f66b5f24';
const DATEIEN = ["./", "./index.html", "./buero.css", "./manifest.webmanifest", "./js/ansichten.js", "./js/ausgaben.js", "./js/baustellen.js", "./js/betrieb.js", "./js/druck.js", "./js/editor.js", "./js/eingang.js", "./js/erechnung.js", "./js/fotos.js", "./js/katalog.js", "./js/kern.js", "./js/pdf.js", "./js/pdfa-daten.js", "./js/qr.js", "./js/start.js", "./js/teilen.js", "./bilder/apple-touch-icon.png", "./bilder/symbol-192.png", "./bilder/symbol-512.png", "./schriften/Fraunces-Bold.ttf", "./schriften/Inter-Regular.ttf", "./schriften/Inter-Bold.ttf", "./schriften/lizenzen/arimo-OFL.txt", "./schriften/lizenzen/bricolagegrotesque-OFL.txt", "./schriften/lizenzen/caveat-OFL.txt", "./schriften/lizenzen/fraunces-OFL.txt", "./schriften/lizenzen/fredoka-OFL.txt", "./schriften/lizenzen/inter-OFL.txt"];
self.addEventListener('install', (ev) => {
  ev.waitUntil(caches.open(VERSION).then((c) => c.addAll(DATEIEN)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (ev) => {
  ev.waitUntil(caches.keys().then((alle) => Promise.all(alle.filter((k) => k.startsWith('sus-buero-') && k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (ev) => {
  const r = ev.request;
  if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  ev.respondWith(caches.match(r, { ignoreSearch: true }).then((treffer) => treffer || fetch(r).catch(() =>
    r.mode === 'navigate' ? caches.match('./index.html') : Response.error())));
});
