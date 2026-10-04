// src/components/LiveGameVisualizer.tsx
// Visualizador de partida en vivo (Spectator v5) con el sistema "Arena":
// marcador de retransmisión (azul · reloj · rojo), los dos equipos con elo,
// hechizos, runas y afinidad con el campeón, bloqueos y tiempos estimados de
// objetivos. Lo visual vive en src/styles/pages/match.css.

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, RefreshCw, Play, Copy, Check, Users, Target, Sword,
  ChevronDown, ChevronUp, Flame, ExternalLink,
} from 'lucide-react';
import { ChampIcon, DragonIcon, UiIcon } from '@/components/arena/primitives';
import { Button, StatusChip } from '@/components/tournament/ui';
import { BanTile, Slot } from '@/components/match/parts';
import '@/styles/pages/match.css';

interface Participant {
  summonerName: string;
  riotId?: string | null;
  championId: number;
  teamId: number;
  puuid?: string;
  spell1Id: number;
  spell2Id: number;
  perks?: {
    keystone?: number;
    primaryStyle?: number;
    subStyle?: number;
  };
  rank?: {
    tier: string; rank: string; lp: number;
    wins?: number; losses?: number; winRate?: number | null; hotStreak?: boolean;
  } | null;
  /** Maestría con el campeón que está jugando EN ESTA partida (points 0 = primera vez). */
  mastery?: { points: number; level: number } | null;
}

interface LiveGameData {
  gameId: number;
  platformId?: string;
  /** Plataforma donde el backend encontró la partida (puede diferir de la página). */
  platformUsed?: string;
  gameMode: string;
  gameLength: number;
  queueId?: number;
  participants: Participant[];
  bannedChampions: Array<{ championId: number; teamId: number }>;
  encryptionKey?: string;
  observers?: { encryptionKey?: string };
}

interface Props {
  liveGame: LiveGameData;
  champs: any;
  version: string;
  runes?: Record<number, { name: string; icon: string }>;
  spells?: Record<string, { name: string; icon: string }>;
  myRiotId: string;
  platform: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  onSpectateRequest?: (gameId: number, encryptionKey: string, platformId: string) => void;
}

const SPELL_COOLDOWNS: Record<number, number> = {
  1: 300, 3: 210, 4: 300, 6: 180, 7: 240, 11: 15, 12: 360,
  14: 180, 21: 180, 32: 80,
};

