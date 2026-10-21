/* Detalle de lugar: visor de foto, mapa y video bajo demanda, marca de "Hoy".
   Requiere core.js (window.Colima). Todo lo de aquí mejora una página que ya
   funciona sin JavaScript: la foto se abre en otra pestaña, "Ver mapa" lleva a
   OpenStreetMap y "Ver video en TikTok" abre el video. */
(function () {
  'use strict';
  var C = window.Colima;
  if (!C) return;
  var $ = C.$, $$ = C.$$, ic = C.ic;

  // ---------- Visor de foto: dialog nativo con zoom simple ----------
  // Esc cierra (nativo); el foco vuelve al botón que lo abrió; clic en la foto
  // acerca / aleja centrando donde se hizo clic; los botones + y − hacen lo mismo.
  var ESCALAS = [1, 2, 3];

  function abrirVisor(enlace) {
    var textos = {};
    try { textos = JSON.parse(enlace.getAttribute('data-visor') || '{}'); } catch (e) { /* textos vacíos */ }
    var d = document.createElement('dialog');
    d.className = 'visor';
    d.setAttribute('aria-label', textos.titulo || enlace.getAttribute('data-alt') || '');
    var menosIcono = '<svg class="ic" aria-hidden="true" focusable="false" viewBox="0 0 24 24"><path d="M5 12h14"/></svg>';
    d.innerHTML =
      '<div class="visor-barra">' +
      '<button type="button" data-z="menos" aria-label="' + C.esc(textos.alejar || '') + '">' + menosIcono + '</button>' +
      '<button type="button" data-z="mas" aria-label="' + C.esc(textos.acercar || '') + '">' + ic('mas') + '</button>' +
      '<button type="button" data-z="cerrar" aria-label="' + C.esc(textos.cerrar || '') + '">' + ic('cerrar') + '</button></div>' +
      '<div class="visor-lienzo" tabindex="0"></div>' +
      '<p class="visor-pie"></p>';
    var lienzo = $('.visor-lienzo', d);
    var img = document.createElement('img');
    img.alt = enlace.getAttribute('data-alt') || '';
    img.src = enlace.getAttribute('href');
    lienzo.appendChild(img);
    var pie = $('.visor-pie', d);
    var menos = $('[data-z="menos"]', d);
    var mas = $('[data-z="mas"]', d);
    var nivel = 0;
    var anchoBase = 0;

    var figura = enlace.closest('figure');
    var credito = figura && $('.lugar-credito', figura);
    pie.innerHTML = '<strong>' + C.esc(img.alt) + '</strong>' + (credito ? '<br />' + credito.innerHTML : '');
    // Los enlaces del crédito del visor se abren en otra pestaña, como en la ficha.
    $$('a', pie).forEach(function (a) { a.target = '_blank'; a.rel = 'noopener nofollow'; a.style.color = 'inherit'; });

    function medirBase() { if (!anchoBase) anchoBase = img.getBoundingClientRect().width; }
    // Cambia el nivel de zoom y deja a la vista el punto de la foto (fracciones
    // fx, fy; por defecto el centro) en el centro del visor.
    function aplicar(nuevo, ancla) {
      medirBase();
      nivel = Math.max(0, Math.min(ESCALAS.length - 1, nuevo));
      if (nivel === 0) {
        img.classList.remove('acercada');
        img.style.width = '';
      } else {
        img.classList.add('acercada');
        img.style.width = Math.round(anchoBase * ESCALAS[nivel]) + 'px';
      }
      menos.disabled = nivel === 0;
      mas.disabled = nivel === ESCALAS.length - 1;
      var fx = ancla ? ancla.fx : 0.5;
      var fy = ancla ? ancla.fy : 0.5;
      lienzo.scrollLeft = Math.max(0, img.offsetLeft + fx * img.offsetWidth - lienzo.clientWidth / 2);
      lienzo.scrollTop = Math.max(0, img.offsetTop + fy * img.offsetHeight - lienzo.clientHeight / 2);
    }

    img.addEventListener('load', function () { anchoBase = 0; medirBase(); });
    img.addEventListener('click', function (e) {
      var r = img.getBoundingClientRect();
      var ancla = { fx: (e.clientX - r.left) / r.width, fy: (e.clientY - r.top) / r.height };
      aplicar(nivel === 0 ? 1 : 0, ancla);
    });
    d.addEventListener('click', function (e) {
      var b = e.target.closest('[data-z]');
      if (b) {
        if (b.dataset.z === 'cerrar') d.close();
        else aplicar(nivel + (b.dataset.z === 'mas' ? 1 : -1));
        return;
      }
      // Clic sobre el fondo (no sobre la foto ni los botones) cierra.
      if (e.target === d || e.target === lienzo) d.close();
    });
    d.addEventListener('close', function () {
      document.body.classList.remove('hoja-abierta');
      d.remove();
      try { enlace.focus(); } catch (e) { /* el enlace ya no está */ }
    });
    document.body.appendChild(d);
    d.showModal();
    document.body.classList.add('hoja-abierta');
    menos.disabled = true;
    var cerrar = $('[data-z="cerrar"]', d);
    if (cerrar) cerrar.focus();
  }

  $$('[data-ampliar]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // abrir en pestaña nueva sigue funcionando
      e.preventDefault();
      abrirVisor(a);
    });
  });

  // ---------- Mapa de OpenStreetMap: solo cuando se pide ----------
  var botonMapa = $('[data-mapa-boton]');
  var cajaMapa = $('[data-mapa]');
  var notaMapa = $('[data-mapa-nota]');
  if (botonMapa && cajaMapa) {
    botonMapa.setAttribute('aria-expanded', 'false');
    var etiquetaMapa = botonMapa.querySelector('span');
    botonMapa.addEventListener('click', function (e) {
      e.preventDefault();
      var abierto = !cajaMapa.hidden;
      if (!abierto && !cajaMapa.firstChild) {
        var lat = Number(botonMapa.dataset.lat);
        var lng = Number(botonMapa.dataset.lng);
        if (!isFinite(lat) || !isFinite(lng)) return;
        var dx = 0.012, dy = 0.008;
        var iframe = document.createElement('iframe');
        var p = function (n) { return n.toFixed(5); };
        iframe.src = 'https://www.openstreetmap.org/export/embed.html?bbox=' + [p(lng - dx), p(lat - dy), p(lng + dx), p(lat + dy)].join('%2C') + '&layer=mapnik&marker=' + p(lat) + '%2C' + p(lng);
        iframe.title = botonMapa.dataset.titulo || '';
        iframe.loading = 'lazy';
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        cajaMapa.appendChild(iframe);
      }
      cajaMapa.hidden = abierto;
      if (notaMapa) notaMapa.hidden = abierto;
      botonMapa.setAttribute('aria-expanded', String(!abierto));
      if (etiquetaMapa) etiquetaMapa.textContent = abierto ? botonMapa.dataset.textoVer : botonMapa.dataset.textoOcultar;
    });
  }

  // ---------- Video de TikTok: solo cuando se pide ----------
  var botonVideo = $('[data-video-boton]');
  var cajaVideo = $('[data-video]');
  var notaVideo = $('[data-video-nota]');
  if (botonVideo && cajaVideo) {
    botonVideo.setAttribute('aria-expanded', 'false');
    botonVideo.addEventListener('click', function (e) {
      e.preventDefault();
      var abierto = !cajaVideo.hidden;
      if (!abierto && !cajaVideo.firstChild) {
        var id = botonVideo.dataset.videoBoton;
        if (!/^\d+$/.test(id || '')) return;
        var iframe = document.createElement('iframe');
        iframe.src = 'https://www.tiktok.com/embed/' + id;
        iframe.title = botonVideo.dataset.titulo || '';
        iframe.loading = 'lazy';
        iframe.allowFullscreen = true;
        iframe.setAttribute('allow', 'encrypted-media; fullscreen');
        iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin allow-popups allow-presentation');
        iframe.setAttribute('referrerpolicy', 'no-referrer');
        cajaVideo.appendChild(iframe);
      }
      cajaVideo.hidden = abierto;
      if (notaVideo) notaVideo.hidden = abierto;
      botonVideo.setAttribute('aria-expanded', String(!abierto));
    });
  }

  // ---------- Horarios: marca el día de hoy (hora de Colima) ----------
  var filas = $$('.lugar-horarios tr[data-dias]');
  if (filas.length) {
    var hoy = null;
    try {
      var nombre = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Mexico_City', weekday: 'short' }).format(new Date());
      hoy = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[nombre];
    } catch (e) { /* sin Intl de zonas: no se marca nada */ }
    if (hoy !== null && hoy !== undefined) {
      filas.forEach(function (tr) {
        var dias = (tr.getAttribute('data-dias') || '').split(',').filter(Boolean).map(Number);
        if (dias.indexOf(hoy) < 0) return;
        tr.classList.add('es-hoy');
        var marca = $('.lugar-hoy', tr);
        if (marca) marca.hidden = false;
      });
    }
  }
})();
