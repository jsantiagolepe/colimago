/* Favoritos — pinta en el navegador la lista de Colima.favoritos (localStorage)
   y, con sesión, la sincroniza con la cuenta. Se repinta con el evento
   'colimago:favoritos' (agregar/quitar en cualquier parte de la guía).
   El HTML trae el contenedor, el estado vacío y los anuncios como <template>. */
(function () {
  'use strict';
  var Colima = window.Colima;
  var fuente = document.getElementById('favoritos-datos');
  var contenedor = document.getElementById('favoritos-lista');
  if (!Colima || !fuente || !contenedor) return;
  var D;
  try { D = JSON.parse(fuente.textContent); } catch (e) { return; }
  var T = D.t;
  var esc = Colima.esc, $ = Colima.$, $$ = Colima.$$;
  var cuenta = $('[data-cuenta]');

  function plantilla(texto, vars) { return String(texto).replace(/\{(\w+)\}/g, function (m, k) { return k in vars ? vars[k] : m; }); }
  function plantillaHtml(id) { var t = document.getElementById(id); return t ? t.innerHTML : ''; }

  // "2026-10-24" → "24 de octubre" (por componentes, sin zonas horarias)
  function fechaLarga(f) {
    var p = String(f).slice(0, 10).split('-').map(Number);
    if (!p[0] || !p[1] || !p[2]) return '';
    return plantilla(D.fechaDia, { d: p[2], mes: D.meses[p[1] - 1] });
  }
  // Los eventos traen la URL de Cloudinary: se pide ya a 480 px, como en el servidor.
  function urlFoto(imagen) {
    var marca = '/image/upload/';
    var i = imagen.indexOf(marca);
    if (i === -1 || /^w_\d+[,/]/.test(imagen.slice(i + marca.length))) return imagen;
    return imagen.slice(0, i + marca.length) + 'w_480,q_auto,f_auto/' + imagen.slice(i + marca.length);
  }
  function urlSegura(imagen) { return /^(\/|https?:\/\/)/i.test(imagen) ? imagen : ''; }

  function tablilla(f) {
    if (f.tipo === 'lugar') return T.lugar;
    var fecha = !f.esPortada && f.fecha ? fechaLarga(f.fecha) : '';
    return fecha || T.evento;
  }

  function tarjeta(f) {
    var imagen = f.imagen ? urlSegura(f.tipo === 'lugar' ? f.imagen : urlFoto(f.imagen)) : '';
    var destino = D.base + (f.tipo === 'lugar' ? 'lugar/' : 'evento/') + encodeURIComponent(f.id);
    var foto = imagen
      ? '<img src="' + esc(imagen) + '" alt="" width="480" height="300" loading="lazy" decoding="async" />'
      : '<span class="sin-foto" role="img" aria-label="' + esc(T.sinFoto) + '"></span>';
    return '<article class="tarjeta-lugar tarjeta-fav" data-fav="' + esc(f.id) + '">' +
      '<div class="marco marco-16-10">' + foto + '</div>' +
      '<div class="tl-accion"><button class="fav-borrar" type="button" data-borrar="' + esc(f.id) + '" aria-label="' + esc(plantilla(T.borrarAria, { titulo: f.titulo || '' })) + '">' +
      Colima.ic('bote') + '<span>' + esc(T.borrar) + '</span></button></div>' +
      '<h3 class="tl-titulo"><a href="' + esc(destino) + '">' + esc(f.titulo || '') + '</a></h3>' +
      '<p class="tl-muni tablilla-muni">' + esc(tablilla(f)) + '</p></article>';
  }

  // Un anuncio cada 3 tarjetas (banner e infeed alternados) y uno al cierre si hay menos de 3
  function conAnuncios(lista) {
    var salida = [], anuncios = 0;
    lista.forEach(function (f, i) {
      salida.push(tarjeta(f));
      if ((i + 1) % 3 === 0) salida.push(plantillaHtml(anuncios++ % 2 === 0 ? 'tpl-anuncio-banner' : 'tpl-anuncio-infeed'));
    });
    if (lista.length && !anuncios) salida.push(plantillaHtml('tpl-anuncio-banner'));
    return salida.join('');
  }

  function pintar(enfocarIndice) {
    var lista = Colima.favoritos.lista();
    contenedor.setAttribute('aria-busy', 'false');
    if (!lista.length) {
      // Vacío: sin anuncios ni cuenta
      contenedor.innerHTML = plantillaHtml('tpl-vacio');
      if (cuenta) cuenta.hidden = true;
    } else {
      contenedor.innerHTML = '<div class="rejilla-lugares favoritos-rejilla">' + conAnuncios(lista) + '</div>';
      if (cuenta) {
        cuenta.hidden = false;
        cuenta.textContent = plantilla(lista.length === 1 ? T.cuenta.uno : T.cuenta.otros, { n: lista.length });
      }
      pedirAnuncios();
    }
    if (typeof enfocarIndice === 'number') {
      // Tras borrar, el foco pasa a la tarjeta vecina (o a la lista si ya no queda ninguna)
      var enlaces = $$('.tl-titulo a', contenedor);
      var destino = enlaces[Math.min(enfocarIndice, enlaces.length - 1)];
      if (destino) destino.focus(); else { contenedor.tabIndex = -1; contenedor.focus(); }
    }
  }

  function pedirAnuncios() {
    if (!(window.COLIMAGO || {}).anuncios) return;
    $$('ins.adsbygoogle', contenedor).forEach(function () {
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) { /* el espacio queda reservado */ }
    });
  }

  // ---------- Borrar ----------
  contenedor.addEventListener('click', function (e) {
    var boton = e.target.closest('[data-borrar]');
    if (!boton) return;
    var id = boton.dataset.borrar;
    var indice = $$('[data-fav]', contenedor).map(function (t) { return t.dataset.fav; }).indexOf(id);
    Colima.confirmar({
      titulo: Colima.T('favoritos.quitarTitulo'),
      texto: Colima.T('favoritos.quitarTexto'),
      aceptar: Colima.T('favoritos.quitar'),
      peligro: true,
    }).then(function (acepto) {
      if (!acepto) return;
      Colima.favoritos.quitar(id).then(function (ok) {
        if (ok) { Colima.toast(Colima.T('favoritoQuitado')); pintar(indice); }
      });
    });
  });

  // ---------- Sesión: aviso y sincronización ----------
  function pintarAviso(usuario) {
    $$('[data-sin-sesion]').forEach(function (el) { el.hidden = !!usuario; });
    $$('[data-con-sesion]').forEach(function (el) { el.hidden = !usuario; });
  }
  function sincronizar(usuario) {
    pintarAviso(usuario);
    // Con sesión se traen los favoritos de la cuenta (subiendo antes los de este navegador);
    // guardarLista dispara 'colimago:favoritos' y la lista se repinta sola.
    if (usuario) Colima.favoritos.sincronizar().then(function () { pintar(); });
  }

  document.addEventListener('colimago:favoritos', function () { pintar(); });
  window.addEventListener('storage', function (e) { if (e.key === 'colimago-favoritos') pintar(); });
  pintar();
  Colima.sesionLista.then(sincronizar);
  Colima.alCambiarSesion(function (usuario) { pintarAviso(usuario); });
})();
