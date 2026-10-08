import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { useDocument } from '../../core/platform/document-store';
import { useToday } from '../../core/useToday';
import { IconCheck, IconPlus, IconPrev, IconTrash } from '../../core/ui/icons';
import { DateMenu } from './DateMenu';
import {
  addTask,
  deleteTask,
  GROUP_TITLES,
  groupOf,
  groupTasks,
  renameTask,
  restoreTask,
  setTaskDone,
  setTaskDue,
  type Task,
} from './model';
import { tasksStore } from './store';
import './tasks.css';

/** Todas las tareas, agrupadas por urgencia, con su barra para agregar. */
export default function TasksPage() {
  const { data, error, update } = useDocument(tasksStore);
  const [titulo, setTitulo] = useState('');
  const [fecha, setFecha] = useState<string | undefined>();
  const [borrada, setBorrada] = useState<{ task: Task; index: number } | null>(null);
  const hoy = useToday();

  // El aviso de "Deshacer" se va solo.
  useEffect(() => {
    if (!borrada) return;
    const t = setTimeout(() => setBorrada(null), 6000);
    return () => clearTimeout(t);
  }, [borrada]);

  const grupos = data ? groupTasks(data.tasks, hoy) : [];
  const pendientes = data ? data.tasks.filter((t) => !t.done).length : 0;

  function agregar(e: FormEvent) {
    e.preventDefault();
    if (!titulo.trim()) return;
    update((d) => addTask(d, titulo, fecha));
    setTitulo('');
    setFecha(undefined);
  }

  function borrar(task: Task) {
    if (!data) return;
    const index = data.tasks.findIndex((t) => t.id === task.id);
    update((d) => deleteTask(d, task.id));
    setBorrada({ task, index });
  }

  return (
    <div className="tasks">
      <header className="tasks-bar">
        <Link to="/" className="tasks-back">
          <IconPrev />
          Inicio
        </Link>
      </header>

      <main className="tasks-main">
        <div className="tasks-head">
          <h1 className="tasks-head__title">Tareas</h1>
          {data && (
            <p className="tasks-head__count">
              {pendientes === 0 ? 'Todo hecho' : pendientes === 1 ? '1 pendiente' : `${pendientes} pendientes`}
            </p>
          )}
        </div>

        {error && (
          <p className="tasks-error" role="alert">
            {error}
          </p>
        )}

        <form className="tasks-add" onSubmit={agregar}>
          <IconPlus className="ui-icon tasks-add__icon" />
          <input
            className="tasks-add__input"
            placeholder="Agregar una tarea…"
            aria-label="Nueva tarea"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
          />
          <DateMenu value={fecha} today={hoy} onChange={setFecha} />
          <button type="submit" className="tasks-add__btn" disabled={!titulo.trim() || !data}>
            Agregar
          </button>
        </form>

        {data && grupos.length === 0 && <p className="tasks-empty">No tienes tareas. Escribe la primera aquí arriba.</p>}

        {grupos.map((grupo) => (
          <section key={grupo.id} className={`tasks-group is-${grupo.id}`} aria-labelledby={`grupo-${grupo.id}`}>
            <h2 id={`grupo-${grupo.id}`} className="tasks-group__title">
              {GROUP_TITLES[grupo.id]}
              <span>{grupo.tasks.length}</span>
            </h2>
            <ul className="tasks-list">
              {grupo.tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  today={hoy}
                  onToggle={() => update((d) => setTaskDone(d, task.id, !task.done))}
                  onRename={(nuevo) => update((d) => renameTask(d, task.id, nuevo))}
                  onDue={(due) => update((d) => setTaskDue(d, task.id, due))}
                  onDelete={() => borrar(task)}
                />
              ))}
            </ul>
          </section>
        ))}
      </main>

      {borrada && (
        <div className="tasks-toast" role="status">
          <span>
            Borraste <strong>{borrada.task.title}</strong>
          </span>
          <button
            type="button"
            onClick={() => {
              update((d) => restoreTask(d, borrada.task, borrada.index));
              setBorrada(null);
            }}
          >
            Deshacer
          </button>
        </div>
      )}
    </div>
  );
}

function TaskRow({
  task,
  today,
  onToggle,
  onRename,
  onDue,
  onDelete,
}: {
  task: Task;
  today: string;
  onToggle: () => void;
  onRename: (title: string) => void;
  onDue: (due?: string) => void;
  onDelete: () => void;
}) {
  const [editando, setEditando] = useState(false);
  const cancelado = useRef(false);

  return (
    <li className={`task-row${task.done ? ' is-done' : ''}`}>
      <button
        type="button"
        className="task-row__check"
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.title}
        onClick={onToggle}
      >
        <span className="task-row__box">{task.done && <IconCheck />}</span>
      </button>

      {editando ? (
        <input
          className="task-row__edit"
          defaultValue={task.title}
          aria-label="Título de la tarea"
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
              cancelado.current = true;
              e.currentTarget.blur();
            }
          }}
          onBlur={(e) => {
            if (!cancelado.current) onRename(e.currentTarget.value);
            cancelado.current = false;
            setEditando(false);
          }}
        />
      ) : (
        <button type="button" className="task-row__title" title="Editar" onClick={() => setEditando(true)}>
          {task.title}
        </button>
      )}

      <DateMenu value={task.due} today={today} overdue={groupOf(task, today) === 'overdue'} onChange={onDue} />

      <button type="button" className="task-row__delete" aria-label={`Borrar ${task.title}`} onClick={onDelete}>
        <IconTrash />
      </button>
    </li>
  );
}
