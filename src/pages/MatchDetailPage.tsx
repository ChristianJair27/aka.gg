// src/pages/MatchDetailPage.tsx
import { useLocation, useParams, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import { useMatchDetail, useMatchTimeline } from "@/hooks/match";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Text, Billboard, Image } from "@react-three/drei";
import { Suspense, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";


/* ====================== helpers ====================== */

type AnyObj = Record<string, any>;

const CDRAGON = "https://raw.communitydragon.org/latest";

// Icono de campeón (para las barras 3D)
const champIcon = (p: AnyObj) =>
  p?.championId != null
    ? `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${p.championId}.png`
    : undefined;

// Icono de ítem (para la lista de compras)
const itemIcon = (id?: number) =>
  id != null
    ? `${CDRAGON}/plugins/rcp-be-lol-game-data/global/default/v1/items/${id}.png`
    : undefined;

function getFrames(tl: AnyObj | undefined): AnyObj[] {
  if (!tl) return [];
  if (Array.isArray(tl?.info?.frames)) return tl.info.frames; // /timeline típico
  if (Array.isArray(tl?.frames)) return tl.frames;            // por si tu hook ya lo aplanó
  return [];
}

function getParticipants(detail: AnyObj | undefined): AnyObj[] {
  if (!detail) return [];
  if (Array.isArray(detail?.match?.info?.participants)) return detail.match.info.participants;
  if (Array.isArray(detail?.info?.participants)) return detail.info.participants;
  if (Array.isArray(detail?.participants)) return detail.participants;
  return [];
}

function toFrameKey(id: number | string | undefined) {
  if (id == null) return undefined;
  return String(id); // "1".."10"
}

/* ====================== 3D Bars (presentacional) ====================== */
function Bars3D({
  values,
  labels,
  icons,                   // <-- NUEVO
}: {
  values: number[];
  labels: string[];
  icons?: (string | undefined)[];
}) {
  const safeValues = values ?? [];
  const safeLabels = labels ?? [];
  const safeIcons  = icons ?? [];
  const max = Math.max(1, ...safeValues);
  const count = Math.max(1, safeLabels.length);
  const groundWidth = count * 1.5;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  return (
    <group>
      {/* Piso */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[groundWidth, 8]} />
        <meshStandardMaterial color="#111214" transparent opacity={0.9} />
      </mesh>

      {/* Ejes */}
      <mesh position={[0, 0.01, -4]}>
        <boxGeometry args={[groundWidth, 0.02, 0.02]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>
      <mesh position={[-groundWidth / 2 + 0.1, 0.01, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[8, 0.02, 0.02]} />
        <meshStandardMaterial color="#4b5563" />
      </mesh>

      {safeValues.map((v, i) => {
        const h = (v / max) * 5;
        const x = (i - (safeLabels.length - 1) / 2) * 1.5;
        const isHovered = hoveredIndex === i;

        return (
          <group
            key={i}
            position={[x, h / 2, 0]}
            onPointerOver={() => setHoveredIndex(i)}
            onPointerOut={() => setHoveredIndex(null)}
          >
            {/* COLUMNA */}
            <mesh>
              <boxGeometry args={[1, h, 1]} />
              <meshStandardMaterial
                color={isHovered ? "#f87171" : "#ef4444"}
                emissive={isHovered ? "#ef4444" : "#000000"}
                emissiveIntensity={isHovered ? 0.35 : 0}
              />
            </mesh>

            {/* ICONO DEL CAMPEÓN (billboard) */}
            {safeIcons[i] && (
              <Billboard position={[0, h + 0.7, 0]} follow>
                {/* Image de drei ya carga y hace material transparente */}
                <Image url={safeIcons[i]!} transparent scale={[0.9, 0.9]} />
              </Billboard>
            )}

            {/* VALOR hover */}
            {isHovered && (
              <Billboard position={[0, h + 1.5, 0]} follow>
                <Text fontSize={0.38} color="white" anchorX="center" anchorY="middle" outlineWidth={0.02} outlineColor="#000">
                  {v.toLocaleString()}
                </Text>
              </Billboard>
            )}

            {/* NOMBRE: al frente y un poco arriba del piso */}
            <Billboard position={[0, 0.12, 0.65]} follow>
              <Text
                color="#d1d5db"
                fontSize={0.28}
                anchorX="center"
                anchorY="middle"
                maxWidth={1.2}
                outlineWidth={0.015}
                outlineColor="#000"
              >
                {safeLabels[i]}
              </Text>
            </Billboard>
          </group>
        );
      })}

      <ambientLight intensity={0.6} />
      <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
      <pointLight position={[-10, 0, -10]} intensity={0.5} />
    </group>
  );
}

/* ====================== Página ====================== */
export default function MatchDetailPage() {
  const { regional, matchId } = useParams();
  const { state } = useLocation() as { state?: { puuid?: string; teamParticipants?: AnyObj[]; participantId?: number } };





  const { data: detail } = useMatchDetail(regional as string, matchId as string);
  const { data: timeline } = useMatchTimeline(regional as string, matchId as string);

  // frames normalizados
  const frames = useMemo(() => getFrames(timeline as any), [timeline]);

  // participantes + jugador actual + pid
const { participants, my, pid } = useMemo(() => {
  const detailParts = getParticipants(detail as any);
  const fromState = Array.isArray(state?.teamParticipants) ? state!.teamParticipants : [];
  const _participants = detailParts.length ? detailParts : fromState;

  // “yo” por puuid dentro de detailParts; si no, fallback
  let _my: AnyObj | undefined =
    detailParts.find(p => p.puuid === state?.puuid) ||
    (_participants.find(p => p.puuid === state?.puuid)) ||
    (detail && (typeof (detail as any).kills === "number" ? (detail as AnyObj) : undefined)) ||
    _participants[0];

  const pidNum: number | undefined =
    _my?.participantId ?? _my?.participantID ?? _my?.participant_id ?? state?.participantId;

  return { participants: _participants, my: _my, pid: toFrameKey(pidNum) };
}, [detail, state?.puuid, state?.teamParticipants, state?.participantId]);

  // barras 3D (si no hay participants, al menos el tuyo)
  const bars = useMemo(() => {
  const list = participants.length ? participants : my ? [my] : [];
  return {
    values: list.map((p: AnyObj) => p.totalDamageDealtToChampions ?? 0),
    labels: list.map((p: AnyObj, i) =>
      p.summonerName || p.championName || (list.length === 1 ? "Tú" : `P${i + 1}`)
    ),
    icons:  list.map((p: AnyObj) => champIcon(p))
  };
}, [participants, my]);

  // oro por minuto
  const goldSeries = useMemo(() => {
  const fs: AnyObj[] = timeline?.frames ?? [];
  return fs.map((f: AnyObj) => ({
    name: `${Math.floor((f.t || 0) / 60)}m`,
    azul: f.blueGold ?? 0,
    rojo: f.redGold ?? 0,
    diff: (f.blueGold ?? 0) - (f.redGold ?? 0),
  }));
}, [timeline]);

  // habilidades / compras
  const { skillOrder, itemBuys } = useMemo(() => {
  const pidNum = pid ? Number(pid) : undefined;

  const skills = (timeline?.skillUps ?? [])
    .filter(s => pidNum != null && s.participantId === pidNum)
    .map(s => ({ minute: Math.floor((s.t || 0) / 60), skillSlot: s.skillSlot, type: s.levelUpType }));

  const items = (timeline?.itemBuys ?? [])
    .filter(it => pidNum != null && it.participantId === pidNum)
    .map(it => ({ minute: Math.floor((it.t || 0) / 60), itemId: it.itemId }));

  return { skillOrder: skills, itemBuys: items };
}, [timeline, pid]);

  // (Opcional) logs temporales para verificar
   console.log({ participants: participants.length, frames: frames.length, pid });


   console.log({
  parts: participants.length,
  myKills: my?.kills,
  myDmg: my?.totalDamageDealtToChampions,
  pid,
  tl_frames: (timeline?.frames ?? []).length,
  tl_skills: (timeline?.skillUps ?? []).length,
  tl_items: (timeline?.itemBuys ?? []).length,
});

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="mb-6">
          <Link to={-1 as any} className="inline-flex items-center text-red-400 hover:text-red-300 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Volver
          </Link>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* KPIs izquierda */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="border-b border-red-700/20 pb-3">
                <CardTitle className="text-xl">Resumen</CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-3">
                <div className="text-3xl font-bold text-white">
                  {(my?.kills ?? 0)} / <span className="text-red-400">{my?.deaths ?? 0}</span> / {(my?.assists ?? 0)}
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">KDA</span>
                  <span className="font-semibold">
                    {Number.isFinite(my?.kda)
                      ? (my!.kda as number).toFixed(2)
                      : ((my?.kills + my?.assists) / Math.max(1, my?.deaths || 0)).toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">CS</span>
                  <span className="font-semibold">{my?.cs ?? my?.totalMinionsKilled ?? 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Daño a campeones</span>
                  <span className="font-semibold">{(my?.totalDamageDealtToChampions ?? 0).toLocaleString()}</span>
                </div>
                <div className={`mt-4 px-4 py-2 rounded-lg text-center font-medium ${my?.win ? "bg-green-600/20 text-green-300" : "bg-red-600/20 text-red-300"}`}>
                  {my?.win ? "VICTORIA" : "DERROTA"}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="border-b border-red-700/20 pb-3">
                <CardTitle className="text-xl">Órdenes de habilidades</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                {skillOrder.length ? (
                  <ul className="space-y-1 text-sm text-gray-200">
                    {skillOrder.map((s, i) => {
                      const label = s.skillSlot === 1 ? "Q" : s.skillSlot === 2 ? "W" : s.skillSlot === 3 ? "E" : s.skillSlot === 4 ? "R" : `S${s.skillSlot}`;
                      return (
                        <li key={i} className="flex justify-between border-b border-gray-700/40 py-1">
                          <span>Min {s.minute}</span>
                          <span className="font-medium">{label}</span>
                          <span className="text-gray-400">{s.type}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="text-sm text-gray-300 py-4 text-center">Sin datos disponibles</div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="border-b border-red-700/20 pb-3">
                <CardTitle className="text-xl">Compras</CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
  {itemBuys.length ? (
    <ul className="space-y-1 text-sm text-gray-200">
      {itemBuys.map((it, i) => (
        <li key={i} className="flex items-center justify-between border-b border-gray-700/40 py-1">
          <div className="flex items-center gap-3">
            <img
              src={itemIcon(it.itemId)}
              className="w-6 h-6 rounded border border-gray-700"
              onError={(e) => ((e.currentTarget as HTMLImageElement).style.visibility = "hidden")}
              alt={`Item ${it.itemId}`}
            />
            <span>Min {it.minute}</span>
          </div>
          <span className="text-gray-400">#{it.itemId}</span>
        </li>
      ))}
    </ul>
  ) : (
    <div className="text-sm text-gray-300 py-4 text-center">Sin datos disponibles</div>
  )}
</CardContent>
            </Card>
          </div>

          {/* Visualizaciones */}
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="border-b border-red-700/20 pb-3">
                <CardTitle className="text-xl">Daño por campeón (3D)</CardTitle>
              </CardHeader>
              <CardContent className="pt-4" style={{ height: 400 }}>
                <Canvas shadows camera={{ position: [0, 4, 8], fov: 50 }}>
                  <Suspense fallback={null}>
                     <OrbitControls target={[0, 2.5, 0]} enablePan enableZoom enableRotate />
                    <Bars3D values={bars.values} labels={bars.labels} icons={bars.icons} />
                  </Suspense>
                </Canvas>
              </CardContent>
            </Card>

            <Card className="bg-gray-800/40 border-red-700/30 backdrop-blur-sm">
              <CardHeader className="border-b border-red-700/20 pb-3">
                <CardTitle className="text-xl">Evolución de oro</CardTitle>
              </CardHeader>
              <CardContent className="pt-4" style={{ height: 250 }}>
                {goldSeries.length ? (
  <ResponsiveContainer width="100%" height="100%">
    <LineChart data={goldSeries}>
      <CartesianGrid strokeDasharray="3 3" stroke="#4b5563" />
      <XAxis dataKey="name" stroke="#9ca3af" />
      <YAxis stroke="#9ca3af" />
      <Tooltip
        contentStyle={{ backgroundColor: "rgba(31, 41, 55, 0.8)", borderColor: "#ef4444", borderRadius: "0.5rem", backdropFilter: "blur(10px)" }}
        labelStyle={{ color: "#f3f4f6" }}
      />
      {/* pinta ambos equipos */}
      <Line type="monotone" dataKey="azul" stroke="#60a5fa" strokeWidth={2} dot={{ r: 2 }} />
      <Line type="monotone" dataKey="rojo" stroke="#f87171" strokeWidth={2} dot={{ r: 2 }} />
      {/* si prefieres la diferencia en vez de dos líneas:
      <Line type="monotone" dataKey="diff" stroke="#ef4444" strokeWidth={2} dot={{ r: 2 }} />
      */}
    </LineChart>
  </ResponsiveContainer>
) : (
  <div className="flex items-center justify-center h-full text-gray-400">Sin datos de timeline disponibles</div>
)}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
