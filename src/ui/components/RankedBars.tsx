import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { StatRow } from '../../domain/gameStats';

const VISIBLE_ROWS = 8;

interface RankedBarsProps {
  title: string;
  rows: StatRow[];
  /** Destino al pulsar una fila, para ver esos juegos. */
  linkTo: (label: string) => string;
}

/** Una sola serie: un solo color, y la longitud de cada barra es relativa a la mayor. */
export function RankedBars({ title, rows, linkTo }: RankedBarsProps) {
  const [expanded, setExpanded] = useState(false);
  if (rows.length === 0) return null;

  const max = rows[0].count;
  const visible = expanded ? rows : rows.slice(0, VISIBLE_ROWS);

  return (
    <section className="glass chart">
      <h2 className="chart__title">{title}</h2>
      <ol className="bars">
        {visible.map((row) => (
          <li key={row.label}>
            <Link className="bars__row" to={linkTo(row.label)}>
              <span className="bars__label">{row.label}</span>
              <span className="bars__value">
                {row.count} <small>({row.percent}%)</small>
              </span>
              <span className="bars__track" aria-hidden="true">
                <span className="bars__bar" style={{ width: `${(row.count / max) * 100}%` }} />
              </span>
            </Link>
          </li>
        ))}
      </ol>
      {rows.length > VISIBLE_ROWS && (
        <button type="button" className="link-button" onClick={() => setExpanded((current) => !current)}>
          {expanded ? 'Ver menos' : `Ver todas (${rows.length})`}
        </button>
      )}
    </section>
  );
}
