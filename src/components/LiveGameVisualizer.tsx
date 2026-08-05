// src/components/LiveGameVisualizer.tsx
// Clean, modern, stats-focused Live Game Visualizer
// Uses Spectator v5 data + smart frontend simulation for cooldowns & objectives

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock, RefreshCw, Play, Copy, Check, Users, Target, Sword,
  AlertCircle, ChevronDown, ChevronUp
} from 'lucide-react';

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

// Etiquetas que cruzan al JUGADOR con el CAMPEÓN de esta partida.
function championTags(p: Participant): Array<{ text: string; cls: string }> {
  const tags: Array<{ text: string; cls: string }> = [];
  const m = p.mastery;
  if (m) {
    if (m.points >= 300_000) tags.push({ text: `Main · ${fmtPts(m.points)} pts`, cls: 'text-amber-300 border-amber-400/30 bg-amber-400/10' });
    else if (m.points >= 60_000) tags.push({ text: `Experimentado · ${fmtPts(m.points)}`, cls: 'text-emerald-300 border-emerald-400/25 bg-emerald-400/10' });
    else if (m.points > 0 && m.points < 6_000) tags.push({ text: 'Poco jugado', cls: 'text-white/55 border-white/15 bg-white/5' });
    else if (m.points === 0) tags.push({ text: 'Primera vez', cls: 'text-sky-300 border-sky-400/25 bg-sky-400/10' });
  }
  if (p.rank?.hotStreak) tags.push({ text: '🔥 Racha', cls: 'text-red-300 border-red-400/30 bg-red-400/10' });
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
    timers.push({ name: 'Baron', time: 0, status: 'active' });
  } else {
    timers.push({ name: 'Baron', time: OBJECTIVE_TIMINGS.baron - gameLength, status: 'spawns' });
  }

  return timers;
}

