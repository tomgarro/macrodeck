// sw.js - Guarda la app en el celu para que abra sin internet (despues de la primera vez).
const V = 'macrodeck-dnd-v59';
const ARCHIVOS = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'macrodeck.webp', 'vendor/jszip.min.js',
  'js/version.js', 'js/red.js', 'js/disco.js', 'js/audios.js', 'js/audios_motor.js', 'js/ambientes.js', 'js/gestos.js', 'js/audios_ui.js', 'js/protocolo.js', 'js/iconos_datos.js', 'js/tema.js', 'js/iconos.js', 'js/sostener.js', 'js/almacen.js', 'js/config.js', 'js/luces_dnd.js', 'js/iconos_ui.js', 'js/audio.js', 'js/diag.js', 'js/vivo.js', 'js/nativo_sim.js', 'js/nativo.js', 'js/transporte.js', 'js/celu.js', 'js/simulador.js', 'js/maqueta.js', 'js/demo.js', 'js/drive_config.js', 'js/drive.js', 'js/drive_escenas.js', 'js/ui.js', 'js/drive_ui.js', 'js/selector.js', 'js/sync_todo.js', 'js/panel_luces.js', 'js/navegacion.js', 'js/tracker_nucleo.js', 'js/tracker_eventos.js', 'js/tracker_fichas.js', 'js/tracker_motor.js', 'js/tracker_audio.js', 'js/tracker_serie.js', 'js/tracker_ui.js', 'js/app.js',
  'tracker/tracker.jpg', 'tracker/joystick.png', 'tracker/sfx/cfgMove1.mp3', 'tracker/sfx/cmbMove1.mp3', 'tracker/sfx/cmbMove2.mp3', 'tracker/sfx/cmbMove3.mp3', 'tracker/sfx/kill1.mp3', 'tracker/sfx/roundchange1.mp3', 'tracker/sfx/roundchange2.mp3', 'tracker/sfx/roundchange3.mp3'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(ARCHIVOS)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
// red primero (para recibir mejoras) y si no hay internet, lo guardado
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(r => { const c = r.clone(); caches.open(V).then(ca => ca.put(e.request, c)).catch(() => {}); return r; }).catch(() => caches.match(e.request)));
});
