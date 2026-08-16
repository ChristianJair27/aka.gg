// src/pages/Dashboard.tsx — panel del usuario, lenguaje "vision" ATAK:
// glass sobre degradado crimson, stat-cards con cuadrado de icono, gauge de
// winrate y tarjeta de bienvenida con splash. Misma lógica/datos de siempre.
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth, syncAuthFromStorage } from "@/features/auth/useAuth";
import {
  User as UserIcon,
  Trophy,
  Users,
  BarChart3,
  Calendar,
  Target,
  Award,
  ArrowRight,
  LayoutDashboard,
  CalendarClock,
  Activity,
} from "lucide-react";
import { DailySchedulesAdmin } from "@/components/DailySchedulesAdmin";
import { axiosInstance } from "@/lib/axios";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/Tip";
import { useQueryClient } from "@tanstack/react-query";
import { useOverview } from "@/hooks/queries/players";
import { useTournaments } from "@/hooks/queries/tournaments";
import { qk } from "@/hooks/queries/keys";
import { TournamentDashboardPanel } from "@/components/TournamentDashboardPanel";
import { dd } from "@/lib/dataDragon";
import "@/styles/vision.css";

// ─── Brand tokens ────────────────────────────────────────────────────────────
const C = {
  red: "#e1242e",
  win: "#2fbf8a",
  loss: "#ff5a64",
  gold: "#c8aa6e",
};
const FONT_BODY = "'Saira', system-ui, sans-serif";
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

const RISE_IN = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

function Card({
  children, className = "", style, delay = 0, hover = false,
}: {
  children: React.ReactNode; className?: string; style?: React.CSSProperties;
  delay?: number; hover?: boolean;
}) {
  return (
    <motion.div
      initial={RISE_IN.initial}
      whileInView={RISE_IN.whileInView}
      viewport={RISE_IN.viewport}
      transition={{ ...RISE_IN.transition, delay }}
      className={`vs-card ${hover ? "vs-card--hover" : ""} ${className}`}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function CardTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{
        fontFamily: FONT_COND, fontWeight: 700, fontSize: 16,
        color: "#fff", margin: 0, letterSpacing: "0.02em",
      }}>
        {children}
      </h2>
      {sub && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.42)" }}>{sub}</p>}
    </div>
  );
}

