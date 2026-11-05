import { isAuthError } from '@supabase/supabase-js';
import { useRef, useState, type FormEvent } from 'react';
import { supabase } from '../../infrastructure/supabase';
import { useAuth } from '../hooks/useAuth';

function recoveryErrorMessage(error: unknown): string {
  // isAuthError y no AuthApiError: la contraseña débil llega con otro tipo de error.
  if (isAuthError(error)) {
    if (error.code === 'otp_expired') return 'El código no es válido o ha caducado. Pide uno nuevo.';
    if (error.code === 'weak_password') return 'La contraseña es demasiado corta o débil.';
    if (error.code === 'same_password') return 'La contraseña nueva debe ser distinta de la anterior.';
    if (error.code === 'over_email_send_rate_limit') return 'Has pedido demasiados códigos. Espera un poco.';
  }
  return 'No se ha podido completar. Inténtalo más tarde.';
}

interface ForgotPasswordFormProps {
  initialEmail: string;
  onBack: () => void;
}

/** Por código, igual que en Android: la misma plantilla de correo sirve para todas las apps. */
export function ForgotPasswordForm({ initialEmail, onBack }: ForgotPasswordFormProps) {
  const { setRecovering } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Un código solo vale una vez: si falla la contraseña, el reintento no debe validarlo de nuevo.
  const codeVerified = useRef(false);

  async function sendCode(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: sendError } = await supabase.auth.resetPasswordForEmail(email.trim());
      if (sendError) throw sendError;
      setStep('code');
    } catch (e) {
      setError(recoveryErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setError('Las dos contraseñas no coinciden.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      if (!codeVerified.current) {
        setRecovering(true);
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: code.trim(),
          type: 'recovery',
        });
        if (verifyError) throw verifyError;
        codeVerified.current = true;
      }

      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setRecovering(false); // Ya hay sesión: entra directamente en la colección.
    } catch (e) {
      if (!codeVerified.current) setRecovering(false);
      setError(recoveryErrorMessage(e));
      setBusy(false);
    }
  }

  async function goBack() {
    // Con el código ya validado hay una sesión abierta sin haber cambiado la contraseña.
    if (codeVerified.current) await supabase.auth.signOut({ scope: 'local' });
    setRecovering(false);
    onBack();
  }

  return step === 'email' ? (
    <form className="glass login__form" onSubmit={sendCode}>
      <p className="muted">Te enviaremos un código a tu correo para que puedas poner una contraseña nueva.</p>
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
      {error && <p className="error-text">{error}</p>}
      <button className="button" disabled={busy}>
        {busy ? 'Enviando…' : 'Enviar código'}
      </button>
      <button type="button" className="link-button" onClick={() => void goBack()}>
        Volver
      </button>
    </form>
  ) : (
    <form className="glass login__form" onSubmit={changePassword}>
      <p className="muted">
        Si la cuenta existe, te hemos enviado un código por correo. Si no lo ves en unos minutos, revisa también la
        carpeta de spam.
      </p>
      <label className="field">
        <span>Código</span>
        <input
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          disabled={codeVerified.current}
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Contraseña nueva</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="field">
        <span>Repite la contraseña nueva</span>
        <input
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
      </label>
      {error && <p className="error-text">{error}</p>}
      <button className="button" disabled={busy}>
        {busy ? 'Cambiando…' : 'Cambiar contraseña'}
      </button>
      <button type="button" className="link-button" onClick={() => void goBack()}>
        Volver
      </button>
    </form>
  );
}
