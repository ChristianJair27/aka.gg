// src/pages/LiveSpectatePage.tsx
// Espectador universal en el navegador: /live/:region/:name
// Cualquier invocador (no solo torneos): si está en partida, muestra el lobby
// completo en vivo (Spectator-V5 oficial): campeones, runas, hechizos, rangos,
// bans y timers de objetivos, con auto-refresh. La URL es compartible: "mira
// mi partida" → tráfico directo. Sin instalar nada — el diferenciador ATAK.
import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { axiosInstance } from '@/lib/axios';
import { useChampions, useStaticData } from '@/hooks/use-ddragon';
import { useResolveRiotId } from '@/hooks/queries/stats';
import LiveGameVisualizer from '@/components/LiveGameVisualizer';
import { KataLoaderOverlay } from '@/components/KataLoader';
import { ArenaPage, SplashBackdrop, stagger } from '@/components/arena/primitives';
import { Button, StatusChip } from '@/components/tournament/ui';
import type { MapArt } from '@/lib/lolAssets';
import { Radio, ArrowLeft, ArrowRight, Link2, Check, SearchX, Clock } from 'lucide-react';
import '@/styles/pages/match.css';

type Platform = 'la1'|'la2'|'na1'|'br1'|'oc1'|'euw1'|'eun1'|'tr1'|'ru'|'jp1'|'kr';

const normalizePlatform = (s?: string): Platform => {
  const m: Record<string, Platform> = {
    lan:'la1', la1:'la1', las:'la2', la2:'la2', na:'na1', na1:'na1',
    br:'br1', br1:'br1', oce:'oc1', oc1:'oc1', euw:'euw1', euw1:'euw1',
    eune:'eun1', eun1:'eun1', tr:'tr1', tr1:'tr1', ru:'ru',
    kr:'kr', jp:'jp1', jp1:'jp1',
  };
  return m[(s || '').toLowerCase()] || (s as Platform) || 'la1';
};

// ":name" llega como "Nombre#TAG", "Nombre-TAG" o "Nombre" (mismo contrato que ProfilePage).
const splitNameTag = (raw?: string) => {
  const s = decodeURIComponent(raw || '').trim();
  if (!s) return { gameName: '', tagLine: '' };
  if (s.includes('#')) {
    const i = s.indexOf('#');
    return { gameName: s.slice(0, i).trim(), tagLine: s.slice(i + 1).trim() };
  }
  const i = s.lastIndexOf('-');
  if (i !== -1) {
    const t = s.slice(i + 1).trim();
    if (t.length >= 2 && t.length <= 5 && /^[A-Za-z0-9]+$/.test(t)) {
      return { gameName: s.slice(0, i).trim(), tagLine: t };
    }
  }
  return { gameName: s, tagLine: '' };
};

