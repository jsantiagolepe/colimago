// Iconos de la guía: un solo trazo (1.8, redondeado) sobre una rejilla de 24.
//
// Se mandan una vez por página como <symbol> dentro de un <svg> oculto
// (layout.js) y se usan con `icono("corazon")` de componentes.js. El color y
// el relleno vienen del CSS (`.ic`, `.ic-lleno`), no de los símbolos, para que
// un botón activo pueda rellenar su icono con `[aria-pressed="true"]`.
//
// Iconos de servicios de los lugares (baños, camping, piscina…): los dibuja
// la página de lugares en lib/guia/iconos-servicios.js.

const ICONOS = {
  inicio: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V20a1 1 0 0 0 1 1h3.5v-6h5v6H18a1 1 0 0 0 1-1V9.5"/>',
  brujula: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  calendario: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  corazon: '<path d="M12 20.5s-8-4.7-8-10.6A4.6 4.6 0 0 1 12 7a4.6 4.6 0 0 1 8 2.9c0 5.9-8 10.6-8 10.6z"/>',
  ajustes: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
  "me-gusta":
    '<path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 1.9 2.6l-2.3 8a2 2 0 0 1-1.9 1.4H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.8a2 2 0 0 0 1.8-1.1L12 2a3.1 3.1 0 0 1 3 3.9z"/>',
  comentario: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/>',
  ojo: '<path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  "ojo-tachado":
    '<path d="M9.9 5.2A9.7 9.7 0 0 1 12 5c6.4 0 10 7 10 7a17 17 0 0 1-3.1 4M6.6 6.700A17 17 0 0 0 2 12s3.6 7 10 7c1.7 0 3.2-.5 4.5-1.2"/><path d="M9.9 9.900a3 3 0 0 0 4.2 4.200M3 3l18 18"/>',
  compartir:
    '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.500l-6.8 4"/>',
  "mas-opciones": '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
  lugar: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  reloj: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  "flecha-derecha": '<path d="M5 12h14M13 6l6 6-6 6"/>',
  "flecha-izquierda": '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  "chevron-derecha": '<path d="m9 6 6 6-6 6"/>',
  "chevron-izquierda": '<path d="m15 6-6 6 6 6"/>',
  "chevron-abajo": '<path d="m6 9 6 6 6-6"/>',
  cerrar: '<path d="M6 6l12 12M18 6 6 18"/>',
  bandera: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  externo: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
  bote: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  paloma: '<path d="m5 12.5 4.5 4.500L19 7.5"/>',
  enviar: '<path d="M21 3 10.5 13.500M21 3l-6.5 18-4-8-8-4z"/>',
  idioma: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  cama: '<path d="M3 18V7M3 14h18v4M21 14v-2.500A2.5 2.5 0 0 0 18.5 9H11v5"/><circle cx="7" cy="11" r="1.6"/>',
  cubiertos: '<path d="M5 3v6a3 3 0 0 0 3 3 3 3 0 0 0 3-3V3M8 3v18M17 21V3c-2.4 1.4-3.5 4.4-3.5 8H17"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  salir: '<path d="M9 21H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h4M16 17l5-5-5-5M21 12H9"/>',
  correo: '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>',
  telefono: '<path d="M5 4h3.500l1.5 4.5-2 1.500a11 11 0 0 0 6 6l1.5-2 4.5 1.500V19a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  web: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  descargar: '<path d="M12 4v12M7 11l5 5 5-5M5 20h14"/>',
  camara: '<path d="M4 8h3l1.5-2.500h7L17 8h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  estrella: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.100L12 17l-5.4 2.9 1-6.100L3.2 9.500l6.1-.9z"/>',
  ampliar: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  reproducir: '<path d="m8 5 11 7-11 7z"/>',
  luna: '<path d="M20 14.500A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.500z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.900l1.4 1.400M17.7 17.700l1.4 1.400M19.1 4.900l-1.4 1.400M6.3 17.700l-1.4 1.4"/>',
  documento: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6"/>',
  escudo: '<path d="M12 3 5 6v5c0 4.5 3 8.4 7 10 4-1.6 7-5.5 7-10V6z"/>',
  tienda: '<path d="M4 9.5 5.5 4h13L20 9.500M4 9.500a2.7 2.7 0 0 0 5.3 0 2.7 2.7 0 0 0 5.4 0 2.7 2.7 0 0 0 5.3 0M5.5 12.500V20h13v-7.5"/>',
  hoja: '<path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15M5 19c2-4 5-7 9-9"/>',
  "nube-tachada": '<path d="M3 3l18 18M8 8a6 6 0 0 0-1 .1A4.5 4.5 0 0 0 7.5 17H17M19.5 17A4.5 4.5 0 0 0 17 9a6 6 0 0 0-9-.5"/>',
  volcan: '<path d="M3 20 9.5 9h5L21 20zM9.5 9l1-2.500M14.5 9l-1-2.5"/>',
  burbujas: '<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2zM19 9h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2v3l-4-3h-4a2 2 0 0 1-2-1.5"/>',
  foco: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.800c.6.5 1 1.2 1.1 2V16h5v-.2c.1-.8.5-1.5 1.1-2A6 6 0 0 0 12 3z"/>',
  "ayuda": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.500a2.5 2.5 0 1 1 3.5 2.300c-.7.4-1 .900-1 1.700M12 17h.01"/>',
  // Marcas: rellenas (`ic-lleno`) o de trazo según el glifo.
  facebook:
    '<path class="lleno" d="M13.5 21v-7.500h2.600l.5-3.200h-3.100V8.400c0-.9.4-1.6 1.7-1.600h1.500V4.100c-.3 0-1.2-.1-2.2-.1-2.4 0-4 1.4-4 4.100v2.300H7.500v3.200h2.600V21z"/>',
  instagram: '<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle class="lleno" cx="17.2" cy="6.8" r="1"/>',
  tiktok: '<path d="M14 3v11.200a3.2 3.2 0 1 1-3.2-3.200M14 3c.3 2.6 1.9 4.3 4.5 4.5"/>',
  youtube: '<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path class="lleno" d="m10 9.5 5 2.5-5 2.500z"/>',
  whatsapp:
    '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3.2 3z"/><path d="M9 8.500c0 3.5 2.5 6.5 6.5 6.500l1-1.5-2.2-1-.9.800a5 5 0 0 1-2.3-2.300l.8-.9-1-2.200z"/>',
  apple:
    '<path class="lleno" d="M17.05 20.280c-.98.95-2.05.8-3.08.350-1.09-.460-2.09-.480-3.24 0-1.44.620-2.2.44-3.06-.350C2.79 15.25 3.51 7.59 9.12 7.310c1.35.070 2.29.740 3.08.8.99-.190 2.05-.850 3.16-.750 1.52.120 2.66.720 3.4 1.8-3.12 1.87-2.61 5.98.280 7.06-.610 1.6-1.4 3.15-2.99 4.060zM12.03 7.250c-.150-2.23 1.66-4.09 3.74-4.25.290 2.13-1.98 4.15-3.74 4.250z"/>',
  "google-play":
    '<path class="lleno" d="M3.6 2.200c-.3.3-.4.7-.4 1.200v17.200c0 .500.1.9.4 1.200l.1.1 9.6-9.600v-.2L3.7 2.100l-.1.100zM16.5 15.500l-3.2-3.200v-.2l3.2-3.2.1.1 3.8 2.200c1.1.6 1.1 1.6 0 2.200l-3.8 2.2-.1-.100zM16.6 15.4 13.3 12l-9.7 9.700c.4.4 1 .4 1.7.1l11.3-6.400M16.6 8.6 5.3 2.200c-.7-.4-1.3-.3-1.7.1L13.3 12l3.3-3.400z"/>',
};

// <symbol> de cada icono (el viewBox es común). Las partes con class="lleno"
// se rellenan con el color del texto.
function sprite() {
  const simbolos = Object.entries(ICONOS)
    .map(([nombre, trazos]) => `<symbol id="i-${nombre}" viewBox="0 0 24 24">${trazos}</symbol>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" class="sprite" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden">${simbolos}</svg>`;
}

module.exports = { ICONOS, sprite };
