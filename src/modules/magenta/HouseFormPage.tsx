import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router';
import { newId } from '../../core/id';
import { IconCheck, IconClose, IconPlus } from '../../core/ui/icons';
import { BackLink } from '../../features/home/hub';
import { HomeBar } from '../../features/home/HomePage';
import { reducirFoto } from './house-photo';
import { CASA_VACIA, CIUDADES, coloniaExistente, coloniasDe, formDeCasa, miniatura, TIPOS, validarCasa, type Casa, type CasaForm, type Colonia, type ErroresCasa, type TipoCasa } from './house';
import {
  actualizarCasa,
  guardarCasa,
  guardarColonia,
  listarColonias,
  MAX_BYTES_FOTO,
  mensajeDeError,
  subirFotos,
  SubidaCancelada,
  type AvanceSubida,
  type FotoPorSubir,
} from './house-upload';
import './magenta.css';

const MAX_FOTOS = 30;
const FORMATOS = /\.(jpe?g|png|webp|gif|heic|heif)$/i;
/** Valor de la opción «Agregar colonia…» del select (no es una colonia). */
const NUEVA_COLONIA = '__nueva__';

/**
 * Una foto de la casa: del disco (con `file`) o ya guardada en ella (solo
 * `url`). Si se achicó por pesar de más, `original` es el archivo que se eligió.
 */
type Foto = FotoPorSubir & { id: string; preview: string; original?: File };

type Fase = 'editando' | 'subiendo' | 'guardada';

function mismaFoto(a: File, b: File): boolean {
  return a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;
}

const pesos = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 });

/**
 * New House (sin `casa`) y edición de una casa guardada (con `casa`): datos y
 * fotos → Cloudinary → catálogo de Magenta (magentagroup.propiedades). Al
 * editar, las fotos que ya tenía la casa se quedan como están (no se vuelven
 * a subir) y se pueden quitar, reordenar o completar con fotos nuevas.
 */
