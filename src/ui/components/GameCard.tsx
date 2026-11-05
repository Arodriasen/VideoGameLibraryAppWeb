import { Link } from 'react-router-dom';
import type { Game } from '../../domain/game';
import { GameCover } from './GameCover';
import { Icon } from './Icon';

export function GameCard({ game }: { game: Game }) {
  return (
    <Link className="card" to={`/juego/${game.id}`}>
      <GameCover key={game.coverUrl} game={game} />
      <div className="card__body">
        <h2 className="card__title">{game.title}</h2>
        <p className="card__meta">{game.platform.split(',')[0] || 'Sin plataforma'}</p>
        {game.rating > 0 && (
          <p className="card__stars" aria-label={`${game.rating} de 5 estrellas`}>
            {Array.from({ length: game.rating }, (_, index) => (
              <Icon key={index} name="star" filled size={13} />
            ))}
          </p>
        )}
      </div>
    </Link>
  );
}
