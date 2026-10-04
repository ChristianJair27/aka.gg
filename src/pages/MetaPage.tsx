// src/pages/MetaPage.tsx — Meta diaria potenciada por OP.GG MCP:
// tier list por línea, calendario esports y skins en oferta.
// Rediseño "Arena": el n.º 1 de la línea elegida es el héroe (splash + modelo 3D)
// y el podio usa el arte vertical de cada campeón.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { useChampions } from '@/hooks/use-ddragon';
import { dd } from '@/lib/dataDragon';
import { TrendingUp, CalendarDays, Sparkles, ArrowRight } from 'lucide-react';
import {
  ArenaPage, SplashBackdrop, PageHero, Champion3D, RoleIcon, ChampIcon, ProgressBar, StatusChip, lol, stagger,
} from '@/components/arena';
import '@/styles/pages/meta.css';

const LANES = [
  { key: 'top', label: 'Top' }, { key: 'jungle', label: 'Jungla' },
  { key: 'mid', label: 'Mid' }, { key: 'bottom', label: 'ADC' }, { key: 'support', label: 'Soporte' },
] as const;
type LaneKey = (typeof LANES)[number]['key'];

const TABS = [
  { key: 'tier', label: 'Tier list', icon: <TrendingUp size={18} /> },
  { key: 'esports', label: 'Esports', icon: <CalendarDays size={18} /> },
  { key: 'skins', label: 'Ofertas', icon: <Sparkles size={18} /> },
] as const;
type TabKey = (typeof TABS)[number]['key'];

const TIER_LABEL: Record<number, string> = { 0: 'N', 1: 'S', 2: 'A', 3: 'B', 4: 'C', 5: 'D' };
const LANE_POS: Record<string, string> = { top: 'TOP', jungle: 'JUNGLE', mid: 'MIDDLE', bottom: 'ADC', support: 'SUPPORT' };
const wrColor = (wr?: number | null) =>
  wr == null ? 'var(--td-muted)' : wr >= 52 ? 'var(--td-green)' : wr >= 49 ? 'var(--td-text)' : 'var(--td-neg)';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Pick = any;

function useTierList(lane: LaneKey) {
  return useQuery({
    queryKey: ['opgg', 'tier', lane],
    queryFn: async () => (await axiosInstance.get(`/api/opgg/tier-list?position=${lane}`)).data.picks as Pick[],
    staleTime: 10 * 60 * 1000,
  });
}

function LaneSelect({ lane, onChange }: { lane: LaneKey; onChange: (l: LaneKey) => void }) {
  return (
    <div className="ax-lanes" role="group" aria-label="Línea">
      {LANES.map((l) => (
        <button key={l.key} type="button" className="ax-lane" data-active={lane === l.key} aria-pressed={lane === l.key}
          onClick={() => onChange(l.key)}>
          <RoleIcon lane={l.key} size={22} />
          <span>{l.label}</span>
        </button>
      ))}
    </div>
  );
}

