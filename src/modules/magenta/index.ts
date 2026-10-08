import { lazy } from 'react';
import type { AppModule } from '../types';

export const magentaModule: AppModule = {
  id: 'magenta',
  title: 'Magenta',
  description: 'Magenta App, Magenta Web y CRM.',
  path: '/magenta',
  icon: 'layers',
  color: '#c42a7f',
  component: lazy(() => import('./MagentaPage')),
};
