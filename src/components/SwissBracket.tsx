// SwissBracket — vista de bracket para torneos suizos / round robin.
// No hay árbol de eliminación, así que el "bracket" son columnas por ronda con
// cards grandes: marcador protagonista, chips BO, avance del pareo por récord
// y stats de la serie expandibles a lo ancho. Animado con stagger por columna.
import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, Copy, Crown, Radio, Swords, Trophy, X } from 'lucide-react';
import { TeamBadge } from '@/components/tournament/ui';
import { TournamentMatchStats } from '@/components/TournamentMatchStats';
import type { BracketMatch } from '@/hooks/queries/tournaments';

const GOLD = '#c8aa6e';

function CopyCode({ code }: { code: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(code);
        setOk(true);
        setTimeout(() => setOk(false), 2000);
      }}
      className="flex items-center gap-1.5 w-full justify-center h-8 rounded-lg bg-red-500/10 border border-red-500/25
        text-[11px] font-mono text-red-200 hover:bg-red-500/20 transition"
      title="Copiar código de partida"
    >
      {ok ? <Check className="h-3 w-3 text-green-400" /> : <Copy className="h-3 w-3" />}
      <span className="truncate">{ok ? '¡Copiado!' : code}</span>
    </button>
  );
}

function SwissMatchCard({
  m, open, onToggle, canViewCodes, delay,
}: {
  m: BracketMatch; open: boolean; onToggle: () => void; canViewCodes: boolean; delay: number;
}) {
  const isBye = m.team1 === 'BYE' || m.team2 === 'BYE';
  const hasStats = m.matchStatus !== 'pending' && !isBye;
  const seriesTo = Number((m as any).seriesTo) || 1;
  const boLabel = seriesTo > 1 ? `BO${seriesTo * 2 - 1}` : 'BO1';

  const ribbon =
    m.matchStatus === 'complete' ? { txt: 'Finalizado', cls: 'bg-green-500/10 text-green-400' }
    : m.matchStatus === 'active' ? { txt: 'En juego', cls: 'bg-red-500/15 text-red-300' }
    : m.matchStatus === 'ready' ? { txt: 'Por jugar', cls: 'bg-white/[0.05] text-gray-400' }
    : { txt: 'Pendiente', cls: 'bg-white/[0.03] text-gray-600' };

  const TeamLine = ({ name, score }: { name: string | null; score?: number }) => {
    const won = !!name && name === m.winner;
    const lost = !!m.winner && !won && !!name && name !== 'BYE';
    return (
      <div className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition ${
        won ? 'bg-green-500/10' : 'bg-white/[0.02]'
      }`}>
        <TeamBadge name={name === 'BYE' ? undefined : name ?? undefined} size={32} />
        <span className={`flex-1 min-w-0 truncate text-[14.5px] ${
          won ? 'font-extrabold text-white'
          : lost ? 'font-medium text-white/35 line-through'
          : name === 'BYE' ? 'italic text-white/25'
          : 'font-semibold text-white/80'
        }`}>
          {name === 'BYE' ? 'Descansa (BYE)' : name || 'Por definir'}
        </span>
        {won && <Crown className="h-4 w-4 flex-shrink-0" style={{ color: GOLD }} />}
        <span className={`min-w-[26px] text-right text-xl font-black tabular-nums ${
          won ? 'text-green-300' : 'text-white/40'
        }`}>
          {score ?? '–'}
        </span>
      </div>
    );
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 18, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={hasStats ? { y: -3 } : undefined}
      onClick={hasStats ? onToggle : undefined}
      className={`td-panel overflow-hidden ${hasStats ? 'cursor-pointer' : ''} ${
        open ? '!border-red-500/45' : ''
      } ${m.matchStatus === 'active' ? '!border-red-500/40 shadow-[0_0_24px_rgba(225,36,46,0.15)]' : ''} ${
        isBye ? 'opacity-55' : ''
      }`}
      style={{ width: 300 }}
      role={hasStats ? 'button' : undefined}
      aria-expanded={open}
    >
      {/* Cinta de estado */}
      <div className={`px-3.5 py-1.5 flex items-center justify-between text-[10.5px] font-bold uppercase tracking-wider ${ribbon.cls}`}>
        <span className="flex items-center gap-1.5">
          {m.matchStatus === 'active' && <Radio className="h-2.5 w-2.5 animate-pulse" />}
          {ribbon.txt}
        </span>
        <span className="px-1.5 rounded bg-black/30 font-black tracking-normal" style={{ color: GOLD }}>
          {boLabel}
        </span>
      </div>

      <div className="p-2.5 space-y-1.5">
        <TeamLine name={m.team1} score={m.score1} />
        <TeamLine name={m.team2} score={m.score2} />
      </div>

      {canViewCodes && m.code && m.matchStatus !== 'complete' && !isBye && (
        <div className="px-2.5 pb-2.5">
          <CopyCode code={m.code} />
        </div>
      )}

      {hasStats && (
        <div className={`px-3.5 py-2 border-t border-white/[0.06] text-center text-[11.5px] font-semibold transition ${
          open ? 'text-red-200 bg-red-500/10' : 'text-red-300/70'
        }`}>
          {open ? 'Ocultar stats de la serie' : 'Ver stats de la serie'}
        </div>
      )}
    </motion.div>
  );
}

export function SwissBracket({
  bracket, bracketType, tournamentId, isActive, canViewCodes = false, champion,
}: {
  bracket: BracketMatch[];
  bracketType?: string;
  tournamentId: string;
  isActive: boolean;
  canViewCodes?: boolean;
  /** Campeón (torneo cerrado) para la tarjeta final. */
  champion?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const rounds = Array.from(new Set(bracket.map((m) => m.round))).sort((a, b) => a - b);
  const openMatch = bracket.find((m) => m.id === openId) ?? null;

  const roundLabel = (r: number) => (bracketType === 'round_robin' ? `Jornada ${r}` : `Ronda ${r}`);
  const roundState = (r: number) => {
    const ms = bracket.filter((m) => m.round === r);
    if (ms.every((m) => m.matchStatus === 'complete')) return { txt: 'Completa', cls: 'text-green-400' };
    if (ms.some((m) => m.matchStatus === 'active')) return { txt: 'En juego', cls: 'text-red-300' };
    return { txt: 'En espera', cls: 'text-gray-500' };
  };

  return (
    <div className="td-panel" style={{ padding: 20 }}>
      <div className="flex items-center gap-2.5 mb-5">
        <Trophy className="h-5 w-5 text-red-400" />
        <h2 className="text-lg font-bold text-white">
          Bracket {bracketType === 'round_robin' ? '· Liga' : '· Suizo'}
        </h2>
        <span className="text-xs text-gray-500 hidden sm:inline">
          — pareos por récord cada ronda, clic en una serie para ver sus stats
        </span>
      </div>

      <div className="overflow-x-auto pb-2">
        <div className="flex items-start gap-8 min-w-max">
          {rounds.map((r, ri) => {
            const st = roundState(r);
            const ms = bracket.filter((m) => m.round === r);
            const isFinalRound = ri === rounds.length - 1 && champion != null;
            return (
              <div key={r} className="flex items-start gap-8">
                <div className="flex flex-col gap-4">
                  {/* Cabecera de la ronda */}
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: ri * 0.12 }}
                    className="flex items-baseline justify-between px-1"
                  >
                    <span className="text-[12px] font-black uppercase tracking-[0.18em] text-white/85">
                      {roundLabel(r)}
                    </span>
                    <span className={`text-[10.5px] font-bold uppercase tracking-wider ${st.cls}`}>{st.txt}</span>
                  </motion.div>
                  {ms.map((m, mi) => (
                    <SwissMatchCard
                      key={m.id}
                      m={m}
                      open={openId === m.id}
                      onToggle={() => setOpenId(openId === m.id ? null : m.id)}
                      canViewCodes={canViewCodes}
                      delay={ri * 0.12 + mi * 0.07}
                    />
                  ))}
                </div>

                {/* Flecha de avance entre rondas */}
                {ri < rounds.length - 1 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: ri * 0.12 + 0.25 }}
                    className="self-center flex flex-col items-center gap-1 text-white/20 pt-10"
                    aria-hidden
                  >
                    <Swords className="h-4 w-4" />
                    <span className="text-[9px] uppercase tracking-widest text-white/25 [writing-mode:vertical-rl]">
                      pareo por récord
                    </span>
                  </motion.div>
                )}

                {/* Campeón al final */}
                {isFinalRound && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: rounds.length * 0.12 + 0.2, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                    className="self-center mt-8 w-[210px] rounded-2xl border p-5 text-center"
                    style={{
                      borderColor: 'rgba(200,170,110,0.45)',
                      background: 'linear-gradient(180deg, rgba(200,170,110,0.12), rgba(120,90,40,0.06))',
                      boxShadow: '0 0 34px rgba(200,170,110,0.15)',
                    }}
                  >
                    <Crown className="h-10 w-10 mx-auto mb-2" style={{ color: GOLD }} />
                    <div className="flex justify-center mb-2"><TeamBadge name={champion ?? undefined} size={44} /></div>
                    <p className="text-[10px] uppercase tracking-[0.2em]" style={{ color: 'rgba(200,170,110,0.8)' }}>Campeón</p>
                    <p className="text-lg font-extrabold text-white mt-1 break-words">{champion}</p>
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Stats de la serie seleccionada, a lo ancho */}
      <AnimatePresence>
        {openMatch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="mt-5 rounded-2xl border border-white/[0.08] bg-black/30 p-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-semibold text-white">
                  {openMatch.team1} <span className="text-gray-600">vs</span> {openMatch.team2}
                  <span className="ml-2 text-xs text-gray-500 tabular-nums">
                    {openMatch.score1 ?? 0}–{openMatch.score2 ?? 0}
                  </span>
                </p>
                <button
                  onClick={() => setOpenId(null)}
                  className="p-1 rounded-lg text-gray-500 hover:text-white hover:bg-white/[0.08] transition"
                  aria-label="Cerrar stats"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <TournamentMatchStats tournamentId={tournamentId} match={openMatch as any} isActive={isActive} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default SwissBracket;
