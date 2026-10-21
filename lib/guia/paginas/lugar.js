// Detalle de lugar: /lugar/:slug (y /en/lugar/:slug).
//
// La ficha más compartida del sitio: foto grande, nombre, municipio, acciones
// (favorito, compartir, me gusta, comentarios, vistas), descripción, servicios,
// horarios, ubicación (mapa solo bajo demanda), video de TikTok (también bajo
// demanda), contacto, crédito de la foto, comentarios en línea y un anuncio de
// pie. Todo sale de los datos locales (data/lugares.json); lo que depende del
// backend (contadores, comentarios) lo completa public/js/social.js en el
// navegador.
//
// Acepta como :slug un id de 24 hex (lo usan Favoritos y el feed): redirige 301
// a su slug canónico. Un slug que no existe responde 404.

const { h, raw, esc } = require("../h");
const { t, urlAbsoluta, SITIO } = require("../i18n");
const datos = require("../datos");
const { icono, boton, botonFavorito, accionesPost, anuncio, sinFoto, guirnalda } = require("../componentes");
const { iconoServicio } = require("../iconos-servicios");
const { esDeEjemplo, lugarIndexable } = require("../indexacion");
const { guia } = require("./lugar-guia");
const { municipioDe, rutaLugar, urlFotoAbsoluta, textoCredito, coordenadasValidas, resumen, listaPadre, tiktokUnico } = require("./lugares-vista");

const ES_ID = /^[a-f0-9]{24}$/i;

// ---------- Horarios: días en texto libre ("martes a domingo") ----------

const NOMBRES_DIA = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
const NUMERO_DIA = { lunes: 1, martes: 2, miercoles: 3, jueves: 4, viernes: 5, sabado: 6, domingo: 0 };
const sinAcentos = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const capitalizar = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

// "jueves a martes", "lunes a jueves y sábado" → días (0 = domingo) o null si no se entiende.
function diasDeTexto(texto) {
  const limpio = sinAcentos(texto).replace(/\s+y\s+dias festivos/, "");
  if (/todos los dias/.test(limpio)) return [0, 1, 2, 3, 4, 5, 6];
  const dias = new Set();
  for (const grupo of limpio.split(/\s+y\s+|,\s*/)) {
    const rango = grupo.match(/^(\w+)\s+a\s+(\w+)$/);
    if (rango) {
      const desde = NOMBRES_DIA.indexOf(rango[1]);
      const hasta = NOMBRES_DIA.indexOf(rango[2]);
      if (desde < 0 || hasta < 0) return null;
      for (let i = desde; ; i = (i + 1) % 7) {
        dias.add(NUMERO_DIA[NOMBRES_DIA[i]]);
        if (i === hasta) break;
      }
    } else if (NOMBRES_DIA.includes(grupo)) {
      dias.add(NUMERO_DIA[grupo]);
    } else {
      return null;
    }
  }
  return dias.size ? [...dias].sort((a, b) => a - b) : null;
}

// El texto del día viene en español: en inglés se traduce palabra por palabra.
function etiquetaDia(texto, lang) {
  const limpio = sinAcentos(texto);
  if (limpio === "todos los dias") return t(lang, "lugar.diaTodos");
  if (lang !== "en") return capitalizar(String(texto).replace(/\bmiercoles\b/gi, "miércoles").replace(/\bsabado\b/gi, "sábado"));
  const nombres = t(lang, "lugar.diasLargosNombres");
  return capitalizar(
    limpio
      .replace(/\b(lunes|martes|miercoles|jueves|viernes|sabado|domingo)\b/g, (m) => nombres[m])
      .replace(/\ba\b/g, "to")
      .replace(/\by\b/g, "and")
      .replace(/dias festivos/, "holidays"),
  );
}

const rangoHoras = (horas) => String(horas).replace(/ - /g, " – ");

// ---------- Secciones ----------

