// src/pages/ChampionPage.tsx — Detalle de campeón (OP.GG MCP): runas, build,
// orden de skills, counters y stats. Rediseño "Arena": el campeón es el héroe
// de la página — su splash de fondo y su modelo 3D en el escenario.
import { useMemo } from 'react';
import { useParams, useSearchParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { useChampions, useStaticData } from '@/hooks/use-ddragon';
import { dd } from '@/lib/dataDragon';
import { ArrowLeft, Swords, ChevronRight, Gem, Hammer, ListOrdered, Activity } from 'lucide-react';
import {
  ArenaPage, SplashBackdrop, Champion3D, SectionHead, ClassIcon, RoleIcon, StatIcon, ChampIcon,
  CLASS_LABELS, normalizeClass, stagger,
} from '@/components/arena';
import type { StatKey } from '@/lib/lolAssets';
import '@/styles/pages/champion.css';

const POSITIONS = [
  { key: 'TOP', label: 'Top' }, { key: 'JUNGLE', label: 'Jungla' },
  { key: 'MIDDLE', label: 'Mid' }, { key: 'ADC', label: 'ADC' }, { key: 'SUPPORT', label: 'Soporte' },
] as const;

const TIER_LABEL = ['', 'S', 'A', 'B', 'C', 'D'];
const SKILL_COLOR: Record<string, string> = { Q: '#4da3ff', W: '#3ddc97', E: '#f5a524', R: '#ff4b57' };

// Estadísticas base de Data Dragon (champion.json → stats) con su icono de LoL.
const BASE_STATS: Array<{ key: string; label: string; icon: StatKey; fmt?: (v: number) => string }> = [
  { key: 'hp', label: 'Vida', icon: 'health' },
  { key: 'mp', label: 'Maná', icon: 'mana' },
  { key: 'attackdamage', label: 'Daño de ataque', icon: 'attack_damage' },
  { key: 'attackspeed', label: 'Vel. de ataque', icon: 'attack_speed', fmt: (v) => v.toFixed(2) },
  { key: 'armor', label: 'Armadura', icon: 'armor' },
  { key: 'spellblock', label: 'Resist. mágica', icon: 'magic_resist' },
  { key: 'movespeed', label: 'Velocidad', icon: 'move_speed' },
  { key: 'attackrange', label: 'Alcance', icon: 'range' },
];

const pct = (v: number | null | undefined, digits = 0) =>
  v == null ? '—' : `${(v * 100).toFixed(digits)}%`;

export default function ChampionPage() {
  const { slug = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const pos = (params.get('pos') || 'MIDDLE').toUpperCase();

  const { data: champs } = useChampions();
  const { runes, items } = useStaticData();
  const entry = champs?.byId?.[slug] ?? Object.values(champs?.byId ?? {}).find((c) => c.id.toLowerCase() === slug.toLowerCase());
  const displayName = entry?.name ?? slug;

  const buildQ = useQuery({
    queryKey: ['champ', 'build', displayName, pos],
    enabled: !!displayName,
    staleTime: 30 * 60_000,
    queryFn: async () => (await axiosInstance.get(`/api/opgg/build`, { params: { champion: displayName, position: pos } })).data.build,
  });
  const countersQ = useQuery({
    queryKey: ['champ', 'counters', displayName, pos],
    enabled: !!displayName,
    staleTime: 30 * 60_000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    queryFn: async () => (await axiosInstance.get(`/api/opgg/counters`, { params: { champion: displayName, position: pos } })).data.counters as any[],
  });

  const b = buildQ.data;
  const maxOrder = useMemo(() => {
    // Orden de maxeo: primeras 3 skills distintas con más niveles en el orden
    if (!b?.skill_order?.length) return [];
    const counts: Record<string, number> = {};
    for (const s of b.skill_order) if (s !== 'R') counts[s] = (counts[s] ?? 0) + 1;
    return Object.entries(counts).sort((x, y) => y[1] - x[1]).map(([k]) => k);
  }, [b]);

  const setPos = (p: string) => setParams((prev) => { const q = new URLSearchParams(prev); q.set('pos', p); return q; }, { replace: true });

  const classes = (entry?.tags ?? []).map(normalizeClass).filter(Boolean) as Array<NonNullable<ReturnType<typeof normalizeClass>>>;
  const tier = b?.tier != null && b.tier > 0 ? (TIER_LABEL[b.tier] ?? `T${b.tier}`) : null;
  // Verde solo si gana claramente, rojo solo si pierde claramente: 50% es neutro.
  const wrColor = b?.win_rate == null ? undefined
    : b.win_rate >= 0.51 ? 'var(--td-green)' : b.win_rate < 0.49 ? 'var(--td-neg)' : undefined;

  return (
    <ArenaPage
      className="cp-page"
      backdrop={entry ? <SplashBackdrop champion={entry.id} opacity={0.5} side="right" position="70% 16%" height="min(88vh, 820px)" /> : undefined}
    >
      <Link to="/meta" className="cp-back ax-rise">
        <ArrowLeft size={16} aria-hidden /> Volver al meta
      </Link>

      {/* Héroe: identidad + escenario 3D */}
      <header className="cp-hero">
        <div className="cp-hero-copy">
          <div className="cp-classes ax-rise">
            {classes.map((c) => (
              <span key={c} className="cp-class">
                <ClassIcon tag={c} size={22} /> {CLASS_LABELS[c]}
              </span>
            ))}
            {tier && (
              <span className="cp-tier">
                <span className="ax-tier" data-tier={tier}>{tier}</span>
                {b?.rank ? <span className="td-over">#{b.rank} en su línea</span> : <span className="td-over">Tier</span>}
              </span>
            )}
          </div>

          <h1 className="ax-pagehero-title ax-rise" style={stagger(1)}>{displayName}</h1>
          {entry?.title && <p className="cp-title ax-rise" style={stagger(2)}>{entry.title}</p>}

          {/* Línea: iconos de carril de LoL */}
          <div className="ax-lanes cp-lanes ax-rise" style={stagger(3)} role="group" aria-label="Posición">
            {POSITIONS.map((p) => (
              <button key={p.key} type="button" className="ax-lane" data-active={pos === p.key} aria-pressed={pos === p.key}
                onClick={() => setPos(p.key)}>
                <RoleIcon lane={p.key} size={22} />
                <span>{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        <Champion3D
          key={entry?.id ?? 'none'}
          slug={entry?.id} champId={entry ? Number(entry.key) : undefined}
          clip="idle" art="none" facing={-0.35} className="cp-stage"
        />
      </header>

      {/* Marcador del campeón en esta línea */}
      <dl className="ax-bug cp-bug ax-rise" style={{ ...stagger(4), ['--cols' as string]: 4, margin: 0 }}>
        <div className="ax-bug-cell">
          <dt className="td-over">Win rate</dt>
          <dd className="ax-bug-value" style={{ marginLeft: 0, color: wrColor }}>
            {pct(b?.win_rate, 1)}
          </dd>
        </div>
        <div className="ax-bug-cell">
          <dt className="td-over">Pick rate</dt>
          <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{pct(b?.pick_rate, 1)}</dd>
        </div>
        <div className="ax-bug-cell">
          <dt className="td-over">Ban rate</dt>
          <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{pct(b?.ban_rate, 1)}</dd>
        </div>
        <div className="ax-bug-cell" data-accent="gold">
          <dt className="td-over">Tier</dt>
          <dd className="ax-bug-value" style={{ marginLeft: 0 }}>{tier ?? '—'}{b?.rank ? <small> · #{b.rank}</small> : null}</dd>
        </div>
      </dl>

      {buildQ.isLoading && <p className="cp-state" role="status">Analizando el meta de {displayName}…</p>}
      {buildQ.isError && (
        <div className="ax-empty" style={{ marginTop: 24 }}>
          <h3>Sin datos en esta posición</h3>
          <p style={{ margin: 0, fontSize: 14 }}>Prueba con otra línea: {displayName} casi no se juega aquí.</p>
        </div>
      )}

      {b && (
        <div className="cp-grid">
          {/* Runas */}
          <section className="td-panel ax-card ax-rise" style={stagger(1)}>
            <SectionHead icon={<Gem size={15} />} title="Runas recomendadas" />
            <div className="cp-runes">
              {(b.rune_ids ?? []).map((id: number, i: number) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const r = (runes as any)?.[id];
                if (!r) return null;
                return (
                  <img key={`${id}-${i}`} src={r.icon} alt={r.name} title={r.name} loading="lazy" decoding="async"
                    className={i === 0 ? 'cp-rune cp-rune--key' : 'cp-rune'} />
                );
              })}
            </div>
            {!!(b.primary_rune_names ?? []).length && (
              <p className="cp-note">{(b.primary_rune_names ?? []).join(' · ')}</p>
            )}
          </section>

          {/* Build */}
          <section className="td-panel ax-card ax-rise" style={stagger(2)}>
            <SectionHead icon={<Hammer size={15} />} title="Build" />
            <div className="cp-build">
              {([['Inicio', b.starter_ids], ['Núcleo', b.core_item_ids], ['Botas', b.boots_id ? [b.boots_id] : []]] as Array<[string, number[] | undefined]>).map(([label, ids]) => (
                <div key={label} className="cp-build-row">
                  <span className="td-over">{label}</span>
                  <div className="cp-items">
                    {(ids ?? []).map((id, i) => (
                      <span key={`${id}-${i}`} className="cp-item-wrap">
                        {i > 0 && label === 'Núcleo' && <ChevronRight size={14} aria-hidden className="cp-arrow" />}
                        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                        <img src={dd.item(id)} alt={(items as any)?.[id]?.name ?? ''} title={(items as any)?.[id]?.name ?? ''}
                          className="cp-item" loading="lazy" decoding="async"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Orden de habilidades */}
          <section className="td-panel ax-card ax-rise" style={stagger(3)}>
            <SectionHead icon={<ListOrdered size={15} />} title="Orden de habilidades" />
            {maxOrder.length > 0 && (
              <div className="cp-max" aria-label={`Prioridad de maxeo: ${maxOrder.join(', ')}`}>
                {maxOrder.map((s, i) => (
                  <span key={s} className="cp-item-wrap">
                    {i > 0 && <ChevronRight size={16} aria-hidden className="cp-arrow" />}
                    <span className="cp-skill cp-skill--lg" style={{ ['--c' as string]: SKILL_COLOR[s] }}>{s}</span>
                  </span>
                ))}
              </div>
            )}
            <ol className="cp-order">
              {(b.skill_order ?? []).slice(0, 15).map((s: string, i: number) => (
                <li key={i} className="cp-skill" style={{ ['--c' as string]: SKILL_COLOR[s] ?? '#8c8c98' }}>
                  <b>{s}</b><small>{i + 1}</small>
                </li>
              ))}
            </ol>
          </section>

          {/* Counters */}
          <section className="td-panel ax-card ax-rise" style={stagger(4)}>
            <SectionHead icon={<Swords size={15} />} title="Cuidado con" />
            {countersQ.isLoading && <p className="cp-note" role="status">Cargando…</p>}
            <div className="cp-counters">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(countersQ.data ?? []).slice(0, 6).map((c: any, i: number) => {
                const cName = c.name ?? c.champion ?? c.champion_name ?? '';
                const cEntry = Object.values(champs?.byId ?? {}).find((x) => x.name.toLowerCase() === String(cName).replace(/_/g, ' ').toLowerCase());
                const wr = c.winRate ?? c.win_rate ?? null;
                return (
                  <button key={`${cName}-${i}`} type="button" className="cp-counter"
                    onClick={() => cEntry && navigate(`/champion/${cEntry.id}?pos=${pos}`)}>
                    {cEntry && <ChampIcon src={dd.champion(cEntry.id)} size={40} />}
                    <span className="cp-counter-name">{cEntry?.name ?? cName}</span>
                    {wr != null && (
                      <span className="td-num cp-counter-wr">{Math.round(wr <= 1 ? wr * 100 : wr)}%<small> te gana</small></span>
                    )}
                    <ChevronRight size={16} aria-hidden className="cp-arrow" />
                  </button>
                );
              })}
              {!countersQ.isLoading && !(countersQ.data ?? []).length && <p className="cp-note">Sin datos de counters aquí.</p>}
            </div>
          </section>

          {/* Estadísticas base (Data Dragon) con iconos de LoL */}
          {entry?.stats && (
            <section className="td-panel ax-card cp-wide ax-rise" style={stagger(5)}>
              <SectionHead icon={<Activity size={15} />} title="Estadísticas base · nivel 1" />
              <dl className="cp-stats">
                {BASE_STATS.filter((s) => entry.stats?.[s.key] != null && entry.stats[s.key] > 0).map((s) => (
                  <div key={s.key} className="cp-stat">
                    <StatIcon stat={s.icon} size={26} />
                    <div>
                      <dt className="td-over">{s.label}</dt>
                      <dd className="cp-stat-val">{s.fmt ? s.fmt(entry.stats![s.key]) : Math.round(entry.stats![s.key])}</dd>
                    </div>
                  </div>
                ))}
              </dl>
            </section>
          )}
        </div>
      )}

      <p className="cp-foot">Datos en vivo de OP.GG (ranked, parche actual)</p>
    </ArenaPage>
  );
}