export default function HouseFormPage({ casa }: { casa?: Casa }) {
  const editando = casa !== undefined;
  const [form, setForm] = useState<CasaForm>(() => (casa ? formDeCasa(casa) : CASA_VACIA));
  const [fotos, setFotos] = useState<Foto[]>(() =>
    (casa?.photos ?? []).map((url) => ({ id: newId(), url, preview: miniatura(url) })),
  );
  const [errores, setErrores] = useState<ErroresCasa>({});
  const [fase, setFase] = useState<Fase>('editando');
  const [avance, setAvance] = useState<AvanceSubida | null>(null);
  const [fallo, setFallo] = useState<string | null>(null);
  const [rechazadas, setRechazadas] = useState<string[]>([]);
  const [reduciendo, setReduciendo] = useState(0); // fotos que se están achicando por pesar más de 8 MB
  const [achicadas, setAchicadas] = useState(0); // de las últimas elegidas, cuántas se achicaron
  const [codigoGuardado, setCodigoGuardado] = useState('');
  // Las colonias viven en el backend (las agregadas desde aquí más las de las casas del catálogo).
  const [colonias, setColonias] = useState<Colonia[] | null>(null);
  const [coloniasFallo, setColoniasFallo] = useState(false);
  const inputFotos = useRef<HTMLInputElement>(null);
  const cancelada = useRef(false);
  const fotosRef = useRef<Foto[]>([]);
  fotosRef.current = fotos;

  // Al salir de la pantalla se corta la subida en curso y se sueltan las vistas previas.
  useEffect(() => {
    cancelada.current = false;
    return () => {
      cancelada.current = true;
      fotosRef.current.forEach((f) => f.file && URL.revokeObjectURL(f.preview));
    };
  }, []);

  // Carga la lista; un fallo suelto de red se reintenta una vez solo, y si sigue
  // fallando queda el botón «Reintentar» (sin lista aún se puede agregar la colonia).
  const [recarga, setRecarga] = useState(0);
  useEffect(() => {
    let vivo = true;
    setColoniasFallo(false);
    const cargar = (reintentos: number): void => {
      listarColonias().then(
        (lista) => vivo && setColonias(lista),
        () => {
          if (!vivo) return;
          if (reintentos > 0) setTimeout(() => cargar(reintentos - 1), 1500);
          else {
            setColonias((actuales) => actuales ?? []);
            setColoniasFallo(true);
          }
        },
      );
    };
    cargar(1);
    return () => {
      vivo = false;
    };
  }, [recarga]);

  function cambiar<K extends keyof CasaForm>(campo: K, valor: CasaForm[K]) {
    setForm((f) => ({ ...f, [campo]: valor }));
    if (errores[campo]) setErrores((e) => ({ ...e, [campo]: undefined }));
  }

  async function elegirFotos(e: ChangeEvent<HTMLInputElement>) {
    const elegidas = Array.from(e.target.files ?? []);
    e.target.value = ''; // para poder volver a elegir la misma foto después de quitarla
    const aceptadas: File[] = [];
    const no: string[] = [];
    // Los archivos tal como se eligieron (el original, si se achicó), para no repetir una foto.
    const yaElegidas = fotos.flatMap((f) => (f.file ? [(f.original ?? f.file) as File] : []));
    for (const file of elegidas) {
      if (!file.type.startsWith('image/') && !FORMATOS.test(file.name)) no.push(`${file.name}: no es una imagen`);
      else if ([...yaElegidas, ...aceptadas].some((f) => mismaFoto(f, file))) continue; // ya estaba
      else if (fotos.length + aceptadas.length >= MAX_FOTOS) no.push(`${file.name}: el máximo es ${MAX_FOTOS} fotos`);
      else aceptadas.push(file);
    }

    // Las que pasan de 8 MB se achican solas (de una en una: son imágenes grandes en memoria).
    setReduciendo(aceptadas.filter((f) => f.size > MAX_BYTES_FOTO).length);
    const listas: { file: File; original?: File }[] = [];
    for (const original of aceptadas) {
      if (original.size <= MAX_BYTES_FOTO) {
        listas.push({ file: original });
        continue;
      }
      try {
        listas.push({ file: await reducirFoto(original), original });
      } catch {
        no.push(`${original.name}: pesa más de 8 MB y no se pudo achicar`);
      }
      setReduciendo((n) => n - 1);
    }
    if (cancelada.current) return; // se salió de la pantalla mientras tanto

    const nuevas: Foto[] = listas.map(({ file, original }) => ({ id: newId(), file, original, preview: URL.createObjectURL(file) }));
    setRechazadas(no);
    setAchicadas(listas.filter((l) => l.original).length);
    if (nuevas.length > 0) {
      setFotos((actuales) => [...actuales, ...nuevas]);
      setErrores((er) => ({ ...er, photos: undefined }));
    }
  }

  function quitarFoto(id: string) {
    const foto = fotos.find((f) => f.id === id);
    if (foto?.file) URL.revokeObjectURL(foto.preview);
    setFotos((actuales) => actuales.filter((f) => f.id !== id));
  }

  function ponerDePortada(id: string) {
    setFotos((actuales) => {
      const foto = actuales.find((f) => f.id === id);
      return foto ? [foto, ...actuales.filter((f) => f.id !== id)] : actuales;
    });
  }

  async function subir(e: FormEvent) {
    e.preventDefault();
    if (fase !== 'editando' || reduciendo > 0) return;
    const { errores: nuevos, payload } = validarCasa(form, fotos.length, { edicion: editando });
    setErrores(nuevos);
    if (!payload) {
      const primero = (Object.keys(nuevos) as (keyof ErroresCasa)[])[0];
      // Los campos van en el orden del formulario; las fotos, al final.
      const orden: (keyof ErroresCasa)[] = ['code', 'city', 'colony', 'cp', 'price', 'rooms', 'toilets', 'm2build', 'm2terrain', 'url', 'video', 'virtualTour', 'photos'];
      const campo = orden.find((c) => nuevos[c]) ?? primero;
      document.getElementById(`mh-${campo}`)?.focus();
      return;
    }

    setFallo(null);
    setFase('subiendo');
    try {
      const urls = await subirFotos(fotos, setAvance, () => cancelada.current);
      if (casa) await actualizarCasa(casa._id, { ...payload, photos: urls });
      else await guardarCasa({ ...payload, photos: urls });
      setCodigoGuardado(payload.code);
      setFase('guardada');
    } catch (err) {
      if (err instanceof SubidaCancelada) return;
      setFallo(mensajeDeError(err));
      setFase('editando');
    }
  }

  function otraCasa() {
    fotos.forEach((f) => f.file && URL.revokeObjectURL(f.preview));
    setForm(CASA_VACIA);
    setFotos([]);
    setErrores({});
    setRechazadas([]);
    setAchicadas(0);
    setAvance(null);
    setFallo(null);
    setFase('editando');
  }

  const bloqueado = fase !== 'editando';
  const precio = Number(form.price.replace(/[\s$,]/g, ''));
  const subidasListas = fotos.some((f) => f.file && f.url); // subidas ahora (no las que ya eran de la casa)

  return (
    <div className="home mh">
      <HomeBar>
        {editando ? (
          <BackLink to="/magenta/crm/all-houses">All Houses</BackLink>
        ) : (
          <BackLink to="/magenta/crm">CRM Magenta</BackLink>
        )}
      </HomeBar>

      {fase === 'guardada' ? (
        <main className="mh-main mh-done">
          <span className="mh-done__mark" aria-hidden="true">
            <IconCheck />
          </span>
          <h1 className="mh-title">{editando ? 'Cambios guardados' : 'Casa guardada'}</h1>
          <p className="mh-lead">
            {editando ? (
              <>
                <strong>{codigoGuardado}</strong> se actualizó en el catálogo de Magenta.
              </>
            ) : (
              <>
                <strong>{codigoGuardado}</strong> ya está en el catálogo de Magenta con {fotos.length}{' '}
                {fotos.length === 1 ? 'foto' : 'fotos'}.
              </>
            )}
          </p>
          <div className="mh-done__actions">
            {editando ? (
              <Link to="/magenta/crm/all-houses" className="mh-btn mh-btn--primary">
                Volver a All Houses
              </Link>
            ) : (
              <>
                <button type="button" className="mh-btn mh-btn--primary" onClick={otraCasa}>
                  Agregar otra casa
                </button>
                <Link to="/magenta/crm" className="mh-btn">
                  Volver al CRM
                </Link>
              </>
            )}
          </div>
        </main>
      ) : (
        <form className="mh-main" onSubmit={(e) => void subir(e)} noValidate>
          <h1 className="mh-title">{editando ? 'Editar casa' : 'New House'}</h1>
          <p className="mh-lead">
            {editando
              ? `Cambia lo que necesites de ${casa.code}; también puedes quitar, reordenar o agregar fotos.`
              : 'Llena los datos, elige las fotos de tu computadora y súbelas al catálogo de Magenta.'}
          </p>

          <fieldset className="mh-fieldset" disabled={bloqueado}>
            <section className="mh-card" aria-labelledby="mh-h-propiedad">
              <h2 id="mh-h-propiedad" className="mh-card__title">
                La propiedad
              </h2>
              <div className="mh-grid">
                <Campo id="code" label="Código" error={errores.code}>
                  <input id="mh-code" value={form.code} onChange={(e) => cambiar('code', e.target.value)} placeholder="NN-HGS118" autoComplete="off" {...ariaCampo('code', errores)} />
                </Campo>
                <Campo id="typeHouse" label="Tipo">
                  <select id="mh-typeHouse" value={form.typeHouse} onChange={(e) => cambiar('typeHouse', e.target.value as TipoCasa)}>
                    {TIPOS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </Campo>
                <Campo id="city" label="Ciudad" error={errores.city}>
                  <select id="mh-city" value={form.city} onChange={(e) => cambiar('city', e.target.value)} {...ariaCampo('city', errores)}>
                    <option value="" disabled>
                      Elige la ciudad
                    </option>
                    {/* Una casa con otra ciudad guardada la conserva como opción. */}
                    {[...(form.city && !CIUDADES.some((c) => c === form.city) ? [form.city] : []), ...CIUDADES].map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </Campo>
                <Campo
                  id="colony"
                  label="Colonia"
                  hint={
                    coloniasFallo ? (
                      <>
                        No se pudo cargar la lista de colonias.{' '}
                        <button type="button" className="mh-link" onClick={() => setRecarga((n) => n + 1)}>
                          Reintentar
                        </button>
                      </>
                    ) : undefined
                  }
                  error={errores.colony}
                >
                  <SelectorColonia
                    ciudad={form.city}
                    valor={form.colony}
                    colonias={coloniasDe(colonias ?? [], form.city)}
                    cargando={colonias === null}
                    onElegir={(colonia) => cambiar('colony', colonia)}
                    onAgregar={async (nombre) => {
                      // Se guarda en la base de Magenta; si ya existía con otra escritura, queda la guardada.
                      const guardada = await guardarColonia(form.city.trim(), nombre);
                      setColonias((actuales) => [...(actuales ?? []), guardada]);
                      cambiar('colony', guardada.colony);
                    }}
                    errores={errores}
                  />
                </Campo>
                <Campo id="cp" label="Código postal" opcional error={errores.cp}>
                  <input id="mh-cp" inputMode="numeric" maxLength={5} value={form.cp} onChange={(e) => cambiar('cp', e.target.value)} placeholder="28979" autoComplete="off" {...ariaCampo('cp', errores)} />
                </Campo>
              </div>
            </section>

            <section className="mh-card" aria-labelledby="mh-h-detalles">
              <h2 id="mh-h-detalles" className="mh-card__title">
                Detalles
              </h2>
              <div className="mh-grid">
                <Campo id="price" label="Precio (MXN)" hint={Number.isInteger(precio) && precio > 0 ? pesos.format(precio) : undefined} error={errores.price}>
                  <input id="mh-price" inputMode="numeric" value={form.price} onChange={(e) => cambiar('price', e.target.value)} placeholder="1,490,000" autoComplete="off" {...ariaCampo('price', errores)} />
                </Campo>
                <div className="mh-grid mh-grid--pair">
                  <Campo id="rooms" label="Recámaras" error={errores.rooms}>
                    <input id="mh-rooms" inputMode="numeric" value={form.rooms} onChange={(e) => cambiar('rooms', e.target.value)} placeholder="3" autoComplete="off" {...ariaCampo('rooms', errores)} />
                  </Campo>
                  <Campo id="toilets" label="Baños" error={errores.toilets}>
                    <input id="mh-toilets" inputMode="numeric" value={form.toilets} onChange={(e) => cambiar('toilets', e.target.value)} placeholder="1" autoComplete="off" {...ariaCampo('toilets', errores)} />
                  </Campo>
                </div>
                <Campo id="m2build" label="m² de construcción" opcional error={errores.m2build}>
                  <input id="mh-m2build" inputMode="decimal" value={form.m2build} onChange={(e) => cambiar('m2build', e.target.value)} placeholder="108" autoComplete="off" {...ariaCampo('m2build', errores)} />
                </Campo>
                <Campo id="m2terrain" label="m² de terreno" opcional error={errores.m2terrain}>
                  <input id="mh-m2terrain" inputMode="decimal" value={form.m2terrain} onChange={(e) => cambiar('m2terrain', e.target.value)} autoComplete="off" {...ariaCampo('m2terrain', errores)} />
                </Campo>
              </div>
              <label className="mh-check">
                <input type="checkbox" checked={form.status} onChange={(e) => cambiar('status', e.target.checked)} />
                <span>
                  <strong>Activa en el catálogo</strong>
                  <small>Desmárcala para guardarla sin mostrarla todavía.</small>
                </span>
              </label>
            </section>

            <section className="mh-card" aria-labelledby="mh-h-descripcion">
              <h2 id="mh-h-descripcion" className="mh-card__title">
                Descripción y enlaces
              </h2>
              <Campo id="resume" label="Resumen" hint="Lo que se muestra en la publicación. Puedes pegar el texto con emojis y #hashtags.">
                <textarea id="mh-resume" rows={6} value={form.resume} onChange={(e) => cambiar('resume', e.target.value)} />
              </Campo>
              <div className="mh-grid">
                <Campo id="url" label="Link de la publicación" opcional error={errores.url} wide>
                  <input id="mh-url" type="url" value={form.url} onChange={(e) => cambiar('url', e.target.value)} placeholder="https://www.realestatecolima.com/propiedad/…" autoComplete="off" {...ariaCampo('url', errores)} />
                </Campo>
                <Campo id="video" label="Video" opcional error={errores.video}>
                  <input id="mh-video" type="url" value={form.video} onChange={(e) => cambiar('video', e.target.value)} placeholder="https://youtube.com/shorts/…" autoComplete="off" {...ariaCampo('video', errores)} />
                </Campo>
                <Campo id="virtualTour" label="Recorrido virtual" opcional error={errores.virtualTour}>
                  <input id="mh-virtualTour" type="url" value={form.virtualTour} onChange={(e) => cambiar('virtualTour', e.target.value)} autoComplete="off" {...ariaCampo('virtualTour', errores)} />
                </Campo>
              </div>
            </section>

            <section className="mh-card" aria-labelledby="mh-h-fotos">
              <h2 id="mh-h-fotos" className="mh-card__title">
                Fotos <span className="mh-card__count">{fotos.length}</span>
              </h2>
              <p className="mh-hint">
                La primera es la portada. Hasta {MAX_FOTOS} fotos (JPG, PNG, WEBP o HEIC); las que pasen de 8 MB se achican solas. Las nuevas se suben a Cloudinary al
                presionar «{editando ? 'Guardar cambios' : 'Subir casa'}».
              </p>
              <input ref={inputFotos} type="file" multiple accept="image/*,.heic,.heif" hidden onChange={elegirFotos} />
              <ul className="mh-photos">
                {fotos.map((f, i) => (
                  <li key={f.id} className={`mh-photo${f.file && f.url ? ' is-uploaded' : ''}`}>
                    {/* Las de la casa vienen de internet (pueden ser muchas): se cargan al verse. Las del disco ya están aquí. */}
                    <img src={f.preview} alt={`Foto ${i + 1}`} loading={f.file ? undefined : 'lazy'} decoding="async" />
                    {i === 0 && <span className="mh-photo__badge">Portada</span>}
                    {f.file && f.url && (
                      <span className="mh-photo__ok" role="img" aria-label="Ya subida">
                        <IconCheck />
                      </span>
                    )}
                    <button type="button" className="mh-photo__remove" aria-label={`Quitar la foto ${i + 1}`} onClick={() => quitarFoto(f.id)}>
                      <IconClose />
                    </button>
                    {i > 0 && (
                      <button type="button" className="mh-photo__cover" onClick={() => ponerDePortada(f.id)}>
                        Poner de portada
                      </button>
                    )}
                  </li>
                ))}
                <li>
                  <button
                    type="button"
                    id="mh-photos"
                    className={`mh-photos__add${errores.photos ? ' is-invalid' : ''}`}
                    disabled={fotos.length >= MAX_FOTOS || reduciendo > 0}
                    onClick={() => inputFotos.current?.click()}
                  >
                    <IconPlus />
                    <span>{fotos.length === 0 ? 'Elegir fotos' : 'Agregar fotos'}</span>
                  </button>
                </li>
              </ul>
              {errores.photos && <p className="mh-error">{errores.photos}</p>}
              {(reduciendo > 0 || achicadas > 0) && (
                <p className="mh-hint mh-photos__note" role="status">
                  {reduciendo > 0
                    ? `Achicando ${reduciendo} ${reduciendo === 1 ? 'foto' : 'fotos'} que pasan de 8 MB…`
                    : `Se ${achicadas === 1 ? 'achicó 1 foto' : `achicaron ${achicadas} fotos`} que pasaban de 8 MB (ahora son JPG).`}
                </p>
              )}
              {rechazadas.length > 0 && (
                <div className="mh-notice" role="status">
                  <strong>No se agregaron {rechazadas.length === 1 ? 'esta foto' : 'estas fotos'}:</strong>
                  <ul>
                    {rechazadas.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </fieldset>

          <div className="mh-bar">
            <div className="mh-bar__status" role="status" aria-live="polite">
              {fase === 'subiendo' && avance ? <Progreso avance={avance} /> : null}
              {fallo && (
                <p className="mh-bar__fail" role="alert">
                  {fallo}
                  {subidasListas && <small>Las fotos que ya se subieron no se vuelven a subir al reintentar.</small>}
                </p>
              )}
            </div>
            <button type="submit" className="mh-btn mh-btn--primary mh-btn--big" disabled={bloqueado || reduciendo > 0}>
              {fase === 'subiendo' ? (editando ? 'Guardando…' : 'Subiendo…') : editando ? 'Guardar cambios' : 'Subir casa'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ariaCampo(campo: keyof ErroresCasa, errores: ErroresCasa) {
  return errores[campo]
    ? ({ 'aria-invalid': true, 'aria-describedby': `mh-${campo}-msg`, className: 'is-invalid' } as const)
    : {};
}

/**
 * Select de colonias (las guardadas en el backend para la ciudad elegida). La
 * opción final «Agregar colonia…» abre ahí mismo un campo para escribir una
 * nueva, que se guarda en la base antes de elegirla; si ya existía (con otros
 * acentos o mayúsculas) se elige la que estaba, para no duplicarla.
 */
function SelectorColonia({
  ciudad,
  valor,
  colonias,
  cargando,
  errores,
  onElegir,
  onAgregar,
}: {
  ciudad: string;
  valor: string;
  colonias: string[];
  cargando: boolean;
  errores: ErroresCasa;
  onElegir: (colonia: string) => void;
  /** Guarda la colonia y la elige; rechaza si no se pudo guardar. */
  onAgregar: (colonia: string) => Promise<void>;
}) {
  const [agregando, setAgregando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [fallo, setFallo] = useState<string | null>(null);
  // La colonia elegida sigue en el select aunque ya no sea de la ciudad escrita.
  const opciones = valor && !coloniaExistente(colonias, valor) ? [valor, ...colonias] : colonias;

  function cerrar() {
    setAgregando(false);
    setNombre('');
    setFallo(null);
  }

  async function confirmar() {
    const texto = nombre.trim().replace(/\s+/g, ' ');
    if (!texto || guardando) return;
    const existente = coloniaExistente(opciones, texto);
    if (existente) {
      onElegir(existente);
      cerrar();
      return;
    }
    if (!ciudad.trim()) {
      setFallo('Escribe primero la ciudad: cada colonia se guarda en su ciudad.');
      return;
    }
    setGuardando(true);
    setFallo(null);
    try {
      await onAgregar(texto);
      cerrar();
    } catch (err) {
      setFallo(mensajeDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <select
        id="mh-colony"
        value={agregando ? NUEVA_COLONIA : valor}
        disabled={cargando || guardando}
        onChange={(e) => {
          if (e.target.value === NUEVA_COLONIA) {
            setAgregando(true);
          } else {
            cerrar();
            onElegir(e.target.value);
          }
        }}
        {...ariaCampo('colony', errores)}
      >
        <option value="" disabled>
          {cargando ? 'Cargando colonias…' : 'Elige la colonia'}
        </option>
        {opciones.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
        <option value={NUEVA_COLONIA}>+ Agregar colonia…</option>
      </select>
      {agregando && (
        <div className="mh-colony-add">
          <input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            onKeyDown={(e) => {
              // Enter no debe enviar todo el formulario.
              if (e.key === 'Enter') {
                e.preventDefault();
                void confirmar();
              } else if (e.key === 'Escape' && !guardando) {
                e.preventDefault();
                cerrar();
              }
            }}
            placeholder="San Bernardo"
            aria-label="Nombre de la colonia nueva"
            autoComplete="off"
            autoFocus
            readOnly={guardando}
          />
          <button type="button" className="mh-btn mh-btn--primary" disabled={!nombre.trim() || guardando} onClick={() => void confirmar()}>
            {guardando ? 'Guardando…' : 'Agregar'}
          </button>
          <button type="button" className="mh-btn" disabled={guardando} onClick={cerrar}>
            Cancelar
          </button>
          {fallo ? (
            <p className="mh-error" role="alert">
              {fallo}
            </p>
          ) : (
            <p className="mh-hint">Solo el nombre, sin «Fracc.» ni «Fraccionamiento». Se guarda para las próximas casas.</p>
          )}
        </div>
      )}
    </>
  );
}

function Campo({
  id,
  label,
  opcional = false,
  hint,
  error,
  wide = false,
  children,
}: {
  id: string;
  label: string;
  opcional?: boolean;
  /** Ayuda debajo del campo; si hay error, se muestra el error en su lugar. */
  hint?: ReactNode;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`mh-field${wide ? ' mh-field--wide' : ''}`}>
      <label htmlFor={`mh-${id}`} className="mh-field__label">
        {label}
        {opcional && <span className="mh-field__opt">Opcional</span>}
      </label>
      {children}
      {error ? (
        <p id={`mh-${id}-msg`} className="mh-error">
          {error}
        </p>
      ) : (
        hint && <p className="mh-hint">{hint}</p>
      )}
    </div>
  );
}

function Progreso({ avance }: { avance: AvanceSubida }) {
  const { hechas, total, esperaSegundos } = avance;
  const texto =
    esperaSegundos !== undefined
      ? `Esperando ${esperaSegundos} s para no pasar el límite de subidas por minuto…`
      : hechas >= total
        ? 'Guardando la casa en el catálogo…'
        : `Subiendo foto ${hechas + 1} de ${total}…`;
  return (
    <>
      <progress className="mh-progress" max={total} value={hechas} aria-label="Fotos subidas" />
      <span>{texto}</span>
    </>
  );
}
