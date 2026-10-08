import { useEffect, useState } from 'react';
import { addDays, dateKey } from './dates';

/**
 * La fecha de hoy ("AAAA-MM-DD"), que cambia sola a medianoche y al volver
 * a la ventana (después de que la Mac durmió, el temporizador puede llegar
 * tarde). Así una pantalla que se quedó abierta de un día para otro no
 * sigue mostrando el día anterior.
 */
export function useToday(): string {
  const [hoy, setHoy] = useState(() => dateKey(new Date()));

  useEffect(() => {
    const revisar = () => setHoy(dateKey(new Date()));
    const medianoche = addDays(new Date(), 1).getTime() - Date.now() + 1000;
    const temporizador = setTimeout(revisar, medianoche);
    window.addEventListener('focus', revisar);
    document.addEventListener('visibilitychange', revisar);
    return () => {
      clearTimeout(temporizador);
      window.removeEventListener('focus', revisar);
      document.removeEventListener('visibilitychange', revisar);
    };
  }, [hoy]);

  return hoy;
}
