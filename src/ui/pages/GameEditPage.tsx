import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { distinctSorted, splitList, type Game, type GameCandidate, type GameInput } from '../../domain/game';
import { createGame, lookupByBarcode, lookupByName, updateGame } from '../../infrastructure/gameApi';
import { CandidatePicker } from '../components/CandidatePicker';
import { Icon } from '../components/Icon';
import { StarRating } from '../components/StarRating';
import { useGames } from '../hooks/useGames';
import { useGoBack } from '../hooks/useGoBack';

interface FormValues {
  title: string;
  platform: string;
  genre: string;
  publisher: string;
  tags: string;
  year: string;
  notes: string;
  rating: number;
  played: boolean;
  isWishlist: boolean;
  coverUrl: string;
}

const CURRENT_YEAR = new Date().getFullYear();

function initialValues(game: Game | undefined, wishlist: boolean): FormValues {
  return {
    title: game?.title ?? '',
    platform: game?.platform ?? '',
    genre: game?.genre ?? '',
    publisher: game?.publisher ?? '',
    tags: game?.tags ?? '',
    year: game?.year?.toString() ?? '',
    notes: game?.notes ?? '',
    rating: game?.rating ?? 0,
    played: game?.played ?? false,
    isWishlist: game?.isWishlist ?? wishlist,
    coverUrl: game?.coverUrl ?? '',
  };
}

export function GameEditPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { games } = useGames();
  const game = id ? games?.find((item) => item.id === Number(id)) : undefined;

  if (id && !game) {
    return (
      <main className="page page--narrow">
        <p className="muted center">{games ? 'Este juego ya no está en tu colección.' : 'Cargando…'}</p>
      </main>
    );
  }

  return (
    <GameForm
      key={id ?? 'nuevo'}
      game={game}
      barcode={params.get('barcode')}
      wishlist={params.get('lista') === 'deseados'}
    />
  );
}

