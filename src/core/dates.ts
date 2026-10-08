// Fechas de la app: siempre locales (nunca UTC), guardadas como
// "AAAA-MM-DD", y sus textos en español de México.

export function dateKey(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${mm}-${dd}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

/** Días de `from` a `to` (negativo si `to` es antes). */
export function daysBetween(from: string, to: string): number {
  return Math.round((parseDateKey(to).getTime() - parseDateKey(from).getTime()) / 86_400_000);
}

const mes = new Intl.DateTimeFormat('es-MX', { month: 'long' });
const diaDeSemana = new Intl.DateTimeFormat('es-MX', { weekday: 'long' });
const diaYMes = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long' });
const corta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const cortaConAnio = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1);

/** "Octubre" */
export const monthName = (fecha: Date) => mayuscula(mes.format(fecha));
/** "Miércoles" */
export const weekdayName = (fecha: Date) => mayuscula(diaDeSemana.format(fecha));
/** "7 de octubre" */
export const dayAndMonth = (fecha: Date) => diaYMes.format(fecha);

/** "Hoy", "Mañana", "Ayer" o "12 oct" (con año si no es el de `today`). */
export function relativeDate(key: string, today: string): string {
  const dias = daysBetween(today, key);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Mañana';
  if (dias === -1) return 'Ayer';
  const fecha = parseDateKey(key);
  const texto = fecha.getFullYear() === parseDateKey(today).getFullYear() ? corta.format(fecha) : cortaConAnio.format(fecha);
  return texto.replace('.', '');
}