function migas(lang, lugar, padre, ctx) {
  const eslabones = [{ nombre: t(lang, "lugar.inicio"), ruta: "/inicio" }];
  if (padre) {
    eslabones.push(padre.padre);
    if (padre.categoria) eslabones.push(padre.categoria);
  } else {
    eslabones.push({ nombre: t(lang, "lugar.municipios"), ruta: "/municipios" });
  }
  return { eslabones, html: h`<nav class="lugar-migas" aria-label="${t(lang, "lugar.migas")}"><ol>
      ${eslabones.map((e) => h`<li><a href="${ctx.ruta(e.ruta)}">${e.nombre}</a></li>`)}
      <li><span aria-current="page">${lugar.titulo}</span></li>
    </ol></nav>` };
}

function bloqueFoto(lang, lugar, municipio) {
  const img = lugar.imagen || {};
  const tieneArchivo = !!img.archivo;
  // Proporción natural (alto/ancho) acotada a [0.75, 1.4], como la portada de la app.
  const natural = img.ancho && img.alto ? img.alto / img.ancho : 0.75;
  const ratio = Math.min(1.4, Math.max(0.75, natural));
  const proporcion = (1 / ratio).toFixed(4);
  const base = tieneArchivo ? `/img/${img.archivo}` : "";
  const alt = `${lugar.titulo}, ${municipio}`;
  const credito = textoCredito(lang, img.credito, "lugar");
  const visor = {
    titulo: t(lang, "lugar.visorTitulo", { lugar: lugar.titulo }),
    cerrar: t(lang, "lugar.visorCerrar"),
    acercar: t(lang, "lugar.visorAcercar"),
    alejar: t(lang, "lugar.visorAlejar"),
    ayuda: t(lang, "lugar.visorAyuda"),
  };
  return h`
    <figure class="lugar-portada" data-revela>
      <div class="marco lugar-foto${tieneArchivo ? "" : " lugar-sin-foto"}" style="--proporcion:${proporcion}">
        ${
          tieneArchivo
            ? h`<img src="${base}-800.webp" srcset="${base}-480.webp 480w, ${base}-800.webp 800w" sizes="(max-width: 899px) calc(100vw - 32px), 540px" alt="${alt}" width="800" height="${Math.round(800 * ratio)}" fetchpriority="high" decoding="async" />
        <a class="btn-foto lugar-ampliar" href="${base}-800.webp" target="_blank" rel="noopener" data-ampliar data-alt="${alt}" data-visor="${JSON.stringify(visor)}" aria-label="${t(lang, "lugar.ampliar")}">${icono("ampliar")}</a>`
            : sinFoto()
        }
      </div>
      ${credito && h`<figcaption class="lugar-credito">${credito}</figcaption>`}
    </figure>`;
}

function barraAcciones(lang, lugar, municipio) {
  const url = urlAbsoluta(lang, `/lugar/${lugar.slug}`);
  const imagenFav = lugar.imagen && lugar.imagen.archivo ? `/img/${lugar.imagen.archivo}-480.webp` : "";
  // Los contadores salen del backend: ocultos hasta que social.js los llene.
  const metricas = String(accionesPost({ id: lugar.id, lang, menu: false, pastilla: true, enlaceComentarios: "#comentarios" })).replace(
    "data-acciones ",
    "data-acciones data-metricas hidden ",
  );
  return h`
    <div class="lugar-barra">
      ${botonFavorito({ id: lugar.id, titulo: lugar.titulo, imagen: imagenFav, tipo: "lugar", variante: "icono", lang })}
      <button class="btn-icono" type="button" data-accion="compartir" data-url="${url}" data-titulo="${lugar.titulo}" data-texto="${t(lang, "lugar.compartirTexto", { lugar: lugar.titulo, municipio })}" aria-label="${t(lang, "comun.compartir")}">${icono("compartir")}</button>
      <span class="acc-espacio"></span>
      ${raw(metricas)}
    </div>`;
}

