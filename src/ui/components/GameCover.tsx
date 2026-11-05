import { useEffect, useRef, useState } from 'react';
import type { Game } from '../../domain/game';
import { fetchCover } from '../../infrastructure/gameApi';
import { Icon } from './Icon';

/**
 * Se prefiere CoverUrl porque no gasta la base de datos, y la portada guardada queda de reserva para
 * los juegos sin URL o cuya URL ya no funciona.
 */
export function GameCover({ game }: { game: Game }) {
  const remoteUrl = game.coverUrl.replace(/^http:/, 'https:');
  const [remoteFailed, setRemoteFailed] = useState(false);
  const [storedUrl, setStoredUrl] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const needsStored = game.coverSize > 0 && (!remoteUrl || remoteFailed);

  useEffect(() => {
    const element = containerRef.current;
    if (!element || !needsStored) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [needsStored]);

  useEffect(() => {
    if (!needsStored || !visible) return;
    let objectUrl: string | null = null;
    let cancelled = false;
    fetchCover(game)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setStoredUrl(objectUrl);
      })
      .catch(() => undefined); // Sin portada se queda el icono de reserva.
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [game, needsStored, visible]);

  const source = remoteUrl && !remoteFailed ? remoteUrl : storedUrl;

  return (
    <div className="cover" ref={containerRef}>
      {source ? (
        <img
          src={source}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => {
            if (source === remoteUrl) setRemoteFailed(true);
          }}
        />
      ) : (
        <span className="cover__placeholder">
          <Icon name="gamepad" size={32} />
        </span>
      )}
    </div>
  );
}
