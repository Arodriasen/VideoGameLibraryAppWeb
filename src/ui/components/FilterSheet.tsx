import { NO_FILTERS, type FilterKey, type FilterOptions, type GameFilters } from '../../domain/gameFilter';
import { Icon } from './Icon';

const RATINGS = [
  { value: '5', label: '★★★★★' },
  { value: '4', label: '★★★★' },
  { value: '3', label: '★★★' },
  { value: '2', label: '★★' },
  { value: '1', label: '★' },
  { value: '0', label: 'Sin puntuar' },
];

const PLAYED = [
  { value: 'si', label: 'Jugados' },
  { value: 'no', label: 'Falta por jugar' },
];

interface FilterSheetProps {
  options: FilterOptions;
  filters: GameFilters;
  resultCount: number;
  onChange: (filters: GameFilters) => void;
  onClose: () => void;
}

export function FilterSheet({ options, filters, resultCount, onChange, onClose }: FilterSheetProps) {
  function toggle(key: FilterKey, value: string) {
    const selected = filters[key];
    onChange({
      ...filters,
      [key]: selected.includes(value) ? selected.filter((item) => item !== value) : [...selected, value],
    });
  }

  function group(key: FilterKey, title: string, items: { value: string; label: string }[]) {
    if (items.length === 0) return null;
    return (
      <fieldset className="filter-group">
        <legend>{title}</legend>
        <div className="filter-options">
          {items.map((item) => (
            <button
              key={item.value}
              type="button"
              className="option"
              aria-pressed={filters[key].includes(item.value)}
              onClick={() => toggle(key, item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>
    );
  }

  const asItems = (values: string[]) => values.map((value) => ({ value, label: value }));

  return (
    <div className="sheet" role="dialog" aria-modal="true" aria-label="Filtros">
      <div className="sheet__panel">
        <header className="sheet__header">
          <h2>Filtros</h2>
          <button type="button" className="icon-button" aria-label="Cerrar" onClick={onClose}>
            <Icon name="close" />
          </button>
        </header>

        <div className="filter-groups">
          {group('played', 'Estado', PLAYED)}
          {group('ratings', 'Puntuación', RATINGS)}
          {group('platforms', 'Plataforma', asItems(options.platforms))}
          {group('genres', 'Género', asItems(options.genres))}
          {group('tags', 'Etiquetas', asItems(options.tags))}
          {group('years', 'Año', asItems(options.years))}
        </div>

        <footer className="sheet__footer">
          <button type="button" className="button button--ghost" onClick={() => onChange(NO_FILTERS)}>
            Limpiar
          </button>
          <button type="button" className="button" onClick={onClose}>
            Ver {resultCount} {resultCount === 1 ? 'juego' : 'juegos'}
          </button>
        </footer>
      </div>
    </div>
  );
}
