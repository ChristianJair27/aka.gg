// src/pages/ForgotPassword.tsx — solicitar enlace + restablecer (misma página
// maneja ambos: /forgot-password y /reset-password?token=...)
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2, MailCheck, KeyRound } from "lucide-react";
import { axiosInstance } from "@/lib/axios";
import { AuthShell } from "@/components/arena/AuthShell";
import "@/styles/pages/auth.css";

export default function ForgotPassword() {
  const navigate = useNavigate();
  const token = new URLSearchParams(useLocation().search).get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try {
      if (token) {
        await axiosInstance.post("/auth/reset-password", { token, password });
        setDone(true);
        setTimeout(() => navigate("/login"), 2500);
      } else {
        await axiosInstance.post("/auth/forgot-password", { email });
        setDone(true);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.response?.data?.msg || "Algo salió mal. Intenta de nuevo.");
    } finally { setBusy(false); }
  };

  return (
    <AuthShell
      compact
      title={token ? "Nueva contraseña" : "Recuperar acceso"}
      subtitle={token ? "Elige tu nueva contraseña." : "Te enviamos un enlace a tu correo."}
      footer={<Link to="/login" className="ax-link">Volver al inicio de sesión</Link>}
    >
      {done ? (
        <div className="au-done" role="status">
          <MailCheck size={44} aria-hidden />
          <p style={{ margin: 0 }}>
            {token
              ? "Contraseña actualizada. Te llevamos al inicio de sesión…"
              : "Si el correo existe, recibirás el enlace en unos minutos. Revisa también la carpeta de spam."}
          </p>
        </div>
      ) : (
        <form onSubmit={submit} className="au-form">
          {token ? (
            <div className="td-field">
              <label htmlFor="new-password" className="td-label">Nueva contraseña</label>
              <input id="new-password" type="password" autoComplete="new-password" placeholder="••••••••"
                minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)}
                className="td-input" aria-describedby="new-password-help" />
              <p id="new-password-help" className="td-help">Mínimo 6 caracteres.</p>
            </div>
          ) : (
            <div className="td-field">
              <label htmlFor="email" className="td-label">Email</label>
              <input id="email" type="email" autoComplete="email" placeholder="tu@email.com"
                required value={email} onChange={(e) => setEmail(e.target.value)} className="td-input" />
            </div>
          )}

          {error && <div className="au-alert" role="alert">{error}</div>}

          <button type="submit" disabled={busy} className="td-btn td-btn--primary" data-full="true">
            {busy
              ? <Loader2 size={18} className="au-spin" aria-label="Enviando…" />
              : (<><KeyRound size={16} aria-hidden />{token ? "Guardar contraseña" : "Enviar enlace"}</>)}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
