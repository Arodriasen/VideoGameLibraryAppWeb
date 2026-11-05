import type { StatRow } from '../../domain/gameStats';

const CHART_HEIGHT = 120;

/** Evolución en el tiempo, de izquierda a derecha. Con un solo periodo basta con una frase. */
export function TimelineColumns({ title, rows, noun }: { title: string; rows: StatRow[]; noun: string }) {
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((row) => row.count));
  const [only] = rows;

  return (
    <section className="glass chart">
      <h2 className="chart__title">{title}</h2>
      {rows.length === 1 ? (
        <p className="muted">
          {only.count} {only.count === 1 ? noun : `${noun}s`} en {only.label}
        </p>
      ) : (
        <div className="columns-scroll">
          <ol className="columns" style={{ height: CHART_HEIGHT + 44 }}>
            {rows.map((row) => (
              <li key={row.label} className="columns__item" aria-label={`${row.label}: ${row.count}`}>
                <span className="columns__value">{row.count}</span>
                <span className="columns__bar" style={{ height: Math.max((row.count / max) * CHART_HEIGHT, 3) }} />
                <span className="columns__label">{row.label}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
