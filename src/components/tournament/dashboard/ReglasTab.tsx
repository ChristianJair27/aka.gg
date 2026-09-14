// ATAK.GG — Dashboard de torneo (extraído del componente único original).
// Sin cambios de comportamiento.

import { Trophy, Users, Swords, ScrollText, Calendar, Clock, AlertTriangle, Lock, BarChart3 } from 'lucide-react';
import { Button, StatusChip, SectionHead } from '@/components/tournament/ui';
import type { TdBoardPayload } from '@/hooks/queries/tournaments';
import { BLUE, RED, Card, EmptyState } from './shared';

export function ReglasTab({ data }: { data: TdBoardPayload }) {
  const t = data.tournament as any;

  // Reglas generadas según el tipo de torneo (tamaño, mapa, bracket, series):
  // cada formato explica sus propias mecánicas y el avance automático.
  const size = Number(t.teamSize) || 5;
  const vs = `${size}v${size}`;
  const gameMap: string = t.gameMap || 'SR';
  const bt: string = t.bracketType || 'single_elim';
  const st = Number(t.seriesTo) || 1;
  const fst = Number(t.finalSeriesTo) || st;
  const serieName = (n: number) => (n === 1 ? 'Bo1 (un juego)' : n === 2 ? 'Bo3 (primero a 2 victorias)' : 'Bo5 (primero a 3 victorias)');

  const lines: string[] = [];

  // Formato de juego
  if (gameMap === 'ARENA') {
    lines.push(
      'Modo ARENA (ladder de duplas): no hay lobbies personalizados — cada dupla juega partidas de Arena normales durante la ventana del evento.',
      'Puntuación por placement: 1º = 10 pts, 2º = 7, 3º = 6, 4º = 5, 5º = 4, 6º = 3, 7º = 2, 8º = 1. Cuentan tus 5 mejores partidas: colocarse alto vale más que jugar muchas.',
      'Ambos miembros de la dupla deben estar en la MISMA partida y el mismo equipo para que puntúe. La detección es automática desde el historial.',
      'Al cerrar la ventana, la clasificación final decide al campeón automáticamente.',
    );
  } else {
    lines.push(
      `Formato de juego: ${vs} en ${gameMap === 'ARAM' ? 'el Abismo de los Lamentos (ARAM, All Random)' : 'la Grieta del Invocador'}.`,
      size === 1
        ? 'En 1v1 tu cuenta ES tu equipo: te inscribes solo, sin suplentes.'
        : `Roster: ${size} titulares y hasta 2 suplentes. Solo juegan cuentas inscritas — los códigos están restringidos a los jugadores registrados.`,
    );
    if (bt === 'single_elim') {
      lines.push(
        'Eliminación directa: pierdes la serie y quedas fuera. Los ganadores avanzan automáticamente y cada nueva ronda recibe su código sola — no hay que reportar nada.',
      );
    } else if (bt === 'round_robin') {
      lines.push(
        'Liga (round robin): todos contra todos por jornadas. Victoria = 3 puntos; la clasificación final decide al campeón. Los códigos de cada jornada se activan automáticamente al completarse la anterior.',
      );
    } else if (bt === 'swiss') {
      const ps = Number(t.playoffsSize) || 0;
      lines.push(
        `Sistema suizo: cada ronda enfrentas a un rival con tu mismo récord, sin revanchas.${t.swissRounds
          ? ` Son ${t.swissRounds} rondas con avance automático.`
          : ' El organizador genera cada ronda al completarse la anterior.'}`,
        ...(ps >= 2 ? [
          `Playoffs: al cerrar la fase suiza, los ${ps} mejores de la clasificación pasan a eliminación directa sembrada (el 1º y el 2º solo pueden cruzarse en la gran final)${(ps & (ps - 1)) !== 0 ? ' — los mejores seeds descansan la primera ronda (BYE)' : ''}. La gran final se juega a ${serieName(fst)} y su ganador es el campeón.`,
        ] : t.swissRounds ? [
          `La última ronda suiza se juega a ${serieName(fst)} y el líder de la clasificación final es el campeón.`,
        ] : []),
      );
    }
    lines.push(
      st === fst
        ? `Series: ${serieName(st)} en todos los enfrentamientos.`
        : `Series: ${serieName(st)} durante el torneo; la final a ${serieName(fst)}.`,
      'Resultados 100% automáticos: juega con el código oficial del enfrentamiento y el sistema detecta ganador, marcador y estadísticas al terminar cada juego.',
      ...(size > 1 ? ['IMPORTANTE: en el lobby cada equipo debe jugar junto en su propio lado, igual que se registró. Si los lados quedan mezclados, el sistema no puede atribuir al ganador y el organizador tendrá que reportar el resultado a mano.'] : []),
    );
  }

  if (t.isPrivate) {
    lines.push('Torneo privado: solo pueden ver e inscribirse los jugadores invitados por el organizador.');
  }
  if (t.fearless) {
    lines.push('FEARLESS DRAFT: los campeones jugados en partidas anteriores del torneo quedan bloqueados para ambos equipos. La lista de bloqueados está en el Resumen; los capitanes son responsables de respetarla en el lobby.');
  }
  lines.push(
    `Parche de juego: ${t.patch || 'Por confirmar'}. Región: ${(t.region || '—').toUpperCase()}.`,
    ...(t.checkinDeadline ? ['Todos los jugadores deben completar el check-in antes del cierre indicado; los equipos sin check-in serán descalificados.'] : []),
    ...(gameMap !== 'ARENA' ? ['Los partidos se juegan con los códigos de torneo oficiales de Riot Games. La suplantación o el uso de cuentas no verificadas conlleva descalificación.'] : []),
    'Las decisiones de los administradores del torneo son definitivas.',
  );
  return (
    <Card>
      <SectionHead
        icon={<BarChart3 size={14} color={RED} />}
        title="REGLAS DEL TORNEO"
        right={t.rulesUrl ? (
          <Button variant="secondary" icon={<ScrollText size={14} />}
            onClick={() => window.open(t.rulesUrl!, '_blank', 'noopener')}>
            ABRIR PDF
          </Button>
        ) : undefined}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {lines.map((l, i) => (
          <p key={i} style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--td-text-2)' }}>{l}</p>
        ))}
      </div>
      {/* Reglamento oficial embebido (PDF) */}
      {t.rulesUrl && (
        <div style={{ marginTop: 16, borderRadius: 12, overflow: 'hidden', background: '#1a1a20' }}>
          <iframe
            src={`${t.rulesUrl}#view=FitH`}
            title="Reglamento oficial"
            style={{ width: '100%', height: '75vh', border: 'none', display: 'block' }}
          />
        </div>
      )}
    </Card>
  );
}

// ── EMPTY STATE ──────────────────────────────────────────────────────────────
