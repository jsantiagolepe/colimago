import { Link, Route, Routes, useParams } from 'react-router';
import { ModuleBadge } from '../../features/home/HomePage';
import { EmptySectionPage, HubCardContent, HubLayout, type HubSection } from '../../features/home/hub';
import './magenta.css';

/** Los proyectos de Magenta, cada uno con su tarjeta. */
const SECTIONS: readonly HubSection[] = [
  { id: 'app', title: 'Magenta App', description: 'La app móvil.', icon: 'smartphone', color: '#c42a7f' },
  { id: 'web', title: 'Magenta Web', description: 'El sitio web.', icon: 'globe', color: '#9b3fb5' },
  { id: 'crm', title: 'CRM Magenta', description: 'Clientes y seguimiento.', icon: 'users', color: '#5a57c9' },
];

export default function MagentaPage() {
  return (
    <Routes>
      <Route index element={<MagentaHome />} />
      <Route path=":seccion" element={<MagentaSection />} />
    </Routes>
  );
}

function MagentaHome() {
  return (
    <HubLayout
      title="Magenta"
      big={
        <section className="hub-big magenta-big" aria-labelledby="magenta-titulo">
          <div className="magenta-big__main">
            <h2 id="magenta-titulo" className="magenta-big__title">
              Magenta
            </h2>
            <p className="magenta-big__text">
              Aquí va el resumen de tus tres proyectos: cómo va cada uno y lo que tienes pendiente. Se irá llenando
              conforme les pongamos contenido.
            </p>
          </div>
          <ul className="magenta-big__projects">
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <Link to={s.id} className="magenta-project">
                  <ModuleBadge module={s} />
                  <span className="magenta-project__name">{s.title}</span>
                  <span className="magenta-project__state">Vacío por ahora</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      }
    >
      <ul className="home__grid hub-grid">
        {SECTIONS.map((s) => (
          <li key={s.id} className="hub-card">
            <Link to={s.id} className="home-card">
              <HubCardContent section={s} />
            </Link>
          </li>
        ))}
      </ul>
    </HubLayout>
  );
}

function MagentaSection() {
  const { seccion } = useParams();
  return <EmptySectionPage section={SECTIONS.find((s) => s.id === seccion)} back={{ to: '/magenta', label: 'Magenta' }} />;
}