const OBJECTIVE_TIMINGS = {
  dragonFirst: 300,
  dragonRespawn: 300,
  heraldWindowStart: 480,
  heraldWindowEnd: 840,
  baron: 1200,
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getChampion(champs: any, id: number) {
  return champs?.byKey?.[String(id)];
}

const SPELL_ID_TO_KEY: Record<number, string> = {
  1: 'Boost', 3: 'Exhaust', 4: 'Flash', 6: 'Haste',
  7: 'Heal', 11: 'Smite', 12: 'Teleport', 14: 'Dot',
  21: 'Barrier', 32: 'Snowball',
};

// Nombre humano por cola (el gameMode crudo dice cosas como "KIWI" o "CHERRY").
const QUEUE_LABELS: Record<number, string> = {
  420: 'Clasificatoria Solo/Dúo', 440: 'Clasificatoria Flex',
  400: 'Normal (Draft)', 430: 'Normal (Blind)', 490: 'Quickplay', 480: 'Swiftplay',
  450: 'ARAM', 2400: 'ARAM: Mayhem', 2300: 'Brawl',
  1700: 'Arena', 1710: 'Arena', 1900: 'URF', 900: 'URF', 700: 'Clash',
  830: 'Co-op vs IA', 840: 'Co-op vs IA', 850: 'Co-op vs IA',
};
const GAMEMODE_LABELS: Record<string, string> = {
  CLASSIC: 'Grieta del Invocador', ARAM: 'ARAM', KIWI: 'ARAM: Mayhem',
  CHERRY: 'Arena', URF: 'URF', TUTORIAL: 'Tutorial', PRACTICETOOL: 'Herramienta de práctica',
};
// Modos donde los jugadores eligen AUGMENTS dentro de la partida (no runas
// completas): el spectator no expone esas elecciones.
const AUGMENT_QUEUES = new Set([1700, 1710, 2400]);
const AUGMENT_MODES = new Set(['KIWI', 'CHERRY']);

// ── Elo + afinidad campeón-jugador ───────────────────────────────────────────
const TIER_COLORS: Record<string, string> = {
  IRON: '#8a8a8a', BRONZE: '#a97142', SILVER: '#b8c4c4', GOLD: '#e8c063',
  PLATINUM: '#4fd1c5', EMERALD: '#2ecc71', DIAMOND: '#7fb8ff',
  MASTER: '#c084fc', GRANDMASTER: '#ef4444', CHALLENGER: '#facc15',
};
const TIER_SHORT: Record<string, string> = {
  IRON: 'Hierro', BRONZE: 'Bronce', SILVER: 'Plata', GOLD: 'Oro', PLATINUM: 'Plat',
  EMERALD: 'Esm', DIAMOND: 'Dia', MASTER: 'Master', GRANDMASTER: 'GM', CHALLENGER: 'Chall',
};
const crestUrl = (tier: string) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${tier.toLowerCase()}.png`;

const fmtPts = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);

type TagKind = 'gold' | 'pos' | 'dim';
// Etiquetas que cruzan al JUGADOR con el CAMPEÓN de esta partida.
function championTags(p: Participant): Array<{ text: string; kind: TagKind; streak?: boolean }> {
  const tags: Array<{ text: string; kind: TagKind; streak?: boolean }> = [];
  const m = p.mastery;
  if (m) {
    if (m.points >= 300_000) tags.push({ text: `Main · ${fmtPts(m.points)} pts`, kind: 'gold' });
    else if (m.points >= 60_000) tags.push({ text: `Experimentado · ${fmtPts(m.points)}`, kind: 'pos' });
    else if (m.points > 0 && m.points < 6_000) tags.push({ text: 'Poco jugado', kind: 'dim' });
    else if (m.points === 0) tags.push({ text: 'Primera vez', kind: 'dim' });
  }
  if (p.rank?.hotStreak) tags.push({ text: 'Racha', kind: 'gold', streak: true });
  return tags.slice(0, 2);
}

function getSpellIcon(version: string, spellId: number) {
  const key = SPELL_ID_TO_KEY[spellId] || 'Flash';
  return `https://ddragon.leagueoflegends.com/cdn/${version}/img/spell/Summoner${key}.png`;
}

function calculateObjectiveTimers(gameLength: number) {
  const timers: any[] = [];

  // Dragon
  if (gameLength < OBJECTIVE_TIMINGS.dragonFirst) {
    timers.push({ name: 'Dragón', time: OBJECTIVE_TIMINGS.dragonFirst - gameLength, status: 'spawns' });
  } else {
    const lastTheoretical = Math.floor((gameLength - OBJECTIVE_TIMINGS.dragonFirst) / OBJECTIVE_TIMINGS.dragonRespawn);
    const next = OBJECTIVE_TIMINGS.dragonFirst + (lastTheoretical + 1) * OBJECTIVE_TIMINGS.dragonRespawn;
    timers.push({ name: 'Dragón', time: Math.max(0, next - gameLength), status: 'next' });
  }

  // Herald
  if (gameLength >= OBJECTIVE_TIMINGS.heraldWindowStart && gameLength <= OBJECTIVE_TIMINGS.heraldWindowEnd) {
    timers.push({ name: 'Heraldo', time: 0, status: 'active' });
  } else if (gameLength < OBJECTIVE_TIMINGS.heraldWindowStart) {
    timers.push({ name: 'Heraldo', time: OBJECTIVE_TIMINGS.heraldWindowStart - gameLength, status: 'spawns' });
  }

  // Baron
  if (gameLength >= OBJECTIVE_TIMINGS.baron) {
    timers.push({ name: 'Barón', time: 0, status: 'active' });
  } else {
    timers.push({ name: 'Barón', time: OBJECTIVE_TIMINGS.baron - gameLength, status: 'spawns' });
  }

  return timers;
}

