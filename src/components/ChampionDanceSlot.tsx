// src/components/ChampionDanceSlot.tsx
// A SMALL panel that shows the player's highest-mastery champion as a 3D model
// "dancing" (same react-three-fiber pattern as KataLoader). The GLB files live
// under /public/models/champions/{ChampionKey}.glb (e.g. Pantheon.glb) and are
// NOT guaranteed to exist yet — so this degrades gracefully:
//
//   1. We probe the URL with a HEAD request first. Only if it exists do we mount
//      the Canvas + useGLTF (avoids Suspense throwing on a 404 / never resolving).
//   2. An error boundary wraps the 3D subtree as a second safety net.
//   3. When there is no model, we fall back to the champion's splash art with a
//      gentle Ken-Burns drift, or a centered icon — never an error, never blank.
import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { Bounds, Center, useAnimations, useGLTF } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { dd } from '@/lib/dataDragon';
import { webglSupported } from '@/lib/webgl';
import Safe3D from '@/components/Safe3D';

const RED = '#e1242e';
const GOLD = '#c8aa6e';
const FONT_COND = "'Saira Condensed', 'Saira', sans-serif";

const localModelUrl = (champKey: string) => `/models/champions/${champKey}.glb`;
// CDN de modelviewer.lol: GLB con rig + 25 clips (incluye "Dance") por campeón.
// Patrón verificado: /lol/models/{alias-lowercase}/{championId*1000}/model.glb
// CORS abierto (Access-Control-Allow-Origin: *). El probe HEAD valida que exista
// antes de montar el Canvas; si el CDN cambia, caemos a splash art sin romper.
const cdnModelUrl = (champKey: string, champId: number) =>
  `https://cdn.modelviewer.lol/lol/models/${champKey.toLowerCase()}/${champId * 1000}/model.glb`;

// ─── Error boundary: any failure inside the 3D subtree → render fallback ───────
class GLBBoundary extends React.Component<
  { fallback: React.ReactNode; children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { /* swallow — fallback already shown */ }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

// ─── The dancing model (only mounted once the GLB is confirmed present) ────────
function DanceModel({ url, onFail }: { url: string; onFail: () => void }) {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF(url) as any;
  const { actions, names } = useAnimations(gltf?.animations || [], group);

  useEffect(() => {
    if (!actions || !names || names.length === 0) return;
    const lower = names.map((n: string) => n.toLowerCase());
    const wanted = ['dance', 'emote', 'idle', 'taunt', 'loop'];
    let target = names[0];
    for (const w of wanted) {
      const i = lower.findIndex((n: string) => n.includes(w));
      if (i >= 0) { target = names[i]; break; }
    }
    const action = actions[target];
    action?.reset().fadeIn(0.3).play();
    action?.setLoop(THREE.LoopRepeat, Infinity);
    return () => { action?.fadeOut(0.2); };
  }, [actions, names]);

  // Gentle idle spin (keeps it lively even without a clip).
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      if (group.current) group.current.rotation.y += 0.0048;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  if (!gltf?.scene) { onFail(); return null; }
  return <group ref={group}><primitive object={gltf.scene} /></group>;
}

// ─── 2D fallback: splash art with a slow drift, or a centered icon ────────────
function ArtFallback({ champName, slug }: { champName: string; slug?: string }) {
  const [splashOk, setSplashOk] = useState(true);
  const splash = slug ? dd.championSplash(slug) : '';
  const icon = slug ? dd.champion(slug) : '';

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: 14, background: '#000' }}>
      {splash && splashOk ? (
        <>
          <motion.img
            src={splash}
            alt={champName}
            onError={() => setSplashOk(false)}
            initial={{ scale: 1.12, x: -8 }}
            animate={{ scale: 1.22, x: 8 }}
            transition={{ duration: 9, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center', opacity: 0.92 }}
          />
          {/* Bottom fade so the name reads cleanly. */}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(10,10,12,0.85), transparent 55%)' }} />
        </>
      ) : (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'radial-gradient(circle at 50% 40%, rgba(225,36,46,0.18), #0a0a0c 70%)' }}>
          {icon ? (
            <motion.img
              src={icon}
              alt={champName}
              animate={{ y: [-4, 4, -4] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: 72, height: 72, borderRadius: 16, objectFit: 'cover', boxShadow: `0 0 22px ${RED}66`, border: `2px solid ${RED}` }}
            />
          ) : (
            <div style={{ color: 'rgba(255,255,255,0.3)', fontFamily: FONT_COND, fontWeight: 800, fontSize: 26 }}>?</div>
          )}
        </div>
      )}
    </div>
  );
}

