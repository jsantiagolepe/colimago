/* Cerca de mí: pide la ubicación y ordena el catálogo por distancia dentro de un radio. */
(function () {
  'use strict';
  var A = window.ColimaApp, raiz = document.querySelector('[data-cerca]');
  if (!A || !raiz) return;
  var estado = raiz.querySelector('[data-estado]'), lista = raiz.querySelector('[data-lista]'), radios = raiz.querySelector('[data-radios]');
  var RADIOS = [5, 15, 30, 60], radio = 15, aqui = null, datos = null;

  function mensaje(titulo, texto, botones) {
    estado.className = 'estado-vista';
    estado.innerHTML = '<span class="ev-icono">' + A.ic('ubicacion') + '</span><h2>' + A.esc(titulo) + '</h2><p>' + A.esc(texto) + '</p>' + (botones || '');
  }
  function municipio(id) { return ({ 1: 'Colima', 2: 'Villa de Álvarez', 3: 'Manzanillo', 4: 'Comala', 5: 'Minatitlán', 6: 'Tecomán', 7: 'Armería', 8: 'Coquimatlán', 9: 'Cuauhtémoc', 10: 'Ixtlahuacán' })[id] || ''; }

  function pintar() {
    var cerca = datos.lugares.filter(function (l) { return l.la != null; }).map(function (l) { return { l: l, m: A.distanciaM(aqui, { lat: l.la, lng: l.lo }) }; })
      .filter(function (x) { return x.m <= radio * 1000; }).sort(function (a, b) { return a.m - b.m; });
    radios.hidden = false;
    radios.innerHTML = RADIOS.map(function (r) { return '<button class="chip" type="button" data-r="' + r + '" aria-pressed="' + (r === radio) + '">' + A.esc(A.T('cerca.nearby.radius', { km: r })) + '</button>'; }).join('');
    if (!cerca.length) {
      var mas = RADIOS.filter(function (r) { return r > radio; })[0];
      mensaje(A.T('cerca.nearby.emptyTitle'), mas ? A.T('cerca.nearby.emptyText') : A.T('cerca.nearby.emptyMaxText'), mas ? '<button class="btn-contorno" type="button" data-r="' + mas + '">' + A.esc(A.T('cerca.nearby.widen', { km: mas })) + '</button>' : '');
      lista.innerHTML = '';
      return;
    }
    estado.className = 'estado-inline';
    estado.textContent = A.T('cerca.nearby.summary', { places: A.T('cerca.nearby.places', { count: cerca.length }, cerca.length), km: radio });
    lista.innerHTML = '<div class="filas">' + cerca.slice(0, 100).map(function (x) {
      var f = A.foto(x.l, 480);
      return '<a class="fila" href="' + A.esc(x.l.url) + '"><span class="fila-icono">' + (f ? '<img src="' + A.esc(f) + '" alt="" loading="lazy" width="40" height="40" />' : A.ic('lugar')) + '</span><span class="fila-texto"><span class="fila-titulo">' + A.esc(x.l.n) + '</span><span class="fila-sub">' + A.esc(A.T('cerca.nearby.away', { municipio: municipio(x.l.m), distance: A.textoDistancia(x.m) })) + '</span></span>' + A.ic('chevron-derecha') + '</a>';
    }).join('') + '</div>';
  }

  function localizar() {
    estado.className = 'estado-inline'; estado.textContent = A.T('cerca.nearby.loading'); lista.innerHTML = ''; radios.hidden = true;
    Promise.all([A.ubicar(), A.catalogo()]).then(function (r) { aqui = r[0]; datos = r[1]; pintar(); }).catch(function (e) {
      if (e && e.code === 1) mensaje(A.T('cerca.nearby.deniedTitle'), A.T('cerca.nearby.deniedText'), '<a class="btn-contorno" href="' + A.ruta('/municipios') + '">' + A.esc(A.T('cerca.nearby.pickMunicipality')) + '</a>');
      else mensaje(A.T('cerca.nearby.errorTitle'), A.T('cerca.nearby.errorText'), '<button class="btn-contorno" type="button" data-reintentar>' + A.esc(A.T('cerca.nearby.retry')) + '</button>');
    });
  }
  raiz.addEventListener('click', function (e) {
    var r = e.target.closest('[data-r]');
    if (r) { radio = Number(r.dataset.r); if (aqui && datos) pintar(); }
    if (e.target.closest('[data-reintentar]')) localizar();
  });
  localizar();
})();
