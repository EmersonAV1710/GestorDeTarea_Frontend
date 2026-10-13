import { useState, type FormEvent } from "react";
import { SidebarIcon } from "../SidebarIcon";
import { Toast } from "../Toast";

type Props = {
  authMode: "login" | "register";
  email: string;
  setEmail: (value: string) => void;
  username: string;
  setUsername: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  passwordConfirmation: string;
  setPasswordConfirmation: (value: string) => void;
  busy: boolean;
  authError: string;
  authErrorId: number;
  notice: string;
  noticeId: number;
  onLogin: (event: FormEvent) => void;
  onRegister: (event: FormEvent) => void;
  onToggleMode: () => void;
  onClearAuthError: () => void;
  onClearNotice: () => void;
};

export function AuthPage({ authMode, email, setEmail, username, setUsername, password, setPassword, passwordConfirmation, setPasswordConfirmation, busy, authError, authErrorId, notice, noticeId, onLogin, onRegister, onToggleMode, onClearAuthError, onClearNotice }: Props) {
  const hasMinimumLength = Array.from(password).length >= 8;
  const hasUppercase = /\p{Lu}/u.test(password);
  const hasNumber = /\p{Nd}/u.test(password);
  const passwordsMatch = passwordConfirmation.length > 0 && password === passwordConfirmation;

  return <main className="login">
    <div className="login-card">
      <div className="brand login-brand"><SidebarIcon name="brand" /><b>Tarevia</b></div>
      <h1>{authMode === "login" ? "Iniciar sesión" : "Crear cuenta"}</h1>
      <p className="muted">{authMode === "login" ? "Accede a tus cursos y actividades." : "Crea tu cuenta para empezar."}</p>
      <form onSubmit={authMode === "login" ? onLogin : onRegister} className="stack">
        {authMode === "register" && <label>Correo electrónico<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="tu@universidad.edu" maxLength={254} /></label>}
        <label>Nombre de usuario<input type="text" required autoComplete="username" autoCapitalize="characters" value={username} onChange={event => setUsername(event.target.value.toUpperCase())} placeholder="TU_USUARIO" minLength={3} maxLength={30} pattern="[A-Z0-9][A-Z0-9._-]{2,29}" /></label>
        <PasswordField key={authMode} id="auth-password" name="password" label="Contraseña" value={password} onChange={setPassword} autoComplete={authMode === "login" ? "current-password" : "new-password"} placeholder={authMode === "login" ? "Ingresa tu contraseña" : "Crea tu contraseña"} minLength={authMode === "register" ? 8 : 1} />
        {authMode === "register" && <>
          <ul className="password-rules" aria-live="polite">
            <Rule ok={hasMinimumLength} text="Mínimo 8 caracteres" />
            <Rule ok={hasUppercase} text="Al menos una mayúscula" />
            <Rule ok={hasNumber} text="Al menos un número" />
            <Rule ok={passwordsMatch} text="Las contraseñas coinciden" />
          </ul>
          <PasswordField id="auth-password-confirmation" name="password_confirmation" label="Confirmar contraseña" value={passwordConfirmation} onChange={setPasswordConfirmation} autoComplete="new-password" placeholder="Repite tu contraseña" minLength={8} />
        </>}
        <button className="primary" disabled={busy || (authMode === "register" && (!hasMinimumLength || !hasUppercase || !hasNumber || !passwordsMatch))}>{busy ? (authMode === "login" ? "Ingresando…" : "Creando cuenta…") : (authMode === "login" ? "Iniciar sesión" : "Crear cuenta")}</button>
      </form>
      <button className="auth-toggle" disabled={busy} onClick={onToggleMode}>{authMode === "login" ? "¿No tienes cuenta? Crear una cuenta" : "¿Ya tienes cuenta? Inicia sesión"}</button>
    </div>
    <div className="toast-stack">{authError && <Toast key={`auth-${authErrorId}`} kind="error" message={authError} onClose={onClearAuthError} />}{notice && <Toast key={`notice-${noticeId}`} kind="success" message={notice} onClose={onClearNotice} />}</div>
  </main>;
}

function PasswordField({ id, name, label, value, onChange, autoComplete, placeholder, minLength }: {
  id: string;
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  placeholder: string;
  minLength: number;
}) {
  const [visible, setVisible] = useState(false);
  return <div className="password-field">
    <label htmlFor={id}>{label}</label>
    <div className="password-control">
      <input id={id} name={name} type={visible ? "text" : "password"} required autoComplete={autoComplete} placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} minLength={minLength} />
      <button type="button" className="password-visibility" aria-controls={id} aria-pressed={visible} aria-label={`${visible ? "Ocultar" : "Mostrar"} ${label.toLocaleLowerCase("es")}`} onClick={() => setVisible(current => !current)}>{visible ? "Ocultar" : "Mostrar"}</button>
    </div>
  </div>;
}

function Rule({ ok, text }: { ok: boolean; text: string }) {
  return <li className={ok ? "rule-ok" : "rule-pending"}><span className="password-rule-check" aria-label={ok ? "Cumplido" : "Sin cumplir"}>
    {ok && <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m3 8 3 3 7-7" /></svg>}
  </span>{text}</li>;
}
