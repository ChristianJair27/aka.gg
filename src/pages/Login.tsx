// src/pages/Login.tsx — inicio de sesión de ATAK.GG (rediseño "Arena").
import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { AuthShell, OAuthButtons } from "@/components/arena/AuthShell";
import "@/styles/pages/auth.css";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
type LoginFormData = z.infer<typeof loginSchema>;

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

// OAuth redirect errors → friendly Spanish copy
const OAUTH_ERRORS: Record<string, string> = {
  google: "No se pudo iniciar sesión con Google. Intenta de nuevo.",
  rso: "No se pudo iniciar sesión con Riot. Intenta de nuevo.",
  rso_state: "Sesión de Riot expirada (state). Vuelve a intentarlo.",
  rso_token: "Riot no devolvió el token. Intenta de nuevo.",
  rso_nopuuid: "No se pudo leer tu cuenta de Riot.",
  oauth: "Error de autenticación. Intenta de nuevo.",
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [remember, setRemember] = useState(true);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const from = (location.state as any)?.from?.pathname || "/dashboard";

  // Surface OAuth redirect errors (?error=google|rso|…)
  useEffect(() => {
    const code = new URLSearchParams(location.search).get("error");
    if (code) setError(OAUTH_ERRORS[code] ?? "Error de autenticación.");
  }, [location.search]);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError("");
    try {
      await login(data);
      // "Recordar sesión": si se desmarca, la sesión muere al cerrar el navegador
      // (axios.ts limpia el token cuando el flag existe sin sessionStorage vivo).
      if (!remember) {
        localStorage.setItem('atak_session_only', '1');
        sessionStorage.setItem('atak_session_alive', '1');
      } else {
        localStorage.removeItem('atak_session_only');
      }
      navigate(from, { replace: true });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.response?.data?.msg || err?.response?.data?.message || "Credenciales inválidas");
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogle = () => { window.location.href = `${API_BASE}/auth/google`; };
  const onRiot = () => { window.location.href = `${API_BASE}/auth/riot`; };

  return (
    <AuthShell
      title="Inicia sesión"
      subtitle="Tu dashboard, tus torneos y tu perfil te esperan."
      stageKicker="Forjado en la Grieta"
      stageTitle={<>El arsenal <em>ATAK</em></>}
      footer={<>¿No tienes una cuenta? <Link to="/register" className="ax-link">Regístrate</Link></>}
    >
      <OAuthButtons riotLabel="Iniciar sesión con Riot" onRiot={onRiot} onGoogle={onGoogle} disabled={isLoading} />

      <form onSubmit={handleSubmit(onSubmit)} className="au-form" noValidate>
        <div className="td-field">
          <label htmlFor="email" className="td-label">Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="tu@email.com" className="td-input"
            aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} {...register("email")} />
          {errors.email && <p id="email-err" className="td-error" role="alert">{errors.email.message}</p>}
        </div>

        <div className="td-field">
          <label htmlFor="password" className="td-label">Contraseña</label>
          <input id="password" type="password" autoComplete="current-password" placeholder="••••••••" className="td-input"
            aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-err" : undefined} {...register("password")} />
          {errors.password && <p id="password-err" className="td-error" role="alert">{errors.password.message}</p>}
        </div>

        <div className="au-row">
          <label className="au-check">
            <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Recordar sesión
          </label>
          <Link to="/forgot-password" className="ax-link">¿Olvidaste tu contraseña?</Link>
        </div>

        {error && <div className="au-alert" role="alert">{error}</div>}

        <button type="submit" disabled={isLoading} className="td-btn td-btn--primary" data-full="true">
          {isLoading ? <Loader2 size={18} className="au-spin" aria-label="Entrando…" /> : "Iniciar sesión"}
        </button>
      </form>
    </AuthShell>
  );
}
