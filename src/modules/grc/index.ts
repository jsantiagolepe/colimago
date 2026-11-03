import { lazy } from 'react';
import type { AppModule } from '../types';
import { grcPending } from './store';

export const grcModule: AppModule = {
  id: 'grc',
  title: 'GRC',
  description: 'Tu ruta de 6 meses: SGSI, ISO 27001, portafolio y empleo.',
  path: '/grc',
  icon: 'shield-check',
  color: '#1f8a6e',
  component: lazy(() => import('./GrcPage')),
  pending: grcPending,
};
