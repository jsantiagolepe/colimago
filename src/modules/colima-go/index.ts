import { lazy } from 'react';
import type { AppModule } from '../types';

export const colimaGoModule: AppModule = {
  id: 'colima-go',
  title: 'ColimaGo',
  description: 'Eventos, lugares y posts.',
  path: '/colima-go',
  icon: 'map-pin',
  color: '#2f5d5a',
  component: lazy(() => import('./ColimaGoDashboard')),
};
