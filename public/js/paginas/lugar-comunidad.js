/* Ficha de un lugar: Cómo está ahora (reportes en vivo), Reseñas y Pregúntale a un local. Todo pasa por /g/*;
   escribir, borrar y reportar piden sesión. Requiere core.js y app.js. */
(function () {
  'use strict';
  var A = window.ColimaApp, Co = window.Colima;
  if (!A || !Co) return;
  var T = A.T, esc = A.esc, ic = A.ic;
  var pedirSesion = function () { return Co.requerirSesion('pitchAcciones'); };

  function cuando(iso) {
    var seg = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(seg)) return '';
    if (seg < 120) return T('guiaapp.com.ahora');
    if (seg < 3600) return T('guiaapp.com.hace', { n: Math.round(seg / 60), u: 'min' });
    if (seg < 86400) return T('guiaapp.com.hace', { n: Math.round(seg / 3600), u: 'h' });
    return new Date(iso).toLocaleDateString(A.lang === 'en' ? 'en-US' : 'es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function error(r) { A.aviso(Co.mensajeError(r)); }
  function avatar(img) { return img ? '<img src="' + esc(img) + '" alt="" referrerpolicy="no-referrer" loading="lazy" />' : '<span class="fila-icono" style="width:32px;height:32px">' + ic('usuario') + '</span>'; }
  function estrellas(n, grande) { var s = ''; for (var i = 1; i <= 5; i++) s += ic('estrella', i <= Math.round(n) ? 'llena' : ''); return '<span class="estrellas" aria-hidden="true">' + s + '</span>'; }

  // Hoja con un campo de texto (reportar, preguntar, responder)
  function hojaTexto(o) {
    var cuerpo = document.createElement('form');
    cuerpo.innerHTML = '<label class="campo"><span class="campo-etiqueta">' + esc(o.etiqueta || '') + '</span><textarea maxlength="' + o.max + '" rows="4" placeholder="' + esc(o.placeholder || '') + '" required></textarea></label>' + (o.ayuda ? '<p class="nota" style="margin-bottom:12px">' + esc(o.ayuda) + '</p>' : '') + '<button class="btn-pintado" type="submit"><span>' + esc(o.boton) + '</span></button>';
    var d = Co.hoja({ id: 'hoja-texto', titulo: o.titulo, cuerpo: cuerpo });
    cuerpo.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = cuerpo.querySelector('textarea').value.trim();
      if (!v) return A.aviso(T('preguntas.preguntas.writeSomething'));
      var b = cuerpo.querySelector('button'); b.disabled = true;
      o.enviar(v).then(function (ok) { if (ok) Co.cerrarHoja(d); else b.disabled = false; });
    });
  }
  function reportar(ruta, cuerpoBase, claveOculta) {
    var motivos = { ofensiva: T('resenas.resenas.motivos.ofensiva'), spam: T('resenas.resenas.motivos.spam'), falsa: T('resenas.resenas.motivos.falsa'), otro: T('resenas.resenas.motivos.otro') };
    var cuerpo = document.createElement('div');
    cuerpo.innerHTML = '<p class="nota" style="margin-bottom:12px">' + esc(T('resenas.resenas.reportHint')) + '</p><div class="filas">' + Object.keys(motivos).map(function (k) { return '<button class="fila" type="button" data-m="' + k + '" style="width:100%;background:none;border:0;text-align:left"><span class="fila-texto"><span class="fila-titulo">' + esc(motivos[k]) + '</span></span></button>'; }).join('') + '</div>';
    var d = Co.hoja({ id: 'hoja-reportar', titulo: T('resenas.resenas.reportTitle'), cuerpo: cuerpo });
    cuerpo.addEventListener('click', function (e) {
      var b = e.target.closest('[data-m]'); if (!b) return;
      Co.api(ruta, { metodo: 'POST', cuerpo: Object.assign({ motivo: motivos[b.dataset.m] }, cuerpoBase) }).then(function (r) {
        if (!r.ok) return error(r);
        A.aviso(r.datos[claveOculta] ? T('resenas.resenas.reportedHidden') : T('resenas.resenas.reported')); Co.cerrarHoja(d);
      });
    });
  }

  // ---------- Cómo está ahora ----------
  var vivo = document.querySelector('[data-vivo]');
  if (vivo) (function () {
    var id = vivo.dataset.id, cuerpo = vivo.querySelector('[data-cuerpo]');
    function cargar() {
      Co.api('/vivo/lugar/' + id).then(function (r) {
        if (!r.ok) { cuerpo.innerHTML = '<p class="nota">' + esc(T('guiaapp.com.error')) + '</p>'; return; }
        var cuenta = {}; (r.datos.reportes || []).forEach(function (x) { cuenta[x.tipo] = (cuenta[x.tipo] || { n: 0, c: x.creadoEn }); cuenta[x.tipo].n++; });
        var tipos = Object.keys(cuenta);
        var mio = r.datos.miReporte;
        cuerpo.innerHTML = (tipos.length ? '<div class="vivo-lista">' + tipos.map(function (k) { return '<span class="vivo-etiqueta">' + esc(T('vivo.vivo.tipos.' + k)) + ' <small>' + esc(cuando(cuenta[k].c)) + (cuenta[k].n > 1 ? ' · ' + esc(T('vivo.vivo.more', { count: cuenta[k].n - 1 })) : '') + '</small></span>'; }).join('') + '</div>' : '<p class="nota">' + esc(T('vivo.vivo.empty')) + '</p>') +
          '<div class="pagina-acciones"><button class="btn-contorno btn-chico" type="button" data-reportar>' + esc(mio ? T('vivo.vivo.change') : T('vivo.vivo.report')) + '</button>' + (mio ? '<button class="btn-texto" type="button" data-retirar>' + esc(T('guiaapp.yo.borrar')) + '</button>' : '') + '</div>';
        cuerpo.querySelector('[data-reportar]').onclick = function () { pedirSesion().then(function (ok) { if (ok) elegir(r.datos.tipos); }); };
        var ret = cuerpo.querySelector('[data-retirar]'); if (ret) ret.onclick = function () { Co.api('/vivo/' + id, { metodo: 'DELETE' }).then(function (x) { if (!x.ok) return error(x); cargar(); }); };
      });
    }
    function elegir(tipos) {
      var c = document.createElement('div');
      c.innerHTML = '<div class="filas">' + tipos.map(function (k) { return '<button class="fila" type="button" data-t="' + k + '" style="width:100%;background:none;border:0;text-align:left"><span class="fila-texto"><span class="fila-titulo">' + esc(T('vivo.vivo.tipos.' + k)) + '</span></span></button>'; }).join('') + '</div>';
      var d = Co.hoja({ id: 'hoja-vivo', titulo: T('vivo.vivo.report'), cuerpo: c });
      c.addEventListener('click', function (e) { var b = e.target.closest('[data-t]'); if (!b) return; Co.api('/vivo', { metodo: 'POST', cuerpo: { id: id, tipo: b.dataset.t } }).then(function (r) { if (!r.ok) return error(r); Co.cerrarHoja(d); cargar(); }); });
    }
    cargar();
  })();

  // ---------- Reseñas ----------
  var rs = document.querySelector('[data-resenas]');
  if (rs) (function () {
    var id = rs.dataset.id, cuerpo = rs.querySelector('[data-cuerpo]'), pagina = 1, lista = [];
    function item(x) {
      return '<article class="resena" data-id="' + esc(x._id) + '"><div class="resena-cab">' + avatar(x.img) + '<span class="resena-nombre">' + esc(x.propia ? T('resenas.resenas.you') : (x.name || T('resenas.resenas.anonymous'))) + '</span>' + estrellas(x.calificacion) + '<span class="resena-fecha">' + esc(cuando(x.createdAt)) + '</span></div>' + (x.texto ? '<p>' + esc(x.texto) + '</p>' : '') + (x.propia ? '' : '<div class="acciones-mini"><button type="button" data-rep="' + esc(x._id) + '">' + esc(T('resenas.resenas.report')) + '</button></div>') + '</article>';
    }
    function pintar(d) {
      var rsm = d.resumen || {}, mi = d.miResena;
      var cab = rsm.total ? '<div class="resumen-resenas"><span class="promedio">' + rsm.promedio.toFixed(1) + '</span>' + estrellas(rsm.promedio) + '<span class="nota">' + esc(T(rsm.total === 1 ? 'resenas.resenas.countOne' : 'resenas.resenas.count', { count: rsm.total })) + '</span></div>' : '<p class="nota">' + esc(T('resenas.resenas.empty')) + '</p>';
      var propia = mi ? '<div class="tarjeta" style="margin-top:14px"><strong>' + esc(T('resenas.resenas.you')) + '</strong>' + (mi.oculta ? '<p>' + esc(T('resenas.resenas.hiddenOwn')) + '</p>' : '') + item(mi).replace('class="resena"', 'class="resena" style="border:0;padding-bottom:0"') + '</div>' : '';
      cuerpo.innerHTML = cab + '<div class="pagina-acciones"><button class="btn-contorno btn-chico" type="button" data-escribir>' + ic('editar') + '<span>' + esc(mi ? T('resenas.resenas.edit') : T('resenas.resenas.write')) + '</span></button></div>' + propia + '<div data-items>' + lista.filter(function (x) { return !x.propia; }).map(item).join('') + '</div>' + (d.hayMas ? '<button class="btn-contorno btn-chico" type="button" data-mas>' + esc(T('guiaapp.verTodos')) + '</button>' : '');
      cuerpo.querySelector('[data-escribir]').onclick = function () { pedirSesion().then(function (ok) { if (ok) escribir(mi); }); };
      var mas = cuerpo.querySelector('[data-mas]'); if (mas) mas.onclick = function () { pagina++; cargar(true); };
      cuerpo.onclick = function (e) { var b = e.target.closest('[data-rep]'); if (b) pedirSesion().then(function (ok) { if (ok) reportar('/resenas/reportar', { idResena: b.dataset.rep }, 'oculta'); }); };
    }
    function cargar(mas) {
      Co.api('/resenas?id=' + id + '&pagina=' + pagina).then(function (r) {
        if (!r.ok) { cuerpo.innerHTML = '<p class="nota">' + esc(T('resenas.resenas.loadError')) + '</p>'; return; }
        lista = mas ? lista.concat(r.datos.resenas || []) : (r.datos.resenas || []);
        pintar(r.datos);
      });
    }
    function escribir(mi) {
      var cal = mi ? mi.calificacion : 0, c = document.createElement('form');
      c.innerHTML = '<p class="campo-etiqueta" style="margin-bottom:6px">' + esc(T('resenas.resenas.ratingLabel')) + '</p><div class="estrellas-elegir" role="radiogroup">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" role="radio" data-n="' + n + '" aria-label="' + esc(T('resenas.resenas.stars', { count: n })) + '">' + ic('estrella') + '</button>'; }).join('') + '</div><label class="campo" style="margin-top:14px"><textarea maxlength="500" rows="4" placeholder="' + esc(T('resenas.resenas.textPlaceholder')) + '">' + esc(mi ? mi.texto : '') + '</textarea></label><div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn-pintado" type="submit"><span>' + esc(mi ? T('resenas.resenas.update') : T('resenas.resenas.publish')) + '</span></button>' + (mi ? '<button class="btn-contorno btn-peligro" type="button" data-borrar>' + esc(T('resenas.resenas.delete')) + '</button>' : '') + '</div>';
      function marcar() { c.querySelectorAll('[data-n]').forEach(function (b) { b.classList.toggle('on', Number(b.dataset.n) <= cal); b.setAttribute('aria-checked', String(Number(b.dataset.n) === cal)); }); }
      marcar();
      var d = Co.hoja({ id: 'hoja-resena', titulo: T('resenas.resenas.writeTitle'), cuerpo: c });
      c.addEventListener('click', function (e) {
        var b = e.target.closest('[data-n]'); if (b) { cal = Number(b.dataset.n); marcar(); }
        if (e.target.closest('[data-borrar]')) Co.api('/resenas/' + id, { metodo: 'DELETE' }).then(function (r) { if (!r.ok) return error(r); A.aviso(T('resenas.resenas.deleted')); Co.cerrarHoja(d); pagina = 1; cargar(); });
      });
      c.addEventListener('submit', function (e) {
        e.preventDefault();
        if (!cal) return A.aviso(T('resenas.resenas.pickRating'));
        Co.api('/resenas', { metodo: 'POST', cuerpo: { id: id, calificacion: cal, texto: c.querySelector('textarea').value } }).then(function (r) { if (!r.ok) return error(r); A.aviso(T('resenas.resenas.saved')); Co.cerrarHoja(d); pagina = 1; cargar(); });
      });
    }
    cargar();
  })();

  // ---------- Pregúntale a un local ----------
  var pq = document.querySelector('[data-preguntas]');
  if (pq) (function () {
    var tipo = pq.dataset.tipo, id = pq.dataset.id, cuerpo = pq.querySelector('[data-cuerpo]'), lista = [], pagina = 1;
    function resp(x, pid) {
      return '<div class="resp"><div class="resena-cab">' + avatar(x.img) + '<span class="resena-nombre">' + esc(x.propia ? T('resenas.resenas.you') : (x.name || T('resenas.resenas.anonymous'))) + '</span>' + (x.esEquipo ? '<span class="insignia" title="' + esc(T('preguntas.preguntas.teamBadge')) + '">' + esc(T('preguntas.preguntas.team')) + '</span>' : '') + '<span class="resena-fecha">' + esc(cuando(x.createdAt)) + '</span></div><p>' + esc(x.texto) + '</p><div class="acciones-mini">' + (x.propia ? '<button type="button" data-borrar-resp="' + esc(pid) + '|' + esc(x._id) + '">' + esc(T('guiaapp.yo.borrar')) + '</button>' : '<button type="button" data-rep="' + esc(pid) + '|' + esc(x._id) + '">' + esc(T('resenas.resenas.report')) + '</button>') + '</div></div>';
    }
    function preg(p) {
      return '<article class="pregunta"><div class="pregunta-cab">' + avatar(p.img) + '<span class="resena-nombre">' + esc(p.propia ? T('resenas.resenas.you') : (p.name || T('resenas.resenas.anonymous'))) + '</span><span class="resena-fecha">' + esc(cuando(p.createdAt)) + '</span></div><p><strong>' + esc(p.texto) + '</strong></p>' + (p.respuestas || []).map(function (x) { return resp(x, p._id); }).join('') + '<div class="acciones-mini"><button type="button" data-resp="' + esc(p._id) + '">' + esc(T('preguntas.preguntas.reply')) + '</button>' + (p.propia ? '<button type="button" data-borrar-preg="' + esc(p._id) + '">' + esc(T('guiaapp.yo.borrar')) + '</button>' : '<button type="button" data-rep="' + esc(p._id) + '">' + esc(T('resenas.resenas.report')) + '</button>') + '</div></article>';
    }
    function pintar(d) {
      var tot = (d.resumen && d.resumen.total) || 0;
      cuerpo.innerHTML = (tot ? '<p class="nota">' + esc(T(tot === 1 ? 'preguntas.preguntas.countOne' : 'preguntas.preguntas.count', { count: tot })) + '</p>' : '<p class="nota">' + esc(T('preguntas.preguntas.empty')) + '</p>') + '<div class="pagina-acciones"><button class="btn-contorno btn-chico" type="button" data-preguntar>' + ic('burbujas') + '<span>' + esc(T('preguntas.preguntas.ask')) + '</span></button></div><div>' + lista.map(preg).join('') + '</div>' + (d.hayMas ? '<button class="btn-contorno btn-chico" type="button" data-mas>' + esc(T('guiaapp.verTodos')) + '</button>' : '');
    }
    function cargar(mas) {
      Co.api('/preguntas?tipo=' + tipo + '&id=' + id + '&pagina=' + pagina).then(function (r) {
        if (!r.ok) { cuerpo.innerHTML = '<p class="nota">' + esc(T('preguntas.preguntas.loadError')) + '</p>'; return; }
        lista = mas ? lista.concat(r.datos.preguntas || []) : (r.datos.preguntas || []);
        pintar(r.datos);
      });
    }
    function refrescar() { pagina = 1; cargar(); }
    cuerpo.addEventListener('click', function (e) {
      var q = function (s) { return e.target.closest(s); }, b;
      if (q('[data-preguntar]')) return pedirSesion().then(function (ok) { if (ok) hojaTexto({ titulo: T('preguntas.preguntas.askTitle'), placeholder: T('preguntas.preguntas.askPlaceholder'), max: 200, boton: T('preguntas.preguntas.publish'), enviar: function (v) { return Co.api('/preguntas', { metodo: 'POST', cuerpo: { tipo: tipo, id: id, texto: v } }).then(function (r) { if (!r.ok) { error(r); return false; } A.aviso(T('preguntas.preguntas.asked')); refrescar(); return true; }); } }); });
      if (q('[data-mas]')) { pagina++; return cargar(true); }
      if ((b = q('[data-resp]'))) return pedirSesion().then(function (ok) { if (ok) hojaTexto({ titulo: T('preguntas.preguntas.replyTitle'), placeholder: T('preguntas.preguntas.replyPlaceholder'), max: 500, boton: T('preguntas.preguntas.publish'), enviar: function (v) { return Co.api('/preguntas/responder', { metodo: 'POST', cuerpo: { idPregunta: b.dataset.resp, texto: v } }).then(function (r) { if (!r.ok) { error(r); return false; } A.aviso(T('preguntas.preguntas.answered')); refrescar(); return true; }); } }); });
      if ((b = q('[data-borrar-preg]'))) return Co.confirmar({ titulo: T('preguntas.preguntas.deleteConfirmTitle'), texto: T('preguntas.preguntas.deleteQuestionText'), aceptar: T('guiaapp.yo.borrar'), peligro: true }).then(function (si) { if (si) Co.api('/preguntas/' + b.dataset.borrarPreg, { metodo: 'DELETE' }).then(function (r) { if (!r.ok) return error(r); A.aviso(T('preguntas.preguntas.deleted')); refrescar(); }); });
      if ((b = q('[data-borrar-resp]'))) { var p = b.dataset.borrarResp.split('|'); return Co.confirmar({ titulo: T('preguntas.preguntas.deleteConfirmTitle'), texto: T('preguntas.preguntas.deleteAnswerText'), aceptar: T('guiaapp.yo.borrar'), peligro: true }).then(function (si) { if (si) Co.api('/preguntas/' + p[0] + '/' + p[1], { metodo: 'DELETE' }).then(function (r) { if (!r.ok) return error(r); A.aviso(T('preguntas.preguntas.deleted')); refrescar(); }); }); }
      if ((b = q('[data-rep]'))) { var ids = b.dataset.rep.split('|'); return pedirSesion().then(function (ok) { if (ok) reportar('/preguntas/reportar', ids[1] ? { idPregunta: ids[0], idRespuesta: ids[1] } : { idPregunta: ids[0] }, 'oculta'); }); }
    });
    cargar();
  })();
})();