function seccionDescripcion(lang, lugar) {
  const texto = datos.textoDescripcion(lugar, lang);
  if (!texto) return h`<p class="lugar-descripcion nota">${t(lang, "lugar.sinDescripcion")}</p>`;
  // Sin traducción al inglés el texto sale en español: se marca para lectores de pantalla.
  const enIngles = lang === "en" && lugar.descripcion && lugar.descripcion.en && lugar.descripcion.en.trim();
  return h`<div class="lectura lugar-descripcion"><p${lang === "en" && !enIngles ? raw(' lang="es"') : ""}>${texto}</p></div>`;
}

// Tianguis y mercados: días de la semana, horas, temporada y semana del mes.
const ORDEN_SEMANA = [1, 2, 3, 4, 5, 6, 0];
function seccionCuando(lang, lugar) {
  if (lugar.tipo !== datos.TIPO_TIANGUIS && lugar.tipo !== datos.TIPO_MERCADO) return null;
  const tx = datos.textos(lang);
  // Los tianguis de temporada traen `dias` vacío: los días salen de su horario.
  let dias = lugar.dias || [];
  if (!dias.length) dias = [...new Set((lugar.horario || []).flatMap((f) => f.dias || []))];
  const resumenDias = datos.etiquetaDias(dias, lang);
  const horas = datos.horasResumen(lugar);
  const linea = [resumenDias, horas && rangoHoras(horas)].filter(Boolean).join(" · ");
  const temporada = datos.etiquetaTemporada(lugar, lang);
  const semanas = lugar.semanasDelMes && lugar.semanasDelMes.length ? lugar.semanasDelMes : null;
  const ordinales = t(lang, "lugar.semanaOrdinal");
  const notaSemanas = semanas
    ? semanas.includes(-1)
      ? t(lang, "lugar.ultimaSemana")
      : t(lang, "lugar.semana", { ordinal: ordinales[semanas[0] - 1] || semanas[0] })
    : "";
  if (!linea && !temporada && !notaSemanas && !dias.length) return null;
  return h`
    <section class="lugar-seccion lugar-cuando" aria-labelledby="t-cuando">
      <h2 class="seccion-titulo" id="t-cuando">${t(lang, "lugar.cuandoTitulo")}</h2>
      ${linea && h`<p class="lugar-cuando-linea">${linea}</p>`}
      ${
        dias.length > 0 &&
        h`<ul class="lugar-dias" aria-label="${t(lang, "lugar.diasQueSePone")}">
          ${ORDEN_SEMANA.map((d) => {
            const activo = dias.includes(d);
            return h`<li class="${activo ? "activo" : ""}"><span aria-hidden="true">${tx.diasCortos[d]}</span><span class="sr-only">${tx.diasLargos[d]}: ${t(lang, activo ? "lugar.seponeDia" : "lugar.noSePoneDia")}</span></li>`;
          })}
        </ul>`
      }
      ${temporada && h`<p class="lugar-cuando-nota"><span class="pastilla pastilla-tenue">${t(lang, "lugar.temporada")}</span> ${temporada}</p>`}
      ${notaSemanas && h`<p class="lugar-cuando-nota">${notaSemanas}</p>`}
    </section>`;
}

function seccionServicios(lang, lugar) {
  const vistos = new Set();
  const servicios = datos.serviciosPintables(lugar.servicios, lang).filter((s) => (vistos.has(s.nombre) ? false : vistos.add(s.nombre)));
  if (!servicios.length) return null;
  return h`
    <section class="lugar-seccion" aria-labelledby="t-servicios">
      <h2 class="seccion-titulo" id="t-servicios">${t(lang, "lugar.servicios")}</h2>
      <ul class="lugar-servicios">
        ${servicios.map((s) => h`<li>${raw(iconoServicio(s.clave))}<span>${s.nombre}</span></li>`)}
      </ul>
    </section>`;
}

