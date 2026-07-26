// src/pages/ForgotPassword.tsx — solicitar enlace + restablecer (misma página
// maneja ambos: /forgot-password y /reset-password?token=...)
import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Loader2, MailCheck, KeyRound } from "lucide-react";
import { axiosInstance } from "@/lib/axios";
import { ScrollVideoBg } from "@/components/ScrollVideoBg";
import { DaggerLogo } from "@/components/DaggerLogo";

const inputCls =
  "w-full h-11 px-3.5 rounded-xl bg-white/[0.04] border border-white/[0.10] text-white text-sm " +
  "placeholder:text-gray-600 outline-none transition focus:border-red-500/60 focus:bg-white/[0.06]";

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
    } catch (err: any) {
      setError(err?.response?.data?.msg || "Algo salió mal. Intenta de nuevo.");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-black relative overflow-hidden">
      <ScrollVideoBg peakOpacity={0.55} floorOpacity={0.55} />
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }} className="relative w-full max-w-md">
        <div className="relative rounded-2xl p-8 shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
          style={{ background: 'linear-gradient(180deg, rgba(16,16,20,0.78) 0%, rgba(10,10,13,0.62) 100%)' }}>
          <div className="absolute inset-x-8 top-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(239,68,68,0.55) 35%, rgba(200,170,110,0.6) 65%, transparent)' }} />

          <div className="text-center mb-7">
            <DaggerLogo className="mx-auto mb-3 h-14 w-14 drop-shadow-[0_0_18px_rgba(239,68,68,0.5)]" />
            <h1 className="font-serif text-3xl tracking-wide text-white">
              {token ? "Nueva contraseña" : "Recuperar acceso"}
            </h1>
            <p className="text-sm text-gray-400 mt-1.5">
              {token ? "Elige tu nueva contraseña" : "Te enviamos un enlace a tu correo"}
            </p>
          </div>

          {done ? (
            <div className="text-center py-4">
              <MailCheck className="h-10 w-10 text-green-400 mx-auto mb-3" />
              <p className="text-sm text-gray-300">
                {token ? "Contraseña actualizada. Redirigiendo al login…" : "Si el correo existe, recibirás el enlace en unos minutos. Revisa spam."}
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              {token ? (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Nueva contraseña</label>
                  <input type="password" autoComplete="new-password" placeholder="mínimo 6 caracteres"
                    minLength={6} required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-gray-400">Email</label>
                  <input type="email" autoComplete="email" placeholder="tu@email.com"
                    required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
                </div>
              )}

              {error && <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">{error}</div>}

              <button type="submit" disabled={busy}
                className="w-full h-11 rounded-xl flex items-center justify-center gap-2 text-sm font-bold text-white
                  bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600
                  shadow-[0_4px_16px_rgba(225,36,46,0.25)] transition disabled:opacity-50">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><KeyRound className="h-4 w-4" />{token ? "Guardar contraseña" : "Enviar enlace"}</>)}
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-sm text-gray-500">
            <Link to="/login" className="text-red-400 hover:text-red-300 font-semibold">Volver al inicio de sesión</Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
