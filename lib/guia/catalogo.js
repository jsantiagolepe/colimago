// Catálogo compacto para el navegador (/catalogo-es.json, /catalogo-en.json): lo que
// necesitan Buscar, Cerca de ti, el Mapa, el Pasaporte, las listas y los planes sin
// pedir una página por lugar. Se arma una vez por idioma con los datos locales; los
// eventos del backend se suman con su caché de 60 s.
//
//   { lugares: [{ id, s, t, m, n, d, f, la, lo }], fiestas: [...], feria: [...], platillos: [...], eventos: [...] }
//
//   lugares   id (del catálogo), s slug, t tipo, m municipio, n título, d texto corto,
//             f foto (ruta sin tamaño ni extensión), la/lo coordenadas (solo las válidas)
//   fiestas   id, n nombre, m municipio, l localidad, i/f mes y día de inicio y fin
//   feria     d fecha, h hora, l lugar, n nombre (la Feria de Todos los Santos)
//   platillos id, n nombre, tp tipo
//   eventos   id, n título, d fecha, m municipio (solo los vigentes)

const datos = require("./datos");
const eventos = require("./eventos");
const { t } = require("./i18n");
const feriaSantos = require("../../data/feria-santos.json");
const gastronomia = require("../../data/gastronomia.json");
const { resumen, coordenadasValidas } = require("./paginas/lugares-vista");

const memoria = {};

function construir(lang) {
  const lugares = datos.lugares.map((l) => {
    const o = { id: l.id, s: l.slug, t: l.tipo, m: l.municipioId, n: l.titulo, d: resumen(datos.textoDescripcion(l, lang), 110) };
    if (l.imagen && l.imagen.archivo) o.f = l.imagen.archivo;
    if (coordenadasValidas(l)) {
      o.la = Number(l.ubicacion.lat.toFixed(5));
      o.lo = Number(l.ubicacion.lng.toFixed(5));
    }
    return o;
  });
  const fiestas = datos.fiestas.map((f) => ({ id: f.id, n: f.nombre, m: f.municipioId, l: f.localidad, i: f.inicio, f: f.fin }));
  const feria = feriaSantos.programa.flatMap((dia) => dia.eventos.map((e) => ({ d: dia.fecha, h: e.hora, l: e.lugar, n: e.nombre })));
  const platillos = gastronomia.map((p) => ({ id: p.id, n: t(lang, `gastro.dishes.${p.id}.name`), tp: p.tipo }));
  return { lugares, fiestas, feria, platillos };
}

async function catalogo(lang) {
  if (!memoria[lang]) memoria[lang] = construir(lang);
  const lista = await eventos.obtenerEventos().catch(() => ({ eventos: [] }));
  const hoy = eventos.hoyEnColima();
  const vigentes = eventos.proximos(lista.eventos || [], hoy).slice(0, 300).map((e) => ({ id: e.id, n: e.titulo, d: e.fecha, m: e.municipioId }));
  return { ...memoria[lang], eventos: vigentes };
}

function montar(app) {
  app.get(/^\/catalogo-(es|en)\.json$/, async (req, res) => {
    try {
      res.set("Cache-Control", "public, max-age=0, s-maxage=300, stale-while-revalidate=3600").type("json").send(JSON.stringify(await catalogo(req.params[0])));
    } catch (err) {
      console.error("catalogo.json:", err);
      res.status(500).set("Cache-Control", "no-store").json({ error: "No se pudo armar el catálogo." });
    }
  });
}

module.exports = { montar, catalogo };
