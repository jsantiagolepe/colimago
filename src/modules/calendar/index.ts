import { lazy } from 'react';
import type { AppModule } from '../types';
import { calendarPending } from './store';

export const calendarModule: AppModule = {
  id: 'calendar',
  title: 'Calendar',
  description: 'Tus checks de cada día.',
  path: '/calendar',
  icon: 'calendar',
  color: '#c97a14',
  component: lazy(() => import('./CalendarPage')),
  pending: calendarPending,
  // Su lugar en el inicio ahora es de GRC; sus checks siguen en Pendientes.
  hidden: true,
};
