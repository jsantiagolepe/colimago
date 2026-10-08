// Íconos de trazo de uso general (cuadrícula de 24, trazo de 2px). Su
// tamaño base es .ui-icon en base.css; cada pantalla lo ajusta.

function Icono({ d, className }: { d: string; className?: string }) {
  return (
    <svg className={className ?? 'ui-icon'} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

type Props = { className?: string };

export const IconCheck = (p: Props) => <Icono d="M5 12.5l4.5 4.5L19 7.5" {...p} />;
export const IconPrev = (p: Props) => <Icono d="M15 18l-6-6 6-6" {...p} />;
export const IconNext = (p: Props) => <Icono d="M9 18l6-6-6-6" {...p} />;
export const IconClose = (p: Props) => <Icono d="M18 6L6 18M6 6l12 12" {...p} />;
export const IconPlus = (p: Props) => <Icono d="M12 5v14M5 12h14" {...p} />;
export const IconTrash = (p: Props) => (
  <Icono d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M18.5 6l-.8 13.1a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 6M10 11v6M14 11v6" {...p} />
);
export const IconCalendar = (p: Props) => (
  <Icono d="M8 2.5v3M16 2.5v3M5.5 4.5h13a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2zM3.5 10h17" {...p} />
);
