import { Link, Route, Routes, useParams } from 'react-router';
import { HomeBar, ModuleBadge } from '../../features/home/HomePage';
import { BackLink, EmptySectionPage, HubCardContent, HubLayout, type HubSection } from '../../features/home/hub';
import AllHousesPage from './AllHousesPage';
import EditHousePage from './EditHousePage';
import HouseFormPage from './HouseFormPage';
import './magenta.css';

/** Los proyectos de Magenta, cada uno con su tarjeta. */
const SECTIONS: readonly HubSection[] = [
  { id: 'app', title: 'Magenta App', description: 'La app móvil.', icon: 'smartphone', color: '#c42a7f' },
  { id: 'web', title: 'Magenta Web', description: 'El sitio web.', icon: 'globe', color: '#9b3fb5' },
  { id: 'crm', title: 'CRM Magenta', description: 'Clientes y seguimiento.', icon: 'users', color: '#5a57c9' },
];

/** Las acciones del CRM, cada una con su tarjeta. */
const CRM_ACTIONS: readonly HubSection[] = [
  { id: 'new-house', title: 'New House', description: 'Agregar una casa nueva.', icon: 'house', color: '#5a57c9' },
  { id: 'all-houses', title: 'All Houses', description: 'Ver, editar y eliminar las casas.', icon: 'layout-list', color: '#2f7f9e' },
];

export default function MagentaPage() {
  return (
    <Routes>
      <Route index element={<MagentaHome />} />
      <Route path="crm" element={<MagentaCrm />} />
      <Route path="crm/new-house" element={<HouseFormPage />} />
      <Route path="crm/all-houses" element={<AllHousesPage />} />
      <Route path="crm/all-houses/:id" element={<EditHousePage />} />
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

function MagentaCrm() {
  return (
    <div className="home">
      <HomeBar>
        <BackLink to="/magenta">Magenta</BackLink>
      </HomeBar>
      <main className="home__main">
        <h1 className="magenta-crm__title">CRM Magenta</h1>
        <ul className="home__grid hub-grid">
          {CRM_ACTIONS.map((a) => (
            <li key={a.id} className="hub-card">
              <Link to={a.id} className="home-card">
                <HubCardContent section={a} />
              </Link>
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}

function MagentaSection() {
  const { seccion } = useParams();
  return <EmptySectionPage section={SECTIONS.find((s) => s.id === seccion)} back={{ to: '/magenta', label: 'Magenta' }} />;
}
