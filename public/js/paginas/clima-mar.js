/* Ahora en la playa: clima y oleaje (vía /g/clima-mar/:id, que cachea 10 min). */
(function () {
  'use strict';
  var A = window.ColimaApp, Co = window.Colima, sec = document.querySelector('[data-clima]');
  if (!A || !Co || !sec) return;
  var cuerpo = sec.querySelector('[data-clima-cuerpo]'), T = A.T, esc = A.esc;
  function hora(iso) { try { return new Date(iso).toLocaleTimeString(A.lang === 'en' ? 'en-US' : 'es-MX', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Mexico_City' }); } catch (e) { return ''; } }
  function cargar() {
    cuerpo.innerHTML = '<p class="nota">' + esc(T('playaahora.beachNow.loading')) + '</p>';
    Co.api('/clima-mar/' + encodeURIComponent(sec.dataset.id) + '?lang=' + A.lang).then(function (r) {
      var d = r.datos;
      if (!r.ok || (!d.clima && !d.mar)) {
        cuerpo.innerHTML = '<p class="nota">' + esc(T('playaahora.beachNow.errorTitle')) + '. ' + esc(T('playaahora.beachNow.errorText')) + '</p><button class="btn-contorno btn-chico" type="button" data-reintentar>' + esc(T('playaahora.beachNow.retry')) + '</button>';
        return;
      }
      var html = '<div class="clima-datos">';
      if (d.clima) html += '<div class="tarjeta clima-bloque"><span class="etiqueta-suave">' + esc(T('playaahora.beachNow.weather')) + '</span><strong class="clima-cifra">' + Math.round(d.clima.temperaturaC) + '°C</strong><span>' + esc(d.clima.condicion || '') + '</span></div>';
      if (d.mar) html += '<div class="tarjeta clima-bloque"><span class="etiqueta-suave">' + esc(T('playaahora.beachNow.waves')) + '</span><strong class="clima-cifra">' + d.mar.alturaM.toFixed(1) + ' m</strong><span>' + (d.mar.periodoS ? esc(T('playaahora.beachNow.period')) + ' ' + Math.round(d.mar.periodoS) + ' s' : '') + '</span></div>';
      else html += '<div class="tarjeta clima-bloque"><span class="etiqueta-suave">' + esc(T('playaahora.beachNow.waves')) + '</span><span>' + esc(T('playaahora.beachNow.noWaves')) + '</span></div>';
      html += '</div><p class="nota" style="margin-top:10px">' + (d.actualizado ? esc(T('playaahora.beachNow.updated', { time: hora(d.actualizado) })) + ' · ' : '') + (d.fuentes && d.fuentes.clima ? esc(T('playaahora.beachNow.sourceWeather', { source: d.fuentes.clima })) + ' · ' : '') + (d.fuentes && d.fuentes.mar ? esc(T('playaahora.beachNow.sourceWaves', { source: d.fuentes.mar })) : '') + '</p><p class="nota">' + esc(T('playaahora.beachNow.disclaimer')) + '</p>';
      cuerpo.innerHTML = html;
    });
  }
  sec.addEventListener('click', function (e) { if (e.target.closest('[data-reintentar]')) cargar(); });
  cargar();
})();
