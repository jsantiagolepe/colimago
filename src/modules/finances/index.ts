import type { AppModule } from '../types';

// Vacío por ahora: cuando tenga pantalla, agrégale `component`
// (React.lazy) y una `description` para su tarjeta.
export const financesModule: AppModule = {
  id: 'finances',
  title: 'Finances',
  path: '/finances',
  icon: 'wallet',
  color: '#3f7256',
};
