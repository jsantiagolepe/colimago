// Iconos de los servicios de los lugares (baños, camping, piscina…).
//
// Mismo trazo que el sprite de la guía (iconos.js): 1.8, extremos y uniones
// redondeados, rejilla de 24. Se devuelven como SVG en línea (no hacen falta
// en el sprite compartido, que lo manda cada página completo). Las partes con
// class="lleno" se rellenan con el color del texto (regla `.ic .lleno` de
// guia.css).
//
//   iconoServicio("pool")            → <svg class="ic ic-servicio" …>…</svg>
//   iconoServicio("pool", "mi-clase")
//
// Claves: las 23 que pinta la app más las que se rescataron del catálogo
// (park, landscape, cleaning_services, wi-fi, fireplace, cabin_rental,
// local_dining) y directions_car. Una clave sin dibujo cae a una paloma.

const ICONOS_SERVICIOS = {
  // Baños: dos figuras separadas por una raya.
  bathroom:
    '<circle cx="6.5" cy="4.6" r="1.7"/><path d="M4 21v-6.5M9 21v-6.5M3.5 14.5h6M4 8.8h5a1.5 1.5 0 0 1 1.5 1.5v4.2M3.5 10.3v4.2"/><circle cx="17.5" cy="4.6" r="1.7"/><path d="M17.5 8.4 14.3 15h6.4zM15.8 15v6M19.2 15v6"/>',
  // Comida y bebidas: vaso con tapa y popote.
  food_drink:
    '<path d="M5.5 8.5h13l-1.3 11a1.6 1.6 0 0 1-1.6 1.5H8.4a1.6 1.6 0 0 1-1.6-1.5z"/><path d="M4.5 8.5h15"/><path d="M13 8.5 14.3 3.5h3"/><path d="M7 13.5h10"/>',
  // Restaurante: tenedor y cuchillo.
  restaurant:
    '<path d="M5 3v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3V3M8 3v18M17 21V3c-2.4 1.4-3.5 4.4-3.5 8H17"/>',
  // Comida (local_dining): campana de servicio.
  local_dining:
    '<path d="M3 18.500h18M5 18.500a7 7 0 0 1 14 0M12 11.500V9.500M10.500 9.500h3"/><path d="M3.500 21.500h17"/>',
  // Estacionamiento: la P dentro de un cuadro.
  local_parking:
    '<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M9.5 17V7.5h3.4a2.8 2.8 0 0 1 0 5.6H9.5"/>',
  // Auto.
  directions_car:
    '<path d="M4 15.5V13l1.8-4.3a2 2 0 0 1 1.8-1.2h8.8a2 2 0 0 1 1.8 1.2L20 13v2.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 12.5h16"/><circle cx="7.6" cy="17.6" r="1.7"/><circle cx="16.4" cy="17.6" r="1.7"/>',
  // Guía turístico: persona y bandera.
  tour_guide:
    '<circle cx="8.5" cy="6" r="2.3"/><path d="M4 20.5V18a4.5 4.5 0 0 1 9 0v2.5"/><path d="M17 20.5V5M17 5h4l-1.2 2.2L21 9.5h-4"/>',
  // Senderismo: caminante con bastón.
  hiking:
    '<circle cx="12.5" cy="4.5" r="1.7"/><path d="m11.5 8.5-2.3 5.3 3.4 2.4.8 5.3M9.2 13.8l-3 1.4M12.8 9.7l3.4 2.6M16.6 8.5V21"/>',
  // Camping: casa de campaña.
  camping:
    '<path d="M2.5 19.5h19M12 4.5l-8 15M12 4.5l8 15"/><path d="m12 19.5-3.2-6.2M12 19.5l3.2-6.2"/>',
  // Observación: binoculares.
  nature_people:
    '<circle cx="7" cy="16" r="3.6"/><circle cx="17" cy="16" r="3.6"/><path d="M7 12.4V6.5h3v3.5M17 12.4V6.5h-3V10M10 9.5h4"/>',
  // Área de picnic: mesa con bancas.
  picnic_area:
    '<path d="M4.5 9.5h15M3 14.5h18M7.5 9.5 5.5 20M16.5 9.5l2 10.500M9.500 14.500l-1.100 5.500M14.500 14.500l1.100 5.500"/>',
  // Piscina: escalera y agua.
  pool:
    '<path d="M8.500 15V6.500a2.500 2.500 0 0 0-5 0M15.500 15V6.500a2.500 2.500 0 0 1 5 0M8.500 9.500h7M8.500 12.500h7"/><path d="M3 18c1.500 0 1.500 1.300 3 1.300S7.500 18 9 18s1.500 1.300 3 1.300S13.500 18 15 18s1.500 1.300 3 1.300S19.500 18 21 18"/>',
  // Enramadas: sombrilla de palapa.
  umbrella:
    '<path d="M3 11.500a9 9 0 0 1 18 0zM12 11.500V21M9.500 21h5M8.500 11.500C8.500 8 10 4.900 12 2.700M15.500 11.500C15.500 8 14 4.900 12 2.700"/>',
  // Asadores: parrilla con humo.
  bbq:
    '<path d="M4 11h16a8 8 0 0 1-16 0zM8.500 18.500 7 21.500M15.500 18.500l1.500 3"/><path d="M9 3.500c-1.200 1.200 1.200 2.300 0 3.500M12 3.500c-1.200 1.200 1.200 2.300 0 3.500M15 3.500c-1.200 1.200 1.200 2.300 0 3.500"/>',
  // Pesca: pez.
  fishing:
    '<path d="M3 12c2.200-3.600 5.400-5.200 8.800-4.500 2.300.500 3.900 2.300 5 4.500-1.100 2.200-2.700 4-5 4.500C8.400 17.200 5.200 15.600 3 12z"/><path d="M16.800 12l4.200-3.700v7.400z"/><circle cx="8" cy="11" r=".6"/>',
  // Barco: velero.
  directions_boat:
    '<path d="M3 15.500h18l-2.200 3.700a1.500 1.500 0 0 1-1.300.8h-11a1.500 1.500 0 0 1-1.300-.8z"/><path d="M12 3.500v12M12 4.500l6 9H12M10.500 8 6.200 13.500h4.300"/>',
  // Cabañas: casa con chimenea.
  cabain_rental:
    '<path d="m3 11.500 9-7.500 9 7.500M5.500 10v10.500h13V10M10 20.500V15h4v5.500M17 7.500V4.500h-2.500"/>',
  cabin_rental:
    '<path d="m3 11.500 9-7.500 9 7.500M5.500 10v10.500h13V10M10 20.500V15h4v5.500M17 7.500V4.500h-2.500"/>',
  // Lanchas: lancha con cabina.
  kayak_rental:
    '<path d="M2.500 13.500h19l-2.800 5.500a1.500 1.500 0 0 1-1.300.8H6.600a1.500 1.500 0 0 1-1.300-.8z"/><path d="m7 13.500 2.500-5h5l2.500 5M12 8.500V5"/><path d="M3 22c1.500 0 1.500-1 3-1s1.500 1 3 1 1.500-1 3-1 1.500 1 3 1 1.500-1 3-1 1.500 1 3 1"/>',
  // Mascotas: huella.
  pet_friendly:
    '<path d="M12 20.500c-3 0-5-1.700-5-3.800 0-2.500 2.500-4.700 5-4.700s5 2.200 5 4.700c0 2.100-2 3.800-5 3.800z"/><circle cx="4.800" cy="11" r="1.500"/><circle cx="8.700" cy="6.800" r="1.500"/><circle cx="15.300" cy="6.800" r="1.500"/><circle cx="19.200" cy="11" r="1.500"/>',
  // Hotel: cama.
  hotel:
    '<path d="M3 18V7M3 14h18v4M21 14v-2.500A2.500 2.500 0 0 0 18.500 9H11v5"/><circle cx="7" cy="11" r="1.600"/>',
  // Ciclismo: bicicleta.
  mountain_biking:
    '<circle cx="6" cy="16.500" r="3.500"/><circle cx="18" cy="16.500" r="3.500"/><path d="m6 16.500 4-7h5.500l2.500 7M10 9.500l3 7M8.500 7h3M15.500 9.500 14.500 6.500H17"/>',
  // Wi-Fi.
  wifi:
    '<path d="M2.500 9a15 15 0 0 1 19 0M5.500 12.500a10.500 10.500 0 0 1 13 0M8.500 16a6 6 0 0 1 7 0"/><circle class="lleno" cx="12" cy="19.500" r="1.100"/>',
  // Renta de equipo: etiqueta.
  equipment_rental:
    '<path d="M3.500 12.500V4.500a1 1 0 0 1 1-1h8a1 1 0 0 1 .7.300l7.500 7.500a1 1 0 0 1 0 1.400l-7.500 7.500a1 1 0 0 1-1.400 0l-7.800-7.800a1 1 0 0 1-.500-.900z"/><circle cx="8" cy="8" r="1.400"/>',
  // Tenis: raqueta y pelota.
  sports_tennis:
    '<circle cx="14.500" cy="9.500" r="5.500"/><path d="M10.600 13.400 4 20M9 9.500h11M14.500 4v11"/><circle cx="5.500" cy="5.500" r="1.400"/>',
  // Parque: árbol.
  park:
    '<path d="M12 3a5 5 0 0 0-4.600 6.900A4 4 0 0 0 9 17.500h6a4 4 0 0 0 1.600-7.600A5 5 0 0 0 12 3z"/><path d="M12 17.500V21"/>',
  // Paisaje: montañas y sol.
  landscape:
    '<path d="m2.500 19.500 6-10 4 6.500 2.500-3.500 6 7z"/><circle cx="17.500" cy="6" r="2"/>',
  // Limpieza: destellos.
  cleaning_services:
    '<path d="m10 4 1.700 4.300L16 10l-4.300 1.700L10 16l-1.700-4.300L4 10l4.300-1.700z"/><path d="m18 14 .8 2.200L21 17l-2.200.8L18 20l-.8-2.200L15 17l2.200-.8z"/>',
  // Fogata: llama y leños.
  fireplace:
    '<path d="M12 3c.5 3.500 5 5.500 5 10.500a5 5 0 0 1-10 0c0-2 1-3.200 2-4.200.200 1.500 1 2.200 1.800 2.500C10.500 9 11 6 12 3z"/><path d="m4 21 5-2M20 21l-5-2"/>',
};
ICONOS_SERVICIOS["wi-fi"] = ICONOS_SERVICIOS.wifi;

const GENERICO = '<circle cx="12" cy="12" r="9"/><path d="m8 12.500 2.800 2.800L16 9.500"/>';

function iconoServicio(clave, clase = "") {
  const trazos = ICONOS_SERVICIOS[String(clave).toLowerCase()] || GENERICO;
  const extra = clase ? ` ${String(clase).replace(/[^\w -]/g, "")}` : "";
  return `<svg class="ic ic-servicio${extra}" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${trazos}</svg>`;
}

module.exports = { ICONOS_SERVICIOS, iconoServicio };