function seccionHorarios(lang, lugar) {
  if (lugar.abiertoTodoElDia) {
    return h`
      <section class="lugar-seccion" aria-labelledby="t-horarios">
        <h2 class="seccion-titulo" id="t-horarios">${t(lang, "lugar.horarios")}</h2>
        <p><span class="pastilla pastilla-lona lugar-pastilla">${t(lang, "lugar.abiertoTodoElDia")}</span></p>
      </section>`;
  }
  // Los horarios de relleno de los lugares originales no se muestran.
  if (lugar.horarioInventado) return null;
  // Un tianguis o mercado con un solo horario ya lo dice "Cuándo se pone": la tabla
  // solo hace falta cuando las horas cambian de un día a otro.
  const esDeTianguis = lugar.tipo === datos.TIPO_TIANGUIS || lugar.tipo === datos.TIPO_MERCADO;
  if (esDeTianguis && datos.horasResumen(lugar)) return null;
  const filas = (lugar.horario || []).filter((f) => f.horas !== datos.SIN_HORARIO);
  if (!filas.length) return null;
  return h`
    <section class="lugar-seccion" aria-labelledby="t-horarios">
      <h2 class="seccion-titulo" id="t-horarios">${t(lang, "lugar.horarios")}</h2>
      <table class="lugar-horarios">
        <tbody>
          ${filas.map((f) => {
            if (f.dia === "general") return h`<tr><td colspan="2">${f.horas}</td></tr>`;
            const dias = Array.isArray(f.dias) && f.dias.length ? f.dias : diasDeTexto(f.dia);
            return h`<tr data-dias="${dias ? dias.join(",") : ""}"><th scope="row">${etiquetaDia(f.dia, lang)}</th><td>${f.horas === null ? h`<span class="lugar-cerrado">${t(lang, "lugar.cerrado")}</span>` : rangoHoras(f.horas)}<span class="lugar-hoy" hidden>${t(lang, "lugar.hoy")}</span></td></tr>`;
          })}
        </tbody>
      </table>
    </section>`;
}

