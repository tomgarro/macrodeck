// version.js - La version de la app, a la vista en la cabecera (abajo del titulo). Se sube en CADA cambio, junto con la cache de sw.js.
window.MD = window.MD || {};
window.MD.VERSION = '1.3-dev21';
(function () { const e = document.getElementById('ver'); if (e) e.textContent = 'v' + window.MD.VERSION; })();
