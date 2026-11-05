import { AuthApiError } from '@supabase/supabase-js';
import { useState, type FormEvent } from 'react';
import { supabase } from '../../infrastructure/supabase';
import { Icon } from '../components/Icon';
import { ForgotPasswordForm } from './ForgotPasswordForm';

function loginErrorMessage(error: unknown): string {
  if (error instanceof AuthApiError) {
    if (error.code === 'invalid_credentials') return 'Correo o contraseña incorrectos.';
    if (error.code === 'email_not_confirmed') return 'Confirma tu cuenta desde el correo que te enviamos.';
  }
  return 'Imposible iniciar sesión, reinténtelo más tarde.';
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forgotPassword, setForgotPassword] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) throw signInError;
    } catch (e) {
      setError(loginErrorMessage(e));
      setBusy(false);
    }
  }

  return (
    <main className="login">
      <div className="login__logo">
        <Icon name="gamepad" size={38} />
      </div>
      <h1>Mi Colección</h1>

      {forgotPassword ? (
        <ForgotPasswordForm initialEmail={email} onBack={() => setForgotPassword(false)} />
      ) : (
        <>
          <p className="muted">Entra con la misma cuenta del escritorio y de Android.</p>
          <form className="glass login__form" onSubmit={handleSubmit}>
            <label className="field">
              <span>Correo</span>
              <input
                type="email"
                autoComplete="username"
                autoCapitalize="none"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Contraseña</span>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>
            {error && <p className="error-text">{error}</p>}
            <button className="button" disabled={busy}>
              {busy ? 'Entrando…' : 'Iniciar sesión'}
            </button>
            <button type="button" className="link-button" onClick={() => setForgotPassword(true)}>
              ¿Olvidaste tu contraseña?
            </button>
          </form>
        </>
      )}
    </main>
  );
}
