/* Calendario — cambia de mes y de día sin recargar, con los eventos que el
   servidor dejó en <script id="calendario-datos">. También recalcula "hoy"
   con la hora de Colima (el HTML puede venir de una copia de la CDN).
   El HTML ya funciona sin este script: días y meses son enlaces ?mes&dia.
   Las fechas se manejan por componentes (año, mes, día), sin new Date('YYYY-MM-DD'). */
(function () {
  'use strict';
  var Colima = window.Colima;
  var fuente = document.getElementById('calendario-datos');
  if (!Colima || !fuente) return;
  var D;
  try { D = JSON.parse(fuente.textContent); } catch (e) { return; }
  var T = D.t;
  var $ = Colima.$, esc = Colima.esc;

  var cuerpoMes = $('[data-cuerpo-mes]');
  var tituloMes = $('#t-mes');
  var captionMes = $('.mes-tabla caption');
  var tituloAgenda = $('#t-agenda');
  var agenda = $('[data-agenda]');
  var anterior = $('[data-mes-paso="-1"]');
  var siguiente = $('[data-mes-paso="1"]');
  if (!cuerpoMes || !agenda) return;

  var estado = { mes: D.mes, dia: D.dia, hoy: D.hoy, siguiendoHoy: !!D.siguiendoHoy };

  // ---------- Fechas por componentes ----------
  function dos(n) { return (n < 10 ? '0' : '') + n; }
  function esBisiesto(a) { return (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0; }
  function diasEnMes(a, m) { return m === 2 ? (esBisiesto(a) ? 29 : 28) : (m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31); }
  function clave(a, m, d) { return a + '-' + dos(m) + '-' + dos(d); }
  function claveMes(a, m) { return a + '-' + dos(m); }
  function partes(f) { var p = String(f).split('-'); return { a: Number(p[0]), m: Number(p[1]), d: Number(p[2]) }; }
  function diaSemana(a, m, d) { return new Date(Date.UTC(a, m - 1, d)).getUTCDay(); } // 0 = domingo
  function diaSiguiente(f) {
    var p = partes(f);
    var d = p.d + 1, m = p.m, a = p.a;
    if (d > diasEnMes(a, m)) { d = 1; m += 1; if (m > 12) { m = 1; a += 1; } }
    return clave(a, m, d);
  }
  function vecino(mes, paso) {
    var p = partes(mes + '-01');
    var total = p.a * 12 + (p.m - 1) + paso;
    return { a: Math.floor(total / 12), m: (total % 12) + 1 };
  }
  function plantilla(texto, vars) { return String(texto).replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }); }
  function mayuscula(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  // ---------- Textos de fechas (igual que lib/guia/i18n.js) ----------
  function fechaLarga(f) { var p = partes(f); return plantilla(T.fechaDia, { d: p.d, mes: T.meses[p.m - 1] }); }
  function hora12(hora) {
    var p = hora.split(':').map(Number);
    return ((p[0] % 12) === 0 ? 12 : p[0] % 12) + ':' + dos(p[1]) + ' ' + (p[0] >= 12 ? 'PM' : 'AM');
  }
  function textoFecha(ev) {
    var hora = ev.a ? null : ev.h;
    if (ev.e) {
      var rango = plantilla(T.rango, { inicio: fechaLarga(ev.f), fin: fechaLarga(ev.e) });
      return hora ? plantilla(T.rangoHora, { rango: rango, hora: hora12(hora) }) : rango;
    }
    return hora ? plantilla(T.fechaHora, { fecha: fechaLarga(ev.f), hora: hora12(hora) }) : fechaLarga(ev.f);
  }
  function nEventos(n) { return plantilla(n === 1 ? T.nEventos.uno : T.nEventos.otros, { n: n }); }

  // ---------- Eventos por día ----------
  var porDia = {};
  D.eventos.forEach(function (ev) {
    var dia = ev.f, n = 0;
    for (;;) {
      (porDia[dia] = porDia[dia] || []).push(ev);
      if (!ev.e || dia >= ev.e || ++n >= 400) break;
      dia = diaSiguiente(dia);
    }
  });
  Object.keys(porDia).forEach(function (dia) {
    porDia[dia].sort(function (x, y) {
      var a = x.f + 'T' + (x.h || '00:00'), b = y.f + 'T' + (y.h || '00:00');
      return a < b ? -1 : a > b ? 1 : x.t.localeCompare(y.t, 'es');
    });
  });

  // ---------- Pintar (mismo marcado que el servidor) ----------
  function urlMes(mes, dia) { return D.base + '?mes=' + mes + (dia ? '&dia=' + dia : ''); }
  function punto(ev) { return ev.p ? '<i class="pt pt-bombilla"></i>' : '<i class="pt pt-' + esc(ev.c) + '"></i>'; }

  function celda(a, m, d) {
    var f = clave(a, m, d);
    var evs = porDia[f] || [];
    var esHoy = f === estado.hoy, esElegido = f === estado.dia;
    var etiqueta = [fechaLarga(f), evs.length ? nEventos(evs.length) : '', esHoy ? T.hoy : ''].filter(Boolean).join(', ');
    var actual = esHoy ? ' aria-current="date"' : esElegido ? ' aria-current="true"' : '';
    return '<td><a class="dia' + (esHoy ? ' es-hoy' : '') + (esElegido ? ' es-elegido' : '') + (evs.length ? ' con-eventos' : '') + '" href="' + esc(urlMes(claveMes(a, m), f)) +
      '" data-dia="' + f + '" aria-label="' + esc(etiqueta) + '"' + actual + '><span class="dia-num">' + d + '</span><span class="dia-puntos" aria-hidden="true">' +
      evs.slice(0, 5).map(punto).join('') + '</span></a></td>';
  }

  function pintarMes() {
    var p = partes(estado.mes + '-01');
    var celdas = [];
    var vacias = diaSemana(p.a, p.m, 1);
    var i;
    for (i = 0; i < vacias; i++) celdas.push('<td class="dia-vacio"></td>');
    for (var d = 1; d <= diasEnMes(p.a, p.m); d++) celdas.push(celda(p.a, p.m, d));
    while (celdas.length % 7) celdas.push('<td class="dia-vacio"></td>');
    var filas = [];
    for (i = 0; i < celdas.length; i += 7) filas.push('<tr>' + celdas.slice(i, i + 7).join('') + '</tr>');
    cuerpoMes.innerHTML = filas.join('');
    var nombre = mayuscula(T.meses[p.m - 1]) + ' ' + p.a;
    tituloMes.textContent = nombre;
    if (captionMes) captionMes.textContent = nombre;
    var ant = vecino(estado.mes, -1), sig = vecino(estado.mes, 1);
    if (anterior) anterior.href = urlMes(claveMes(ant.a, ant.m));
    if (siguiente) siguiente.href = urlMes(claveMes(sig.a, sig.m));
  }

  function fila(ev) {
    var muni = D.municipios[ev.m];
    return '<li><a class="evento-fila" href="' + esc(D.baseEvento + ev.i) + '"><span class="evento-marca" aria-hidden="true">' +
      (ev.p ? '<span class="foco-solo encendido"></span>' : '<i class="pt pt-grande pt-' + esc(ev.c) + '"></i>') + '</span><span class="evento-texto"><span class="evento-titulo">' + esc(ev.t) + '</span>' +
      (muni ? '<span class="tablilla-muni">' + esc(muni) + '</span>' : '') +
      (ev.p ? '' : '<span class="evento-fecha">' + esc(textoFecha(ev)) + '</span>') +
      '</span><span class="evento-chevron" aria-hidden="true">' + Colima.ic('chevron-derecha') + '</span></a></li>';
  }
  function plantillaHtml(id) { var t = document.getElementById(id); return t ? t.innerHTML : ''; }

  function pintarAgenda() {
    tituloAgenda.textContent = estado.dia === estado.hoy ? T.eventosHoy : plantilla(T.eventosDia, { fecha: fechaLarga(estado.dia) });
    if (D.falla) { agenda.innerHTML = plantillaHtml('tpl-error'); return; }
    var evs = porDia[estado.dia] || [];
    if (!evs.length) { agenda.innerHTML = plantillaHtml('tpl-vacio'); return; }
    // Anuncios solo-banner cada 3 eventos, y uno al cierre si hay menos de 3
    var partesHtml = [], anuncios = 0;
    evs.forEach(function (ev, i) {
      partesHtml.push(fila(ev));
      if ((i + 1) % 3 === 0) partesHtml.push('<li class="agenda-anuncio">' + plantillaHtml('tpl-anuncio-' + (anuncios++ % 3)) + '</li>');
    });
    if (!anuncios) partesHtml.push('<li class="agenda-anuncio">' + plantillaHtml('tpl-anuncio-0') + '</li>');
    agenda.innerHTML = '<ul class="agenda-lista">' + partesHtml.join('') + '</ul>';
    if ((window.COLIMAGO || {}).anuncios) {
      Colima.$$('ins.adsbygoogle', agenda).forEach(function () {
        try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* el espacio queda reservado */ }
      });
    }
  }

  function pintar() { pintarMes(); pintarAgenda(); }

  function guardarUrl() {
    var url = estado.siguiendoHoy ? D.base : urlMes(estado.mes, estado.dia);
    try { history.replaceState(null, '', url); } catch (e) { /* sin historial */ }
  }

  // ---------- Navegación ----------
  function elegirDia(f) {
    estado.dia = f;
    estado.siguiendoHoy = false;
    pintar();
    guardarUrl();
    var celdaDia = $('a[data-dia="' + f + '"]', cuerpoMes);
    if (celdaDia) celdaDia.focus();
  }
  function cambiarMes(paso) {
    var v = vecino(estado.mes, paso);
    estado.mes = claveMes(v.a, v.m);
    // Igual que el servidor: hoy si cae en ese mes; si no, el día 1
    estado.dia = estado.hoy.slice(0, 7) === estado.mes ? estado.hoy : estado.mes + '-01';
    estado.siguiendoHoy = false;
    pintar();
    guardarUrl();
  }
  function irAHoy() {
    estado.hoy = hoyEnColima() || estado.hoy;
    estado.mes = estado.hoy.slice(0, 7);
    estado.dia = estado.hoy;
    estado.siguiendoHoy = true;
    pintar();
    guardarUrl();
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a || e.metaKey || e.ctrlKey || e.shiftKey || e.button) return;
    if (a.hasAttribute('data-dia')) { e.preventDefault(); elegirDia(a.dataset.dia); }
    else if (a.hasAttribute('data-mes-paso')) { e.preventDefault(); cambiarMes(Number(a.dataset.mesPaso)); }
    else if (a.hasAttribute('data-ir-hoy')) { e.preventDefault(); irAHoy(); }
  });

  // ---------- "Hoy" con la hora de Colima ----------
  var formatoColima = null;
  try { formatoColima = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' }); } catch (e) { /* sin Intl con zonas */ }
  function hoyEnColima() {
    if (!formatoColima) return null;
    var p = {};
    formatoColima.formatToParts(new Date()).forEach(function (x) { p[x.type] = x.value; });
    return p.year + '-' + p.month + '-' + p.day;
  }
  function revisarHoy() {
    var hoy = hoyEnColima();
    if (!hoy || hoy === estado.hoy) return;
    estado.hoy = hoy;
    // Mientras nadie toque un día, la selección sigue a "hoy" (también al cruzar la medianoche)
    if (estado.siguiendoHoy) { estado.dia = hoy; estado.mes = hoy.slice(0, 7); }
    pintar();
  }
  revisarHoy();
  document.addEventListener('visibilitychange', function () { if (!document.hidden) revisarHoy(); });
  window.addEventListener('focus', revisarHoy);
  setInterval(revisarHoy, 60000);
})();
