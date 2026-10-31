/* Buscar: filtra el catálogo (lugares, eventos, feria, fiestas, platillos) mientras se escribe. */
(function () {
  'use strict';
  var A = window.ColimaApp, raiz = document.querySelector('[data-buscar]');
  if (!A || !raiz) return;
  var entrada = raiz.querySelector('#q'), res = raiz.querySelector('[data-res]');
  var tab = 'all', semana = false, datos = null, temporizador;
  var N = A.normalizar;

  function fila(o) {
    var icono = o.foto ? '<span class="fila-icono"><img src="' + A.esc(o.foto) + '" alt="" loading="lazy" width="40" height="40" /></span>' : '<span class="fila-icono">' + A.ic(o.ic) + '</span>';
    return '<a class="fila" href="' + A.esc(o.url) + '">' + icono + '<span class="fila-texto"><span class="fila-titulo">' + A.esc(o.n) + '</span><span class="fila-sub">' + A.esc(o.sub) + '</span></span>' + A.ic('chevron-derecha') + '</a>';
  }
  function municipio(id) { return ({ 1: 'Colima', 2: 'Villa de Álvarez', 3: 'Manzanillo', 4: 'Comala', 5: 'Minatitlán', 6: 'Tecomán', 7: 'Armería', 8: 'Coquimatlán', 9: 'Cuauhtémoc', 10: 'Ixtlahuacán' })[id] || ''; }
  function finSemana() { return A.sumaDias(A.hoy(), 7); }

  function todos() {
    var salida = [];
    datos.lugares.forEach(function (l) { salida.push({ k: 'lugar', n: l.n, sub: [A.T('buscar.search.kind.' + l.t), municipio(l.m)].filter(Boolean).join(' · '), url: l.url, foto: A.foto(l, 480), ic: 'lugar', t: N(l.n + ' ' + l.d + ' ' + municipio(l.m)) }); });
    datos.eventos.forEach(function (e) { salida.push({ k: 'evento', n: e.n, sub: A.T('buscar.search.kind.event') + ' · ' + A.fechaLarga(e.d, { weekday: undefined }), url: A.ruta('/evento/' + e.id), ic: 'calendario', fecha: e.d, t: N(e.n) }); });
    datos.feria.forEach(function (e) { salida.push({ k: 'feria', n: e.n, sub: A.T('buscar.search.kind.feria') + ' · ' + A.fechaLarga(e.d, { weekday: undefined }) + ' ' + e.h, url: A.ruta('/feria-de-todos-los-santos') + '#dia-' + e.d, ic: 'bandera', fecha: e.d, t: N(e.n) }); });
    datos.fiestas.forEach(function (f) { salida.push({ k: 'fiesta', n: f.n, sub: A.T('buscar.search.kind.festival') + ' · ' + (f.l || municipio(f.m)), url: A.ruta('/fiestas-del-pueblo/' + f.id), ic: 'musica', t: N(f.n + ' ' + f.l) }); });
    datos.platillos.forEach(function (p) { salida.push({ k: 'platillo', n: p.n, sub: A.T('guiaapp.buscar.platillo'), url: A.ruta('/gastronomia/' + p.id), ic: 'cubiertos', t: N(p.n) }); });
    return salida;
  }

  var cache = null;
  function pintar() {
    var q = N(entrada.value.trim());
    if (!q && !semana) {
      res.innerHTML = '<div class="estado-vista"><span class="ev-icono">' + A.ic('buscar') + '</span><h2>' + A.esc(A.T('buscar.search.hintTitle')) + '</h2><p>' + A.esc(A.T('buscar.search.hint')) + '</p></div>';
      return;
    }
    if (!cache) cache = todos();
    var palabras = q.split(/\s+/).filter(Boolean), hoy = A.hoy(), fin = finSemana();
    var lista = cache.filter(function (o) {
      if (tab !== 'all' && o.k !== tab) return false;
      if (semana && !(o.fecha && o.fecha >= hoy && o.fecha <= fin)) return false;
      return palabras.every(function (p) { return o.t.indexOf(p) >= 0; });
    }).slice(0, 80);
    if (!lista.length) {
      res.innerHTML = '<div class="estado-vista"><span class="ev-icono">' + A.ic('buscar') + '</span><h2>' + A.esc(A.T('buscar.search.emptyTitle')) + '</h2><p>' + A.esc(A.T('buscar.search.emptyHint')) + '</p></div>';
      return;
    }
    res.innerHTML = '<div class="filas" style="margin-top:18px">' + lista.map(fila).join('') + '</div>';
  }

  function iniciar() { A.catalogo().then(function (d) { datos = d; pintar(); }).catch(function () { res.innerHTML = '<p class="estado-inline">' + A.esc(A.T('guiaapp.error')) + '</p>'; }); }
  entrada.addEventListener('input', function () { clearTimeout(temporizador); temporizador = setTimeout(function () { if (datos) pintar(); }, 120); });
  raiz.addEventListener('click', function (e) {
    var b = e.target.closest('[data-tab]');
    if (b) { tab = b.dataset.tab; raiz.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', String(x === b)); }); if (datos) pintar(); }
    var f = e.target.closest('[data-filtro]');
    if (f) { semana = !semana; f.setAttribute('aria-pressed', String(semana)); if (datos) pintar(); }
  });
  iniciar();
  entrada.focus({ preventScroll: true });
})();
