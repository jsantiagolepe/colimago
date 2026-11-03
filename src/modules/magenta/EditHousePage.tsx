import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router';
import { BackLink } from '../../features/home/hub';
import { HomeBar } from '../../features/home/HomePage';
import HouseFormPage from './HouseFormPage';
import type { Casa } from './house';
import { listarCasas, mensajeDeError } from './house-upload';
import './magenta.css';

/**
 * Editar una casa (/magenta/crm/all-houses/:id). Si viene de la lista, la
 * casa llega en el estado de la navegación; si no (se recargó la ventana),
 * se busca en el catálogo. El backend no tiene "una casa completa por id"
 * (GET /magentagroup/:id solo regresa algunos campos), por eso se busca en la lista.
 */
export default function EditHousePage() {
  const { id } = useParams();
  const { state } = useLocation();
  const desdeLista = (state as { casa?: Casa } | null)?.casa;
  // undefined = cargando; null = ya no existe.
  const [casa, setCasa] = useState<Casa | null | undefined>(desdeLista?._id === id ? desdeLista : undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (casa !== undefined) return;
    let vivo = true;
    listarCasas().then(
      (lista) => vivo && setCasa(lista.find((c) => c._id === id) ?? null),
      (err) => vivo && setError(mensajeDeError(err)),
    );
    return () => {
      vivo = false;
    };
  }, [casa, id]);

  if (casa) return <HouseFormPage key={casa._id} casa={casa} />;

  return (
    <div className="home mh">
      <HomeBar>
        <BackLink to="/magenta/crm/all-houses">All Houses</BackLink>
      </HomeBar>
      <main className="empty-module">
        <p className="empty-module__text" role={error ? 'alert' : 'status'}>
          {error ?? (casa === null ? 'Esta casa ya no existe en el catálogo.' : 'Cargando la casa…')}
        </p>
      </main>
    </div>
  );
}
