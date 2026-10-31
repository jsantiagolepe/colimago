/* Yo: resumen (hub), Pasaporte Colima, Mis listas y Mis planes. Todo en este navegador. */
(function () {
  'use strict';
  var A = window.ColimaApp, M = window.ColimaMis, Co = window.Colima;
  var raiz = document.querySelector('[data-yo]');
  if (!A || !M || !raiz) return;
  var T = A.T, esc = A.esc, ic = A.ic;
  var vista = raiz.dataset.yo, cont = raiz.querySelector('[data-contenido]');
  var params = new URLSearchParams(location.search);

  function vacio(icono, titulo, texto, extra) { return '<div class="estado-vista"><span class="ev-icono">' + ic(icono) + '</span><h2>' + esc(titulo) + '</h2><p>' + esc(texto) + '</p>' + (extra || '') + '</div>'; }
  function fila(o) {
    return '<' + (o.href ? 'a href="' + esc(o.href) + '"' : 'div') + ' class="fila"' + (o.attrs || '') + '><span class="fila-icono">' + (o.img ? '<img src="' + esc(o.img) + '" alt="" loading="lazy" width="40" height="40" />' : ic(o.ic || 'lugar')) + '</span><span class="fila-texto"><span class="fila-titulo">' + esc(o.t) + '</span>' + (o.s ? '<span class="fila-sub">' + esc(o.s) + '</span>' : '') + '</span>' + (o.fin || (o.href ? ic('chevron-derecha') : '')) + '</' + (o.href ? 'a' : 'div') + '>';
  }
  function actualizar() { if (vista === 'listas') listasVista(); else if (vista === 'planes') planesVista(); else if (vista === 'pasaporte') pasaporteVista(); }

  // ---------- Hub: resúmenes ----------
  function hub() {
    var n = Object.keys(M.sellos()).length, l = M.listas(), guardados = l.quieroIr.length + l.yaFui.length + l.propias.reduce(function (a, p) { return a + p.items.length; }, 0), p = M.planes().length;
    function poner(clave, texto) { var e = raiz.querySelector('[data-resumen="' + clave + '"]'); if (e) e.textContent = texto; }
    if (n) A.catalogo().then(function (c) { poner('pasaporte', T('pasaporte.passport.progress', { done: n, total: totalSellables(c).length })); }).catch(function () {});
    if (guardados) poner('listas', T('listas.lists.count', { count: guardados }, guardados));
    if (p) poner('planes', T('planes.plan.stops', { count: p }, p).replace(/parada|stop/i, function (m) { return m; }) && (p + (A.lang === 'en' ? ' plan' + (p > 1 ? 's' : '') : (p > 1 ? ' planes' : ' plan'))));
  }

  // ---------- Pasaporte ----------
  var CATS_PASAPORTE = [['playas', [11]], ['rios', [10, 12]], ['montanas', [13]], ['cultura', [14, 16]], ['parques', [15, 18]], ['balnearios', [17]]];
  function totalSellables(c) { var tipos = [].concat.apply([], CATS_PASAPORTE.map(function (x) { return x[1]; })); return c.lugares.filter(function (l) { return l.la != null && tipos.indexOf(l.t) >= 0; }); }
  var RADIO_SELLO = 200;

  function pasaporteVista() {
    A.catalogo().then(function (c) {
      var s = M.sellos(), todos = totalSellables(c), hechos = todos.filter(function (l) { return s[l.s]; }).length;
      var html = '<div class="tarjeta pasaporte-resumen"><strong>' + esc(T('pasaporte.passport.progress', { done: hechos, total: todos.length })) + '</strong><div class="barra-progreso" aria-hidden="true"><span style="width:' + (todos.length ? Math.round(hechos * 100 / todos.length) : 0) + '%"></span></div><button class="btn-pintado" type="button" data-sellar-aqui style="margin-top:14px">' + ic('ubicacion') + '<span>' + esc(T('pasaporte.passport.stampHere')) + '</span></button><p class="nota" style="margin-top:10px">' + esc(T('pasaporte.passport.hint')) + '</p><p class="nota" data-msg role="status"></p></div>';
      CATS_PASAPORTE.forEach(function (cat) {
        var lugares = todos.filter(function (l) { return cat[1].indexOf(l.t) >= 0; }).sort(function (a, b) { return a.n.localeCompare(b.n, 'es'); });
        if (!lugares.length) return;
        html += '<section class="bloque" style="margin-top:28px"><h2>' + esc(T('pasaporte.passport.categories.' + cat[0])) + '</h2><div class="filas">' + lugares.map(function (l) {
          var f = s[l.s];
          return fila({ href: l.url, img: A.foto(l, 480), t: l.n, s: f ? T('pasaporte.passport.stamped', { date: A.fechaLarga(f, { weekday: undefined }) }) : '', fin: f ? '<span class="sello" aria-label="' + esc(T('pasaporte.passport.stamped', { date: f })) + '">' + ic('paloma') + '</span>' : '<button class="btn-contorno btn-chico" type="button" data-sellar="' + esc(l.s) + '">' + esc(T('pasaporte.passport.stamp')) + '</button>' });
        }).join('') + '</div></section>';
      });
      cont.innerHTML = html;
      var cat = c;
      cont.onclick = function (e) {
        var b = e.target.closest('[data-sellar]'), aqui = e.target.closest('[data-sellar-aqui]');
        if (e.target.closest('a')) return;
        var msg = cont.querySelector('[data-msg]');
        if (!b && !aqui) return;
        A.ubicar().then(function (p) {
          var cand = totalSellables(cat).map(function (l) { return { l: l, m: A.distanciaM(p, { lat: l.la, lng: l.lo }) }; }).sort(function (x, y) { return x.m - y.m; });
          if (b) {
            var uno = cand.filter(function (x) { return x.l.s === b.dataset.sellar; })[0];
            if (uno.m > RADIO_SELLO) { msg.textContent = T('pasaporte.passport.tooFar', { meters: Math.round(uno.m / 10) * 10 }); return; }
            M.sellar(uno.l.s); A.aviso(T('pasaporte.passport.justStamped', { name: uno.l.n })); pasaporteVista();
          } else {
            var sin = cand.filter(function (x) { return !M.sellos()[x.l.s] && x.m <= RADIO_SELLO; })[0];
            if (!sin) { msg.textContent = T('pasaporte.passport.nothingNear', { meters: RADIO_SELLO }); return; }
            M.sellar(sin.l.s); A.aviso(T('pasaporte.passport.justStamped', { name: sin.l.n })); pasaporteVista();
          }
        }).catch(function (er) { msg.textContent = er && er.code === 1 ? T('pasaporte.passport.denied') : T('pasaporte.passport.locationError'); });
      };
    }).catch(function () { cont.innerHTML = '<p class="estado-inline">' + esc(T('guiaapp.error')) + '</p>'; });
  }

  // ---------- Listas ----------
  function listasVista() {
    var id = params.get('l');
    var l = M.listas();
    if (id) return listaDetalle(id, l);
    function cuenta(a) { return T(a.length === 1 ? 'listas.lists.countOne' : 'listas.lists.count', { count: a.length }); }
    var html = '<div class="filas">' + fila({ href: A.ruta('/favoritos'), ic: 'corazon', t: T('comun.nav.favoritos') }) +
      fila({ href: '?l=quieroIr', ic: 'marcador', t: M.nombreLista(l, 'quieroIr'), s: cuenta(l.quieroIr) }) +
      fila({ href: '?l=yaFui', ic: 'paloma', t: M.nombreLista(l, 'yaFui'), s: cuenta(l.yaFui) }) + '</div>';
    html += '<section class="bloque" style="margin-top:28px"><h2>' + esc(T('listas.lists.mine')) + '</h2>' + (l.propias.length ? '<div class="filas">' + l.propias.map(function (p) { return fila({ href: '?l=' + p.id, ic: 'marcador', t: p.nombre, s: cuenta(p.items) }); }).join('') + '</div>' : '') +
      '<form class="mis-nueva" data-nueva style="display:flex;gap:8px;margin-top:14px"><input type="text" maxlength="40" placeholder="' + esc(T('listas.lists.namePlaceholder')) + '" aria-label="' + esc(T('listas.lists.nameLabel')) + '" /><button class="btn-pintado btn-chico" type="submit"><span>' + esc(T('listas.lists.newButton')) + '</span></button></form></section><p class="nota" style="margin-top:16px">' + esc(T('guiaapp.yo.guardadoLocal')) + '</p>';
    cont.innerHTML = html;
    cont.querySelector('[data-nueva]').onsubmit = function (e) {
      e.preventDefault();
      var r = M.nuevaLista(e.target.querySelector('input').value);
      if (r.error) return A.aviso(r.error);
      listasVista();
    };
  }
  function listaDetalle(id, l) {
    var items = M.arregloDe(l, id), propia = l.propias.filter(function (p) { return p.id === id; })[0];
    if (!items) { cont.innerHTML = vacio('marcador', T('listas.lists.missingTitle'), T('listas.lists.missingText'), '<a class="btn-contorno" href="?">' + esc(T('guiaapp.yo.volver')) + '</a>'); return; }
    var titulo = M.nombreLista(propia, id);
    var html = '<nav class="migas" style="padding:0 0 12px"><a href="?">' + ic('chevron-izquierda') + esc(T('listas.lists.title')) + '</a></nav><h2 style="font-size:24px;margin-bottom:14px">' + esc(titulo) + '</h2>';
    html += items.length ? '<div class="filas">' + items.map(function (it, i) { return fila({ href: it.u, img: it.f, ic: it.k === 'evento' ? 'calendario' : 'lugar', t: it.n, fin: '<button class="btn-icono" type="button" data-quitar="' + i + '" aria-label="' + esc(T('listas.lists.remove')) + '">' + ic('cerrar') + '</button>' }); }).join('') + '</div>' : vacio('marcador', T('listas.lists.emptyTitle'), T('listas.lists.emptyText'));
    if (propia) html += '<button class="btn-contorno btn-peligro btn-chico" type="button" data-borrar style="margin-top:20px">' + ic('bote') + '<span>' + esc(T('listas.lists.deleteTitle')) + '</span></button>';
    cont.innerHTML = html;
    cont.onclick = function (e) {
      var q = e.target.closest('[data-quitar]');
      if (q) { e.preventDefault(); var ll = M.listas(); M.arregloDe(ll, id).splice(Number(q.dataset.quitar), 1); M.guardarListas(ll); listaDetalle(id, ll); }
      if (e.target.closest('[data-borrar]')) {
        Co.confirmar({ titulo: T('listas.lists.deleteTitle'), texto: T('listas.lists.deleteText', { name: titulo }), aceptar: T('guiaapp.yo.borrar'), peligro: true }).then(function (si) {
          if (!si) return; var ll = M.listas(); ll.propias = ll.propias.filter(function (p) { return p.id !== id; }); M.guardarListas(ll); location.href = location.pathname;
        });
      }
    };
  }

  // ---------- Planes ----------
  function planesVista() {
    var id = params.get('p');
    if (id) return planDetalle(id);
    var p = M.planes(), hoy = A.hoy();
    var html = p.length ? '<div class="filas">' + p.map(function (pl) { return fila({ href: '?p=' + pl.id, ic: 'calendario', t: pl.nombre, s: A.fechaLarga(pl.inicio, { weekday: undefined }) + ' – ' + A.fechaLarga(pl.fin, { weekday: undefined }) + ' · ' + T(pl.paradas.length === 1 ? 'planes.plan.stopsOne' : 'planes.plan.stops', { count: pl.paradas.length }) }); }).join('') + '</div>' : vacio('calendario', T('planes.plan.emptyTitle'), T('planes.plan.emptyText'));
    html += '<section class="bloque" style="margin-top:28px"><h2>' + esc(T('planes.plan.newTitle')) + '</h2><form data-nuevo style="display:grid;gap:12px;max-width:460px"><label class="campo"><span class="campo-etiqueta">' + esc(T('planes.plan.nameLabel')) + '</span><input type="text" name="n" maxlength="40" value="' + esc(T('planes.plan.defaultName')) + '" /></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="campo"><span class="campo-etiqueta">' + esc(T('guiaapp.yo.desde')) + '</span><input type="date" name="i" value="' + hoy + '" /></label><label class="campo"><span class="campo-etiqueta">' + esc(T('guiaapp.yo.hasta')) + '</span><input type="date" name="f" value="' + A.sumaDias(hoy, 2) + '" /></label></div><p class="nota">' + esc(T('planes.plan.datesHint', { max: M.MAX_DIAS })) + '</p><button class="btn-pintado" type="submit"><span>' + esc(T('planes.plan.create')) + '</span></button></form></section>';
    cont.innerHTML = html;
    cont.querySelector('[data-nuevo]').onsubmit = function (e) {
      e.preventDefault(); var f = e.target.elements;
      if (!M.fechasValidas(f.i.value, f.f.value)) return A.aviso(T('guiaapp.yo.fechasInvalidas'));
      var plan = M.nuevoPlan(f.n.value, f.i.value, f.f.value, 1); location.search = '?p=' + plan.id;
    };
  }
  function planDetalle(id) {
    var todos = M.planes(), plan = todos.filter(function (x) { return x.id === id; })[0];
    if (!plan) { cont.innerHTML = vacio('calendario', T('planes.plan.missingTitle'), T('planes.plan.missingText'), '<a class="btn-contorno" href="?">' + esc(T('guiaapp.yo.volver')) + '</a>'); return; }
    var html = '<nav class="migas" style="padding:0 0 12px"><a href="?">' + ic('chevron-izquierda') + esc(T('planes.plan.listTitle')) + '</a></nav><h2 style="font-size:24px">' + esc(plan.nombre) + '</h2><p class="nota" style="margin:4px 0 18px">' + esc(A.fechaLarga(plan.inicio, { weekday: undefined })) + ' – ' + esc(A.fechaLarga(plan.fin, { weekday: undefined })) + ' · ' + esc(T('planes.plan.stops', { count: plan.paradas.length }, plan.paradas.length)) + '</p><div class="pagina-acciones" style="margin:0 0 20px"><button class="btn-contorno btn-chico" type="button" data-ics>' + ic('calendario') + '<span>' + esc(T('alcalendario.toCalendar.button')) + '</span></button><button class="btn-contorno btn-chico" type="button" data-compartir>' + ic('compartir') + '<span>' + esc(T('planes.plan.share')) + '</span></button><button class="btn-contorno btn-peligro btn-chico" type="button" data-borrar>' + ic('bote') + '<span>' + esc(T('planes.plan.deleteTitle')) + '</span></button></div>';
    M.diasDe(plan).forEach(function (d) {
      var ps = plan.paradas.filter(function (x) { return x.dia === d; }).sort(function (a, b) { return (a.hora || '99') < (b.hora || '99') ? -1 : 1; });
      html += '<section class="bloque"><h3 style="font-size:18px;margin-bottom:10px;text-transform:capitalize">' + esc(A.fechaLarga(d)) + '</h3>';
      html += ps.length ? '<div class="filas">' + ps.map(function (x) { return fila({ href: x.u, ic: x.k === 'evento' ? 'calendario' : 'lugar', t: x.n, s: x.hora || T('planes.plan.noTime'), fin: '<input type="time" value="' + esc(x.hora || '') + '" data-hora="' + esc(x.pid) + '" aria-label="' + esc(T('planes.plan.timeLabel')) + '" style="width:auto;padding:6px 8px" /><button class="btn-icono" type="button" data-quitar="' + esc(x.pid) + '" aria-label="' + esc(T('planes.plan.removeStop')) + '">' + ic('cerrar') + '</button>' }); }).join('') + '</div>' : '<p class="nota">' + esc(T('planes.plan.dayEmptyText')) + '</p>';
      html += '</section>';
    });
    cont.innerHTML = html;
    cont.onchange = function (e) {
      var h = e.target.closest('[data-hora]'); if (!h) return;
      var ll = M.planes(), pl = ll.filter(function (x) { return x.id === id; })[0]; pl.paradas.forEach(function (x) { if (x.pid === h.dataset.hora) x.hora = h.value || null; });
      M.guardarPlanes(ll); planDetalle(id);
    };
    cont.onclick = function (e) {
      var q = e.target.closest('[data-quitar]');
      if (q) { e.preventDefault(); var ll = M.planes(), pl = ll.filter(function (x) { return x.id === id; })[0]; pl.paradas = pl.paradas.filter(function (x) { return x.pid !== q.dataset.quitar; }); M.guardarPlanes(ll); planDetalle(id); return; }
      if (e.target.closest('[data-ics]')) {
        var ev = plan.paradas.filter(function (x) { return x.hora; }).map(function (x) { return { titulo: x.n, fecha: x.dia, hora: x.hora, minutos: 90, descripcion: location.origin + x.u }; });
        if (!ev.length) return A.aviso(T('alcalendario.toCalendar.nothing'));
        A.descargarICS(plan.nombre, ev); A.aviso(T('alcalendario.toCalendar.addedMany', {}, ev.length));
      }
      if (e.target.closest('[data-compartir]')) {
        var texto = plan.nombre + '\n' + M.diasDe(plan).map(function (d) { return A.fechaLarga(d) + '\n' + plan.paradas.filter(function (x) { return x.dia === d; }).map(function (x) { return '  ' + (x.hora ? x.hora + ' ' : '') + x.n; }).join('\n'); }).join('\n\n') + '\n\ncolimago.mx';
        if (navigator.share) navigator.share({ title: plan.nombre, text: texto }).catch(function () {}); else if (navigator.clipboard) navigator.clipboard.writeText(texto).then(function () { A.aviso(T('guiaapp.yo.copiado')); });
      }
      if (e.target.closest('[data-borrar]')) {
        Co.confirmar({ titulo: T('planes.plan.deleteTitle'), texto: T('planes.plan.deleteText', { name: plan.nombre }), aceptar: T('guiaapp.yo.borrar'), peligro: true }).then(function (si) {
          if (si) { M.guardarPlanes(M.planes().filter(function (x) { return x.id !== id; })); location.href = location.pathname; }
        });
      }
    };
  }

  if (vista === 'hub') hub(); else actualizar();
})();
