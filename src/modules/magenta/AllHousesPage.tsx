import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { Dialog } from '../../core/ui/Dialog';
import { IconPlus } from '../../core/ui/icons';
import { ModuleIcon } from '../../core/ui/ModuleIcon';
import { BackLink } from '../../features/home/hub';
import { HomeBar } from '../../features/home/HomePage';
import { filtrarCasas, miniatura, type Casa, type FiltroEstado } from './house';
import { borrarCasa, listarCasas, mensajeDeError } from './house-upload';
import './magenta.css';

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

const FILTROS: { id: FiltroEstado; nombre: string }[] = [
  { id: 'todas', nombre: 'Todas' },
  { id: 'activas', nombre: 'Activas' },
  { id: 'pausadas', nombre: 'Pausadas' },
];

/** "3 recámaras · 1 baño · 108 m² de construcción"; lo que sea 0 no se muestra. */
function datosDe(casa: Casa): string {
  const partes: string[] = [];
  if (casa.rooms > 0) partes.push(`${casa.rooms} ${casa.rooms === 1 ? 'recámara' : 'recámaras'}`);
  if (casa.toilets > 0) partes.push(`${casa.toilets} ${casa.toilets === 1 ? 'baño' : 'baños'}`);
  if (casa.m2build && casa.m2build > 0) partes.push(`${casa.m2build} m² construidos`);
  if (casa.m2terrain && casa.m2terrain > 0) partes.push(`${casa.m2terrain} m² de terreno`);
  return partes.join(' · ');
}

