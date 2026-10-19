// tema.js - Apariencia de la app (colores) + logo TG. Elegir en Herramientas > Apariencia; se guarda en ESE celu (localStorage md_tema).
// El logo TG sale de firmware/macrodeck/logo_datos.h (el mismo dibujo del DXF que usa el Macrodeck): la T, la G y la cola de la T, todo en UN solo color.
window.MD = window.MD || {};
(function (MD) {
  const LOGO_D = 'M-40.00 -42.57L-34.13 -38.47L-34.13 -24.26L-28.09 -32.57L-5.00 -32.57L-5.00 -10.07L5.00 -10.07L5.00 -32.57L28.09 -32.57L34.13 -24.26L34.13 -38.47L40.00 -42.57ZM-25.54 -27.57L-7.50 -27.57L-7.50 -17.57L-20.44 -17.57L-22.64 -14.54L-10.00 13.86L-7.50 13.86L-7.50 23.86L-16.49 23.86L-34.13 -15.75ZM7.50 13.86L7.50 23.86L16.49 23.86L30.49 -7.57L7.50 -7.57L-7.50 -7.57L-14.07 -7.57L-9.61 2.43L-7.50 2.43L7.50 2.43L15.09 2.43L10.00 13.86ZM21.77 -15.75L20.44 -17.57L7.50 -17.57L7.50 -27.57L25.54 -27.57L34.13 -15.75ZM-5.00 35.43L0.00 42.57L5.00 35.43L5.00 4.93L-5.00 4.93Z';
  const LOGO_VB = '-52 -52 104 104';   // cuadrado; el dibujo se baja 6 unidades (DESPLAZ) para que se vea centrado: es ancho arriba y angosto abajo
  const DESPLAZ = 6;
  const TEMAS = [
    { id: 'grafito', nombre: 'Grafito', desc: 'Grises oscuros neutros', tema: '#121212',
      colores: { amarillo: '#e0b21f', rojo: '#d4342c', blanco: '#e6e6e6', gris: '#808080' }, muestra: ['#121212', '#262626', '#ebebeb'] },
    { id: 'grafito-amarillo', nombre: 'Grafito + amarillo', desc: 'Grises con el amarillo de la e-Paper como acento', tema: '#121212',
      colores: { amarillo: '#e0b21f', rojo: '#d4342c', blanco: '#e6e6e6', gris: '#808080' }, muestra: ['#121212', '#262626', '#e0b21f'] },
    { id: 'papel', nombre: 'Papel', desc: 'Gris claro, como la e-Paper', tema: '#e4e4e2',
      colores: { amarillo: '#b88a00', rojo: '#c0281f', blanco: '#2a2a2a', gris: '#8a8a8a' }, muestra: ['#e4e4e2', '#f3f3f1', '#1a1a1a'] },
  ];
  const POR_DEFECTO = 'grafito';
  function logo(clase) {
    const ns = 'http://www.w3.org/2000/svg', s = document.createElementNS(ns, 'svg');
    s.setAttribute('viewBox', LOGO_VB); s.setAttribute('class', clase || 'logo'); s.setAttribute('aria-label', 'TG'); s.setAttribute('role', 'img');
    const p = document.createElementNS(ns, 'path'); p.setAttribute('d', LOGO_D); p.setAttribute('transform', 'translate(0 ' + DESPLAZ + ')'); s.appendChild(p); return s;
  }
  function guardado() { try { return localStorage.getItem('md_tema'); } catch (e) { return null; } }
  function actual() { const id = guardado(); return TEMAS.some(t => t.id === id) ? id : POR_DEFECTO; }
  function aplicar(id, guardar) {
    const t = TEMAS.find(x => x.id === id) || TEMAS[0];
    document.documentElement.setAttribute('data-tema', t.id);
    if (MD.Config && MD.Config.COLOR_HEX) Object.assign(MD.Config.COLOR_HEX, t.colores);
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t.tema);
    if (guardar) { try { localStorage.setItem('md_tema', t.id); } catch (e) { /* sin almacenamiento: queda solo hasta cerrar */ } }
    return t.id;
  }
  function iniciar() {
    aplicar(actual(), false);
    const cab = document.querySelector('header.cab'); if (cab && !cab.querySelector('.logo')) cab.insertBefore(logo('logo'), cab.firstChild);
    const g = document.querySelector('#audioGate .tarjeta'); if (g && !g.querySelector('.logo')) g.insertBefore(logo('logo'), g.firstChild);
  }
  MD.Tema = { TEMAS, actual, aplicar, logo, iniciar, LOGO_D, LOGO_VB };
  iniciar();
})(window.MD);
