// version.js - La version de la app, a la vista en la cabecera (abajo del titulo). Se sube en CADA cambio, junto con la cache de sw.js.
window.MD = window.MD || {};
window.MD.VERSION = '2.0-dev2';
(function () { const e = document.getElementById('ver'); if (e) e.textContent = 'v' + window.MD.VERSION; })();
