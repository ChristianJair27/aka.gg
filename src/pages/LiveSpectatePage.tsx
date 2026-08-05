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
import { ScrollVideoBg } from '@/components/ScrollVideoBg';
import { KataLoaderOverlay } from '@/components/KataLoader';
import { Radio, ArrowLeft, Link2, Check } from 'lucide-react';

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

const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

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

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0c', color: '#e8e8ea', fontFamily: FONT_COND }}>
      <ScrollVideoBg />
      {loading && <KataLoaderOverlay show label="Buscando la partida" />}

      <div style={{ position: 'relative', zIndex: 1, maxWidth: 1180, margin: '0 auto', padding: '92px 18px 80px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 26 }}>
          <Link to={profileHref} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontSize: 14, fontWeight: 600 }}>
            <ArrowLeft size={16} /> Perfil
          </Link>
          <h1 style={{ margin: 0, fontSize: 30, fontWeight: 800, color: '#fff' }}>
            {gameName}
            <span style={{ color: 'rgba(255,255,255,0.4)', fontWeight: 600, fontSize: 20 }}> #{tagLine}</span>
          </h1>
          {live && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px', borderRadius: 999,
              background: 'rgba(225,36,46,0.15)', color: '#ff6b73', fontWeight: 700, fontSize: 13, letterSpacing: 0.6,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#e1242e', boxShadow: '0 0 10px #e1242e', animation: 'atak-live-dot 1.4s ease-in-out infinite' }} />
              EN VIVO
            </span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={copyLink} style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 999,
            background: 'rgba(255,255,255,0.07)', color: copied ? '#0bc4e3' : 'rgba(255,255,255,0.8)',
            border: 'none', cursor: 'pointer', fontFamily: FONT_COND, fontWeight: 700, fontSize: 13,
          }}>
            {copied ? <Check size={15} /> : <Link2 size={15} />}
            {copied ? 'Link copiado' : 'Compartir partida'}
          </button>
        </div>

        <style>{`@keyframes atak-live-dot { 0%,100%{opacity:1} 50%{opacity:.35} }`}</style>

        {/* Contenido */}
        {!loading && !live && (
          <div style={{ textAlign: 'center', padding: '90px 20px' }}>
            <Radio size={44} style={{ color: 'rgba(255,255,255,0.18)', marginBottom: 18 }} />
            <div style={{ fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.85)', marginBottom: 8 }}>
              {resolveQ.isError ? 'No se encontró al invocador'
                : forbidden ? 'El espectador en vivo llegará muy pronto'
                : 'No está en partida ahora mismo'}
            </div>
            <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.45)', marginBottom: 26 }}>
              {resolveQ.isError
                ? 'Verifica el Riot ID y la región del link.'
                : forbidden
                ? 'Estamos habilitando el acceso al modo espectador con Riot. Mientras tanto puedes ver el perfil completo.'
                : 'Esta página se actualiza sola cada 30 segundos: déjala abierta y la partida aparecerá al empezar.'}
            </div>
            <Link to={profileHref} style={{
              display: 'inline-block', padding: '11px 22px', borderRadius: 12, background: 'rgba(255,255,255,0.08)',
              color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 14,
            }}>
              Ver perfil completo
            </Link>
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
      </div>
    </div>
  );
}
