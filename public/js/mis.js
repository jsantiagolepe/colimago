/* Lo personal de la guía, igual que en la app: Mis listas (Quiero ir, Ya fui y las propias), Mis planes
   y el Pasaporte. Todo vive en localStorage de este navegador. Además enlaza los botones
   [data-guardar] y [data-agregar-plan] de las fichas de lugares y eventos. Requiere app.js. */
(function () {
  'use strict';
  var A = window.ColimaApp, Co = window.Colima;
  if (!A) return;
  var T = A.T;
  var MAX_LISTAS = 20, MAX_DIAS = 14;

  // ---------- Listas ----------
  function listas() { var l = A.lee('colimago-listas', null) || {}; return { quieroIr: l.quieroIr || [], yaFui: l.yaFui || [], propias: l.propias || [] }; }
  function guardarListas(l) { return A.guarda('colimago-listas', l); }
  function nombreLista(l, clave) { return clave === 'quieroIr' ? T('listas.lists.wantToGo') : clave === 'yaFui' ? T('listas.lists.beenThere') : (l && l.nombre) || ''; }
  function arregloDe(l, clave) { return clave === 'quieroIr' || clave === 'yaFui' ? l[clave] : (l.propias.filter(function (p) { return p.id === clave; })[0] || {}).items; }
  function item(k, id, n, u, f) { return { k: k, id: id, n: n, u: u, f: f || null }; }
  function enLista(clave, it) { var l = listas(), a = arregloDe(l, clave) || []; return a.some(function (x) { return x.k === it.k && x.id === it.id; }); }
  function alternarEnLista(clave, it) {
    var l = listas(), a = arregloDe(l, clave);
    if (!a) return false;
    var i = -1; a.forEach(function (x, j) { if (x.k === it.k && x.id === it.id) i = j; });
    if (i >= 0) a.splice(i, 1); else a.push(it);
    guardarListas(l);
    return i < 0;
  }
  function nuevaLista(nombre) {
    nombre = String(nombre || '').trim();
    var l = listas();
    if (!nombre) return { error: T('listas.lists.nameEmpty') };
    if (l.propias.length >= MAX_LISTAS) return { error: T('guiaapp.yo.limiteListas') };
    var repetido = l.propias.some(function (p) { return p.nombre.toLowerCase() === nombre.toLowerCase(); }) || [T('listas.lists.wantToGo'), T('listas.lists.beenThere')].some(function (n) { return n.toLowerCase() === nombre.toLowerCase(); });
    if (repetido) return { error: T('listas.lists.nameTaken') };
    var nueva = { id: A.id(), nombre: nombre.slice(0, 40), items: [] };
    l.propias.push(nueva); guardarListas(l);
    return { lista: nueva };
  }

  // ---------- Planes ----------
  function planes() { return A.lee('colimago-planes', []) || []; }
  function guardarPlanes(p) { return A.guarda('colimago-planes', p); }
  function diasDe(plan) { var d = [], f = plan.inicio; while (f <= plan.fin && d.length < MAX_DIAS) { d.push(f); f = A.sumaDias(f, 1); } return d; }
  function nuevoPlan(nombre, inicio, fin, personas) {
    var p = planes();
    var plan = { id: A.id(), nombre: String(nombre || T('planes.plan.defaultName')).slice(0, 40), inicio: inicio, fin: fin, personas: personas || 1, paradas: [] };
    p.unshift(plan); guardarPlanes(p);
    return plan;
  }
  function fechasValidas(i, f) { return /^\d{4}-\d{2}-\d{2}$/.test(i) && /^\d{4}-\d{2}-\d{2}$/.test(f) && f >= i && A.sumaDias(i, MAX_DIAS - 1) >= f; }

  // ---------- Pasaporte ----------
  function sellos() { return A.lee('colimago-pasaporte', {}) || {}; }
  function sellar(slug) { var s = sellos(); if (!s[slug]) s[slug] = A.hoy(); A.guarda('colimago-pasaporte', s); }

  // ---------- Hojas: guardar en lista y agregar al plan ----------
  function hojaGuardar(it) {
    var cuerpo = document.createElement('div');
    function pintar() {
      var l = listas();
      var filas = [['quieroIr', nombreLista(l, 'quieroIr')], ['yaFui', nombreLista(l, 'yaFui')]].concat(l.propias.map(function (p) { return [p.id, p.nombre]; }));
      cuerpo.innerHTML = '<div class="filas">' + filas.map(function (f) {
        var on = enLista(f[0], it);
        return '<button class="fila" type="button" data-lista="' + A.esc(f[0]) + '" aria-pressed="' + on + '" style="width:100%;background:none;border:0;text-align:left"><span class="fila-icono">' + A.ic(on ? 'paloma' : 'marcador') + '</span><span class="fila-texto"><span class="fila-titulo">' + A.esc(f[1]) + '</span></span></button>';
      }).join('') + '</div><form class="mis-nueva" style="display:flex;gap:8px;margin-top:16px"><input type="text" maxlength="40" placeholder="' + A.esc(T('listas.lists.namePlaceholder')) + '" aria-label="' + A.esc(T('listas.lists.nameLabel')) + '" /><button class="btn-pintado btn-chico" type="submit"><span>' + A.esc(T('listas.lists.create')) + '</span></button></form><p class="nota" style="margin-top:10px">' + A.esc(T('guiaapp.yo.guardadoLocal')) + '</p>';
    }
    pintar();
    cuerpo.addEventListener('click', function (e) {
      var b = e.target.closest('[data-lista]'); if (!b) return;
      var on = alternarEnLista(b.dataset.lista, it); pintar();
      A.aviso(on ? T('listas.lists.saved') : T('listas.lists.remove'));
      document.dispatchEvent(new CustomEvent('colimago:listas'));
    });
    cuerpo.addEventListener('submit', function (e) {
      e.preventDefault();
      var r = nuevaLista(cuerpo.querySelector('input').value);
      if (r.error) return A.aviso(r.error);
      alternarEnLista(r.lista.id, it); pintar(); A.aviso(T('listas.lists.saved'));
      document.dispatchEvent(new CustomEvent('colimago:listas'));
    });
    Co.hoja({ id: 'hoja-guardar', titulo: T('listas.lists.saveTitle'), cuerpo: cuerpo });
  }

  function hojaPlan(it) {
    var cuerpo = document.createElement('div');
    var hoy = A.hoy();
    function pintar() {
      var p = planes();
      if (!p.length) {
        cuerpo.innerHTML = '<p class="nota" style="margin-bottom:12px">' + A.esc(T('planes.plan.noPlansYet')) + '</p>' + formNuevo(hoy);
        return;
      }
      cuerpo.innerHTML = '<div class="filas">' + p.map(function (pl) { return '<button class="fila" type="button" data-plan="' + A.esc(pl.id) + '" style="width:100%;background:none;border:0;text-align:left"><span class="fila-icono">' + A.ic('calendario') + '</span><span class="fila-texto"><span class="fila-titulo">' + A.esc(pl.nombre) + '</span><span class="fila-sub">' + A.esc(A.fechaLarga(pl.inicio, { weekday: undefined })) + ' – ' + A.esc(A.fechaLarga(pl.fin, { weekday: undefined })) + '</span></span>' + A.ic('chevron-derecha') + '</button>'; }).join('') + '</div><button class="btn-contorno btn-chico" type="button" data-nuevo style="margin-top:14px">' + A.ic('mas') + '<span>' + A.esc(T('planes.plan.newButton')) + '</span></button>';
    }
    function formNuevo(desde) {
      return '<form data-form-plan style="display:grid;gap:12px"><label class="campo"><span class="campo-etiqueta">' + A.esc(T('planes.plan.nameLabel')) + '</span><input type="text" name="n" maxlength="40" value="' + A.esc(T('planes.plan.defaultName')) + '" /></label><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><label class="campo"><span class="campo-etiqueta">' + A.esc(T('guiaapp.yo.desde')) + '</span><input type="date" name="i" value="' + desde + '" /></label><label class="campo"><span class="campo-etiqueta">' + A.esc(T('guiaapp.yo.hasta')) + '</span><input type="date" name="f" value="' + A.sumaDias(desde, 2) + '" /></label></div><button class="btn-pintado btn-chico" type="submit"><span>' + A.esc(T('planes.plan.create')) + '</span></button></form>';
    }
    function elegirDia(plan) {
      cuerpo.innerHTML = '<p class="campo-etiqueta" style="margin-bottom:10px;color:var(--tinta-suave)">' + A.esc(T('planes.plan.pickDay')) + '</p><div class="filas">' + diasDe(plan).map(function (d) { return '<button class="fila" type="button" data-dia="' + d + '" data-plan-id="' + A.esc(plan.id) + '" style="width:100%;background:none;border:0;text-align:left"><span class="fila-texto"><span class="fila-titulo" style="text-transform:capitalize">' + A.esc(A.fechaLarga(d)) + '</span></span></button>'; }).join('') + '</div>';
    }
    pintar();
    cuerpo.addEventListener('click', function (e) {
      var pl = e.target.closest('[data-plan]'), d = e.target.closest('[data-dia]');
      if (e.target.closest('[data-nuevo]')) { cuerpo.innerHTML = formNuevo(hoy); return; }
      if (pl) { var plan = planes().filter(function (x) { return x.id === pl.dataset.plan; })[0]; if (plan) elegirDia(plan); }
      if (d) {
        var todos = planes(), plan2 = todos.filter(function (x) { return x.id === d.dataset.planId; })[0];
        if (!plan2) return;
        if (plan2.paradas.some(function (x) { return x.dia === d.dataset.dia && x.k === it.k && x.id === it.id; })) { A.aviso(T('planes.plan.alreadyThere')); return; }
        plan2.paradas.push({ pid: A.id(), dia: d.dataset.dia, hora: null, k: it.k, id: it.id, n: it.n, u: it.u });
        guardarPlanes(todos); A.aviso(T('planes.plan.added')); Co.cerrarHoja(cuerpo.closest('dialog'));
      }
    });
    cuerpo.addEventListener('submit', function (e) {
      var f = e.target.closest('[data-form-plan]'); if (!f) return;
      e.preventDefault();
      var i = f.elements.i.value, fi = f.elements.f.value;
      if (!fechasValidas(i, fi)) return A.aviso(T('guiaapp.yo.fechasInvalidas'));
      elegirDia(nuevoPlan(f.elements.n.value, i, fi, 1));
    });
    Co.hoja({ id: 'hoja-plan', titulo: T('planes.plan.addTitle'), cuerpo: cuerpo });
  }

  document.addEventListener('click', function (e) {
    var g = e.target.closest('[data-guardar]'), p = e.target.closest('[data-agregar-plan]');
    var b = g || p; if (!b) return;
    var it = item(b.dataset.k, b.dataset.id, b.dataset.n, b.dataset.u, b.dataset.f);
    if (g) hojaGuardar(it); else hojaPlan(it);
  });

  window.ColimaMis = { listas: listas, guardarListas: guardarListas, nombreLista: nombreLista, arregloDe: arregloDe, nuevaLista: nuevaLista, planes: planes, guardarPlanes: guardarPlanes, diasDe: diasDe, nuevoPlan: nuevoPlan, fechasValidas: fechasValidas, sellos: sellos, sellar: sellar, enLista: enLista, MAX_DIAS: MAX_DIAS };
})();
