// src/pages/Dashboard.tsx — panel del usuario (sistema "Arena").
// Héroe con el campeón principal del jugador (splash + modelo 3D), tira de
// métricas y pestañas. Misma lógica y datos de siempre: solo cambia la capa
// visual (ver design-system/atak-gg/MASTER.md).
import { TdSelect } from '@/components/ui/td-select';
import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, syncAuthFromStorage } from "@/features/auth/useAuth";
import {
  Trophy,
  Users,
  BarChart3,
  Calendar,
  Target,
  ArrowRight,
  LayoutDashboard,
  CalendarClock,
  Activity,
  Clock,
  UserRound,
  Zap,
} from "lucide-react";
import { DailySchedulesAdmin } from "@/components/DailySchedulesAdmin";
import { axiosInstance } from "@/lib/axios";
import { toast } from "sonner";
import { REGIONS, regionLabel } from "@/lib/regions";
import { fixMojibakeUtf8, b64urlToJsonUtf8, repairStoredUserName } from "@/lib/utf8";
import { Skeleton } from "@/components/ui/skeleton";
import { Tip } from "@/components/ui/Tip";
import { useQueryClient } from "@tanstack/react-query";
import { useOverview } from "@/hooks/queries/players";
import { useTournaments } from "@/hooks/queries/tournaments";
import { useChampions } from "@/hooks/use-ddragon";
import { qk } from "@/hooks/queries/keys";
import { TournamentDashboardPanel } from "@/components/TournamentDashboardPanel";
import { dd } from "@/lib/dataDragon";
import {
  ArenaPage, SplashBackdrop, PageHero, Champion3D, Button, StatusChip, SectionHead, ProgressBar,
  ChampIcon, lol, mapArtFor,
} from "@/components/arena";
import "@/styles/pages/dashboard.css";

// ==== helpers ====
// Antes: `JSON.parse(atob(...))`. `atob` devuelve Latin-1, así que un nombre
// UTF-8 como "Osvaldo Pérez Ochoa" se guardaba como "Osvaldo PÃ©rez Ochoa".
// El decodificador correcto vive en src/lib/utf8.ts.
const b64urlToJson = b64urlToJsonUtf8;

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

// Las regiones viven en src/lib/regions.ts: el <select> envía el platform id
// ("la1") pero muestra la etiqueta que usa la gente ("LAN").

// ─── Pestañas del panel ──────────────────────────────────────────────────────
type DashSection = "resumen" | "torneos" | "actividad" | "diarios";

const TABS: Array<{ key: DashSection; label: string; Icon: typeof Trophy; adminOnly?: boolean }> = [
  { key: "resumen",   label: "Resumen",         Icon: LayoutDashboard },
  { key: "torneos",   label: "Mis torneos",     Icon: Trophy },
  { key: "actividad", label: "Actividad",       Icon: Activity },
  { key: "diarios",   label: "Torneos diarios", Icon: CalendarClock, adminOnly: true },
];