export default function LiveSpectatePage() {
  const { region, name } = useParams<{ region: string; name: string }>();
  const platform = normalizePlatform(region);
  const { gameName, tagLine } = splitNameTag(name);

  const { data: champs } = useChampions();
  const staticData = useStaticData();
  const version = staticData.version || (champs as any)?.version || '';

  const resolveQ = useResolveRiotId(gameName ? platform : undefined, gameName, tagLine);
  const puuid = resolveQ.data?.puuid;

  const liveQ = useQuery({
    queryKey: ['live-spectate', platform, puuid],
    enabled: !!puuid,
    // La partida cambia (drakes, tiempo): re-consultar cada 30s mientras se ve.
    refetchInterval: 30_000,
    retry: false,
    queryFn: async () => {
      const { data, status } = await axiosInstance.get(`/api/stats/spectator/${platform}/${puuid}`, {
        params: { rank: 1 },
        validateStatus: (s) => s < 500,
        timeout: 15000,
      });
      if (status === 200 && Array.isArray(data?.participants) && data.participants.length > 0) {
        const gameLength = data.gameLength ??
          (data.gameStartTime ? Math.floor((Date.now() - data.gameStartTime) / 1000) : 0);
        return { ...data, gameLength };
      }
      // La key aún no tiene Spectator-V5 aprobado por Riot → estado propio.
      if (status === 403 && data?.error === 'spectator_forbidden') return { forbidden: true };
      return null; // 204/404 → no está en partida
    },
  });

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard bloqueado: sin drama */ }
  };

  const profileHref = `/profile/${region}/${encodeURIComponent(name || '')}`;
  const loading = resolveQ.isPending || (Boolean(puuid) && liveQ.isPending);
  const payload: any = liveQ.data ?? null;
  const forbidden = payload?.forbidden === true;
  const live = payload && !forbidden ? payload : null;

  // Arte de fondo: el mapa de la partida (o la Grieta mientras no hay partida).
  const mapArt: MapArt = !live ? 'summoners-rift'
    : (live.gameMode === 'ARAM' || live.gameMode === 'KIWI' || live.queueId === 450 || live.queueId === 2400) ? 'howling-abyss'
    : (live.gameMode === 'CHERRY' || live.queueId === 1700 || live.queueId === 1710) ? 'shadow-isles'
    : 'summoners-rift';

  return (
    <ArenaPage width="wide" backdrop={<SplashBackdrop map={mapArt} opacity={0.9} position="50% 40%" />}>
      {loading && <KataLoaderOverlay show label="Buscando la partida" />}

      <Link to={profileHref} className="mx-back">
        <ArrowLeft size={16} aria-hidden /> Perfil
      </Link>

      {/* Cabecera */}
      <header className="mx-head" data-solo="true">
        <div style={{ minWidth: 0 }}>
          <div className="mx-head-row ax-rise">
            <span className="td-over ax-kicker">Espectador en vivo · {platform.toUpperCase()}</span>
            {live && <StatusChip kind="live">En vivo</StatusChip>}
          </div>
          <div className="mx-head-row" style={{ justifyContent: 'space-between', alignItems: 'flex-end', gap: '16px 24px' }}>
            <h1 className="ax-pagehero-title ax-rise" data-size="md" style={stagger(1)}>
              {gameName}
              {tagLine && <span className="mx-tag"> #{tagLine}</span>}
            </h1>
            <div className="ax-rise" style={stagger(2)}>
              <Button variant="secondary" onClick={copyLink}
                icon={copied ? <Check size={15} style={{ color: 'var(--td-green)' }} /> : <Link2 size={15} />}>
                {copied ? 'Link copiado' : 'Compartir partida'}
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Sin partida: estado claro con salida al perfil */}
      {!loading && !live && (
        <div className="ax-empty ax-rise" role="status">
          {resolveQ.isError
            ? <SearchX size={44} aria-hidden style={{ color: 'var(--td-muted)' }} />
            : <Radio size={44} aria-hidden style={{ color: 'var(--td-muted)' }} />}
          <h3>
            {resolveQ.isError ? 'No se encontró al invocador'
              : forbidden ? 'El espectador en vivo llegará muy pronto'
              : 'No está en partida ahora mismo'}
          </h3>
          <p style={{ margin: '0 auto', maxWidth: '56ch' }}>
            {resolveQ.isError
              ? 'Verifica el Riot ID y la región del link.'
              : forbidden
              ? 'Estamos habilitando el acceso al modo espectador con Riot. Mientras tanto puedes ver el perfil completo.'
              : 'Esta página se actualiza sola cada 30 segundos: déjala abierta y la partida aparecerá al empezar.'}
          </p>
          {!resolveQ.isError && !forbidden && (
            <div>
              <span className="mx-empty-note">
                <span className="mx-dot td-dot-pulse" style={{ ['--c' as string]: 'var(--td-red)' }} aria-hidden />
                <Clock size={13} aria-hidden /> Buscando partida cada 30 s
              </span>
            </div>
          )}
          <div className="mx-empty-actions">
            <Link to={profileHref} className="td-btn td-btn--primary">
              Ver perfil completo <ArrowRight size={15} aria-hidden />
            </Link>
            {resolveQ.isError && (
              <Link to="/stats" className="td-btn td-btn--secondary">Buscar otro invocador</Link>
            )}
          </div>
        </div>
      )}

      {live && (
        <LiveGameVisualizer
          liveGame={live}
          champs={champs}
          version={version}
          runes={staticData.runes}
          spells={staticData.spells}
          myRiotId={`${gameName}#${tagLine}`}
          platform={platform}
          onRefresh={() => liveQ.refetch()}
          isRefreshing={liveQ.isFetching}
        />
      )}
    </ArenaPage>
  );
}
