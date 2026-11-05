import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { canonicalBarcode } from '../../domain/barcode';
import { sameBarcode } from '../../domain/game';
import { readBarcodeFromPhoto } from '../../infrastructure/barcodeReader';
import { updateGame } from '../../infrastructure/gameApi';
import { GameCard } from '../components/GameCard';
import { Icon } from '../components/Icon';
import { useBarcodeScanner, type ScannerStatus } from '../hooks/useBarcodeScanner';
import { useGames } from '../hooks/useGames';
import { useGoBack } from '../hooks/useGoBack';

const STATUS_MESSAGES: Partial<Record<ScannerStatus, string>> = {
  starting: 'Encendiendo la cámara…',
  scanning: 'Centra el código de barras en la franja',
  denied: 'No hay permiso para usar la cámara. Actívalo en Ajustes > Safari > Cámara, o usa una foto.',
  unavailable: 'No se ha podido abrir la cámara. Puedes usar una foto.',
};

/** Una lectura vuelve a montar el visor desde cero, para escanear otra caja. */
export function ScannerPage() {
  const [session, setSession] = useState(0);
  return <Scanner key={session} onScanAgain={() => setSession((value) => value + 1)} />;
}

function Scanner({ onScanAgain }: { onScanAgain: () => void }) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const [params] = useSearchParams();
  const { games, error, saveLocally } = useGames();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [code, setCode] = useState<string | null>(null);
  const [photoMessage, setPhotoMessage] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const camera = useBarcodeScanner(videoRef, (detected) => setCode(canonicalBarcode(detected.code)));

  const match = code ? games?.find((game) => sameBarcode(game.barcode, code)) : undefined;
  const isNew = code !== null && (games !== null || error !== null) && !match;

  useEffect(() => {
    if (!isNew || !code) return;
    const query = new URLSearchParams({ barcode: code });
    if (params.get('lista') === 'deseados') query.set('lista', 'deseados');
    navigate(`/juego/nuevo?${query}`, { replace: true });
  }, [code, isNew, navigate, params]);

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0];
    event.target.value = '';
    if (!photo) return;

    setPhotoMessage('Leyendo la foto…');
    try {
      const detected = await readBarcodeFromPhoto(photo);
      setPhotoMessage(detected ? null : 'No se ve ningún código en la foto. Prueba más cerca y con buena luz.');
      if (detected) setCode(canonicalBarcode(detected.code));
    } catch {
      setPhotoMessage('No se ha podido abrir la foto.');
    }
  }

  async function moveToCollection(id: number) {
    setMoving(true);
    setMoveError(null);
    try {
      saveLocally(await updateGame(id, { isWishlist: false }));
      navigate(`/juego/${id}`, { replace: true });
    } catch (e) {
      setMoveError(e instanceof Error ? e.message : 'No se ha podido guardar el cambio.');
      setMoving(false);
    }
  }

  return (
    <main className="scanner">
      <video ref={videoRef} className="scanner__video" playsInline muted autoPlay />
      <div className="scanner__shade" />
      {!code && <div className="scanner__strip" />}

      <header className="scanner__top">
        <button className="icon-button icon-button--dark" aria-label="Volver" onClick={goBack}>
          <Icon name="back" />
        </button>
        {camera.zoomAvailable && (
          <button
            className="icon-button icon-button--dark"
            aria-label="Zoom"
            aria-pressed={camera.zoomOn}
            onClick={camera.toggleZoom}
          >
            <Icon name="zoom" />
          </button>
        )}
        {camera.torchAvailable && (
          <button
            className="icon-button icon-button--dark"
            aria-label="Linterna"
            aria-pressed={camera.torchOn}
            onClick={camera.toggleTorch}
          >
            <Icon name="torch" filled={camera.torchOn} />
          </button>
        )}
      </header>

      <section className="scanner__panel">
        {match ? (
          <>
            <p>
              <strong>{match.isWishlist ? 'Lo tienes en deseados:' : 'Ya lo tienes en la colección:'}</strong>
            </p>
            <GameCard game={match} />
            {moveError && <p className="error-text">{moveError}</p>}
            {match.isWishlist && (
              <button className="button" disabled={moving} onClick={() => void moveToCollection(match.id)}>
                {moving ? 'Guardando…' : 'Pasar a la colección'}
              </button>
            )}
            <button className="button button--ghost" onClick={onScanAgain}>
              Escanear otro
            </button>
          </>
        ) : code ? (
          <p>Comprobando {code}…</p>
        ) : (
          <>
            <p>{photoMessage ?? STATUS_MESSAGES[camera.status]}</p>
            <label className="button button--ghost">
              <Icon name="camera" size={18} />
              Usar una foto
              <input type="file" accept="image/*" capture="environment" hidden onChange={handlePhoto} />
            </label>
          </>
        )}
      </section>
    </main>
  );
}
