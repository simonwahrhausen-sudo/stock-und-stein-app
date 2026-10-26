/* Stock und Stein – Offline-Betrieb: alle App-Dateien werden beim Installieren zwischengespeichert; danach läuft die App
   ohne Netz. Kundendaten liegen nicht hier, sondern im Speicher der App (localStorage) auf dem Gerät. */
'use strict';
const VERSION = 'sus-buero-fbb914a26bee';
const DATEIEN = ["./", "./index.html", "./buero.css", "./manifest.webmanifest", "./js/ansichten.js", "./js/ausgaben.js", "./js/baustellen.js", "./js/beleg.js", "./js/betrieb.js", "./js/druck.js", "./js/editor.js", "./js/eingang.js", "./js/erechnung.js", "./js/fotos.js", "./js/katalog.js", "./js/kern.js", "./js/paket.js", "./js/pdf.js", "./js/pdfa-daten.js", "./js/qr.js", "./js/start.js", "./js/teilen.js", "./bilder/apple-touch-icon.png", "./bilder/symbol-192.png", "./bilder/symbol-512.png", "./schriften/Fraunces-Bold.ttf", "./schriften/Inter-Regular.ttf", "./schriften/Inter-Bold.ttf", "./schriften/lizenzen/arimo-OFL.txt", "./schriften/lizenzen/bricolagegrotesque-OFL.txt", "./schriften/lizenzen/caveat-OFL.txt", "./schriften/lizenzen/fraunces-OFL.txt", "./schriften/lizenzen/fredoka-OFL.txt", "./schriften/lizenzen/inter-OFL.txt", "./ocr/deu.traineddata", "./ocr/lizenzen/HINWEISE.txt", "./ocr/lizenzen/tessdata_fast-LICENSE.txt", "./ocr/lizenzen/tesseract.js-LICENSE.txt", "./ocr/lizenzen/tesseract.js-core-LICENSE.txt", "./ocr/lizenzen/tesseract.min.js-Drittlizenzen.txt", "./ocr/lizenzen/worker.min.js-Drittlizenzen.txt", "./ocr/tesseract-core-lstm.wasm.js", "./ocr/tesseract-core-simd-lstm.wasm.js", "./ocr/tesseract.min.js", "./ocr/worker.min.js"];
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
