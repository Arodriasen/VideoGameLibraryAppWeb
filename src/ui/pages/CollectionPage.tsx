import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { matchesSearch, shareListText } from '../../domain/game';
import {
  activeFilterCount,
  filterOptions,
  matchesFilters,
  NO_FILTERS,
  readFilters,
  readSort,
  SORT_LABELS,
  sortGames,
  writeFilters,
  type GameFilters,
  type GameSort,
} from '../../domain/gameFilter';
import { deleteGames } from '../../infrastructure/gameApi';
import { FilterSheet } from '../components/FilterSheet';
import { Icon } from '../components/Icon';
import { SelectableCard } from '../components/SelectableCard';
import { useGames } from '../hooks/useGames';
import { shareOrCopy } from '../share';

export function CollectionPage() {
  const { games, error, collectionName, reload, removeLocally } = useGames();
  // Lista, búsqueda, filtros y orden van en la dirección, para seguir igual al volver de una ficha.
  const [params, setParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  // null fuera del modo selección.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<number> | null>(null);
  const [selectionBusy, setSelectionBusy] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);

  const onWishlist = params.get('lista') === 'deseados';
  const search = params.get('q') ?? '';
  const sort = readSort(params);
  const filters = useMemo(() => readFilters(params), [params]);

  function updateParam(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    setParams(next, { replace: true });
  }

  const owned = useMemo(() => games?.filter((game) => !game.isWishlist) ?? [], [games]);
  const wishlist = useMemo(() => games?.filter((game) => game.isWishlist) ?? [], [games]);
  const currentList = onWishlist ? wishlist : owned;
  const options = useMemo(() => filterOptions(currentList), [currentList]);
  const visible = useMemo(
    () =>
      sortGames(
        currentList.filter((game) => matchesSearch(game, search) && matchesFilters(game, filters)),
        sort,
      ),
    [currentList, search, filters, sort],
  );

  // Solo lo que se ve: un filtro no debe dejar juegos ocultos dentro de la selección.
  const selectedGames = visible.filter((game) => selectedIds?.has(game.id));

  function leaveSelection() {
    setSelectedIds(null);
    setSelectionMessage(null);
  }

  function toggleSelected(id: number) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  async function shareSelected() {
    setSelectionMessage(await shareOrCopy('Mi colección de juegos', shareListText(selectedGames)));
  }

  async function deleteSelected() {
    const count = selectedGames.length;
    const subject = count === 1 ? 'Se moverá 1 juego' : `Se moverán ${count} juegos`;
    if (!window.confirm(`${subject} a la papelera. Podrás recuperarlos durante 7 días.`)) return;

    setSelectionBusy(true);
    setSelectionMessage(null);
    try {
      const moved = await deleteGames(selectedGames.map((game) => game.id));
      moved.forEach(removeLocally);
      leaveSelection();
    } catch (e) {
      setSelectionMessage(e instanceof Error ? e.message : 'No se han podido eliminar los juegos.');
    } finally {
      setSelectionBusy(false);
    }
  }

  const filterCount = activeFilterCount(filters);
  const listQuery = onWishlist ? '?lista=deseados' : '';

  function setList(wishlistTab: boolean) {
    leaveSelection();
    // Las opciones de cada lista son distintas: los filtros de una no tienen por qué valer en la otra.
    const next = writeFilters(params, NO_FILTERS);
    if (wishlistTab) next.set('lista', 'deseados');
    else next.delete('lista');
    setParams(next, { replace: true });
  }

  function applyFilters(next: GameFilters) {
    setParams(writeFilters(params, next), { replace: true });
  }

  return (
    <main className="page">
      <header className="topbar">
        <span className="topbar__logo">
          <Icon name="gamepad" size={20} />
        </span>
        <h1 className="topbar__title">{collectionName || 'Mi Colección'}</h1>
        <Link className="icon-button" to="/estadisticas" aria-label="Estadísticas">
          <Icon name="chart" />
        </Link>
        <Link className="icon-button" to="/papelera" aria-label="Papelera">
          <Icon name="trash" />
        </Link>
        <Link className="icon-button" to="/ajustes" aria-label="Ajustes">
          <Icon name="settings" />
        </Link>
      </header>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={!onWishlist} onClick={() => setList(false)}>
          Colección ({owned.length})
        </button>
        <button role="tab" aria-selected={onWishlist} onClick={() => setList(true)}>
          Deseados ({wishlist.length})
        </button>
      </div>

      <label className="search glass">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder="Buscar por título, plataforma o género"
          aria-label="Buscar"
          value={search}
          onChange={(event) => updateParam('q', event.target.value)}
        />
      </label>

      <div className="toolbar">
        <button className="chip-button" aria-pressed={filterCount > 0} onClick={() => setFiltersOpen(true)}>
          <Icon name="filter" size={16} />
          {filterCount > 0 ? `Filtros (${filterCount})` : 'Filtros'}
        </button>
        <select
          className="sort"
          aria-label="Ordenar por"
          value={sort}
          onChange={(event) => updateParam('orden', event.target.value === 'titulo' ? '' : event.target.value)}
        >
          {(Object.keys(SORT_LABELS) as GameSort[]).map((option) => (
            <option key={option} value={option}>
              {SORT_LABELS[option]}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <div className="glass message">
          <p className="error-text">{error}</p>
          <button className="button" onClick={reload}>
            Reintentar
          </button>
        </div>
      ) : games === null ? (
        <p className="muted center">Cargando tu colección…</p>
      ) : visible.length === 0 ? (
        <p className="muted center">
          {search || filterCount > 0 ? 'Ningún juego coincide con la búsqueda.' : 'Aquí aún no hay juegos.'}
        </p>
      ) : (
        <section className="grid">
          {visible.map((game) => (
            <SelectableCard
              key={game.id}
              game={game}
              selecting={selectedIds !== null}
              selected={selectedIds?.has(game.id) ?? false}
              onLongPress={(id) => setSelectedIds(new Set([id]))}
              onToggle={toggleSelected}
            />
          ))}
        </section>
      )}

      {selectedIds ? (
        <div className="selection-bar" role="toolbar" aria-label="Juegos seleccionados">
          {selectionMessage && <p className="selection-bar__message">{selectionMessage}</p>}
          <div className="selection-bar__row">
            <span className="selection-bar__count">
              {selectedGames.length === 1 ? '1 seleccionado' : `${selectedGames.length} seleccionados`}
            </span>
            <button
              className="icon-button"
              aria-label="Compartir seleccionados"
              disabled={selectedGames.length === 0 || selectionBusy}
              onClick={() => void shareSelected()}
            >
              <Icon name="share" />
            </button>
            <button
              className="icon-button icon-button--danger"
              aria-label="Eliminar seleccionados"
              disabled={selectedGames.length === 0 || selectionBusy}
              onClick={() => void deleteSelected()}
            >
              <Icon name="trash" />
            </button>
            <button className="icon-button" aria-label="Salir de la selección" onClick={leaveSelection}>
              <Icon name="close" />
            </button>
          </div>
        </div>
      ) : (
        <div className="fabs">
          <Link className="fab fab--small" to={`/juego/nuevo${listQuery}`} aria-label="Añadir juego a mano">
            <Icon name="plus" />
          </Link>
          <Link className="fab" to={`/escanear${listQuery}`} aria-label="Escanear código de barras">
            <Icon name="scan" size={26} />
          </Link>
        </div>
      )}

      {filtersOpen && (
        <FilterSheet
          options={options}
          filters={filters}
          resultCount={visible.length}
          onChange={applyFilters}
          onClose={() => setFiltersOpen(false)}
        />
      )}
    </main>
  );
}
