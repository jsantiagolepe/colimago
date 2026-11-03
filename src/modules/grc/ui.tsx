// Piezas pequeñas que comparten las pantallas de GRC.

import type { CSSProperties } from 'react';
import { parseDateKey } from '../../core/dates';
import { IconCheck } from '../../core/ui/icons';

const corta = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short' });
const larga = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'long', year: 'numeric' });
/** "2 nov" */
export const fechaCorta = (key: string) => corta.format(parseDateKey(key)).replace('.', '');
/** "2 de noviembre de 2026" */
export const fechaLarga = (key: string) => larga.format(parseDateKey(key));

export function CheckButton({
  done,
  color,
  label,
  onToggle,
  large = false,
}: {
  done: boolean;
  color: string;
  label: string;
  onToggle: () => void;
  large?: boolean;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={label}
      className={`grc-check${done ? ' is-done' : ''}${large ? ' grc-check--large' : ''}`}
      style={{ '--c': color } as CSSProperties}
      onClick={onToggle}
    >
      {done && <IconCheck />}
    </button>
  );
}
