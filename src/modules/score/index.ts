import { lazy } from 'react';
import type { AppModule } from '../types';
import { scorePending } from './store';

export const scoreModule: AppModule = {
  id: 'score',
  title: 'Score',
  description: 'iOS, Android y Facebook.',
  path: '/score',
  icon: 'trending-up',
  color: '#e0702a',
  component: lazy(() => import('./ScorePage')),
  pending: scorePending,
  showPendingCount: true,
};
