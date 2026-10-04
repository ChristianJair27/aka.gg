// Champion3D — modelo 3D de un campeón integrado en la página (sin caja).
//
// Es la versión general del antiguo ChampionDanceSlot: el mismo GLB con rig de
// modelviewer.lol, pero pensado para vivir dentro de un héroe o una tarjeta:
//
//  · Fluido: el <Canvas> no se monta hasta que el escenario entra en pantalla,
//    se congela al salir (frameloop 'never') y limita el DPR a 1.5.
//  · Sin saltos: el alto lo fija el contenedor y el arte 2D del campeón hace de
//    marcador de posición; al estar listo el modelo, funde uno con otro.
//  · Con presupuesto: sondea el GLB antes de cargarlo y, si pesa demasiado para
//    el dispositivo (o no hay WebGL / ahorro de datos), se queda con el arte.
//  · Accesible: con prefers-reduced-motion se queda en pose fija.
//  · Limpio: al desmontar libera geometrías, materiales y texturas.
//
// Un mismo modelo solo puede estar montado UNA vez por página (drei cachea la
// escena y un Object3D no puede tener dos padres).
import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Bounds, Center, useAnimations, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import Safe3D from '@/components/Safe3D';
import { webglSupported } from '@/lib/webgl';
import { lol } from '@/lib/lolAssets';
import { useChampions } from '@/hooks/use-ddragon';

export type ChampClip = 'idle' | 'dance' | 'taunt' | 'laugh' | 'joke' | 'recall' | 'run';

export interface Champion3DProps {
  /** Slug de Data Dragon ("Katarina", "MissFortune"). */
  slug?: string | null;
  /** Id numérico; si falta se resuelve con champion.json. */
  champId?: number | null;
  skin?: number;
  /** Animación preferida; si el modelo no la trae, cae a la siguiente mejor. */
  clip?: ChampClip;
  /** Giro lento continuo (plato giratorio). */
  spin?: boolean;
  /** El modelo se orienta sutilmente hacia el puntero. */
  follow?: boolean;
  /** Se puede arrastrar para girarlo. */
  drag?: boolean;
  /** Color de la luz de contra y del charco de luz del suelo. */
  accent?: string;
  /** Rotación inicial en Y (radianes). */
  facing?: number;
  /** Margen del encuadre (1 = ajustado). */
  fit?: number;
  /** Arte 2D de marcador / respaldo. 'none' si la página ya pinta el splash. */
  art?: 'centered' | 'loading' | 'none';
  /** Monta el modelo sin esperar a que entre en pantalla. */
  eager?: boolean;
  className?: string;
  style?: React.CSSProperties;
  /** Contenido sobrepuesto (rótulo, nombre…). */
  children?: React.ReactNode;
}

// ── Sondeo del GLB (una vez por URL) ─────────────────────────────────────────
const probes = new Map<string, Promise<{ ok: boolean; bytes: number }>>();
function probe(url: string) {
  if (!probes.has(url)) {
    probes.set(url, fetch(url, { method: 'HEAD' })
      .then((r) => ({
        ok: r.ok && !(r.headers.get('content-type') || '').includes('text/html'),
        bytes: Number(r.headers.get('content-length') || 0),
      }))
      .catch(() => ({ ok: false, bytes: 0 })));
  }
  return probes.get(url)!;
}

/** Presupuesto de descarga del modelo según dispositivo y red (bytes). 0 = no cargar. */
function modelBudget(): number {
  if (typeof window === 'undefined') return 0;
  const nav = navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string }; deviceMemory?: number };
  if (nav.connection?.saveData) return 0;
  if (/2g|3g/.test(nav.connection?.effectiveType ?? '')) return 0;
  const small = window.matchMedia('(max-width: 720px)').matches;
  const lowMem = typeof nav.deviceMemory === 'number' && nav.deviceMemory <= 4;
  return (small || lowMem ? 5 : 12) * 1024 * 1024;
}

// ── Piezas que el cliente de LoL oculta (accesorios de emotes, mascotas…) ────
const hideCache = new Map<string, Promise<Set<string>>>();
function submeshesToHide(slug: string, skin: number): Promise<Set<string>> {
  const key = `${slug.toLowerCase()}:${skin}`;
  if (!hideCache.has(key)) {
    hideCache.set(key, fetch(`https://raw.communitydragon.org/latest/game/data/characters/${slug.toLowerCase()}/skins/skin${skin}.bin.json`)
      .then((r) => (r.ok ? r.text() : ''))
      .then((raw) => {
        const m = raw.match(/"initialSubmeshToHide"\s*:\s*"([^"]*)"/);
        return new Set((m?.[1] ?? '').split(/[\s,]+/).filter(Boolean).map((x) => x.toLowerCase()));
      })
      .catch(() => new Set<string>()));
  }
  return hideCache.get(key)!;
}

