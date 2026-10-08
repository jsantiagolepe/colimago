/** Marca de MyProject: cuatro módulos, uno encendido. Igual que el ícono de la app. */
export function AppMark({ className, size = 56 }: { className?: string; size?: number }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="15" fill="#202027" />
      <rect x="14" y="14" width="16" height="16" rx="4.5" fill="#f4f3f0" />
      <rect x="34" y="14" width="16" height="16" rx="4.5" fill="#f4f3f0" opacity="0.55" />
      <rect x="14" y="34" width="16" height="16" rx="4.5" fill="#f4f3f0" opacity="0.55" />
      <rect x="34" y="34" width="16" height="16" rx="4.5" fill="#f2a93b" />
    </svg>
  );
}
