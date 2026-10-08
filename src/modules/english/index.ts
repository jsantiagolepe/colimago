import { lazy } from 'react';
import type { AppModule } from '../types';
import { englishPending } from './store';

export const englishModule: AppModule = {
  id: 'english',
  title: 'English',
  description: 'Loora, YouTube, Text, Talk e IA.',
  component: lazy(() => import('./EnglishPage')),
  pending: englishPending,
  showPendingCount: true,
  path: '/english',
  icon: 'languages',
  color: '#3364c9',
};
