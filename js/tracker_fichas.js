// tracker_fichas.js - Las fichitas de PETG transparente del tracker, dibujadas como SVG (caja de 100 x 170).
// Calavera con marcas de cuenta (1 a 6; del 7.o enemigo en adelante, calavera lisa), Paladin, Druida, Picaro, Monje, Barbaro e Invitado.
// (Siluetas hechas a ojo; si Tom manda los DXF de las fichas reales, se reemplazan los trazados de este archivo y nada mas.)
window.MD = window.MD || {};
(function (MD) {
  const Trk = MD.Trk || (MD.Trk = {});
  const PIE = 'M12 150H88V170H62V160Q50 150 38 160V170H12Z';
  // marcas de cuenta: 1-4 palitos; 5 = cuatro palitos tachados; 6 = un grupo de 5 y un palito
  function barras(n) {
    if (n < 1 || n > 6) return '';
    let d = '';
    const grupo = (x0, k, tachar, paso) => {
      for (let i = 0; i < k; i++) d += 'M' + (x0 + i * paso) + ' 14h5v30h-5z';
      if (tachar) d += 'M' + (x0 - 4) + ' 40L' + (x0 + (k - 1) * paso + 9) + ' 18L' + (x0 + (k - 1) * paso + 11) + ' 24L' + (x0 - 2) + ' 46Z';
    };
    if (n <= 4) { const paso = 13; grupo(50 - (n - 1) * paso / 2 - 2.5, n, false, paso); }
    else if (n === 5) grupo(50 - 19.5 - 2.5, 4, true, 13);
    else { grupo(22, 4, true, 10); d += 'M80 14h5v30h-5z'; }
    return d;
  }
  Trk.barras = barras;
  // devuelve el interior del <svg> (paths); num = numero de calavera (solo para 'E')
  Trk.ficha = function (t, num) {
    const P = [];
    if (t === 'E') {
      P.push('M50 8C20 8 10 30 12 55C12 70 20 78 28 82V96H72V82C80 78 88 70 88 55C90 30 80 8 50 8Z M24 52L44 56L40 68L24 64Z M76 52L56 56L60 68L76 64Z M50 70L45 84H55Z ' + (num >= 1 && num <= 6 ? barras(num) : ''));
      P.push('M30 96H70V150H30Z M37 104h4v34h-4z M48 104h4v40h-4z M59 104h4v34h-4z');
    } else if (t === 'D') {
      P.push('M50 4L58 20V92H42V20Z M48 26h4v58h-4z M22 92H78V102H22Z M46 102H54V132H46Z M50 126m-8 0a8 8 0 1 0 16 0a8 8 0 1 0-16 0'); P.push('M44 138H56V150H44Z');
    } else if (t === 'N') {
      P.push('M50 6C86 30 90 76 56 122V150H44V122C10 76 14 30 50 6Z M49 30h2v80h-2z M50 60L68 46L70 50L52 66Z M50 60L32 46L30 50L48 66Z M50 88L70 74L72 78L52 94Z M50 88L30 74L28 78L48 94Z');
    } else if (t === 'L') {
      P.push('M50 4L62 40L58 100H42L38 40Z M30 100H70V108H30Z M45 108H55V138H45Z M44 138H56V148H44Z M47 114h6v3h-6z M47 123h6v3h-6z M47 132h6v3h-6z');
    } else if (t === 'X') {
      P.push('M22 40Q22 20 40 20H64Q80 20 80 38V100Q80 126 56 128H44Q22 126 22 100Z M40 22v38h3V22z M52 22v38h3V22z M64 24v36h3V24z M30 70Q46 64 60 74L58 80Q46 72 32 78Z'); P.push('M40 128H62V150H40Z');
    } else if (t === 'R') {
      P.push('M46 8H54V150H46Z M46 16C6 6 2 62 22 80C32 88 40 84 46 78Z M54 16C94 6 98 62 78 80C68 88 60 84 54 78Z M24 40L38 52L36 56L22 44Z');
    } else if (t === 'I') {
      P.push('M50 6L61 40L96 40L68 62L79 96L50 75L21 96L32 62L4 40L39 40Z'); P.push('M44 92H56V150H44Z');
    } else P.push('M30 10H70Q80 10 80 22V130Q80 150 70 150H30Q20 150 20 130V22Q20 10 30 10Z');   // ficha en blanco (pintando la cantidad)
    return P.map((p) => '<path fill-rule="evenodd" d="' + p + '"/>').join('') + '<path d="' + PIE + '"/>';
  };
  Trk.fichaBlanca = function () { return Trk.ficha('?'); };
})(window.MD);