function PlayerRow({
  p, side, champs, version, runes, spells, isMe, platform, augmentMode,
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

  return (
    <div className={`group flex items-center gap-3 rounded-xl border p-2.5 transition-all
      ${side === 'blue' ? 'border-blue-500/20 bg-blue-500/[0.02] hover:bg-blue-500/[0.06]' : 'border-red-500/20 bg-red-500/[0.02] hover:bg-red-500/[0.06]'}
      ${isMe ? 'ring-1 ring-yellow-400/60' : ''}`}>
      
      {/* Champion */}
      <div className="relative flex-shrink-0">
        {champ?.image ? (
          <img src={champ.image} alt="" className="w-11 h-11 rounded-lg object-cover ring-1 ring-white/10" />
        ) : (
          <div className="w-11 h-11 rounded-lg bg-zinc-800" />
        )}
        {isMe && (
          <div className="absolute -top-1 -right-1 px-1 py-px text-[8px] font-black bg-yellow-400 text-black rounded">TÚ</div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {profileHref ? (
              <a href={profileHref} target="_blank" rel="noopener noreferrer"
                className="font-semibold text-sm truncate hover:text-red-400 hover:underline underline-offset-2 transition-colors">
                {p.summonerName || 'Invocador'}
              </a>
            ) : (
              <div className="font-semibold text-sm truncate">
                {p.summonerName || 'Invocador'}
              </div>
            )}
            {/* Elo del jugador (crest oficial + tier corto + LP + WR temporada) */}
            {p.rank?.tier && (
              <span
                className="flex items-center gap-1 rounded-full border px-1.5 py-0.5 flex-shrink-0"
                style={{ borderColor: `${TIER_COLORS[p.rank.tier] || '#888'}55`, background: `${TIER_COLORS[p.rank.tier] || '#888'}14` }}
                title={`${p.rank.tier} ${p.rank.rank} · ${p.rank.lp} LP${p.rank.winRate != null ? ` · ${p.rank.winRate}% WR (${p.rank.wins}V ${p.rank.losses}D)` : ''}`}
              >
                <img src={crestUrl(p.rank.tier)} className="w-4 h-4 object-contain" alt=""
                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                <span className="text-[10px] font-bold" style={{ color: TIER_COLORS[p.rank.tier] || '#ccc' }}>
                  {TIER_SHORT[p.rank.tier] || p.rank.tier} {p.rank.rank}
                </span>
                {p.rank.winRate != null && (
                  <span className={`text-[9px] font-mono ${p.rank.winRate >= 50 ? 'text-teal-300/80' : 'text-white/40'}`}>
                    {p.rank.winRate}%
                  </span>
                )}
              </span>
            )}
          </div>
          {champ && <div className="text-[10px] text-white/50 font-mono truncate flex-shrink-0">{champ.name}</div>}
        </div>

        {/* Spells + Runes row */}
        <div className="mt-1.5 flex items-center gap-3 text-[11px]">
          {/* Spells */}
          <div className="flex gap-1.5">
            {[p.spell1Id, p.spell2Id].map((sid, idx) => {
              const cd = idx === 0 ? spell1Cd : spell2Cd;
              return (
                <div key={idx} className="flex items-center gap-1 rounded bg-black/40 px-1.5 py-0.5 border border-white/10">
                  <img
                    src={getSpellIcon(version, sid)}
                    className="w-4 h-4 rounded-sm opacity-90"
                    alt=""
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <span className="font-mono text-[10px] text-white/70 tabular-nums">{Math.floor(cd / 60)}:{(cd % 60).toString().padStart(2, '0')}</span>
                </div>
              );
            })}
          </div>

          {/* Keystone — en modos con augments (Mayhem/Arena) las elecciones se
              hacen dentro de la partida y el spectator no las expone. */}
          {augmentMode ? (
            <div className="flex items-center gap-1.5 rounded bg-purple-500/10 border border-purple-500/25 px-1.5 py-0.5 text-purple-300">
              <span className="text-[10px]">Augments en partida</span>
            </div>
          ) : runeData ? (
            <div className="flex items-center gap-1.5 text-white/80">
              <img src={runeData.icon} className="w-4 h-4" alt="" />
              <span className="text-[10px] truncate max-w-[92px]">{runeData.name}</span>
            </div>
          ) : null}

          {/* Afinidad jugador↔campeón de ESTA partida (maestría) + racha */}
          {championTags(p).map((tag, i) => (
            <span key={i} className={`rounded-full border px-1.5 py-0.5 text-[10px] whitespace-nowrap ${tag.cls}`}>
              {tag.text}
            </span>
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

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-zinc-950/80 overflow-hidden">
      {/* Header - Clean & Stats Focused */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 bg-black/30">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1">
            <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-xs font-bold tracking-[1px] text-red-400">EN VIVO</span>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium text-white/90">
            <Clock className="h-4 w-4 text-white/60" />
            <span className="font-mono tabular-nums">{formatTime(liveGame.gameLength || 0)}</span>
          </div>

          <div className="text-xs text-white/60">{gameModeLabel}</div>

          {detectedOnDifferentPlatform && (
            <div className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">
              Detectado en {liveGame.platformUsed?.toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {canSpectate && (
            <button
              onClick={handleSpectate}
              className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/15 border border-white/15 px-3 py-1.5 text-xs font-semibold transition"
            >
              <Play className="h-3.5 w-3.5" /> VER EN CLIENTE
            </button>
          )}

          <button
            onClick={onRefresh ? onRefresh : undefined}
            disabled={!!isRefreshing}
            className="flex items-center gap-1.5 rounded-lg border border-white/10 hover:bg-white/5 px-3 py-1.5 text-xs font-medium transition disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Actualizando...' : 'Actualizar'}
          </button>

          <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-white/50 hover:text-white">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            {/* Teams */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/5">
              {/* Blue Side */}
              <div className="bg-zinc-950 p-4">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="text-blue-400 text-xs font-bold tracking-widest">AZUL</div>
                  <div className="flex-1 h-px bg-blue-500/20" />
                  <div className="text-[10px] text-white/40 font-mono">{blue.length} JUGADORES</div>
                </div>
                <div className="space-y-2">
                  {blue.map((p, i) => (
                    <PlayerRow key={i} p={p} side="blue" champs={champs} version={version} runes={runes} spells={spells} isMe={isMe(p)} platform={(liveGame.platformUsed || platform).toLowerCase()} augmentMode={augmentMode} />
                  ))}
                </div>

                {/* Bans Blue */}
                {bansBlue.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <div className="text-[10px] font-mono text-white/50 mb-1.5 px-1">PROHÍBIDAS</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {bansBlue.map((b, i) => {
                        const c = getChampion(champs, b.championId);
                        return (
                          <div key={i} className="relative w-7 h-7 rounded overflow-hidden ring-1 ring-white/10">
                            {c?.image && <img src={c.image} className="grayscale opacity-70" alt="" />}
                            <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center">
                              <span className="text-red-400 text-[9px]">✕</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Red Side */}
              <div className="bg-zinc-950 p-4 lg:border-l border-white/5">
                <div className="flex items-center gap-2 mb-3 px-1">
                  <div className="text-red-400 text-xs font-bold tracking-widest">ROJO</div>
                  <div className="flex-1 h-px bg-red-500/20" />
                  <div className="text-[10px] text-white/40 font-mono">{red.length} JUGADORES</div>
                </div>
                <div className="space-y-2">
                  {red.map((p, i) => (
                    <PlayerRow key={i} p={p} side="red" champs={champs} version={version} runes={runes} spells={spells} isMe={isMe(p)} platform={(liveGame.platformUsed || platform).toLowerCase()} augmentMode={augmentMode} />
                  ))}
                </div>

                {bansRed.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <div className="text-[10px] font-mono text-white/50 mb-1.5 px-1">PROHÍBIDAS</div>
                    <div className="flex gap-1.5 flex-wrap justify-end">
                      {bansRed.map((b, i) => {
                        const c = getChampion(champs, b.championId);
                        return (
                          <div key={i} className="relative w-7 h-7 rounded overflow-hidden ring-1 ring-white/10">
                            {c?.image && <img src={c.image} className="grayscale opacity-70" alt="" />}
                            <div className="absolute inset-0 bg-red-950/70 flex items-center justify-center">
                              <span className="text-red-400 text-[9px]">✕</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Stats-Focused Bottom Section */}
            <div className="border-t border-white/10 bg-black/30 p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Game Info */}
                <div>
                  <div className="uppercase text-[10px] tracking-[1px] text-white/50 mb-2 font-medium">ESTADO DEL JUEGO</div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between"><span className="text-white/60">Duración</span> <span className="font-mono font-medium">{formatTime(liveGame.gameLength || 0)}</span></div>
                    <div className="flex justify-between"><span className="text-white/60">Modo</span> <span>{gameModeLabel}</span></div>
                    <div className="flex justify-between"><span className="text-white/60">Game ID</span> <span className="font-mono text-xs text-white/70">{liveGame.gameId}</span></div>
                  </div>
                </div>

                {/* Objective Timers — solo Grieta del Invocador (en ARAM/Arena no hay dragón/heraldo/barón) */}
                <div>
                  <div className="uppercase text-[10px] tracking-[1px] text-white/50 mb-2 font-medium flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5" /> OBJETIVOS (ESTIMADOS)
                  </div>
                  {showObjectives ? (
                    <>
                      <div className="space-y-1.5 text-sm">
                        {objectiveTimers.map((obj, idx) => (
                          <div key={idx} className="flex justify-between items-center rounded bg-white/[0.025] px-3 py-1">
                            <span className="text-white/80">{obj.name}</span>
                            <span className={`font-mono text-xs ${obj.status === 'active' ? 'text-emerald-400' : 'text-white/70'}`}>
                              {obj.status === 'active' ? 'ACTIVO AHORA' : obj.time > 0 ? `~${formatTime(obj.time)}` : '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                      <div className="text-[10px] text-white/40 mt-1.5">Los tiempos son aproximados basados en la duración.</div>
                    </>
                  ) : (
                    <div className="text-xs text-white/45 rounded bg-white/[0.025] px-3 py-2">
                      {gameModeLabel}: sin objetivos neutrales (dragón/heraldo/barón).
                    </div>
                  )}
                </div>

                {/* Quick Team Stats */}
                <div>
                  <div className="uppercase text-[10px] tracking-[1px] text-white/50 mb-2 font-medium flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> COMPOSICIÓN
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center text-xs">
                    <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 py-2">
                      <div className="text-blue-400 font-bold text-lg tabular-nums">{blue.length}</div>
                      <div className="text-blue-400/70 text-[10px]">AZUL</div>
                    </div>
                    <div className="rounded-lg border border-red-500/20 bg-red-500/5 py-2">
                      <div className="text-red-400 font-bold text-lg tabular-nums">{red.length}</div>
                      <div className="text-red-400/70 text-[10px]">ROJO</div>
                    </div>
                  </div>
                  <div className="mt-2 text-[10px] text-white/50">
                    {blue.length + red.length} invocadores en partida
                  </div>
                </div>
              </div>

              {/* ATAK AI Live Coach - Like Itero style companion */}
              <div className="mt-6 pt-5 border-t border-white/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="uppercase text-[10px] tracking-[1px] text-white/50 font-medium flex items-center gap-2">
                    <Sword className="h-3.5 w-3.5" /> ATAK AI LIVE COACH
                  </div>
                  <button
                    onClick={fetchLiveAdvice}
                    disabled={aiLoading}
                    className="text-xs px-3 py-1 rounded bg-red-600/90 hover:bg-red-600 disabled:opacity-50 transition flex items-center gap-1.5"
                  >
                    {aiLoading ? 'Pensando...' : 'Pedir consejo en vivo'}
                  </button>
                </div>

                {aiAdvice ? (
                  <div className="rounded-xl bg-zinc-900/70 border border-white/10 p-4 text-sm leading-relaxed text-white/90">
                    {aiAdvice}
                  </div>
                ) : (
                  <div className="text-xs text-white/40 italic">
                    Pulsa el botón para que el coach de IA analice la composición actual y te dé recomendaciones accionables (usa el mismo modelo que el resto de ATAK).
                  </div>
                )}
              </div>

              {/* Desktop Companion Launch (for real rich LCD + AI when YOU are playing) */}
              <div className="mt-4 pt-4 border-t border-white/10 text-center">
                <a
                  href="https://github.com/Kister87/atakgg/blob/main/atak-electron-companion/README.md"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-xs px-4 py-2 rounded-lg border border-red-500/30 hover:bg-red-500/10 text-red-400 transition"
                >
                  🚀 Launch ATAK Desktop Companion (real-time stats + AI when you play)
                </a>
                <div className="text-[10px] text-white/40 mt-1">
                  (Electron app — runs locally, reads actual game data, bypasses web API limits)
                </div>
              </div>
            </div>

            {/* Footer actions */}
            <div className="flex items-center justify-between border-t border-white/10 bg-black/40 px-5 py-2.5 text-[11px] text-white/50">
              <div>Datos de Riot Spectator • Actualizado hace unos segundos</div>
              {canSpectate && (
                <button onClick={copySpectateCommand} className="flex items-center gap-1 hover:text-white transition">
                  {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                  Copiar comando de espectador
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
