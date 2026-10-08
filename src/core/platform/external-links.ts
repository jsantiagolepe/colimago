// Los enlaces a otros sitios (post de Facebook, Google Maps…) se abren en
// el navegador del sistema. Dentro de la app no existen pestañas nuevas:
// sin esto, un <a target="_blank"> no haría nada.

import { openUrl } from '@tauri-apps/plugin-opener';

const PROTOCOLOS_EXTERNOS = new Set(['http:', 'https:', 'mailto:']);

export function installExternalLinkHandler(): () => void {
  const alHacerClic = (evento: MouseEvent) => {
    if (evento.defaultPrevented || evento.button !== 0) return;
    const enlace = evento.target instanceof Element ? evento.target.closest('a[href]') : null;
    if (!(enlace instanceof HTMLAnchorElement)) return;

    let url: URL;
    try {
      url = new URL(enlace.href, window.location.href);
    } catch {
      return;
    }
    if (!PROTOCOLOS_EXTERNOS.has(url.protocol) || url.origin === window.location.origin) return;

    evento.preventDefault();
    openUrl(url.href).catch((err) => console.error('No se pudo abrir el enlace', err));
  };

  document.addEventListener('click', alHacerClic);
  return () => document.removeEventListener('click', alHacerClic);
}
