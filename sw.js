// sw.js - Guarda la app en el celu para que abra sin internet (despues de la primera vez).
const V = 'macrodeck-dnd-v5';
const ARCHIVOS = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'vendor/jszip.min.js',
  'js/protocolo.js', 'js/iconos.js', 'js/almacen.js', 'js/config.js', 'js/audio.js', 'js/transporte.js', 'js/simulador.js', 'js/demo.js', 'js/drive_config.js', 'js/drive.js', 'js/drive_escenas.js', 'js/ui.js', 'js/drive_ui.js', 'js/app.js'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// red primero (para recibir mejoras) y si no hay internet, lo guardado
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(ca => ca.put(e.request, c)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