/** All Houses: el catálogo de Magenta (magentagroup.propiedades) con buscador; cada casa se edita o se elimina. */
export default function AllHousesPage() {
  const [casas, setCasas] = useState<Casa[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [intento, setIntento] = useState(0);
  const [texto, setTexto] = useState('');
  const [estado, setEstado] = useState<FiltroEstado>('todas');
  const [aBorrar, setABorrar] = useState<Casa | null>(null);

  useEffect(() => {
    let vivo = true;
    setError(null);
    setCasas(null);
    listarCasas().then(
      (lista) => vivo && setCasas(lista),
      (err) => vivo && setError(mensajeDeError(err)),
    );
    return () => {
      vivo = false;
    };
  }, [intento]);

  const visibles = useMemo(() => filtrarCasas(casas ?? [], texto, estado), [casas, texto, estado]);
  const activas = casas?.filter((c) => c.status).length ?? 0;
  const cuantas: Record<FiltroEstado, number> = {
    todas: casas?.length ?? 0,
    activas,
    pausadas: (casas?.length ?? 0) - activas,
  };

  return (
    <div className="home mh">
      <HomeBar>
        <BackLink to="/magenta/crm">CRM Magenta</BackLink>
      </HomeBar>

      <main className="mh-main ah-main">
        <div className="ah-head">
          <h1 className="mh-title">All Houses</h1>
          {casas && <span className="mh-card__count">{casas.length}</span>}
          <Link to="/magenta/crm/new-house" className="mh-btn mh-btn--primary ah-new">
            <IconPlus />
            New House
          </Link>
        </div>

        {casas && casas.length > 0 && (
          <div className="ah-tools">
            <input
              type="search"
              className="ah-search"
              placeholder="Buscar por código, colonia o ciudad"
              aria-label="Buscar casas"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
            />
            <div className="ah-filters" role="group" aria-label="Estado">
              {FILTROS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`ah-filter${estado === f.id ? ' is-on' : ''}`}
                  aria-pressed={estado === f.id}
                  onClick={() => setEstado(f.id)}
                >
                  {f.nombre} <span>{cuantas[f.id]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error ? (
          <div className="ah-state" role="alert">
            <p>{error}</p>
            <button type="button" className="mh-btn" onClick={() => setIntento((n) => n + 1)}>
              Reintentar
            </button>
          </div>
        ) : casas === null ? (
          <ul className="ah-list" aria-busy="true" aria-label="Cargando casas">
            {[0, 1, 2].map((i) => (
              <li key={i} className="ah-row ah-row--ghost" aria-hidden="true" />
            ))}
          </ul>
        ) : casas.length === 0 ? (
          <div className="ah-state">
            <p>Todavía no hay casas en el catálogo.</p>
            <Link to="/magenta/crm/new-house" className="mh-btn mh-btn--primary">
              Agregar la primera
            </Link>
          </div>
        ) : visibles.length === 0 ? (
          <div className="ah-state">
            <p>Ninguna casa coincide con lo que buscas.</p>
            <button
              type="button"
              className="mh-btn"
              onClick={() => {
                setTexto('');
                setEstado('todas');
              }}
            >
              Ver todas
            </button>
          </div>
        ) : (
          <ul className="ah-list">
            {visibles.map((casa) => (
              <FilaCasa key={casa._id} casa={casa} onEliminar={() => setABorrar(casa)} />
            ))}
          </ul>
        )}
      </main>

      {aBorrar && (
        <ConfirmarBorrado
          casa={aBorrar}
          onClose={() => setABorrar(null)}
          onBorrada={(id) => {
            setCasas((actuales) => actuales?.filter((c) => c._id !== id) ?? null);
            setABorrar(null);
          }}
        />
      )}
    </div>
  );
}

function FilaCasa({ casa, onEliminar }: { casa: Casa; onEliminar: () => void }) {
  const fotos = casa.photos?.length ?? 0;
  const datos = datosDe(casa);
  return (
    <li className="ah-row">
      <span className="ah-thumb">
        {fotos > 0 ? (
          <img src={miniatura(casa.photos[0])} alt="" loading="lazy" decoding="async" />
        ) : (
          <ModuleIcon name="house" className="ah-thumb__none" />
        )}
      </span>
      <div className="ah-row__text">
        <div className="ah-row__top">
          <strong className="ah-row__code">{casa.code}</strong>
          <span className="ah-tag">{casa.typeHouse}</span>
          <span className={`ah-pill${casa.status ? ' is-on' : ''}`}>{casa.status ? 'Activa' : 'Pausada'}</span>
        </div>
        <p className="ah-row__place">
          {casa.colony}, {casa.city}
        </p>
        <p className="ah-row__facts">
          {datos && <span>{datos}</span>}
          <span>
            {fotos} {fotos === 1 ? 'foto' : 'fotos'}
          </span>
        </p>
      </div>
      <div className="ah-row__price">{casa.price > 0 ? pesos.format(casa.price) : 'Sin precio'}</div>
      <div className="ah-row__actions">
        <Link to={`/magenta/crm/all-houses/${casa._id}`} state={{ casa }} className="mh-btn" aria-label={`Editar ${casa.code}`}>
          Editar
        </Link>
        <button type="button" className="mh-btn mh-btn--danger" aria-label={`Eliminar ${casa.code}`} onClick={onEliminar}>
          Eliminar
        </button>
      </div>
    </li>
  );
}

function ConfirmarBorrado({
  casa,
  onClose,
  onBorrada,
}: {
  casa: Casa;
  onClose: () => void;
  onBorrada: (id: string) => void;
}) {
  const [borrando, setBorrando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);

  async function borrar() {
    setBorrando(true);
    setFallo(null);
    try {
      await borrarCasa(casa._id);
      onBorrada(casa._id);
    } catch (err) {
      setFallo(mensajeDeError(err));
      setBorrando(false);
    }
  }

  return (
    <Dialog className="ah-confirm" labelledBy="ah-confirm-titulo" onClose={() => !borrando && onClose()}>
      <div className="ah-confirm__inner">
        <h2 id="ah-confirm-titulo" className="ah-confirm__title">
          ¿Eliminar {casa.code}?
        </h2>
        <p className="ah-confirm__text">
          {casa.colony}, {casa.city}. Se borra del catálogo de Magenta y no se puede deshacer. Sus fotos se quedan en
          Cloudinary.
        </p>
        {fallo && (
          <p className="mh-error" role="alert">
            {fallo}
          </p>
        )}
        <div className="ah-confirm__actions">
          <button type="button" className="mh-btn" onClick={onClose} disabled={borrando} autoFocus>
            Cancelar
          </button>
          <button type="button" className="mh-btn mh-btn--danger-solid" onClick={() => void borrar()} disabled={borrando}>
            {borrando ? 'Eliminando…' : 'Eliminar'}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
