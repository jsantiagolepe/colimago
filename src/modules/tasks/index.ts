import { lazy } from 'react';
import type { AppModule } from '../types';
import { tasksPending } from './store';

export const tasksModule: AppModule = {
  id: 'tasks',
  title: 'Tareas',
  description: 'Pendientes con fecha, hechos y por hacer.',
  path: '/tasks',
  icon: 'list-checks',
  color: '#2a7f9e',
  component: lazy(() => import('./TasksPage')),
  pending: tasksPending,
};