// ─── Gauge circular (winrate) ────────────────────────────────────────────────
function Gauge({ pct, label, sub }: { pct: number; label: string; sub?: string }) {
  const p = Math.max(0, Math.min(100, pct));
  const R = 62;
  const CIRC = 2 * Math.PI * R;
  // Arco de 270° (como el medidor de la referencia), empezando abajo-izquierda.
  const SPAN = 0.75;
  const good = p >= 50;
  return (
    <div style={{ position: "relative", width: 168, height: 168, margin: "0 auto" }}>
      <svg width="168" height="168" viewBox="0 0 168 168" style={{ transform: "rotate(135deg)" }}>
        <defs>
          <linearGradient id="vs-gauge" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={good ? "#2fbf8a" : "#e1242e"} />
            <stop offset="100%" stopColor={good ? "#c8aa6e" : "#ff5a64"} />
          </linearGradient>
        </defs>
        <circle cx="84" cy="84" r={R} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10"
          strokeLinecap="round" strokeDasharray={`${CIRC * SPAN} ${CIRC}`} />
        <circle cx="84" cy="84" r={R} fill="none" stroke="url(#vs-gauge)" strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${CIRC * SPAN * (p / 100)} ${CIRC}`}
          style={{ transition: "stroke-dasharray 1s cubic-bezier(0.22,1,0.36,1)" }} />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", textAlign: "center",
      }}>
        <span style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 34, color: "#fff", lineHeight: 1 }}>
          {label}
        </span>
        {sub && <span style={{ fontSize: 10.5, color: "rgba(255,255,255,0.4)", marginTop: 4, maxWidth: 110 }}>{sub}</span>}
      </div>
    </div>
  );
}

// ==== helpers ====
function b64urlToJson<T = any>(s: string): T {
  const normalized = s.replace(/-/g, "+").replace(/_/g, "/");
  const json = atob(normalized);
  return JSON.parse(json);
}

type OverviewResponse = {
  ok: boolean;
  linked: boolean;
  profile?: {
    gameName?: string; tagLine?: string; platform?: string;
    puuid?: string; profileIcon?: number | null;
  };
  stats?: {
    totalMatches?: number; winRate?: number; currentRank?: string | null;
    lp?: number | null; favoriteChampion?: string | null;
    tournamentsJoined?: number; socialPosts?: number;
  };
  recent?: Array<{ win?: boolean; queueName?: string; championName?: string; duration?: number }>;
};

const regions = ["la1", "la2", "na1", "br1", "oc1", "euw1", "eun1", "kr", "jp1", "ru", "tr1"];

// ─── Sidebar de administración ───────────────────────────────────────────────
type DashSection = "resumen" | "torneos" | "actividad" | "diarios";

const SIDE_ITEMS: Array<{ key: DashSection; label: string; sub: string; Icon: typeof Trophy; adminOnly?: boolean }> = [
  { key: "resumen",   label: "Resumen",        sub: "Stats y perfil",        Icon: LayoutDashboard },
  { key: "torneos",   label: "Mis torneos",    sub: "Equipos e invitaciones", Icon: Trophy },
  { key: "actividad", label: "Actividad",      sub: "Partidas y accesos",     Icon: Activity },
  { key: "diarios",   label: "Torneos diarios", sub: "Plantillas automáticas", Icon: CalendarClock, adminOnly: true },
];

function DashSidebar({
  section, onSelect, isAdmin,
}: { section: DashSection; onSelect: (s: DashSection) => void; isAdmin: boolean }) {
  const items = SIDE_ITEMS.filter(i => !i.adminOnly || isAdmin);
  return (
    <>
      {/* Desktop: columna sticky con stagger de entrada */}
      <motion.aside
        className="dash-side vs-card"
        initial={{ opacity: 0, x: -24 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ padding: 12 }}
      >
        <p className="vs-over" style={{ margin: "6px 10px 10px" }}>Administración</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {items.map((it, i) => {
            const active = section === it.key;
            return (
              <motion.button
                key={it.key}
                onClick={() => onSelect(it.key)}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + i * 0.06, duration: 0.35, ease: "easeOut" }}
                whileHover={{ x: 3 }}
                style={{
                  position: "relative", display: "flex", alignItems: "center", gap: 12,
                  padding: "11px 12px", borderRadius: 12, border: "none", cursor: "pointer",
                  textAlign: "left", width: "100%",
                  background: active ? "rgba(225,36,46,0.12)" : "transparent",
                  transition: "background 0.25s ease",
                }}
              >
                {active && (
                  <motion.span
                    layoutId="dash-side-ind"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    style={{
                      position: "absolute", left: 0, top: 8, bottom: 8, width: 3,
                      borderRadius: 4, background: C.red,
                      boxShadow: "0 0 12px rgba(225,36,46,0.7)",
                    }}
                  />
                )}
                <span className="vs-ico" style={{
                  width: 36, height: 36,
                  color: active ? "#ff8a90" : undefined,
                  borderColor: active ? "rgba(225,36,46,0.4)" : undefined,
                }}>
                  <it.Icon size={16} />
                </span>
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: FONT_COND, fontWeight: 700, fontSize: 14.5, color: active ? "#fff" : "rgba(255,255,255,0.75)" }}>
                    {it.label}
                  </span>
                  <span style={{ display: "block", fontSize: 11, color: "rgba(255,255,255,0.38)" }}>{it.sub}</span>
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.aside>

      {/* Móvil: pills horizontales */}
      <div className="dash-side-m">
        {items.map(it => {
          const active = section === it.key;
          return (
            <button key={it.key} onClick={() => onSelect(it.key)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
                padding: "9px 14px", borderRadius: 999, fontSize: 13, fontWeight: 700, cursor: "pointer",
                color: active ? "#fff" : "rgba(255,255,255,0.55)",
                background: active ? "rgba(225,36,46,0.2)" : "rgba(255,255,255,0.05)",
                border: `1px solid ${active ? "rgba(225,36,46,0.5)" : "rgba(255,255,255,0.09)"}`,
                transition: "all 0.25s ease",
              }}>
              <it.Icon size={13} /> {it.label}
            </button>
          );
        })}
      </div>
    </>
  );
}

const SECTION_ANIM = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

const Dashboard = () => {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [section, setSection] = useState<DashSection>("resumen");

  // ===== estado de overview / link =====
  const overviewQ = useOverview();
  const overview = (overviewQ.data ?? null) as OverviewResponse | null;
  const loading = overviewQ.isLoading;
  const [err, setErr] = useState("");

  const [riotId, setRiotId] = useState("");
  const [platform, setPlatform] = useState("la1");
  const [linking, setLinking] = useState(false);

  // ===== próximo torneo (reusa el cache de /api/tournaments) =====
  const { data: tournaments = [] } = useTournaments();
  const nextT = useMemo(() => {
    const list: any[] = Array.isArray(tournaments) ? tournaments : [];
    const upcoming = list
      .filter((t) => t.phase === "registration" || t.phase === "checkin")
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    return upcoming[0] ?? list.find((t) => t.phase === "active") ?? null;
  }, [tournaments]);

  // ===== procesa payload OAuth (cuando vuelves de Google) =====
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const p = params.get("payload");
    if (!p) return;
    try {
      const { token, user: u } = b64urlToJson<{ token: string; user: any }>(p);
      localStorage.setItem("access_token", token);
      localStorage.setItem("user", JSON.stringify(u));
      params.delete("payload");
      const clean = `${location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
      window.history.replaceState({}, "", clean);
      // Notifica al store de auth: navbar y demás se actualizan sin recargar.
      syncAuthFromStorage();
    } catch {
      navigate("/login?error=oauth", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== vincular cuenta =====
  const qc = useQueryClient();
  const linkAccount = async () => {
    setLinking(true);
    setErr("");
    try {
      await axiosInstance.post("/api/players/link", { riotId, platform });
      await qc.invalidateQueries({ queryKey: qk.overview() });
    } catch (e: any) {
      setErr(e?.response?.data?.msg || "No se pudo vincular la cuenta");
    } finally {
      setLinking(false);
    }
  };

  useEffect(() => {
    if (overviewQ.error) {
      setErr((overviewQ.error as any)?.response?.data?.msg || "Error cargando overview");
    }
  }, [overviewQ.error]);

  const inputStyle: React.CSSProperties = {
    width: "100%", height: 44, padding: "0 16px",
    background: "rgba(0,0,0,0.35)", border: "1px solid rgba(255,255,255,0.10)",
    borderRadius: 12, color: "#fff", fontFamily: FONT_BODY, fontSize: 14, outline: "none",
  };

  // ===== loading =====
  if (loading) {
    return (
      <div className="vs-page" style={{ fontFamily: FONT_BODY }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "92px 20px 80px" }}>
          <div className="vs-grid">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="vs-card vs-col-3" style={{ padding: 20 }}>
                <Skeleton width="55%" height={12} />
                <div style={{ marginTop: 10 }}><Skeleton width="40%" height={24} /></div>
              </div>
            ))}
            <div className="vs-card vs-col-5" style={{ padding: 24, minHeight: 260 }}>
              <Skeleton width={200} height={20} />
              <div style={{ marginTop: 14 }}><Skeleton width="70%" height={14} /></div>
            </div>
            <div className="vs-card vs-col-3" style={{ padding: 24, minHeight: 260 }}>
              <Skeleton variant="circle" width={140} height={140} style={{ margin: "20px auto" }} />
            </div>
            <div className="vs-card vs-col-4" style={{ padding: 24, minHeight: 260 }}>
              <Skeleton variant="circle" width={64} height={64} style={{ margin: "0 auto 14px" }} />
              <Skeleton height={14} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== CTA de vinculación =====
  if (!overview?.linked) {
    return (
      <div className="vs-page" style={{ fontFamily: FONT_BODY }}>
        <div style={{ maxWidth: 620, margin: "0 auto", padding: "110px 20px 80px" }}>
          <Card style={{ padding: 32 }}>
            <CardTitle sub="Para mostrar tus estadísticas reales en ATAK.GG">
              Vincula tu cuenta de League of Legends
            </CardTitle>
            <div style={{ display: "grid", gap: 16, marginTop: 8 }}>
              <div>
                <label className="vs-over" style={{ display: "block", marginBottom: 7 }}>
                  Riot ID (GameName#TAG)
                </label>
                <input placeholder="Kister#IZPZ" value={riotId}
                  onChange={(e) => setRiotId(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label className="vs-over" style={{ display: "block", marginBottom: 7 }}>Región</label>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} style={inputStyle}>
                  {regions.map((r) => (
                    <option key={r} value={r} style={{ background: "#101014" }}>{r.toUpperCase()}</option>
                  ))}
                </select>
              </div>
              {err && <div style={{ fontSize: 13, color: C.loss }}>{err}</div>}
              <button className="vs-btn" onClick={linkAccount} disabled={!riotId || linking} style={{ width: "100%" }}>
                {linking ? "Vinculando…" : "Vincular cuenta"}
              </button>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ===== datos reales =====
  const s = overview?.stats ?? {};
  const recent = overview?.recent ?? [];
  const wr = s.winRate ?? 0;
  const favChamp = s.favoriteChampion || "Katarina";

  const statCards = [
    { label: "Partidas recientes", value: `${s.totalMatches ?? 0}`, icon: <BarChart3 size={20} />, ico: "", tip: "Partidas analizadas recientemente" },
    { label: "Win rate", value: `${wr}%`, delta: wr >= 50 ? "en forma" : "a remontar", deltaColor: wr >= 50 ? C.win : C.loss, icon: <Target size={20} />, ico: "", tip: "Porcentaje de victorias en tus partidas recientes" },
    { label: "Rango actual", value: s.currentRank ?? "—", delta: s.lp != null ? `${s.lp} LP` : undefined, deltaColor: C.gold, icon: <Award size={20} />, ico: "vs-ico--gold", tip: "Tu rango en clasificatoria" },
    { label: "Torneos", value: `${s.tournamentsJoined ?? 0}`, icon: <Trophy size={20} />, ico: "", tip: "Torneos en los que has participado" },
  ];

  const quickActions = [
    { to: "/stats", icon: <BarChart3 size={22} />, title: "Ver Stats", desc: "Revisa tus estadísticas" },
    { to: "/tournaments", icon: <Trophy size={22} />, title: "Torneos", desc: "Únete a competencias" },
    { to: "/social", icon: <Users size={22} />, title: "Social", desc: "Conecta con otros" },
  ];

  const resumen = (
    <div className="vs-grid">
      {/* ── Fila 1: stat cards ── */}
      {statCards.map((c, i) => (
            <Card key={c.label} delay={i * 0.05} hover className="vs-col-3" style={{ padding: "16px 18px" }}>
              <Tip label={c.tip}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <p className="vs-over" style={{ margin: 0 }}>{c.label}</p>
                    <p style={{
                      margin: "5px 0 0", fontFamily: FONT_COND, fontWeight: 800, fontSize: 24,
                      color: "#fff", lineHeight: 1.05,
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.value}
                      {c.delta && (
                        <span style={{ fontSize: 12.5, fontWeight: 700, color: c.deltaColor, marginLeft: 8 }}>
                          {c.delta}
                        </span>
                      )}
                    </p>
                  </div>
                  <span className={`vs-ico ${c.ico}`}>{c.icon}</span>
                </div>
              </Tip>
            </Card>
          ))}

          {/* ── Fila 2: bienvenida + gauge + perfil ── */}
          <Card className="vs-col-5" style={{ position: "relative", overflow: "hidden", minHeight: 280, padding: 0 }}>
            <img
              src={dd.championSplash(favChamp)} alt="" loading="lazy"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 20%" }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <div style={{
              position: "absolute", inset: 0,
              background: "linear-gradient(105deg, rgba(10,7,9,0.92) 20%, rgba(10,7,9,0.55) 55%, rgba(10,7,9,0.25))",
            }} />
            <div style={{
              position: "relative", height: "100%", minHeight: 280, padding: 26,
              display: "flex", flexDirection: "column", justifyContent: "space-between",
            }}>
              <div>
                <p className="vs-over" style={{ margin: 0 }}>Bienvenido de vuelta,</p>
                <h1 style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 32, color: "#fff", margin: "6px 0 8px", lineHeight: 1.05 }}>
                  {user?.name || "Invocador"}
                </h1>
                <p style={{ margin: 0, fontSize: 13.5, color: "rgba(255,255,255,0.65)", maxWidth: 300 }}>
                  {overview?.profile?.gameName
                    ? `${overview.profile.gameName}#${overview.profile.tagLine} · ${overview.profile.platform?.toUpperCase()}`
                    : "Tu resumen de actividad y estadísticas"}
                </p>
              </div>
              <Link
                to={overview?.profile?.gameName
                  ? `/stats/${overview.profile.platform || "la1"}/${encodeURIComponent(`${overview.profile.gameName}#${overview.profile.tagLine}`)}`
                  : "/stats"}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 7, textDecoration: "none",
                  fontSize: 13.5, fontWeight: 700, color: "#fff",
                }}
              >
                Ver mi perfil completo <ArrowRight size={15} />
              </Link>
            </div>
          </Card>

          <Card className="vs-col-3" delay={0.06} style={{ padding: 24, display: "flex", flexDirection: "column" }}>
            <CardTitle sub="De tus partidas recientes">Win rate</CardTitle>
            <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
              <Gauge pct={wr} label={`${wr}%`} sub={`sobre ${s.totalMatches ?? 0} partidas`} />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
              <span>0%</span><span>100%</span>
            </div>
          </Card>

          <Card className="vs-col-4" delay={0.1} style={{ padding: 24 }}>
            <CardTitle>Mi perfil</CardTitle>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              {overview?.profile?.profileIcon ? (
                <img
                  src={dd.profileIcon(overview.profile.profileIcon)} alt=""
                  style={{ width: 58, height: 58, borderRadius: 14, objectFit: "cover", boxShadow: "0 0 0 2px rgba(225,36,46,0.45)" }}
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }}
                />
              ) : (
                <div style={{
                  width: 58, height: 58, borderRadius: 14, display: "grid", placeItems: "center",
                  background: `linear-gradient(135deg, ${C.red}, #3b0000)`,
                }}>
                  <span style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 22, color: "#fff" }}>
                    {user?.name?.[0]?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <h3 style={{ margin: 0, fontFamily: FONT_COND, fontWeight: 700, fontSize: 17, color: "#fff" }}>
                  {user?.name || "Usuario"}
                </h3>
                <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "rgba(255,255,255,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user?.email}
                </p>
                {overview?.profile?.gameName && (
                  <p style={{ margin: "3px 0 0", fontSize: 12, color: C.gold }}>
                    {overview.profile.gameName}#{overview.profile.tagLine}
                  </p>
                )}
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 11, fontSize: 13.5 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>Campeón favorito</span>
                <span style={{ fontWeight: 600, color: "#fff", display: "inline-flex", alignItems: "center", gap: 7 }}>
                  {s.favoriteChampion && (
                    <img src={dd.champion(s.favoriteChampion)} alt="" style={{ width: 20, height: 20, borderRadius: 6, objectFit: "cover" }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  )}
                  {s.favoriteChampion ?? "—"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>Publicaciones</span>
                <span style={{ fontWeight: 600, color: "#fff" }}>{s.socialPosts ?? 0}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "rgba(255,255,255,0.55)" }}>Región</span>
                <span style={{ fontWeight: 600, color: "#fff" }}>{overview?.profile?.platform?.toUpperCase() ?? "—"}</span>
              </div>
            </div>

            <button className="vs-btn vs-btn--ghost" style={{ width: "100%", marginTop: 18, height: 40, fontSize: 13.5 }}>
              Editar perfil
            </button>
          </Card>
    </div>
  );

  const torneos = (
    <div className="vs-grid">
      {/* Panel de torneos existente (equipos, invitaciones, administrando) */}
      <div className="vs-col-12">
        <TournamentDashboardPanel />
      </div>
      <Card className="vs-col-4" style={{ padding: 24 }}>
        <CardTitle>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
            <Calendar size={15} color={C.gold} /> Próximo torneo
          </span>
        </CardTitle>
        {nextT ? (
          <div onClick={() => navigate(`/tournaments/${nextT.id}`)} style={{ cursor: "pointer" }}>
            <div style={{ fontFamily: FONT_COND, fontWeight: 700, fontSize: 18, color: "#fff", lineHeight: 1.15, marginBottom: 8 }}>
              {nextT.name}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12.5, color: "rgba(255,255,255,0.6)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                <Calendar size={13} />
                {new Date(nextT.startDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              {nextT.prize ? <span style={{ color: C.gold }}>🏆 {nextT.prize}</span> : null}
            </div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="vs-over" style={{ color: nextT.phase === "active" ? C.win : C.gold }}>
                {nextT.phase === "registration" ? "Inscripciones" : nextT.phase === "checkin" ? "Check-in" : "En curso"}
              </span>
              <span style={{ fontSize: 12.5, color: C.red, fontWeight: 700 }}>Ver →</span>
            </div>
          </div>
        ) : (
          <p style={{ textAlign: "center", fontSize: 13.5, color: "rgba(255,255,255,0.45)", margin: "16px 0" }}>
            No hay torneos próximos
          </p>
        )}
      </Card>
    </div>
  );

  const actividad = (
    <div className="vs-grid">
          <Card className="vs-col-4" style={{ padding: 24 }}>
            <CardTitle sub="Accede a las funciones principales">Acciones rápidas</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {quickActions.map((a) => (
                <Link key={a.to} to={a.to} style={{ textDecoration: "none" }}>
                  <div className="vs-row">
                    <span className="vs-ico" style={{ width: 40, height: 40 }}>{a.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ margin: 0, fontFamily: FONT_COND, fontWeight: 700, fontSize: 15, color: "#fff" }}>{a.title}</p>
                      <p style={{ margin: 0, fontSize: 12, color: "rgba(255,255,255,0.45)" }}>{a.desc}</p>
                    </div>
                    <ArrowRight size={15} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.35)", flexShrink: 0 }} />
                  </div>
                </Link>
              ))}
            </div>
          </Card>

          <Card className="vs-col-5" delay={0.05} style={{ padding: 24 }}>
            <CardTitle sub="Últimas partidas">Actividad reciente</CardTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {!recent || recent.length === 0 ? (
                <p style={{ fontSize: 13.5, color: "rgba(255,255,255,0.45)" }}>No hay partidas recientes.</p>
              ) : (
                recent.map((m, index) => (
                  <div key={index} className="vs-row" style={{ boxShadow: `inset 3px 0 0 ${m.win ? C.win : C.loss}` }}>
                    {m.championName ? (
                      <img src={dd.champion(m.championName)} alt="" loading="lazy"
                        style={{ width: 34, height: 34, borderRadius: 10, objectFit: "cover", flexShrink: 0 }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
                    ) : (
                      <span className="vs-ico vs-ico--dim" style={{ width: 34, height: 34 }}><Target size={15} /></span>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, color: "#fff" }}>
                        {m.championName ?? "?"} · {m.queueName ?? "Partida"}
                      </p>
                      <p style={{ margin: "1px 0 0", fontSize: 12, color: "rgba(255,255,255,0.5)" }}>
                        <span style={{ color: m.win ? C.win : C.loss, fontWeight: 700 }}>
                          {m.win ? "Victoria" : "Derrota"}
                        </span>{" "}
                        · {m.duration ? Math.round(m.duration / 60) : 0} min
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
    </div>
  );

  const isAdmin = (user as any)?.role === "admin";

  return (
    <div className="vs-page" style={{ fontFamily: FONT_BODY, lineHeight: 1.5 }}>
      <div style={{ maxWidth: 1320, margin: "0 auto", padding: "92px 20px 80px" }}>
        <div className="dash-shell">
          <DashSidebar section={section} onSelect={setSection} isAdmin={isAdmin} />

          <div style={{ minWidth: 0 }}>
            <AnimatePresence mode="wait">
              <motion.div key={section} {...SECTION_ANIM}>
                {section === "resumen" && resumen}
                {section === "torneos" && torneos}
                {section === "actividad" && actividad}
                {section === "diarios" && isAdmin && <DailySchedulesAdmin />}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {err && <div style={{ fontSize: 13, color: C.loss, marginTop: 22 }}>{err}</div>}
      </div>

      {/* Responsive del shell: sidebar sticky en desktop, pills arriba en móvil */}
      <style>{`
        .dash-shell { display: grid; grid-template-columns: 236px minmax(0, 1fr); gap: 20px; align-items: start; }
        .dash-side { position: sticky; top: 92px; }
        .dash-side-m { display: none; }
        @media (max-width: 900px) {
          .dash-shell { grid-template-columns: 1fr; }
          .dash-side { display: none; }
          .dash-side-m {
            display: flex; gap: 8px; overflow-x: auto; padding-bottom: 6px;
            -webkit-overflow-scrolling: touch; scrollbar-width: none;
          }
          .dash-side-m::-webkit-scrollbar { display: none; }
        }
      `}</style>
    </div>
  );
};

export default Dashboard;
