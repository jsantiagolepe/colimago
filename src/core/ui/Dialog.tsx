import { useEffect, useRef, type ReactNode } from 'react';

/**
 * Diálogo modal nativo (<dialog> + showModal): atrapa el foco y se cierra
 * con Escape o con un clic en el fondo. Se abre al montarse; para cerrarlo,
 * quien lo usa deja de renderizarlo desde `onClose`. Varios abiertos se
 * apilan en el orden en que se abrieron, y Escape cierra el de arriba.
 *
 * Su contenido debe llenar el <dialog> (sin padding en él), para que un
 * clic directo sobre el elemento solo pueda venir del fondo.
 */
export function Dialog({
  className,
  labelledBy,
  onClose,
  children,
}: {
  className?: string;
  labelledBy?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  // Un clic que empezó dentro (p. ej. al seleccionar texto) y terminó en
  // el fondo no debe cerrar el diálogo.
  const presionEnFondo = useRef(false);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      className={className}
      aria-labelledby={labelledBy}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        presionEnFondo.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (presionEnFondo.current && e.target === e.currentTarget) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
