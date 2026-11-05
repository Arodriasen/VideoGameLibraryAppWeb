import { useEffect, useState } from 'react';
import { trashDaysLeftText, type TrashedGame } from '../../domain/game';
import { deleteGameForever, fetchTrash, restoreGame } from '../../infrastructure/gameApi';
import { GameCover } from '../components/GameCover';
import { Icon } from '../components/Icon';
import { useGames } from '../hooks/useGames';
import { useGoBack } from '../hooks/useGoBack';

export function TrashPage() {
  const goBack = useGoBack();
  const { saveLocally } = useGames();
  const [items, setItems] = useState<TrashedGame[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTrash()
      .then((loaded) => {
        if (!cancelled) setItems(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'No se ha podido leer la papelera.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function run(id: number, action: () => Promise<void>) {
    setBusyId(id);
    setActionError(null);
    try {
      await action();
      setItems((current) => current?.filter((item) => item.id !== id) ?? null);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'No se ha podido completar la acción.');
    } finally {
      setBusyId(null);
    }
  }

  function restore(item: TrashedGame) {
    void run(item.id, async () => saveLocally(await restoreGame(item.id)));
  }

  function deleteForever(item: TrashedGame) {
    if (!window.confirm(`"${item.title}" se eliminará para siempre. Esta acción no se puede deshacer.`)) return;
    void run(item.id, () => deleteGameForever(item.id));
  }

  return (
    <main className="page page--narrow">
      <header className="topbar">
        <button className="icon-button" aria-label="Volver" onClick={goBack}>
          <Icon name="back" />
        </button>
        <h1 className="topbar__title">Papelera</h1>
      </header>

      {actionError && <p className="error-text center-text">{actionError}</p>}

      {loadError ? (
        <p className="error-text center">{loadError}</p>
      ) : items === null ? (
        <p className="muted center">Cargando la papelera…</p>
      ) : items.length === 0 ? (
        <p className="muted center">La papelera está vacía.</p>
      ) : (
        <ul className="trash-list">
          {items.map((item) => (
            <li key={item.id} className="glass trash-item">
              <GameCover key={item.coverUrl} game={item} />
              <div className="trash-item__body">
                <h2>{item.title}</h2>
                <p>{item.platform.split(',')[0]}</p>
                <p>{trashDaysLeftText(item.deletedDate)}</p>
                <div className="trash-item__actions">
                  <button className="chip-button" disabled={busyId !== null} onClick={() => restore(item)}>
                    <Icon name="restore" size={16} />
                    Restaurar
                  </button>
                  <button
                    className="chip-button chip-button--danger"
                    disabled={busyId !== null}
                    onClick={() => deleteForever(item)}
                  >
                    <Icon name="trash" size={16} />
                    Eliminar
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
