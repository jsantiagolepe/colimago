/* Mapa general: pines por categoría sobre OpenStreetMap (Leaflet), filtro por categoría y "Mi ubicación". */
(function () {
  'use strict';
  var A = window.ColimaApp, raiz = document.querySelector('[data-mapa]');
  if (!A || !raiz || !window.L) return;
  var CAT = { 11: 'playas', 10: 'rios', 12: 'rios', 13: 'naturaleza', 15: 'naturaleza', 17: 'naturaleza', 18: 'naturaleza', 14: 'cultura', 16: 'cultura', 30: 'mercados', 31: 'mercados', 21: 'comer', 20: 'dormir' };
  var COLOR = { playas: '#2aa3c9', rios: '#3a6fd6', naturaleza: '#3fa055', cultura: '#b8321f', mercados: '#e0932a', comer: '#d1566a', dormir: '#8b63c9' };
  var MUNI = { 1: 'Colima', 2: 'Villa de Álvarez', 3: 'Manzanillo', 4: 'Comala', 5: 'Minatitlán', 6: 'Tecomán', 7: 'Armería', 8: 'Coquimatlán', 9: 'Cuauhtémoc', 10: 'Ixtlahuacán' };

  var mapa = L.map('mapa-lienzo', { scrollWheelZoom: false }).setView([19.1, -103.8], 9);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' }).addTo(mapa);
  var capa = L.layerGroup().addTo(mapa), pines = [], yo = null;

  A.catalogo().then(function (d) {
    d.lugares.forEach(function (l) {
      if (l.la == null || !CAT[l.t]) return;
      var c = CAT[l.t];
      var icono = L.divIcon({ className: '', html: '<div class="marca-pin" style="--c:' + COLOR[c] + '"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
      var m = L.marker([l.la, l.lo], { icon: icono, title: l.n, alt: l.n });
      m.bindPopup('<strong><a href="' + A.esc(l.url) + '">' + A.esc(l.n) + '</a></strong><div class="mapa-pop-muni">' + A.esc(MUNI[l.m] || '') + ' · ' + A.esc(A.T('mapa.map.cat.' + c)) + '</div>');
      pines.push({ c: c, m: m });
    });
    mostrar('');
  }).catch(function () { A.aviso(A.T('guiaapp.error')); });

  function mostrar(cat) {
    capa.clearLayers();
    var visibles = pines.filter(function (p) { return !cat || p.c === cat; });
    visibles.forEach(function (p) { capa.addLayer(p.m); });
    if (visibles.length) mapa.fitBounds(L.featureGroup(visibles.map(function (p) { return p.m; })).getBounds().pad(0.1));
    else A.aviso(A.T('mapa.map.noneInCategory'));
  }
  raiz.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (b) { raiz.querySelectorAll('[data-cat]').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); mostrar(b.dataset.cat); }
    if (e.target.closest('[data-yo]')) {
      A.ubicar().then(function (p) {
        if (yo) mapa.removeLayer(yo);
        yo = L.marker([p.lat, p.lng], { icon: L.divIcon({ className: '', html: '<div class="marca-yo"></div>', iconSize: [16, 16], iconAnchor: [8, 8] }), title: A.T('mapa.map.myLocation') }).addTo(mapa);
        mapa.setView([p.lat, p.lng], 12);
      }).catch(function () { A.aviso(A.T('mapa.map.errorText')); });
    }
  });
  mapa.on('focus', function () { mapa.scrollWheelZoom.enable(); });
  mapa.on('blur', function () { mapa.scrollWheelZoom.disable(); });
})();