const objectiveIcon = (name: string) =>
  name === 'Dragón' ? <DragonIcon dragon="elder" size={20} />
  : name === 'Heraldo' ? <UiIcon name="rift_herald" size={22} />
  : <UiIcon name="nashor" size={22} />;

function PlayerRow({
  p, side, champs, version, runes, isMe, platform, augmentMode,
}: {
  p: Participant; side: 'blue' | 'red'; champs: any; version: string;
  runes?: any; spells?: any; isMe: boolean; platform?: string; augmentMode?: boolean;
}) {
  const champ = getChampion(champs, p.championId);
  const keystone = p.perks?.keystone;
  const runeData = keystone && runes ? runes[keystone] : null;
  // Link al perfil del jugador (formato de ruta: /profile/:region/Nombre-TAG)
  const profileHref = p.riotId && platform
    ? `/profile/${platform}/${encodeURIComponent(p.riotId.replace('#', '-'))}`
    : null;

  const spell1Cd = SPELL_COOLDOWNS[p.spell1Id] || 180;
  const spell2Cd = SPELL_COOLDOWNS[p.spell2Id] || 300;
  const tierColor = p.rank?.tier ? (TIER_COLORS[p.rank.tier] || '#b6b6c0') : undefined;

  return (
    <div className="mx-lrow" data-side={side} data-me={isMe ? 'true' : undefined}>
      {/* Campeón */}
      {champ?.image
        ? <ChampIcon src={champ.image} name={champ.name} size={46} />
        : <Slot size={46} />}

      <div className="mx-lrow-body">
        <div className="mx-lrow-top">
          {profileHref ? (
            <a href={profileHref} target="_blank" rel="noopener noreferrer" className="mx-lname">
              {p.summonerName || 'Invocador'}
            </a>
          ) : (
            <span className="mx-lname">{p.summonerName || 'Invocador'}</span>
          )}
          {isMe && <StatusChip kind="gold" dot={false}>Tú</StatusChip>}
          {/* Elo del jugador (crest oficial + tier corto + WR de temporada) */}
          {p.rank?.tier && (
            <span
              className="mx-rank"
              style={{ ['--c' as string]: tierColor } as React.CSSProperties}
              title={`${p.rank.tier} ${p.rank.rank} · ${p.rank.lp} LP${p.rank.winRate != null ? ` · ${p.rank.winRate}% WR (${p.rank.wins}V ${p.rank.losses}D)` : ''}`}
            >
              <img src={crestUrl(p.rank.tier)} alt="" loading="lazy"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              {TIER_SHORT[p.rank.tier] || p.rank.tier} {p.rank.rank}
              {p.rank.winRate != null && (
                <small data-pos={p.rank.winRate >= 50 ? 'true' : undefined}>{p.rank.winRate}%</small>
              )}
            </span>
          )}
          {champ && <span className="mx-lchamp">{champ.name}</span>}
        </div>

        {/* Hechizos + runa + afinidad */}
        <div className="mx-lmeta">
          {[p.spell1Id, p.spell2Id].map((sid, idx) => {
            const cd = idx === 0 ? spell1Cd : spell2Cd;
            return (
              <span key={idx} className="mx-spell" title="Enfriamiento base del hechizo">
                <img
                  src={getSpellIcon(version, sid)}
                  alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                {Math.floor(cd / 60)}:{(cd % 60).toString().padStart(2, '0')}
              </span>
            );
          })}

          {/* Keystone — en modos con augments (Mayhem/Arena) las elecciones se
              hacen dentro de la partida y el spectator no las expone. */}
          {augmentMode ? (
            <StatusChip kind="dim" dot={false}>Augments en partida</StatusChip>
          ) : runeData ? (
            <span className="mx-rune">
              <img src={runeData.icon} alt="" />
              <span>{runeData.name}</span>
            </span>
          ) : null}

          {/* Afinidad jugador↔campeón de ESTA partida (maestría) + racha */}
          {championTags(p).map((tag, i) => (
            <StatusChip key={i} kind={tag.kind} dot={false}>
              {tag.streak && <Flame size={12} aria-hidden />}{tag.text}
            </StatusChip>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function LiveGameVisualizer({
  liveGame, champs, version, runes, spells, myRiotId, platform,
  onRefresh, isRefreshing, onSpectateRequest = undefined,
}: Props) {
  const [expanded, setExpanded] = useState(true);
  const [copied, setCopied] = useState(false);
  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const blue = (liveGame.participants || []).filter((p: Participant) => p.teamId === 100);
  const red  = (liveGame.participants || []).filter((p: Participant) => p.teamId === 200);
  const bansBlue = (liveGame.bannedChampions || []).filter(b => b.teamId === 100);
  const bansRed  = (liveGame.bannedChampions || []).filter(b => b.teamId === 200);

  const myName = myRiotId.split('#')[0].toLowerCase().trim();
  const isMe = (p: Participant) => (p.summonerName || '').toLowerCase().includes(myName);

  const encKey = liveGame.encryptionKey || liveGame.observers?.encryptionKey;
  const platId = liveGame.platformId || platform.toUpperCase();
  const canSpectate = !!(liveGame.gameId && encKey);

  const objectiveTimers = useMemo(() => calculateObjectiveTimers(liveGame.gameLength || 0), [liveGame.gameLength]);

  // Etiqueta humana del modo: primero por queueId (más preciso), luego gameMode.
  const gameModeLabel =
    QUEUE_LABELS[liveGame.queueId ?? -1] ||
    GAMEMODE_LABELS[liveGame.gameMode || ''] ||
    liveGame.gameMode || 'Partida';
  const augmentMode = AUGMENT_QUEUES.has(liveGame.queueId ?? -1) || AUGMENT_MODES.has(liveGame.gameMode || '');
  // Los timers de dragón/heraldo/barón solo aplican a la Grieta del Invocador.
  const showObjectives = (liveGame.gameMode === 'CLASSIC') || [420, 440, 400, 430, 490, 480, 700].includes(liveGame.queueId ?? -1);

  // Show if the live game was detected on a different platform than the page (common with multi-region accounts)
  const detectedOnDifferentPlatform = liveGame.platformUsed && liveGame.platformUsed.toLowerCase() !== platform.toLowerCase();

  const copySpectateCommand = async () => {
    if (!canSpectate) return;
    const host = `${platId.toLowerCase()}.lol.riotgames.com`;
    const cmd = `"C:\\Riot Games\\League of Legends\\LeagueClient.exe" "spectator ${host} 80 ${encKey} ${liveGame.gameId} ${platId}"`;
    try {
      await navigator.clipboard.writeText(cmd);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  };

  const handleSpectate = () => {
    if (onSpectateRequest && canSpectate) {
      onSpectateRequest(liveGame.gameId, encKey!, platId);
    } else {
      copySpectateCommand();
    }
  };

  const fetchLiveAdvice = async () => {
    setAiLoading(true);
    setAiAdvice(null);

    const API_URL = (import.meta.env.VITE_API_URL as string) || 'http://localhost:4000';

    try {
      const res = await fetch(`${API_URL}/api/ai-live-coach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          liveGame,
          playerRiotId: myRiotId,
          // Podríamos pasar más contexto del jugador en el futuro
        }),
      });

      const data = await res.json();
      if (data.advice) {
        setAiAdvice(data.advice);
      } else {
        setAiAdvice('El coach de IA no pudo generar consejo en este momento.');
      }
    } catch (err) {
      console.error('Error fetching live AI advice:', err);
      setAiAdvice('Error conectando con ATAK AI Coach. ¿Está el servidor de IA corriendo?');
    } finally {
      setAiLoading(false);
    }
  };

  const rowPlatform = (liveGame.platformUsed || platform).toLowerCase();

  const faces = (team: Participant[], side: 'blue' | 'red') => (
    <div className="mx-faces" data-side={side}>
      {team.map((p, i) => {
        const c = getChampion(champs, p.championId);
        return c?.image ? (
          <img key={i} className="mx-face" src={c.image} alt={c.name} loading="lazy" decoding="async"
            title={`${p.summonerName || 'Invocador'} · ${c.name}`} data-me={isMe(p) ? 'true' : undefined} />
        ) : (
          <span key={i} className="mx-face" aria-hidden />
        );
      })}
    </div>
  );

  const team = (players: Participant[], side: 'blue' | 'red', bans: typeof bansBlue) => (
    <div className="mx-lteam" data-side={side}>
      <div className="mx-lteam-head">
        <b>{side === 'blue' ? 'Azul' : 'Rojo'}</b>
        <i aria-hidden />
        <span className="td-over">{players.length} jugadores</span>
      </div>
      {players.map((p, i) => (
        <PlayerRow key={i} p={p} side={side} champs={champs} version={version} runes={runes} spells={spells}
          isMe={isMe(p)} platform={rowPlatform} augmentMode={augmentMode} />
      ))}
      {bans.length > 0 && (
        <div className="mx-bans">
          <span className="td-over">Bloqueos</span>
          <div className="mx-bans-list">
            {bans.map((b, i) => {
              const c = getChampion(champs, b.championId);
              return <BanTile key={i} src={c?.image} name={c?.name} />;
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="td-root mx-embed">
      <section className="mx-bug ax-rise" data-live="true" aria-label="Partida en vivo">
        {/* Cabecera: estado, modo y acciones */}
        <div className="mx-bug-top">
          <StatusChip kind="live">En vivo</StatusChip>
          <span className="mx-bug-fact">{gameModeLabel}</span>
          {detectedOnDifferentPlatform && (
            <StatusChip kind="gold" dot={false}>Detectado en {liveGame.platformUsed?.toUpperCase()}</StatusChip>
          )}
          <span className="mx-spacer" />
          {canSpectate && (
            <Button variant="secondary" icon={<Play size={15} />} onClick={handleSpectate}>Ver en cliente</Button>
          )}
          <Button variant="secondary" disabled={!!isRefreshing} onClick={onRefresh ? onRefresh : undefined}
            icon={<RefreshCw size={15} className={isRefreshing ? 'mx-spin' : undefined} />}>
            {isRefreshing ? 'Actualizando…' : 'Actualizar'}
          </Button>
          <button type="button" className="mx-iconbtn" onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded} aria-label={expanded ? 'Ocultar el detalle de la partida' : 'Mostrar el detalle de la partida'}>
            {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
        </div>

        {/* Marcador: lado azul · reloj · lado rojo */}
        <div className="mx-bug-main">
          <div className="mx-side" data-side="blue">
            <span className="td-over mx-side-tag">Lado azul</span>
            <span className="mx-side-name">Azul</span>
          </div>
          <div className="mx-score">
            <span className="mx-live-clock">{formatTime(liveGame.gameLength || 0)}</span>
            <span className="td-over" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Clock size={12} aria-hidden /> Tiempo de partida
            </span>
          </div>
          <div className="mx-side" data-side="red">
            <span className="td-over mx-side-tag">Lado rojo</span>
            <span className="mx-side-name">Rojo</span>
          </div>
          <div className="mx-faces-row">
            {faces(blue, 'blue')}
            {faces(red, 'red')}
          </div>
        </div>

        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              style={{ overflow: 'hidden' }}
            >
              {/* Equipos */}
              <div className="mx-lteams">
                {team(blue, 'blue', bansBlue)}
                {team(red, 'red', bansRed)}
              </div>

              {/* Estado · objetivos · composición */}
              <div className="mx-info">
                <div>
                  <div className="td-over mx-info-title">Estado del juego</div>
                  <div className="mx-kv"><span>Duración</span><b>{formatTime(liveGame.gameLength || 0)}</b></div>
                  <div className="mx-kv"><span>Modo</span><b>{gameModeLabel}</b></div>
                  <div className="mx-kv"><span>Game ID</span><b>{liveGame.gameId}</b></div>
                </div>

                {/* Solo Grieta del Invocador (en ARAM/Arena no hay dragón/heraldo/barón) */}
                <div>
                  <div className="td-over mx-info-title"><Target size={13} aria-hidden /> Objetivos (estimados)</div>
                  {showObjectives ? (
                    <>
                      {objectiveTimers.map((obj, idx) => (
                        <div key={idx} className="mx-kv">
                          <span>{objectiveIcon(obj.name)}{obj.name}</span>
                          <b data-on={obj.status === 'active' ? 'true' : undefined}>
                            {obj.status === 'active' ? 'Activo ahora' : obj.time > 0 ? `~${formatTime(obj.time)}` : '—'}
                          </b>
                        </div>
                      ))}
                      <p className="mx-note">Los tiempos son aproximados, calculados con la duración de la partida.</p>
                    </>
                  ) : (
                    <p className="mx-note" style={{ marginTop: 0, fontSize: 14 }}>
                      {gameModeLabel}: sin objetivos neutrales (dragón, heraldo o barón).
                    </p>
                  )}
                </div>

                <div>
                  <div className="td-over mx-info-title"><Users size={13} aria-hidden /> Composición</div>
                  <div className="mx-comp">
                    <div data-side="blue"><b>{blue.length}</b><span className="td-over">Azul</span></div>
                    <div data-side="red"><b>{red.length}</b><span className="td-over">Rojo</span></div>
                  </div>
                  <p className="mx-note">{blue.length + red.length} invocadores en partida</p>
                </div>
              </div>

              {/* ATAK AI Live Coach */}
              <div className="mx-strip">
                <div style={{ minWidth: 0, flex: '1 1 320px' }}>
                  <div className="td-over mx-info-title" style={{ marginBottom: 4 }}>
                    <Sword size={13} aria-hidden style={{ color: 'var(--td-red)' }} /> ATAK AI Live Coach
                  </div>
                  {!aiAdvice && (
                    <p className="mx-note" style={{ margin: 0, fontSize: 13.5 }}>
                      Pulsa el botón para que el coach de IA analice la composición actual y te dé recomendaciones
                      accionables (usa el mismo modelo que el resto de ATAK).
                    </p>
                  )}
                </div>
                <Button variant="primary" disabled={aiLoading} onClick={fetchLiveAdvice}>
                  {aiLoading ? 'Pensando…' : 'Pedir consejo en vivo'}
                </Button>
              </div>
              {aiAdvice && <div className="td-sub mx-advice">{aiAdvice}</div>}

              {/* Companion de escritorio (datos reales + IA cuando TÚ juegas) */}
              <div className="mx-strip">
                <p className="mx-note" style={{ margin: 0, fontSize: 13.5, flex: '1 1 320px' }}>
                  ¿Estás jugando tú? El Companion de escritorio corre en tu equipo y lee los datos reales de la
                  partida, sin los límites de la API web.
                </p>
                <a
                  href="https://github.com/Kister87/atakgg/blob/main/atak-electron-companion/README.md"
                  target="_blank"
                  rel="noreferrer"
                  className="td-btn td-btn--secondary"
                >
                  <ExternalLink size={15} aria-hidden /> Abrir ATAK Desktop Companion
                </a>
              </div>

              {/* Pie */}
              <div className="mx-strip" data-foot="true">
                <span>Datos de Riot Spectator · Actualizado hace unos segundos</span>
                {canSpectate && (
                  <button type="button" onClick={copySpectateCommand} className="mx-textbtn">
                    {copied ? <Check size={14} style={{ color: 'var(--td-green)' }} /> : <Copy size={14} />}
                    {copied ? 'Comando copiado' : 'Copiar comando de espectador'}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}