function TierListTab({ lane, setLane }: { lane: LaneKey; setLane: (l: LaneKey) => void }) {
  const navigate = useNavigate();
  const { data: champs } = useChampions();
  const q = useTierList(lane);
  const picks = (q.data ?? []).slice(0, 25);
  const go = (p: Pick) => {
    const slug = champs?.byKey?.[String(p.id)]?.id;
    if (slug) navigate(`/champion/${slug}?pos=${LANE_POS[lane]}`);
  };

  return (
    <div>
      <div className="mt-toolbar">
        <LaneSelect lane={lane} onChange={setLane} />
        <span className="td-over">Datos de OP.GG · se actualiza cada 30 min</span>
      </div>

      {q.isLoading && (
        <div className="mt-list" aria-busy="true" aria-label="Cargando tier list">
          {Array.from({ length: 8 }).map((_, i) => <div key={i} className="mt-row mt-row--ghost" />)}
        </div>
      )}
      {q.isError && (
        <div className="ax-empty">
          <h3>No se pudo cargar la tier list</h3>
          <p style={{ margin: 0, fontSize: 14 }}>OP.GG no respondió. Vuelve a intentarlo en un momento.</p>
        </div>
      )}

      {!q.isLoading && !q.isError && (
        <div key={lane}>
          {/* Podio: arte vertical de los tres mejores de la línea */}
          <div className="mt-podium">
            {picks.slice(0, 3).map((p, i) => {
              const slug = champs?.byKey?.[String(p.id)]?.id;
              return (
                <button key={p.name} type="button" className="ax-artcard mt-pod ax-rise" data-rank={i + 1} style={stagger(i)}
                  onClick={() => go(p)} aria-label={`Ver ${p.name}`}>
                  {slug && (
                    <img className="ax-artcard-img" src={lol.loading(slug)} alt="" loading="lazy" decoding="async"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                  )}
                  <span className="ax-pos mt-pod-rank" data-pos={i + 1}>{i + 1}</span>
                  <span className="mt-pod-name">{p.name}</span>
                  <span className="mt-pod-stats">
                    <span className="ax-tier" data-tier={TIER_LABEL[p.tier] ?? 'C'}>{TIER_LABEL[p.tier] ?? 'C'}</span>
                    <span className="td-num" style={{ color: wrColor(p.wr) }}>{p.wr != null ? `${p.wr}%` : '—'}<small> WR</small></span>
                    <span className="td-num mt-pod-score">{p.score}<small> pts</small></span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-list">
            <div className="mt-row mt-row--head td-over" aria-hidden>
              <span>#</span><span>Campeón</span><span>Tier</span><span className="mt-col-wr">WR</span>
              <span className="mt-col-score">Puntuación</span><span />
            </div>
            {picks.slice(3).map((p, i) => {
              const slug = champs?.byKey?.[String(p.id)]?.id;
              const tier = TIER_LABEL[p.tier] ?? 'C';
              return (
                <button key={p.name} type="button" className="mt-row ax-slide" style={stagger(Math.min(i, 10))} onClick={() => go(p)}>
                  <span className="ax-pos">{i + 4}</span>
                  <span className="mt-champ">
                    {slug ? <ChampIcon src={dd.champion(slug)} size={44} /> : <span className="ax-champ" style={{ width: 44, height: 44 }} />}
                    <span className="mt-champ-name">{p.name}</span>
                  </span>
                  <span className="ax-tier" data-tier={tier}>{tier}</span>
                  <span className="td-num mt-col-wr" style={{ color: wrColor(p.wr) }}>{p.wr != null ? `${p.wr}%` : '—'}</span>
                  <span className="mt-col-score">
                    <ProgressBar kind="red" pct={(p.score / 10) * 100} height={5} />
                    <span className="td-num">{p.score}</span>
                  </span>
                  <ArrowRight size={16} aria-hidden className="mt-go" />
                </button>
              );
            })}
          </div>
          <p className="mt-note">La puntuación combina el tier y el ranking del campeón dentro de su línea.</p>
        </div>
      )}
    </div>
  );
}

function EsportsTab() {
  const q = useQuery({
    queryKey: ['opgg', 'esports'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async () => (await axiosInstance.get('/api/opgg/esports/schedules')).data.schedules as any[],
    staleTime: 10 * 60 * 1000,
  });
  const byDay = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const m = new Map<string, any[]>();
    for (const s of q.data ?? []) {
      const d = new Date(s.scheduledAt).toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'short' });
      if (!m.has(d)) m.set(d, []);
      m.get(d)!.push(s);
    }
    return [...m.entries()];
  }, [q.data]);

  if (q.isLoading) return <p className="mt-state" role="status">Cargando calendario…</p>;
  if (!byDay.length) return <div className="ax-empty"><h3>Sin partidos próximos</h3></div>;

  const logo = (url?: string) => (
    <img src={url} alt="" width={32} height={32} loading="lazy" decoding="async" className="mt-team-logo"
      onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden'; }} />
  );

  return (
    <div className="mt-days">
      {byDay.map(([day, matches]) => (
        <section key={day}>
          <h3 className="ax-h3 mt-day">{day}</h3>
          <div className="mt-list">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {matches.map((m: any) => {
              const upcoming = m.status === 'NOT_STARTED';
              return (
                <a key={m.id} href={m.details} target="_blank" rel="noopener noreferrer" className="mt-match">
                  <StatusChip kind={upcoming ? 'dim' : m.status === 'IN_PROGRESS' ? 'live' : 'finished'} dot={!upcoming}>{m.league}</StatusChip>
                  <span className="mt-team mt-team--home">
                    <span className="mt-team-name">{m.homeTeam?.acronym}</span>{logo(m.homeTeam?.image_url)}
                  </span>
                  <span className="mt-score td-num" data-upcoming={upcoming}>
                    {upcoming
                      ? new Date(m.scheduledAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
                      : `${m.homeScore} - ${m.awayScore}`}
                  </span>
                  <span className="mt-team">
                    {logo(m.awayTeam?.image_url)}<span className="mt-team-name">{m.awayTeam?.acronym}</span>
                  </span>
                  <span className="td-over mt-bo">Bo{m.numberOfGames}</span>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function SkinsTab() {
  const { data: champs } = useChampions();
  const q = useQuery({
    queryKey: ['opgg', 'skins'],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async () => (await axiosInstance.get('/api/opgg/skins-sale')).data.skins as any[],
    staleTime: 60 * 60 * 1000,
  });
  if (q.isLoading) return <p className="mt-state" role="status">Cargando ofertas…</p>;
  if (!q.data?.length) return <div className="ax-empty"><h3>Sin ofertas activas</h3></div>;

  return (
    <div className="ax-grid" style={{ ['--cols' as string]: 4 }}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      {q.data.map((s: any, i: number) => {
        const champ = champs?.byKey?.[String(s.champion_id)];
        const skinNum = s.skin_id % 1000;
        return (
          <article key={s.skin_id} className="ax-artcard mt-skin ax-rise" data-hover="true" style={stagger(Math.min(i, 10))}>
            {champ && (
              <img className="ax-artcard-img" src={lol.splash(champ.id, skinNum)} alt="" loading="lazy" decoding="async"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = lol.splash(champ.id, 0); }} />
            )}
            <span className="mt-skin-off"><StatusChip kind="live" dot={false}>-{Math.round((s.discount_rate ?? 0) * 100)}%</StatusChip></span>
            <span className="mt-skin-name">{champ?.name ?? `Campeón ${s.champion_id}`}</span>
            <span className="td-num mt-skin-cost">{s.cost} RP</span>
          </article>
        );
      })}
    </div>
  );
}

export default function MetaPage() {
  const [tab, setTab] = useState<TabKey>('tier');
  const [lane, setLane] = useState<LaneKey>('mid');
  const { data: champs } = useChampions();
  // El n.º 1 de la línea elegida protagoniza el héroe (misma caché que la lista).
  const topQ = useTierList(lane);
  const top = topQ.data?.[0];
  const topEntry = top ? champs?.byKey?.[String(top.id)] : undefined;
  const laneLabel = LANES.find((l) => l.key === lane)?.label ?? '';

  return (
    <ArenaPage
      className="mt-page"
      backdrop={topEntry ? <SplashBackdrop key={topEntry.id} champion={topEntry.id} opacity={0.42} side="right" position="68% 16%" /> : undefined}
    >
      <PageHero
        kicker="Datos en vivo de OP.GG"
        title={<>Meta <em>del parche</em></>}
        lede="Tier list por línea, calendario profesional y skins en oferta. Se actualiza solo."
        aside={topEntry && (
          <Champion3D key={topEntry.id} slug={topEntry.id} champId={Number(topEntry.key)} clip="idle" art="centered"
            facing={-0.3} className="mt-stage">
            <div className="ax-stage-label">
              <span className="td-over">N.º 1 en {laneLabel}</span>
              <div className="mt-stage-name">{topEntry.name}</div>
            </div>
          </Champion3D>
        )}
      />

      <nav className="ax-tabs mt-tabs" aria-label="Secciones del meta">
        {TABS.map((t) => (
          <button key={t.key} type="button" className="ax-tab" data-active={tab === t.key}
            aria-current={tab === t.key ? 'page' : undefined} onClick={() => setTab(t.key)}>
            {t.icon}{t.label}
          </button>
        ))}
      </nav>

      <div key={tab} className="ax-rise mt-body">
        {tab === 'tier' && <TierListTab lane={lane} setLane={setLane} />}
        {tab === 'esports' && <EsportsTab />}
        {tab === 'skins' && <SkinsTab />}
      </div>
    </ArenaPage>
  );
}