function seccionUbicacion(lang, lugar) {
  const texto = datos.textoUbicacion(lugar);
  const mapa = coordenadasValidas(lugar);
  if (!texto && !mapa) return null;
  // El nombre de la ubicación solo se repite si dice algo distinto al título (en los tianguis es la dirección).
  const norm = (x) => sinAcentos(x).replace(/[^a-z0-9]+/g, " ").trim();
  const nombreBruto = texto && texto.nombre ? texto.nombre.trim() : "";
  const nombre = nombreBruto && !norm(nombreBruto).includes(norm(lugar.titulo)) && !norm(lugar.titulo).includes(norm(nombreBruto)) ? nombreBruto : "";
  const descripcion = texto && texto.descripcion ? texto.descripcion.trim() : "";
  if (!nombre && !descripcion && !mapa) return null;
  const { lat, lng } = lugar.ubicacion || {};
  // La ubicación solo existe en español: en inglés se marca el idioma del texto.
  const enEspanol = lang === "en" ? raw(' lang="es"') : "";
  return h`
    <section class="lugar-seccion lugar-ubicacion" aria-labelledby="t-ubicacion">
      <h2 class="seccion-titulo" id="t-ubicacion">${t(lang, "lugar.ubicacion")}</h2>
      ${nombre && h`<p class="lugar-direccion">${icono("lugar")}<span${enEspanol}>${nombre}</span></p>`}
      ${descripcion && h`<p class="lectura lugar-ubicacion-texto"${enEspanol}>${descripcion}</p>`}
      ${
        mapa &&
        h`<div class="lugar-acciones">
          ${boton({ texto: t(lang, "lugar.verEnMaps"), href: datos.urlMaps(lat, lng), variante: "lona", chico: true, icono: "externo", attrs: { target: "_blank", rel: "noopener" } })}
          ${boton({
            texto: t(lang, "lugar.verMapa"),
            href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`,
            variante: "contorno",
            icono: "lugar",
            attrs: {
              target: "_blank",
              rel: "noopener",
              "data-mapa-boton": true,
              "data-lat": lat,
              "data-lng": lng,
              "data-titulo": t(lang, "lugar.mapaTitulo", { lugar: lugar.titulo }),
              "data-texto-ver": t(lang, "lugar.verMapa"),
              "data-texto-ocultar": t(lang, "lugar.ocultarMapa"),
              "aria-controls": "mapa-lugar",
            },
          })}
        </div>
        <div class="lugar-mapa" id="mapa-lugar" data-mapa hidden></div>
        <p class="nota lugar-mapa-nota" data-mapa-nota hidden>${t(lang, "lugar.mapaNota")}</p>`
      }
    </section>`;
}

function seccionVideo(lang, lugar) {
  const id = tiktokUnico(lugar);
  if (!id) return null;
  return h`
    <section class="lugar-seccion" aria-labelledby="t-video">
      <h2 class="seccion-titulo" id="t-video">${t(lang, "lugar.video")}</h2>
      <div class="lugar-acciones">
        ${boton({
          texto: t(lang, "lugar.verVideo"),
          href: datos.urlTikTokEmbed(id),
          variante: "contorno",
          icono: "tiktok",
          attrs: { target: "_blank", rel: "noopener nofollow", "data-video-boton": id, "data-titulo": t(lang, "lugar.videoTitulo", { lugar: lugar.titulo }), "aria-controls": "video-lugar" },
        })}
      </div>
      <div class="lugar-video" id="video-lugar" data-video hidden></div>
      <p class="nota lugar-mapa-nota" data-video-nota hidden>${t(lang, "lugar.videoNota")}</p>
    </section>`;
}

// Enlaces externos del lugar: solo http(s) válidos.
function urlHttp(valor) {
  if (!valor || typeof valor !== "string") return null;
  try {
    const u = new URL(valor.trim());
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}
const sinWww = (host) => host.replace(/^www\./, "");

function contactos(lang, lugar) {
  const redes = lugar.redes || {};
  const filas = [];
  if (lugar.direccion && lugar.direccion.trim()) filas.push({ icono: "lugar", etiqueta: t(lang, "lugar.direccion"), texto: lugar.direccion.trim() });
  const telefono = (lugar.telefono || redes.phone || "").trim();
  if (telefono && /\d{7,}/.test(telefono.replace(/\D/g, "")) && lugar.tipo !== 20 && lugar.tipo !== 21) {
    filas.push({ icono: "telefono", etiqueta: t(lang, "lugar.telefono"), texto: telefono, href: `tel:${telefono.replace(/[^\d+]/g, "")}` });
  }
  const web = urlHttp(lugar.sitioWeb || redes.web);
  if (web) filas.push({ icono: "web", etiqueta: t(lang, "lugar.sitioWeb"), texto: sinWww(new URL(web).host), href: web, externo: true });
  for (const [clave, nombre] of [["facebook", "Facebook"], ["instagram", "Instagram"], ["tiktok", "TikTok"], ["youtube", "YouTube"]]) {
    const url = urlHttp(redes[clave]);
    if (url) filas.push({ icono: clave, etiqueta: nombre, texto: nombre, href: url, externo: true });
  }
  const correo = (redes.mail || "").trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) filas.push({ icono: "correo", etiqueta: "Email", texto: correo, href: `mailto:${correo}` });
  return filas;
}

function seccionContacto(lang, lugar) {
  const filas = contactos(lang, lugar);
  if (!filas.length) return null;
  return h`
    <section class="lugar-seccion" aria-labelledby="t-contacto">
      <h2 class="seccion-titulo" id="t-contacto">${t(lang, "lugar.contacto")}</h2>
      <ul class="lugar-contacto">
        ${filas.map((f) => h`<li>${icono(f.icono)}${
          f.href
            ? h`<a href="${f.href}"${f.externo ? raw(' target="_blank" rel="noopener nofollow"') : ""}${f.etiqueta !== f.texto ? raw(` aria-label="${esc(`${f.etiqueta}: ${f.texto}`)}"`) : ""}>${f.texto}</a>`
            : h`<span><span class="sr-only">${f.etiqueta}: </span>${f.texto}</span>`
        }</li>`)}
      </ul>
    </section>`;
}

function avisoCambio(lang, lugar, ctx) {
  if (lugar.tipo !== datos.TIPO_TIANGUIS && lugar.tipo !== datos.TIPO_MERCADO) return null;
  return h`
    <aside class="lugar-aviso" aria-labelledby="t-cambio">
      <h2 id="t-cambio">${t(lang, "lugar.cambioTitulo")}</h2>
      <p>${t(lang, "lugar.cambioTexto")}</p>
      ${boton({ texto: t(lang, "lugar.cambioBoton"), href: ctx.ruta(`/sugerir/cambio?lugar=${encodeURIComponent(lugar.slug)}`), variante: "contorno" })}
    </aside>`;
}

function avisoSinFoto(lang, lugar, ctx) {
  if (lugar.imagen && lugar.imagen.tipo === "foto") return null;
  return h`
    <aside class="lugar-aviso" aria-labelledby="t-sinfoto">
      <h2 id="t-sinfoto">${t(lang, "lugar.sinFotoTitulo")}</h2>
      <p>${t(lang, "lugar.sinFotoTexto")}</p>
      ${boton({ texto: t(lang, "lugar.sinFotoBoton"), href: ctx.ruta(`/sugerir/foto?lugar=${encodeURIComponent(lugar.slug)}`), variante: "foco", icono: "camara" })}
    </aside>`;
}

function seccionComentarios(lang, lugar) {
  // social.js reemplaza el contenido del contenedor: el título va fuera.
  return h`
    <section class="lugar-seccion lugar-comentarios" id="comentarios" aria-labelledby="t-comentarios">
      <h2 class="seccion-titulo" id="t-comentarios">${t(lang, "lugar.comentarios")}</h2>
      <div data-comentarios-inline data-id="${lugar.id}"></div>
      <noscript><p class="nota">${t(lang, "lugar.comentariosSinJs")}</p></noscript>
    </section>`;
}

// ---------- Datos estructurados ----------

function jsonLdLugar(lang, lugar, eslabones, ctx) {
  const url = urlAbsoluta(lang, `/lugar/${lugar.slug}`);
  const municipio = municipioDe(lugar);
  const foto = urlFotoAbsoluta(lugar, 800);
  const credito = lugar.imagen && lugar.imagen.credito;
  const imagen = foto
    ? credito
      ? { "@type": "ImageObject", url: foto, creditText: `${credito.autor} · ${credito.licencia} · ${credito.fuente || "Wikimedia Commons"}`, ...(credito.url ? { acquireLicensePage: credito.url } : {}) }
      : foto
    : undefined;
  const redes = lugar.redes || {};
  const telefono = (lugar.telefono || redes.phone || "").trim();
  const sameAs = [urlHttp(lugar.sitioWeb || redes.web), urlHttp(redes.facebook), urlHttp(redes.instagram)].filter(Boolean);
  const direccion = { "@type": "PostalAddress", ...(lugar.direccion ? { streetAddress: lugar.direccion } : {}), addressLocality: municipio, addressRegion: "Colima", addressCountry: "MX" };
  const principal = {
    "@context": "https://schema.org",
    "@type": "TouristAttraction",
    name: lugar.titulo,
    description: datos.textoDescripcion(lugar, lang) || undefined,
    url,
    ...(imagen ? { image: imagen } : {}),
    address: direccion,
    ...(coordenadasValidas(lugar) ? { geo: { "@type": "GeoCoordinates", latitude: lugar.ubicacion.lat, longitude: lugar.ubicacion.lng } } : {}),
    containedInPlace: { "@type": "AdministrativeArea", name: "Colima" },
    ...(telefono ? { telephone: telefono } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    inLanguage: lang === "en" ? "en" : "es-MX",
  };
  const migas = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...eslabones.map((e, i) => ({ "@type": "ListItem", position: i + 1, name: e.nombre, item: urlAbsoluta(lang, e.ruta) })),
      { "@type": "ListItem", position: eslabones.length + 1, name: lugar.titulo, item: url },
    ],
  };
  return [principal, migas];
}

module.exports = {
  rutas: ["/lugar/:slug"],
  async pagina(req, ctx) {
    const { lang } = ctx;
    const bruto = String(req.params.slug || "");

    // Un id de 24 hex (Favoritos, feed) lleva a la ficha con su slug; un slug en
    // mayúsculas también se normaliza.
    let lugar = datos.lugarPorSlug(bruto);
    if (!lugar && ES_ID.test(bruto)) lugar = datos.lugarPorId(bruto.toLowerCase());
    if (!lugar) lugar = datos.lugarPorSlug(bruto.toLowerCase());
    if (!lugar) return { status: 404 };
    if (lugar.slug !== bruto) return { redirigir: rutaLugar(lang, lugar), status: 301 };

    const municipio = municipioDe(lugar);
    const padre = listaPadre(lang, lugar);
    const { eslabones, html: migasHtml } = migas(lang, lugar, padre, ctx);
    const foto = urlFotoAbsoluta(lugar, 800);
    const textoMeta = datos.textoDescripcion(lugar, lang);
    // Los hoteles y restaurantes del catálogo son datos de ejemplo: no se indexan. En inglés
    // solo se indexa la ficha cuya descripción está en inglés (lib/guia/indexacion.js); la que
    // no, tampoco se anuncia como alterna de la versión en español.
    const ejemplo = esDeEjemplo(lugar);
    const indexable = lugarIndexable(lugar, lang);
    const g = guia(lang, lugar, ctx);

    const cuerpo = h`
<div class="lugar-pagina">
  <div class="envoltura">
    <div class="lugar-cable">${guirnalda({ focos: 34, comba: 0.4, alto: 40 })}</div>
    ${migasHtml}
    <article class="lugar" data-registrar-vista="${lugar.id}">
      ${bloqueFoto(lang, lugar, municipio)}
      <div class="lugar-hoja">
        <header class="lugar-cabeza" data-revela="2">
          <h1 class="rotulo lugar-nombre">${lugar.titulo}</h1>
          <p class="lugar-muni">${
            datos.municipioPorId(lugar.municipioId)
              ? h`<a href="${ctx.ruta(`/municipios/${datos.municipioPorId(lugar.municipioId).slug}`)}" aria-label="${t(lang, "lugar.municipioEnlace", { municipio })}">${icono("lugar")}<span>${municipio}</span></a>`
              : h`<span>${icono("lugar")}<span>${municipio}</span></span>`
          }</p>
        </header>
        ${barraAcciones(lang, lugar, municipio)}
        ${seccionDescripcion(lang, lugar)}
        ${g.perfil}
        ${seccionCuando(lang, lugar)}
        ${seccionServicios(lang, lugar)}
        ${seccionHorarios(lang, lugar)}
        ${seccionUbicacion(lang, lugar)}
        ${g.llegar}
        ${seccionVideo(lang, lugar)}
        ${seccionContacto(lang, lugar)}
        ${g.epoca}
        ${g.consejos}
        ${g.cerca}
        ${g.municipio}
        ${avisoCambio(lang, lugar, ctx)}
        ${avisoSinFoto(lang, lugar, ctx)}
        ${seccionComentarios(lang, lugar)}
      </div>
    </article>
    <div class="lugar-pie-anuncio">${anuncio({ lang, formato: "banner", indice: 0, clase: "anuncio-pie" })}</div>
  </div>
</div>`;

    return {
      titulo: `${lugar.titulo}, ${municipio}`,
      descripcion: resumen(textoMeta) || t(lang, "lugar.descripcionRespaldo", { lugar: lugar.titulo, municipio }),
      activa: "inicio",
      cuerpo,
      css: ["lugar"],
      js: ["social", "paginas/lugar"],
      jsonLd: ejemplo ? [] : jsonLdLugar(lang, lugar, eslabones, ctx),
      robots: indexable ? undefined : "noindex, follow",
      alternos: lugarIndexable(lugar, "en") ? undefined : false,
      og: { imagen: foto || undefined, alt: `${lugar.titulo}, ${municipio}`, tipo: "website" },
      cache: "estatico",
    };
  },
};
