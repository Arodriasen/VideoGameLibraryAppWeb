import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { parseLocalDate, shareText, splitList, type Game } from '../../domain/game';
import { deleteGame, updateGame } from '../../infrastructure/gameApi';
import { GameCover } from '../components/GameCover';
import { Icon } from '../components/Icon';
import { useGames } from '../hooks/useGames';
import { useGoBack } from '../hooks/useGoBack';
import { shareOrCopy } from '../share';

function formatAddedDate(date: string): string {
  const parsed = parseLocalDate(date);
  if (Number.isNaN(parsed.getTime())) return '';
  return parsed.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function GameDetailPage() {
  const { id } = useParams();
  const goBack = useGoBack();
  const { games, error, saveLocally, removeLocally } = useGames();
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const game = games?.find((item) => item.id === Number(id));

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setActionError(null);
    try {
      await action();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se ha podido guardar el cambio.');
    } finally {
      setBusy(false);
    }
  }

  async function share(current: Game) {
    setActionError(await shareOrCopy(current.title, shareText(current)));
  }

  function change(current: Game, changes: Partial<Game>) {
    void run(async () => saveLocally(await updateGame(current.id, changes)));
  }

  function remove(current: Game) {
    if (!window.confirm(`Se moverá a la papelera. Podrás recuperarlo durante 7 días.\n\n¿Eliminar "${current.title}"?`)) {
      return;
    }
    void run(async () => {
      await deleteGame(current.id);
      removeLocally(current.id);
      goBack();
    });
  }

  return (
    <main className="page page--narrow">
      <header className="topbar">
        <button className="icon-button" aria-label="Volver" onClick={goBack}>
          <Icon name="back" />
        </button>
        <h1 className="topbar__title">Ficha</h1>
        {game && (
          <>
            <button className="icon-button" aria-label="Compartir" onClick={() => void share(game)}>
              <Icon name="share" />
            </button>
            <Link className="icon-button" to={`/juego/${game.id}/editar`} aria-label="Editar">
              <Icon name="edit" />
            </Link>
          </>
        )}
      </header>

      {!game ? (
        <p className="muted center">{error ?? (games ? 'Este juego ya no está en tu colección.' : 'Cargando…')}</p>
      ) : (
        <>
          <div className="detail__cover">
            <GameCover key={game.coverUrl} game={game} />
          </div>

          <section className="detail__heading">
            <h2>{game.title}</h2>
            <p className="muted">{[game.platform, game.year].filter(Boolean).join(' · ')}</p>
            {game.rating > 0 && (
              <p className="card__stars detail__stars" aria-label={`${game.rating} de 5 estrellas`}>
                {Array.from({ length: game.rating }, (_, index) => (
                  <Icon key={index} name="star" filled size={20} />
                ))}
              </p>
            )}
          </section>

          <div className="actions">
            <button className="chip-button" aria-pressed={game.played} disabled={busy} onClick={() => change(game, { played: !game.played })}>
              <Icon name="check" size={18} />
              {game.played ? 'Jugado' : 'Sin jugar'}
            </button>
            <button
              className="chip-button"
              aria-pressed={game.isWishlist}
              disabled={busy}
              onClick={() => change(game, { isWishlist: !game.isWishlist })}
            >
              <Icon name="heart" size={18} filled={game.isWishlist} />
              {game.isWishlist ? 'Pasar a colección' : 'Mover a deseados'}
            </button>
          </div>

          {actionError && <p className="error-text center-text">{actionError}</p>}

          <dl className="glass facts">
            {game.genre && <Fact label="Género" value={game.genre} />}
            {game.publisher && <Fact label="Editorial" value={game.publisher} />}
            {game.barcode && <Fact label="Código de barras" value={game.barcode} />}
            <Fact label="Añadido" value={formatAddedDate(game.addedDate)} />
          </dl>

          {game.tags && (
            <div className="tags">
              {splitList(game.tags).map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>
          )}

          {game.notes && (
            <section className="glass notes">
              <h3>Notas</h3>
              <p>{game.notes}</p>
            </section>
          )}

          <button className="button button--danger" disabled={busy} onClick={() => remove(game)}>
            <Icon name="trash" size={18} />
            Eliminar
          </button>
        </>
      )}
    </main>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="facts__row">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