// ── Elección de clip ─────────────────────────────────────────────────────────
// Los nombres varían por campeón ("Idle1", "Idle1_Raw", "Dance_Loop"…) y hay
// transiciones que no sirven en bucle ("Idle_In", "Attack1_ToIdle").
const TRANSITION = /(_in\b|_in_|to_?idle|to_?run|_to_|wndup|winddown|_out\b)/i;
const FALLBACK_ORDER: Record<ChampClip, string[]> = {
  idle: ['idle', 'dance', 'taunt'],
  dance: ['dance', 'joke', 'laugh', 'idle'],
  taunt: ['taunt', 'joke', 'idle'],
  laugh: ['laugh', 'joke', 'idle'],
  joke: ['joke', 'laugh', 'taunt', 'idle'],
  recall: ['recall', 'taunt', 'idle'],
  run: ['run', 'idle'],
};
function pickClip(names: string[], want: ChampClip): string | null {
  if (!names.length) return null;
  for (const key of FALLBACK_ORDER[want]) {
    const hits = names.filter((n) => n.toLowerCase().includes(key) && !TRANSITION.test(n) && !/\.anm$/i.test(n));
    if (hits.length) return hits.sort((a, b) => a.length - b.length)[0];
  }
  return names[0];
}

// ── Liberación de GPU con conteo de referencias ──────────────────────────────
const live = new Map<string, number>();
function retain(url: string) { live.set(url, (live.get(url) ?? 0) + 1); }
function release(url: string, scene: THREE.Object3D | undefined) {
  const n = (live.get(url) ?? 1) - 1;
  if (n > 0) { live.set(url, n); return; }
  live.delete(url);
  // Con margen: evita tirar y recargar al volver enseguida (o el doble montaje
  // de StrictMode en desarrollo).
  window.setTimeout(() => {
    if (live.has(url) || !scene) return;
    scene.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry?.dispose();
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      mats.forEach((m) => {
        if (!m) return;
        Object.values(m as unknown as Record<string, unknown>).forEach((v) => {
          if (v && (v as THREE.Texture).isTexture) (v as THREE.Texture).dispose();
        });
        m.dispose();
      });
    });
    try { useGLTF.clear(url); } catch { /* noop */ }
  }, 6000);
}

type Pointer = { x: number; drag: number };

function Model({ url, slug, skin, clip, spin, follow, facing, frozen, pointer, onReady }: {
  url: string; slug: string; skin: number; clip: ChampClip; spin: boolean; follow: boolean; facing: number;
  frozen: boolean; pointer: React.MutableRefObject<Pointer>; onReady: () => void;
}) {
  const group = useRef<THREE.Group>(null!);
  const gltf = useGLTF(url) as unknown as { scene: THREE.Group; animations: THREE.AnimationClip[] };
  const { actions, names } = useAnimations(gltf.animations || [], group);
  const [visible, setVisible] = useState(false);
  const spinT = useRef(0);

  useEffect(() => {
    retain(url);
    return () => release(url, gltf.scene);
  }, [url, gltf.scene]);

  // Oculta las piezas alternativas antes de mostrar nada.
  useEffect(() => {
    let alive = true;
    const show = () => { if (alive) { setVisible(true); onReady(); } };
    const fallback = window.setTimeout(show, 2500);
    gltf.scene.traverse((o) => { (o as THREE.Mesh).frustumCulled = false; });
    submeshesToHide(slug, skin).then((hide) => {
      if (!alive) return;
      if (hide.size) {
        gltf.scene.traverse((o) => {
          const mesh = o as THREE.Mesh;
          if (!mesh.isMesh) return;
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          if (mats.some((m) => hide.has(String(m?.name ?? '').toLowerCase()))) mesh.visible = false;
        });
      }
      window.clearTimeout(fallback);
      show();
    });
    return () => { alive = false; window.clearTimeout(fallback); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gltf.scene, slug, skin]);

  useEffect(() => {
    const name = pickClip(names, clip);
    const action = name ? actions[name] : null;
    if (!action) return;
    action.reset().fadeIn(0.35).play();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.paused = frozen;
    return () => { action.fadeOut(0.2); };
  }, [actions, names, clip, frozen]);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
    if (spin && !frozen) spinT.current += dt * 0.32;
    const target = facing + spinT.current + pointer.current.drag + (follow ? pointer.current.x * 0.42 : 0);
    g.rotation.y = THREE.MathUtils.damp(g.rotation.y, target, 4.5, dt);
  });

  return <group ref={group} visible={visible} rotation={[0, facing, 0]}><primitive object={gltf.scene} /></group>;
}

