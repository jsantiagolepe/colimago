import type { AppModule } from '../types';

// Vacío por ahora: cuando tenga pantalla, agrégale `component`
// (React.lazy) y una `description` para su tarjeta.
export const coursesModule: AppModule = {
  id: 'courses',
  title: 'Cursos',
  path: '/courses',
  icon: 'graduation-cap',
  color: '#5a57c9',
};