function GameForm({ game, barcode, wishlist }: { game?: Game; barcode: string | null; wishlist: boolean }) {
  const navigate = useNavigate();
  const goBack = useGoBack();
  const { games, saveLocally } = useGames();
  const [values, setValues] = useState(() => initialValues(game, wishlist));
  const [candidates, setCandidates] = useState<GameCandidate[] | null>(null);
  const [searching, setSearching] = useState(barcode !== null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const platforms = useMemo(() => distinctSorted(games?.map((item) => item.platform) ?? []), [games]);
  const genres = useMemo(() => distinctSorted(games?.flatMap((item) => splitList(item.genre)) ?? []), [games]);

  function update(changes: Partial<FormValues>) {
    setValues((current) => ({ ...current, ...changes }));
  }

  function applyCandidate(candidate: GameCandidate) {
    setCandidates(null);
    setValues((current) => ({
      ...current,
      title: candidate.title,
      platform: candidate.platform || current.platform,
      genre: candidate.genre || current.genre,
      year: candidate.year?.toString() ?? current.year,
      coverUrl: candidate.coverUrl || current.coverUrl,
    }));
  }

  function showResults(found: GameCandidate[], emptyMessage: string) {
    setNotice(found.length === 0 ? emptyMessage : null);
    if (found.length === 1) applyCandidate(found[0]);
    if (found.length > 1) setCandidates(found);
  }

  useEffect(() => {
    if (barcode === null) return;
    let cancelled = false;
    lookupByBarcode(barcode)
      .then((found) => {
        if (!cancelled) showResults(found, 'No hemos encontrado este código. Busca por nombre o rellénalo a mano.');
      })
      .catch(() => {
        if (!cancelled) setNotice('No se ha podido buscar el juego. Puedes rellenarlo a mano.');
      })
      .finally(() => {
        if (!cancelled) setSearching(false);
      });
    return () => {
      cancelled = true;
    };
  }, [barcode]);

  async function searchName() {
    if (!values.title.trim()) {
      setNotice('Escribe el título para buscarlo.');
      return;
    }
    setSearching(true);
    setNotice(null);
    try {
      showResults(await lookupByName(values.title), 'No hemos encontrado ningún juego con ese nombre.');
    } catch {
      setNotice('No se ha podido buscar el juego.');
    } finally {
      setSearching(false);
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const fields: Omit<GameInput, 'barcode' | 'coverUrl'> = {
      title: values.title,
      platform: values.platform,
      genre: values.genre,
      publisher: values.publisher,
      tags: values.tags,
      year: values.year ? Number(values.year) : null,
      notes: values.notes,
      rating: values.rating,
      played: values.played,
      isWishlist: values.isWishlist,
    };

    try {
      if (game) {
        // La URL solo se envía si ha cambiado: al recibirla, el servidor reemplaza la portada guardada.
        const coverChanges = values.coverUrl !== game.coverUrl ? { coverUrl: values.coverUrl } : {};
        saveLocally(await updateGame(game.id, { ...fields, ...coverChanges }));
        goBack();
      } else {
        const created = await createGame({ ...fields, barcode, coverUrl: values.coverUrl });
        saveLocally(created);
        navigate(`/juego/${created.id}`, { replace: true });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se ha podido guardar el juego.');
      setSaving(false);
    }
  }

  return (
    <main className="page page--narrow">
      <header className="topbar">
        <button type="button" className="icon-button" aria-label="Volver" onClick={goBack}>
          <Icon name="back" />
        </button>
        <h1 className="topbar__title">{game ? 'Editar juego' : 'Añadir juego'}</h1>
      </header>

      {searching && <p className="muted center-text">Buscando el juego…</p>}
      {notice && <p className="notice">{notice}</p>}

      {values.coverUrl && (
        <img
          className="form-cover"
          src={values.coverUrl.replace(/^http:/, 'https:')}
          alt=""
          referrerPolicy="no-referrer"
        />
      )}

      <form className="glass form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Título</span>
          <div className="field__row">
            <input required maxLength={300} value={values.title} onChange={(event) => update({ title: event.target.value })} />
            <button type="button" className="icon-button icon-button--soft" aria-label="Buscar por nombre" disabled={searching} onClick={searchName}>
              <Icon name="search" />
            </button>
          </div>
        </label>

        <label className="field">
          <span>Plataforma</span>
          <input list="plataformas" value={values.platform} onChange={(event) => update({ platform: event.target.value })} />
          <datalist id="plataformas">
            {platforms.map((platform) => (
              <option key={platform} value={platform} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>Género</span>
          <input list="generos" value={values.genre} onChange={(event) => update({ genre: event.target.value })} />
          <datalist id="generos">
            {genres.map((genre) => (
              <option key={genre} value={genre} />
            ))}
          </datalist>
        </label>

        <label className="field">
          <span>Editorial</span>
          <input value={values.publisher} onChange={(event) => update({ publisher: event.target.value })} />
        </label>

        <label className="field">
          <span>Año</span>
          <input
            type="number"
            inputMode="numeric"
            min={1950}
            max={CURRENT_YEAR + 2}
            value={values.year}
            onChange={(event) => update({ year: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Etiquetas (separadas por comas)</span>
          <input value={values.tags} onChange={(event) => update({ tags: event.target.value })} />
        </label>

        <label className="field">
          <span>Notas</span>
          <textarea rows={3} value={values.notes} onChange={(event) => update({ notes: event.target.value })} />
        </label>

        <div className="field">
          <span>Puntuación</span>
          <StarRating value={values.rating} onChange={(rating) => update({ rating })} />
        </div>

        <label className="switch">
          <span>Jugado</span>
          <input type="checkbox" checked={values.played} onChange={(event) => update({ played: event.target.checked })} />
        </label>

        <label className="switch">
          <span>En deseados</span>
          <input
            type="checkbox"
            checked={values.isWishlist}
            onChange={(event) => update({ isWishlist: event.target.checked })}
          />
        </label>

        {error && <p className="error-text">{error}</p>}

        <button className="button" disabled={saving || searching}>
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>

      {candidates && <CandidatePicker candidates={candidates} onPick={applyCandidate} onClose={() => setCandidates(null)} />}
    </main>
  );
}