class Boundary extends React.Component<{ onFail: () => void; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFail(); }
  render() { return this.state.failed ? null : this.props.children; }
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const fn = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', fn);
    return () => mq.removeEventListener('change', fn);
  }, []);
  return reduced;
}

export default function Champion3D({
  slug, champId, skin = 0, clip = 'idle', spin = false, follow = true, drag = true,
  accent = '#e8323c', facing = 0, fit = 1.12, art = 'centered', eager = false,
  className, style, children,
}: Champion3DProps) {
  const champs = useChampions();
  const id = champId ?? (slug ? Number(champs.data?.byId[slug]?.key) || null : null);
  const wrap = useRef<HTMLDivElement>(null);
  const pointer = useRef<Pointer>({ x: 0, drag: 0 });
  const [inView, setInView] = useState(false);
  const [armed, setArmed] = useState(eager);
  const [src, setSrc] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [artLoaded, setArtLoaded] = useState(false);
  const reduced = usePrefersReducedMotion();

  // Visibilidad: monta al entrar por primera vez y pausa al salir.
  useEffect(() => {
    const el = wrap.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setInView(true); setArmed(true); return; }
    const io = new IntersectionObserver(([e]) => {
      setInView(e.isIntersecting);
      if (e.isIntersecting) setArmed(true);
    }, { rootMargin: '120px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Sondeo + presupuesto. Sin modelo válido se queda el arte 2D.
  useEffect(() => {
    setSrc(null); setReady(false);
    if (!armed || !slug || !id) return;
    const budget = modelBudget();
    if (!budget || !webglSupported()) return;
    let cancelled = false;
    const url = lol.model(slug, id, skin);
    probe(url).then((p) => {
      if (cancelled || !p.ok) return;
      if (p.bytes && p.bytes > budget) return;
      setSrc(url);
    });
    return () => { cancelled = true; };
  }, [armed, slug, id, skin]);

  // Puntero: solo mientras está en pantalla, sin provocar renders.
  useEffect(() => {
    if (!follow || !inView || reduced) return;
    const onMove = (e: PointerEvent) => { pointer.current.x = (e.clientX / window.innerWidth - 0.5) * 2; };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, [follow, inView, reduced]);

  const dragState = useRef<{ x: number; base: number } | null>(null);
  const dragHandlers = useMemo(() => (drag ? {
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === 'touch') return; // en táctil, el gesto es el scroll
      dragState.current = { x: e.clientX, base: pointer.current.drag };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (!dragState.current) return;
      pointer.current.drag = dragState.current.base + (e.clientX - dragState.current.x) * 0.012;
    },
    onPointerUp: () => { dragState.current = null; },
    onPointerCancel: () => { dragState.current = null; },
  } : {}), [drag]);

  const artSrc = slug && art !== 'none' ? (art === 'loading' ? lol.loading(slug, skin) : lol.centered(slug, skin)) : null;

  return (
    <div
      ref={wrap}
      className={`ax-stage${className ? ` ${className}` : ''}`}
      style={{ ['--accent' as string]: accent, ...style }}
      data-ready={ready}
      data-drag={drag && !!src}
      {...dragHandlers}
    >
      {artSrc && (
        <img className="ax-stage-art" src={artSrc} alt="" aria-hidden loading="lazy" decoding="async"
          data-loaded={artLoaded} onLoad={() => setArtLoaded(true)}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
      )}
      <span className="ax-stage-floor" aria-hidden />
      {src && slug && (
        <Safe3D fallback={null}>
          <Boundary onFail={() => { setSrc(null); setReady(false); }}>
            <div className="ax-stage-canvas" aria-hidden>
              <Canvas
                frameloop={reduced ? 'demand' : inView ? 'always' : 'never'}
                dpr={[1, 1.5]}
                camera={{ position: [0, 1, 3.2], fov: 30 }}
                gl={{ alpha: true, antialias: true, powerPreference: 'high-performance' }}
                resize={{ scroll: false, debounce: { scroll: 50, resize: 120 } }}
                style={{ background: 'transparent' }}
              >
                <ambientLight intensity={0.85} />
                <hemisphereLight args={['#ffffff', '#1a1016', 0.45]} />
                <directionalLight position={[3, 5, 4]} intensity={1.25} />
                <directionalLight position={[-4, 2.5, -3]} intensity={0.9} color={accent} />
                <Suspense fallback={null}>
                  <Bounds fit clip observe margin={fit}>
                    <Center>
                      <Model url={src} slug={slug} skin={skin} clip={clip} spin={spin} follow={follow && !reduced}
                        facing={facing} frozen={reduced} pointer={pointer} onReady={() => setReady(true)} />
                    </Center>
                  </Bounds>
                </Suspense>
              </Canvas>
            </div>
          </Boundary>
        </Safe3D>
      )}
      {children}
    </div>
  );
}
