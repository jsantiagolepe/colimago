/* Avisos de protección civil vigentes: franja arriba del Inicio (lluvias, huracanes, otras emergencias). */
(function () {
  'use strict';
  var A = window.ColimaApp, Co = window.Colima, caja = document.querySelector('[data-alertas]');
  if (!A || !Co || !caja) return;
  var T = A.T, esc = A.esc;
  Co.api('/alertas').then(function (r) {
    var lista = (r.ok && r.datos.alertas) || [];
    if (!lista.length) return;
    var peso = { alerta: 3, precaucion: 2, informativo: 1 };
    lista.sort(function (a, b) { return (peso[b.gravedad] || 0) - (peso[a.gravedad] || 0); });
    var a = lista[0], en = A.lang === 'en';
    caja.className = 'franja-alerta gravedad-' + esc(a.gravedad);
    caja.innerHTML = '<span class="franja-tipo">' + A.ic('info') + esc(T('alertas.alertas.gravedad.' + a.gravedad)) + ' · ' + esc(T('alertas.alertas.tipo.' + a.tipo)) + '</span><strong>' + esc((en && a.tituloEn) || a.tituloEs) + '</strong><span>' + esc((en && a.cuerpoEn) || a.cuerpoEs) + '</span>' +
      '<span class="nota">' + (a.fuenteUrl && /^https?:\/\//.test(a.fuenteUrl) ? '<a href="' + esc(a.fuenteUrl) + '" target="_blank" rel="noopener nofollow">' + esc(T('alertas.alertas.fuente', { nombre: a.fuenteNombre })) + '</a>' : '') + (lista.length > 1 ? ' · ' + esc(T('alertas.alertas.mas', { count: lista.length - 1 })) : '') + '</span>';
    caja.hidden = false;
  });
})();
