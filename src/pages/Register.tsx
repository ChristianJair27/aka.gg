// src/pages/Register.tsx — registro de ATAK.GG (rediseño "Arena", espejo del Login).
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useAuth } from "@/features/auth/useAuth";
import { AuthShell, OAuthButtons } from "@/components/arena/AuthShell";
import "@/styles/pages/auth.css";

const registerSchema = z.object({
  name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
});
type RegisterFormData = z.infer<typeof registerSchema>;

const API_BASE = (import.meta.env.VITE_API_URL ?? "http://localhost:4000").replace(/\/$/, "");

const Register = () => {
  const navigate = useNavigate();
  const { register: registerUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const location = useLocation();
  const { register, handleSubmit, formState: { errors } } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError("");
    try {
      await registerUser(data);
      setSuccess(true);
      // Arrastramos el `from` hasta /login, que ya sabe honrarlo. Sin esto,
      // quien llega desde el formulario de la portada se registra y aterriza
      // en el dashboard, con su borrador de torneo olvidado.
      setTimeout(() => navigate("/login", { state: location.state }), 1800);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      setError(err?.response?.data?.msg || err?.response?.data?.message || "Error al crear la cuenta");
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogle = () => { window.location.href = `${API_BASE}/auth/google`; };
  const onRiot = () => { window.location.href = `${API_BASE}/auth/riot`; };

  // Éxito: tarjeta simple centrada (no hace falta el escenario).
  if (success) {
    return (
      <AuthShell compact title="¡Cuenta creada!" subtitle="Te llevamos al inicio de sesión…">
        <div className="au-done" role="status">
          <CheckCircle2 size={44} aria-hidden />
          <Loader2 size={20} className="au-spin" aria-hidden style={{ color: 'var(--td-text-2)' }} />
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Gratis. Organiza torneos, guarda tu perfil y recibe tus stats."
      stageKicker="Tu ascenso empieza aquí"
      stageTitle={<>Únete a <em>ATAK</em></>}
      footer={<>¿Ya tienes una cuenta? <Link to="/login" className="ax-link">Inicia sesión</Link></>}
    >
      <OAuthButtons riotLabel="Registrarse con Riot" onRiot={onRiot} onGoogle={onGoogle} disabled={isLoading} />

      <form onSubmit={handleSubmit(onSubmit)} className="au-form" noValidate>
        <div className="td-field">
          <label htmlFor="name" className="td-label">Nombre</label>
          <input id="name" type="text" autoComplete="name" placeholder="Tu nombre" className="td-input"
            aria-invalid={!!errors.name} aria-describedby={errors.name ? "name-err" : undefined} {...register("name")} />
          {errors.name && <p id="name-err" className="td-error" role="alert">{errors.name.message}</p>}
        </div>
        <div className="td-field">
          <label htmlFor="email" className="td-label">Email</label>
          <input id="email" type="email" autoComplete="email" placeholder="tu@email.com" className="td-input"
            aria-invalid={!!errors.email} aria-describedby={errors.email ? "email-err" : undefined} {...register("email")} />
          {errors.email && <p id="email-err" className="td-error" role="alert">{errors.email.message}</p>}
        </div>
        <div className="td-field">
          <label htmlFor="password" className="td-label">Contraseña</label>
          <input id="password" type="password" autoComplete="new-password" placeholder="••••••••" className="td-input"
            aria-invalid={!!errors.password} aria-describedby={errors.password ? "password-err" : "password-help"} {...register("password")} />
          {errors.password
            ? <p id="password-err" className="td-error" role="alert">{errors.password.message}</p>
            : <p id="password-help" className="td-help">Mínimo 6 caracteres.</p>}
        </div>

        {error && <div className="au-alert" role="alert">{error}</div>}

        <button type="submit" disabled={isLoading} className="td-btn td-btn--primary" data-full="true">
          {isLoading ? <Loader2 size={18} className="au-spin" aria-label="Creando cuenta…" /> : "Crear cuenta"}
        </button>
      </form>
    </AuthShell>
  );
};

export default Register;