function DashTabs({
  section, onSelect, isAdmin,
}: { section: DashSection; onSelect: (s: DashSection) => void; isAdmin: boolean }) {
  const items = TABS.filter((i) => !i.adminOnly || isAdmin);
  return (
    <div className="db-tabs">
      <div className="ax-tabs" role="tablist" aria-label="Secciones de tu panel">
        {items.map((it) => {
          const active = section === it.key;
          return (
            <button key={it.key} type="button" role="tab" id={`db-tab-${it.key}`}
              className="ax-tab" data-active={active} aria-selected={active}
              onClick={() => onSelect(it.key)}>
              <it.Icon size={17} aria-hidden />
              {it.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Nombre en la display: la última palabra lleva el acento crimson. */
function heroName(name: string) {
  const words = name.trim().split(/\s+/);
  if (words.length < 2) return <em>{name}</em>;
  return <>{words.slice(0, -1).join(" ")} <em>{words[words.length - 1]}</em></>;
}

const PHASE_CHIP = {
  registration: { label: "Inscripciones", kind: "registration" },
  checkin:      { label: "Check-in",      kind: "gold" },
  active:       { label: "En curso",      kind: "live" },
} as const;

const hideImg = (e: React.SyntheticEvent<HTMLImageElement>) => { e.currentTarget.style.display = "none"; };

const Dashboard = () => {
  const { user } = useAuth();
  // Sesiones anteriores quedaron guardadas con el nombre roto por el `atob`
  // viejo: se repara al mostrar (y una vez en localStorage, ya que el
  // decodificador también está arreglado).
  useEffect(() => { repairStoredUserName(); }, []);
  const displayName = fixMojibakeUtf8(user?.name);
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

  // ===== campeón principal → slug de Data Dragon (arte y modelo 3D) =====
  // El overview da el nombre tal cual llega de Riot; Data Dragon usa slugs
  // ("MonkeyKing" para Wukong). Sin campeón no hay arte de campeón ni modelo.
  const champs = useChampions();
  const favRaw = overview?.stats?.favoriteChampion ?? null;
  const favSlug = useMemo(() => {
    if (!favRaw) return null;
    const key = favRaw.replace(/[^a-zA-Z0-9]/g, "");
    const byId = champs.data?.byId;
    if (!byId || byId[key]) return key;
    const low = key.toLowerCase();
    const hit = Object.values(byId).find(
      (c) => c.id.toLowerCase() === low || c.name.toLowerCase() === favRaw.toLowerCase(),
    );
    return hit?.id ?? key;
  }, [favRaw, champs.data]);
  // Nombre localizado del campeón ("Miss Fortune", no "MissFortune") cuando Data Dragon ya cargó.
  const champName = (raw?: string | null) => {
    if (!raw) return raw ?? null;
    return champs.data?.byId[raw.replace(/[^a-zA-Z0-9]/g, "")]?.name ?? raw;
  };

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
  // Enfriamiento tras un 429 de Riot. El cliente NO reintenta solo (una sola
  // petición por click, y queryClient tampoco reintenta 429): el límite lo
  // impone Riot aguas arriba. Lo único útil desde aquí es decirlo claro y
  // bloquear el botón unos segundos para que insistir no lo empeore.
  const [cooldown, setCooldown] = useState(0);
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const linkAccount = async () => {
    if (cooldown > 0) return;
    setLinking(true);
    setErr("");
    try {
      await axiosInstance.post("/api/players/link", { riotId, platform });
      await qc.invalidateQueries({ queryKey: qk.overview() });
    } catch (e: any) {
      if (e?.response?.status === 429) {
        // Retry-After llega en segundos cuando Riot lo manda; si no, 20 s.
        const wait = Number(e?.response?.headers?.["retry-after"]) || 20;
        setCooldown(wait);
        setErr("Riot está limitando peticiones — reintenta en un momento");
        toast.warning("Riot está limitando peticiones — reintenta en un momento");
      } else {
        setErr(e?.response?.data?.msg || "No se pudo vincular la cuenta");
      }
    } finally {
      setLinking(false);
    }
  };

  useEffect(() => {
    if (overviewQ.error) {
      setErr((overviewQ.error as any)?.response?.data?.msg || "Error cargando overview");
    }
  }, [overviewQ.error]);

  // ===== loading =====
  if (loading) {
    return (
      <ArenaPage width="wide" className="db-page">
        <div aria-busy="true" aria-label="Cargando tu panel">
          <Skeleton width={180} height={14} />
          <div style={{ marginTop: 16 }}><Skeleton width="min(520px, 80%)" height={64} /></div>
          <div style={{ marginTop: 18 }}><Skeleton width="min(360px, 60%)" height={16} /></div>
          <div className="td-panel ax-bug db-bug" style={{ ["--cols" as string]: 4 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="ax-bug-cell">
                <Skeleton width="55%" height={12} />
                <div style={{ marginTop: 10 }}><Skeleton width="40%" height={24} /></div>
              </div>
            ))}
          </div>
          <div className="db-grid" style={{ marginTop: 24 }}>
            <div className="td-panel db-card db-c7" style={{ minHeight: 260 }}>
              <Skeleton width={200} height={20} />
              <div style={{ marginTop: 18 }}><Skeleton width="45%" height={72} /></div>
              <div style={{ marginTop: 18 }}><Skeleton width="70%" height={14} /></div>
            </div>
            <div className="td-panel db-card db-c5" style={{ minHeight: 260 }}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <Skeleton width={64} height={64} style={{ borderRadius: 6 }} />
                <div style={{ flex: 1, display: "grid", gap: 8 }}>
                  <Skeleton width="60%" height={18} /><Skeleton width="80%" height={12} />
                </div>
              </div>
              <div style={{ marginTop: 22 }}><Skeleton height={14} count={3} /></div>
            </div>
          </div>
        </div>
      </ArenaPage>
    );
  }

  // ===== CTA de vinculación =====
  if (!overview?.linked) {
    const canLink = !!riotId && !linking && cooldown <= 0;
    return (
      <ArenaPage width="narrow" className="db-page"
        backdrop={<SplashBackdrop map="summoners-rift" opacity={0.8} side="right" height="560px" position="50% 42%" />}>
        <PageHero
          size="md"
          kicker="Tu cuenta de League of Legends"
          title={<>Vincula tu <em>cuenta</em></>}
          lede="Para mostrar tus estadísticas reales en ATAK.GG"
        />
        <form className="td-panel db-linkform ax-rise" style={{ ["--i" as string]: 3 }}
          onSubmit={(e) => { e.preventDefault(); if (canLink) linkAccount(); }}>
          <div className="td-field">
            <label className="td-label" htmlFor="db-riot-id">Riot ID</label>
            <input id="db-riot-id" className="td-input" placeholder="Kister#IZPZ" value={riotId}
              autoComplete="off" spellCheck={false} aria-describedby="db-riot-id-help"
              aria-invalid={err ? true : undefined}
              onChange={(e) => setRiotId(e.target.value)} />
            <span className="td-help" id="db-riot-id-help">Formato: GameName#TAG</span>
          </div>
          <div className="td-field">
            <label className="td-label" htmlFor="db-region">Región</label>
            <TdSelect id="db-region" value={platform} onValueChange={setPlatform}
              options={REGIONS.map((r) => ({ value: r.value, label: `${r.label} — ${r.name}` }))} />
          </div>
          {err && <div className="td-error" role="alert">{err}</div>}
          <Button type="submit" variant="primary" full disabled={!canLink} icon={<Zap size={15} />}>
            {linking ? "Vinculando…" : cooldown > 0 ? `Reintenta en ${cooldown}s` : "Vincular cuenta"}
          </Button>
        </form>
      </ArenaPage>
    );
  }

  // ===== datos reales =====
  const s = overview?.stats ?? {};
  const recent = overview?.recent ?? [];
  const wr = s.winRate ?? 0;
  const recentWins = recent.filter((m) => m.win).length;
  const riotTag = overview?.profile?.gameName
    ? `${overview.profile.gameName}#${overview.profile.tagLine}`
    : null;
  const profileHref = riotTag
    ? `/stats/${overview?.profile?.platform || "la1"}/${encodeURIComponent(riotTag)}`
    : "/stats";

  const quickActions = [
    { to: "/stats", icon: <BarChart3 size={20} />, title: "Ver Stats", desc: "Revisa tus estadísticas" },
    { to: "/tournaments", icon: <Trophy size={20} />, title: "Torneos", desc: "Únete a competencias" },
    { to: "/social", icon: <Users size={20} />, title: "Social", desc: "Conecta con otros" },
  ];

  const resumen = (
    <div className="db-grid">
      {/* ── Forma reciente: win rate + últimas partidas ── */}
      <section className="td-panel db-card db-c7">
        <SectionHead
          size="lg"
          icon={<Target size={19} />}
          title="Win rate"
          right={<StatusChip kind={wr >= 50 ? "pos" : "warn"}>{wr >= 50 ? "En forma" : "A remontar"}</StatusChip>}
        />
        <div className="db-wr">
          <div className="db-wr-num" aria-label={`Win rate ${wr}%`}>{wr}<small>%</small></div>
          <div className="db-wr-side">
            <p className="db-muted" style={{ marginBottom: 10 }}>
              De tus partidas recientes · sobre <b className="td-num" style={{ color: "var(--td-text)" }}>{s.totalMatches ?? 0}</b> partidas
            </p>
            <ProgressBar kind="wr" pct={wr} height={8} />
            <div className="db-wr-scale td-num"><span>0%</span><span>100%</span></div>
          </div>
        </div>

        {recent.length > 0 && (
          <div className="db-form">
            <div className="td-over">
              Últimas {recent.length} partidas ·{" "}
              <span style={{ color: "var(--td-green)" }}>{recentWins}V</span>{" "}
              <span style={{ color: "var(--td-neg)" }}>{recent.length - recentWins}D</span>
            </div>
            <ul className="db-form-row">
              {recent.map((m, i) => (
                <li key={i} className="db-form-chip" data-win={String(!!m.win)}
                  title={`${champName(m.championName) ?? "?"} · ${m.win ? "Victoria" : "Derrota"}`}>
                  {m.championName
                    ? <ChampIcon src={dd.champion(m.championName)} size={44} style={{ borderRadius: 0 }} />
                    : <span className="db-form-blank"><Target size={16} aria-hidden /></span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ── Mi perfil ── */}
      <section className="td-panel db-card db-c5">
        <SectionHead size="lg" icon={<UserRound size={19} />} title="Mi perfil" />
        <div className="db-me">
          {overview?.profile?.profileIcon ? (
            <img className="db-me-icon" src={dd.profileIcon(overview.profile.profileIcon)} alt="" width={64} height={64}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
          ) : (
            <span className="db-me-icon" aria-hidden>{displayName?.[0]?.toUpperCase() || "U"}</span>
          )}
          <div style={{ minWidth: 0 }}>
            <h3 className="db-me-name">{displayName || "Usuario"}</h3>
            <p className="db-me-mail">{user?.email}</p>
            {riotTag && <p className="db-me-riot">{riotTag}</p>}
          </div>
        </div>

        <dl className="db-dl">
          <div>
            <dt>Campeón favorito</dt>
            <dd>
              {s.favoriteChampion && <ChampIcon src={dd.champion(s.favoriteChampion)} size={26} />}
              {champName(s.favoriteChampion) ?? "—"}
            </dd>
          </div>
          <div>
            <dt>Publicaciones</dt>
            <dd className="td-num">{s.socialPosts ?? 0}</dd>
          </div>
          <div>
            <dt>Región</dt>
            <dd>{regionLabel(overview?.profile?.platform)}</dd>
          </div>
        </dl>

        <Button variant="secondary" full>Editar perfil</Button>
      </section>
    </div>
  );

  const nextPhase = nextT ? (PHASE_CHIP[nextT.phase as keyof typeof PHASE_CHIP] ?? PHASE_CHIP.active) : null;
  const torneos = (
    <div className="db-grid">
      {/* Panel de torneos existente (equipos, invitaciones, administrando) */}
      <div className="db-c8">
        <TournamentDashboardPanel />
      </div>
      <div className="db-c4">
        {nextT && nextPhase ? (
          <Link to={`/tournaments/${nextT.id}`} className="ax-artcard db-next" aria-label={`Ver ${nextT.name}`}>
            {/* El arte es el mapa del torneo (Grieta, ARAM o Arena) */}
            <img className="ax-artcard-img" src={lol.map(mapArtFor(nextT.gameMap))} alt="" loading="lazy" decoding="async" onError={hideImg} />
            <span className="td-over" style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Calendar size={13} color="var(--td-gold)" aria-hidden /> Próximo torneo
            </span>
            <h2 className="db-next-name">{nextT.name}</h2>
            <div className="db-next-facts">
              <span>
                <Calendar size={14} aria-hidden />
                {new Date(nextT.startDate).toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" })}
              </span>
              {nextT.prize ? (
                <span style={{ color: "var(--td-gold-bright)" }}><Trophy size={14} aria-hidden />{nextT.prize}</span>
              ) : null}
            </div>
            <div className="db-next-foot">
              <StatusChip kind={nextPhase.kind}>{nextPhase.label}</StatusChip>
              <span className="db-go">Ver <ArrowRight size={15} aria-hidden /></span>
            </div>
          </Link>
        ) : (
          <section className="td-panel db-card">
            <SectionHead icon={<Calendar size={15} />} title="Próximo torneo" />
            <p className="db-muted" style={{ textAlign: "center", padding: "12px 0" }}>No hay torneos próximos</p>
          </section>
        )}
      </div>
    </div>
  );

  const actividad = (
    <div className="db-grid">
      <section className="td-panel db-card db-c4">
        <SectionHead size="lg" icon={<Zap size={19} />} title="Acciones rápidas" />
        <p className="db-block-sub">Accede a las funciones principales</p>
        <ul className="db-links">
          {quickActions.map((a) => (
            <li key={a.to}>
              <Link to={a.to}>
                <span className="td-ico db-ico" data-tone="red" aria-hidden>{a.icon}</span>
                <span style={{ minWidth: 0 }}>
                  <span className="db-link-title">{a.title}</span>
                  <span className="db-link-desc">{a.desc}</span>
                </span>
                <ArrowRight size={17} aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="td-panel db-card db-c8">
        <SectionHead size="lg" icon={<Activity size={19} />} title="Actividad reciente" />
        <p className="db-block-sub">Últimas partidas</p>
        {!recent || recent.length === 0 ? (
          <p className="db-muted">No hay partidas recientes.</p>
        ) : (
          <ul className="db-matches">
            {recent.map((m, index) => (
              <li key={index} className="db-match" data-win={String(!!m.win)}>
                {m.championName ? (
                  <ChampIcon src={dd.champion(m.championName)} size={44} />
                ) : (
                  <span className="td-ico" style={{ width: 44, height: 44 }} aria-hidden><Target size={18} /></span>
                )}
                <div className="db-match-main">
                  <p className="db-match-name">{champName(m.championName) ?? "?"}</p>
                  <p className="db-match-sub">{m.queueName ?? "Partida"}</p>
                </div>
                <div className="db-match-end">
                  <span className="td-num db-match-time">
                    <Clock size={14} aria-hidden style={{ display: "inline", verticalAlign: "-2px", marginRight: 6, color: "var(--td-muted)" }} />
                    {m.duration ? Math.round(m.duration / 60) : 0} min
                  </span>
                  <StatusChip kind={m.win ? "pos" : "warn"} dot={false}>{m.win ? "Victoria" : "Derrota"}</StatusChip>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );

  const isAdmin = (user as any)?.role === "admin";

  return (
    <ArenaPage
      width="wide"
      className="db-page"
      backdrop={favSlug
        ? <SplashBackdrop champion={favSlug} side="right" opacity={0.5} />
        : <SplashBackdrop map="summoners-rift" side="right" opacity={0.8} height="560px" position="50% 42%" />}
    >
      <PageHero
        size="md"
        kicker="Bienvenido de vuelta"
        title={heroName(displayName || "Invocador")}
        lede={riotTag
          ? `${riotTag} · ${regionLabel(overview?.profile?.platform)}`
          : "Tu resumen de actividad y estadísticas"}
        actions={
          <Link to={profileHref} className="td-btn td-btn--primary">
            Ver mi perfil completo <ArrowRight size={15} aria-hidden />
          </Link>
        }
        /* Un único modelo 3D en la página: el campeón principal del jugador. */
        aside={favSlug ? <Champion3D slug={favSlug} clip="idle" art="none" className="db-stage" /> : undefined}
      />

      {/* ── Tira de métricas ── */}
      <dl className="td-panel ax-bug db-bug ax-rise" style={{ ["--cols" as string]: 4, ["--i" as string]: 4 }}>
        <Tip label="Partidas analizadas recientemente">
          <div className="ax-bug-cell">
            <dt className="td-over">Partidas recientes</dt>
            <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{s.totalMatches ?? 0}</dd>
          </div>
        </Tip>
        <Tip label="Porcentaje de victorias en tus partidas recientes">
          <div className="ax-bug-cell">
            <dt className="td-over">Win rate</dt>
            <dd className="ax-bug-value" style={{ marginLeft: 0 }}>
              {wr}% <small data-tone={wr >= 50 ? "pos" : "neg"}>{wr >= 50 ? "en forma" : "a remontar"}</small>
            </dd>
          </div>
        </Tip>
        <Tip label="Tu rango en clasificatoria">
          <div className="ax-bug-cell" data-accent="gold">
            <dt className="td-over">Rango actual</dt>
            <dd className="ax-bug-value" style={{ marginLeft: 0 }}>
              {s.currentRank ?? "—"}{s.lp != null && <small data-tone="gold"> {s.lp} LP</small>}
            </dd>
          </div>
        </Tip>
        <Tip label="Torneos en los que has participado">
          <div className="ax-bug-cell">
            <dt className="td-over">Torneos</dt>
            <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{s.tournamentsJoined ?? 0}</dd>
          </div>
        </Tip>
      </dl>

      <DashTabs section={section} onSelect={setSection} isAdmin={isAdmin} />

      <div key={section} className="ax-rise" role="tabpanel" aria-labelledby={`db-tab-${section}`}>
        {section === "resumen" && resumen}
        {section === "torneos" && torneos}
        {section === "actividad" && actividad}
        {section === "diarios" && isAdmin && <div style={{ marginTop: 16 }}><DailySchedulesAdmin /></div>}
      </div>

      {err && <div className="td-error" role="alert" style={{ marginTop: 22 }}>{err}</div>}
    </ArenaPage>
  );
};

export default Dashboard;
