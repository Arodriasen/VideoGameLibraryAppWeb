import { useEffect, useState, type FormEvent } from 'react';
import {
  clearCoverCache,
  fetchSettings,
  saveCollectionName,
  saveSettings,
  type AppSettings,
} from '../../infrastructure/gameApi';
import { supabase } from '../../infrastructure/supabase';
import { Icon } from '../components/Icon';
import { useGames } from '../hooks/useGames';
import { useGoBack } from '../hooks/useGoBack';

/** Las claves van ocultas: esta pantalla se puede abrir con alguien mirando. */
function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [visible, setVisible] = useState(false);
  return (
    <label className="field">
      <span>{label}</span>
      <div className="field__row">
        <input
          type={visible ? 'text' : 'password'}
          autoComplete="off"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="icon-button icon-button--soft"
          aria-label={visible ? `Ocultar ${label}` : `Mostrar ${label}`}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          <Icon name="eye" />
        </button>
      </div>
    </label>
  );
}

export function SettingsPage() {
  const goBack = useGoBack();
  const { collectionName, setCollectionName, reload } = useGames();
  const [original, setOriginal] = useState<AppSettings | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  // null hasta que lo edites: el nombre puede llegar después de abrir esta pantalla.
  const [editedName, setEditedName] = useState<string | null>(null);
  const name = editedName ?? collectionName;
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((loaded) => {
        if (cancelled) return;
        setOriginal(loaded);
        setSettings(loaded);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'No se han podido leer los ajustes.');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function update(changes: Partial<AppSettings>) {
    setSettings((current) => (current ? { ...current, ...changes } : current));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!settings || !original) return;

    setSaving(true);
    setSaveError(null);
    try {
      // Primero los ajustes: el nombre se guarda en la base de datos, que puede acabar de cambiar.
      await saveSettings(settings);
      const trimmedName = name.trim();
      if (trimmedName !== collectionName) {
        await saveCollectionName(trimmedName);
        setCollectionName(trimmedName);
      }
      if (settings.connectionString.trim() !== original.connectionString.trim()) {
        await clearCoverCache();
        reload();
      }
      goBack();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'No se han podido guardar los ajustes.');
      setSaving(false);
    }
  }

  return (
    <main className="page page--narrow">
      <header className="topbar">
        <button className="icon-button" aria-label="Volver" onClick={goBack}>
          <Icon name="back" />
        </button>
        <h1 className="topbar__title">Ajustes</h1>
      </header>

      {loadError ? (
        <p className="error-text center">{loadError}</p>
      ) : !settings ? (
        <p className="muted center">Cargando los ajustes…</p>
      ) : (
        <form className="glass form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Nombre de la colección</span>
            <input maxLength={100} value={name} onChange={(event) => setEditedName(event.target.value)} />
          </label>

          <h2 className="form__section">Base de datos</h2>
          <SecretField
            label="Cadena de conexión"
            value={settings.connectionString}
            onChange={(connectionString) => update({ connectionString })}
          />
          <p className="form__hint">
            La misma de la app de escritorio. Antes de guardarla se comprueba que funciona. Las otras apps la recibirán
            la próxima vez que inicies sesión en ellas.
          </p>

          <h2 className="form__section">Claves de API (opcionales)</h2>
          <SecretField
            label="ScanDex Token"
            value={settings.scanDexToken}
            onChange={(scanDexToken) => update({ scanDexToken })}
          />
          <SecretField
            label="IGDB Client Id"
            value={settings.igdbClientId}
            onChange={(igdbClientId) => update({ igdbClientId })}
          />
          <SecretField
            label="IGDB Client Secret"
            value={settings.igdbClientSecret}
            onChange={(igdbClientSecret) => update({ igdbClientSecret })}
          />
          <SecretField label="RAWG API Key" value={settings.rawgApiKey} onChange={(rawgApiKey) => update({ rawgApiKey })} />
          <SecretField
            label="TheGamesDB API Key"
            value={settings.theGamesDbApiKey}
            onChange={(theGamesDbApiKey) => update({ theGamesDbApiKey })}
          />

          {saveError && <p className="error-text">{saveError}</p>}
          <button className="button" disabled={saving}>
            {saving ? 'Comprobando y guardando…' : 'Guardar'}
          </button>
        </form>
      )}

      <button className="button button--danger" onClick={() => void supabase.auth.signOut({ scope: 'local' })}>
        <Icon name="logout" size={18} />
        Cerrar sesión
      </button>
    </main>
  );
}
