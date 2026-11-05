import { useMemo } from 'react';
import { NO_FILTERS, writeFilters, type FilterKey } from '../../domain/gameFilter';
import { computeStats } from '../../domain/gameStats';
import { Icon } from '../components/Icon';
import { RankedBars } from '../components/RankedBars';
import { TimelineColumns } from '../components/TimelineColumns';
import { useGames } from '../hooks/useGames';
import { useGoBack } from '../hooks/useGoBack';

function filteredCollection(key: FilterKey, value: string): string {
  return `/?${writeFilters(new URLSearchParams(), { ...NO_FILTERS, [key]: [value] })}`;
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass tile">
      <span className="tile__value">{value}</span>
      <span className="tile__label">{label}</span>
    </div>
  );
}

export function StatsPage() {
  const goBack = useGoBack();
  const { games, error } = useGames();
  const stats = useMemo(() => (games ? computeStats(games) : null), [games]);

  return (
    <main className="page page--narrow">
      <header className="topbar">
        <button className="icon-button" aria-label="Volver" onClick={goBack}>
          <Icon name="back" />
        </button>
        <h1 className="topbar__title">Estadísticas</h1>
      </header>

      {!stats ? (
        <p className={error ? 'error-text center' : 'muted center'}>{error ?? 'Cargando…'}</p>
      ) : stats.total === 0 ? (
        <p className="muted center">Aún no hay juegos en tu colección.</p>
      ) : (
        <>
          <div className="tiles">
            <StatTile label="Total" value={String(stats.total)} />
            <StatTile label="Jugados" value={String(stats.played)} />
            <StatTile label="Jugado" value={`${stats.playedPercent}%`} />
          </div>

          {stats.wishlist > 0 && (
            <p className="muted center-text stats-note">{stats.wishlist} en deseados, no incluidos en estas cifras.</p>
          )}

          <RankedBars
            title="Por plataforma"
            rows={stats.byPlatform}
            linkTo={(label) => filteredCollection('platforms', label)}
          />
          <RankedBars title="Por género" rows={stats.byGenre} linkTo={(label) => filteredCollection('genres', label)} />
          <RankedBars title="Por etiquetas" rows={stats.byTag} linkTo={(label) => filteredCollection('tags', label)} />
          <TimelineColumns title="Por década de lanzamiento" rows={stats.byReleaseDecade} noun="juego" />
          <TimelineColumns title="Añadidos por año" rows={stats.byYearAdded} noun="juego añadido" />
        </>
      )}
    </main>
  );
}
