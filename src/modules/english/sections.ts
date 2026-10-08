import type { ModuleIconName } from '../../core/ui/ModuleIcon';

export type SectionId = 'loora' | 'youtube' | 'text' | 'talk' | 'ia';

/** Un campo del formulario para anotar algo en una actividad. */
export interface EntryField {
  name: 'title' | 'url' | 'body';
  label: string;
  placeholder: string;
  required?: boolean;
  multiline?: boolean;
}

/** Las actividades diarias de inglés: una tarjeta cada una dentro de English. */
export interface EnglishSection {
  id: SectionId;
  title: string;
  /** Una línea para su tarjeta. */
  description: string;
  icon: ModuleIconName;
  color: string;
  /** Lo que se anota cada vez; sin campos, la actividad solo se palomea. */
  fields: EntryField[];
  /** Cómo se llama lo que se anota: "conversación", "video"… */
  entryName: string;
}

export const SECTIONS: readonly EnglishSection[] = [
  {
    id: 'loora',
    title: 'Loora',
    description: 'Conversación con IA.',
    icon: 'bot',
    color: '#7a4fd6',
    entryName: 'conversación',
    fields: [{ name: 'title', label: 'Tema de la conversación', placeholder: 'Practice interview', required: true }],
  },
  {
    id: 'youtube',
    title: 'YouTube',
    description: 'Videos para aprender.',
    icon: 'play',
    color: '#d23a32',
    entryName: 'video',
    fields: [
      { name: 'url', label: 'Link del video', placeholder: 'https://www.youtube.com/watch?v=…', required: true },
      { name: 'title', label: 'Título (opcional)', placeholder: 'De qué trata' },
    ],
  },
  {
    id: 'text',
    title: 'Text',
    description: 'Leer y anotar.',
    icon: 'book-open',
    color: '#2f6fd6',
    entryName: 'texto',
    fields: [
      { name: 'title', label: 'Título', placeholder: 'Título del texto', required: true },
      { name: 'body', label: 'Texto', placeholder: 'Escribe o pega el texto…', multiline: true },
    ],
  },
  {
    id: 'talk',
    title: 'Talk',
    description: 'Práctica hablando.',
    icon: 'mic',
    color: '#2f8a6a',
    entryName: 'tema',
    fields: [{ name: 'title', label: 'Tema del que hablaste', placeholder: 'My weekend', required: true }],
  },
  {
    id: 'ia',
    title: 'IA English',
    description: 'Usar la IA en inglés.',
    icon: 'sparkles',
    color: '#d0558f',
    entryName: '',
    fields: [],
  },
];

export const sectionById = (id: string | undefined) => SECTIONS.find((s) => s.id === id);
