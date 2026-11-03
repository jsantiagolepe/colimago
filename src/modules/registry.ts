// Módulos de la app, en el orden en que salen en el inicio. Para agregar
// uno nuevo: crea src/modules/<id>/index.ts que exporte su AppModule y
// agrégalo a esta lista. El router (App.tsx) le da su ruta protegida y el
// inicio su tarjeta automáticamente.

import { calendarModule } from './calendar';
import { colimaGoModule } from './colima-go';
import { colimaGoWebModule } from './colima-go-web';
import { coursesModule } from './courses';
import { englishModule } from './english';
import { financesModule } from './finances';
import { grcModule } from './grc';
import { magentaModule } from './magenta';
import { scoreModule } from './score';
import { tasksModule } from './tasks';
import type { AppModule } from './types';

export const modules: readonly AppModule[] = [
  colimaGoModule,
  magentaModule,
  colimaGoWebModule,
  englishModule,
  financesModule,
  grcModule,
  tasksModule,
  coursesModule,
  scoreModule,
  // Sin tarjeta en el inicio (hidden), pero con su ruta y sus pendientes.
  calendarModule,
];