export interface ChampionDanceSlotProps {
  /** DDragon champion slug (e.g. "Pantheon"). When absent → icon fallback. */
  champSlug?: string;
  /** Numeric championId (e.g. 55) — habilita el modelo del CDN de modelviewer. */
  champId?: number;
  /** Localized champion name for the caption. */
  champName?: string;
  /** Color dominante del campeón (tiñe glow y luz de borde; fallback rojo marca). */
  accent?: { r: number; g: number; b: number } | null;
  /** Loading state from the profile (mastery not resolved yet). */
  loading?: boolean;
  style?: React.CSSProperties;
}

export default function ChampionDanceSlot({ champSlug, champId, champName, accent, loading, style }: ChampionDanceSlotProps) {
  const glowRgba = accent ? `rgba(${accent.r}, ${accent.g}, ${accent.b}, 0.14)` : 'rgba(225,36,46,0.10)';
  const rimColor = accent ? `rgb(${accent.r}, ${accent.g}, ${accent.b})` : RED;
  // 'checking' → probing; 'model' → GLB confirmado (src); 'fallback' → splash art.
  const [phase, setPhase] = useState<'checking' | 'model' | 'fallback'>('checking');
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!champSlug) { setPhase('fallback'); return; }
    let cancelled = false;
    setPhase('checking');

    // Probe HEAD: el archivo debe existir Y no ser el index.html de un catch-all.
    const probe = async (url: string) => {
      try {
        const res = await fetch(url, { method: 'HEAD' });
        const ct = res.headers.get('content-type') || '';
        return res.ok && !ct.includes('text/html');
      } catch { return false; }
    };

    (async () => {
      // 1) Override local (permite reemplazar un modelo puntual en /public/models).
      const local = localModelUrl(champSlug);
      if (await probe(local)) {
        if (cancelled) return;
        setSrc(local); setPhase('model');
        try { useGLTF.preload(local); } catch { /* noop */ }
        return;
      }
      // 2) CDN de modelviewer.lol (todos los campeones, con clip "Dance").
      if (champId) {
        const cdn = cdnModelUrl(champSlug, champId);
        if (await probe(cdn)) {
          if (cancelled) return;
          setSrc(cdn); setPhase('model');
          try { useGLTF.preload(cdn); } catch { /* noop */ }
          return;
        }
      }
      if (!cancelled) setPhase('fallback');
    })();

    return () => { cancelled = true; };
  }, [champSlug, champId]);

  const name = champName || champSlug || '—';

  if (!webglSupported()) {
    return (
      <div style={{ position: 'relative', height: 240, borderRadius: 16, overflow: 'hidden', ...style }}>
        <ArtFallback champName={name} slug={champSlug} />
      </div>
    );
  }

  return (
    <div
      style={{
        position: 'relative',
        height: 240,
        borderRadius: 16,
        overflow: 'hidden',
        // Sin borde: el panel se asienta con luz (glow radial del color del
        // campeón) y sombra — se funde con la página en vez de encajonarse.
        background: `radial-gradient(ellipse 70% 60% at 50% 45%, ${glowRgba}, rgba(0,0,0,0) 70%)`,
        boxShadow: '0 24px 60px -30px rgba(0,0,0,.8)',
        transition: 'background 900ms ease',
        ...style,
      }}
    >
      {loading ? (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 12 }}>
          Cargando maestría…
        </div>
      ) : phase === 'model' && champSlug && src ? (
        <GLBBoundary fallback={<ArtFallback champName={name} slug={champSlug} />}>
          <Safe3D fallback={<ArtFallback champName={name} slug={champSlug} />}>
            <Canvas
              camera={{ position: [0, 1, 3], fov: 35 }}
              dpr={[1, 1.5]}
              gl={{ alpha: true, antialias: true }}
              style={{ background: 'transparent' }}
            >
              <ambientLight intensity={0.8} />
              <directionalLight position={[3, 5, 4]} intensity={1.2} />
              <directionalLight position={[-4, 2, -3]} intensity={0.5} color={rimColor} />
              <Suspense fallback={null}>
                <Bounds fit clip observe margin={1.12}>
                  <Center>
                    <DanceModel url={src} onFail={() => setPhase('fallback')} />
                  </Center>
                </Bounds>
              </Suspense>
            </Canvas>
          </Safe3D>
        </GLBBoundary>
      ) : (
        <ArtFallback champName={name} slug={champSlug} />
      )}

      {/* Caption (always on top) */}
      <div style={{ position: 'absolute', left: 12, bottom: 10, zIndex: 2, pointerEvents: 'none' }}>
        <div style={{ fontSize: 9, letterSpacing: '0.18em', textTransform: 'uppercase', color: GOLD, fontWeight: 700 }}>
          Maestría principal
        </div>
        <div style={{ fontFamily: FONT_COND, fontWeight: 800, fontSize: 18, color: '#fff', lineHeight: 1.1, textShadow: '0 2px 8px rgba(0,0,0,0.8)' }}>
          {name}
        </div>
      </div>
    </div>
  );
}
