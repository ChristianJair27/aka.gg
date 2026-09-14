// ATAK.GG — Tarjeta compartible del podio de un torneo.
//
// Mismo patrón que ShareProfileCard: un <canvas> propio a 1080×1350 dibujado a
// mano, sin html2canvas ni dependencias nuevas. Las imágenes cargan con
// crossOrigin para que el canvas no quede "tainted" y toBlob funcione.
//
// El flujo es generar → vista previa → el usuario elige Compartir o Descargar.
// Es a propósito: navigator.share() pierde la activación de usuario mientras se
// cargan las imágenes, y en escritorio fallaba en silencio.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Tip } from '@/components/ui/Tip';
import { dd } from '@/lib/dataDragon';
import { formatKda } from '@/components/tournament/PlayerRadarCard';
import type { PlayerAggregate } from '@/types/tournament-global-stats';

const W = 1080;
const H = 1350;
const SCALE = 2;
const RED = '#e1242e';
const GOLD = '#c8aa6e';
const WIN = '#2fbf8a';
const SITE = 'atakgg.revolution505.com';

const FONT_DISPLAY = '"Friz Quadrata Std", "Friz Quadrata", Georgia, serif';
const FONT_COND = '"Saira Condensed", "Saira", system-ui, sans-serif';

/** Ancho mínimo para ofrecer la tarjeta: por debajo el podio no se lee bien. */
const MIN_VIEWPORT = 720;

export interface PodiumEntry {
  rank: 1 | 2 | 3;
  player: PlayerAggregate;
  /** Valor ya formateado de la categoría (KDA, daño/min…). */
  value: string;
}

export interface SharePodiumData {
  tournamentId: string;
  tournamentName: string;
  /** Subtítulo de marca, p.ej. "Liga Queretana". */
  subtitle?: string;
  /** Categoría del podio: "KDA", "Oro/min"… */
  category: string;
  entries: PodiumEntry[];
  /** Logo del torneo servido desde /public. */
  logoUrl?: string;
}

function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    const timer = setTimeout(() => resolve(null), 7000);
    img.crossOrigin = 'anonymous';
    img.onload = () => { clearTimeout(timer); resolve(img); };
    img.onerror = () => { clearTimeout(timer); resolve(null); };
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** drawImage recortando tipo object-fit: cover dentro de un rect redondeado. */
function drawCover(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  x: number, y: number, w: number, h: number, r = 0,
) {
  const ir = img.width / img.height;
  const rr = w / h;
  let sx = 0, sy = 0, sw = img.width, sh = img.height;
  if (ir > rr) { sw = img.height * rr; sx = (img.width - sw) / 2; }
  else { sh = img.width / rr; sy = (img.height - sh) / 2; }
  ctx.save();
  if (r > 0) { roundRect(ctx, x, y, w, h, r); ctx.clip(); }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

function truncate(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

async function renderPodium(data: SharePodiumData): Promise<Blob | null> {
  try {
    await Promise.all([
      document.fonts.load(`700 60px ${FONT_DISPLAY}`),
      document.fonts.load(`800 76px ${FONT_COND}`),
      document.fonts.load(`600 30px ${FONT_COND}`),
    ]);
  } catch { /* sin Font Loading API el fallback sigue siendo legible */ }

  const [logo, brandMark, ...champs] = await Promise.all([
    loadImage(data.logoUrl),
    loadImage('/atak-logo-mark.png'),
    ...data.entries.map((e) => loadImage(dd.champion(e.player.mostPlayedChamp || 'Garen'))),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // ── Fondo: negro con sangrado crimson y toque de oro ───────────────────────
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W * 0.85, -60, 40, W * 0.85, -60, 900);
  glow.addColorStop(0, 'rgba(225,36,46,0.30)');
  glow.addColorStop(1, 'rgba(225,36,46,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const gold = ctx.createRadialGradient(W * 0.2, H + 60, 40, W * 0.2, H + 60, 760);
  gold.addColorStop(0, 'rgba(200,170,110,0.16)');
  gold.addColorStop(1, 'rgba(200,170,110,0)');
  ctx.fillStyle = gold;
  ctx.fillRect(0, 0, W, H);

  // ── Cabecera: logo del torneo + nombre ─────────────────────────────────────
  let headX = 64;
  if (logo) {
    const lh = 104;
    const lw = Math.min(260, (logo.width / logo.height) * lh);
    ctx.drawImage(logo, headX, 64, lw, lh);
    headX += lw + 26;
  }
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff';
  ctx.font = `700 46px ${FONT_DISPLAY}`;
  ctx.fillText(truncate(ctx, data.tournamentName, W - headX - 64), headX, 118);
  if (data.subtitle) {
    ctx.fillStyle = GOLD;
    ctx.font = `600 24px ${FONT_COND}`;
    ctx.fillText(data.subtitle.toUpperCase(), headX, 152);
  }

  // Filo de marca bajo la cabecera
  const edge = ctx.createLinearGradient(64, 0, W - 64, 0);
  edge.addColorStop(0, 'rgba(225,36,46,0)');
  edge.addColorStop(0.3, RED);
  edge.addColorStop(0.7, GOLD);
  edge.addColorStop(1, 'rgba(200,170,110,0)');
  ctx.fillStyle = edge;
  ctx.fillRect(64, 196, W - 128, 2);

  // ── Título del podio ───────────────────────────────────────────────────────
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.font = `600 26px ${FONT_COND}`;
  ctx.fillText('TOP 3 DEL TORNEO', 64, 254);
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 76px ${FONT_COND}`;
  ctx.fillText(data.category.toUpperCase(), 64, 330);

  // ── Filas del podio ────────────────────────────────────────────────────────
  const rowH = 232;
  const top = 396;
  const medal: Record<number, string> = { 1: GOLD, 2: '#d6d9de', 3: '#b06a3b' };

  data.entries.forEach((e, i) => {
    const y = top + i * (rowH + 22);
    const first = e.rank === 1;

    // Tarjeta
    ctx.fillStyle = first ? 'rgba(200,170,110,0.10)' : 'rgba(255,255,255,0.035)';
    roundRect(ctx, 64, y, W - 128, rowH, 26);
    ctx.fill();
    ctx.strokeStyle = first ? 'rgba(200,170,110,0.45)' : 'rgba(255,255,255,0.08)';
    ctx.lineWidth = first ? 2 : 1;
    roundRect(ctx, 64, y, W - 128, rowH, 26);
    ctx.stroke();

    // Puesto
    ctx.fillStyle = medal[e.rank];
    ctx.font = `800 96px ${FONT_COND}`;
    ctx.textAlign = 'center';
    ctx.fillText(String(e.rank), 148, y + rowH / 2 + 34);
    ctx.textAlign = 'left';

    // Campeón más jugado
    const champ = champs[i];
    const cs = first ? 148 : 124;
    const cx = 216;
    const cy = y + (rowH - cs) / 2;
    if (champ) drawCover(ctx, champ, cx, cy, cs, cs, 22);
    else {
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      roundRect(ctx, cx, cy, cs, cs, 22);
      ctx.fill();
    }

    // Nombre + detalle
    const tx = cx + cs + 28;
    const maxText = W - 64 - 300 - tx;
    ctx.fillStyle = '#ffffff';
    ctx.font = `800 ${first ? 52 : 44}px ${FONT_COND}`;
    ctx.fillText(truncate(ctx, e.player.summonerName, maxText), tx, y + rowH / 2 - 8);

    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.font = `600 26px ${FONT_COND}`;
    const kda = formatKda(e.player);
    const detail = `${e.player.gamesPlayed} PJ  ·  ${e.player.wins}-${e.player.losses}  ·  KDA ${kda.text}`;
    ctx.fillText(truncate(ctx, detail, maxText), tx, y + rowH / 2 + 34);

    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.font = `600 22px ${FONT_COND}`;
    ctx.fillText(
      truncate(ctx, e.player.championPool.slice(0, 3).join(' · '), maxText),
      tx, y + rowH / 2 + 68,
    );

    // Valor de la categoría, a la derecha
    ctx.textAlign = 'right';
    ctx.fillStyle = first ? GOLD : '#ffffff';
    ctx.font = `800 ${first ? 78 : 62}px ${FONT_COND}`;
    ctx.fillText(e.value, W - 96, y + rowH / 2 + 20);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.font = `600 22px ${FONT_COND}`;
    ctx.fillText(data.category.toUpperCase(), W - 96, y + rowH / 2 + 56);
    ctx.textAlign = 'left';
  });

  // ── Pie: marca ─────────────────────────────────────────────────────────────
  const footY = H - 70;
  if (brandMark) {
    const mh = 40;
    const mw = (brandMark.width / brandMark.height) * mh;
    ctx.drawImage(brandMark, 64, footY - 28, mw, mh);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.40)';
  ctx.font = `600 24px ${FONT_COND}`;
  ctx.textAlign = 'right';
  ctx.fillText(SITE, W - 64, footY);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

/**
 * Botón "Compartir podio". Se oculta solo en pantallas estrechas: la tarjeta
 * es de 1080×1350 y por debajo de 720px la vista previa no se lee, así que es
 * mejor no ofrecerla que entregar algo roto.
 */
export function SharePodiumButton({ data, style }: { data: SharePodiumData; style?: React.CSSProperties }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);
  const tooNarrow = typeof window !== 'undefined' && window.innerWidth < MIN_VIEWPORT;

  if (tooNarrow || data.entries.length === 0) return null;

  const fileName = `atakgg-podio-${data.tournamentId}.png`;

  const onGenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await renderPodium(data);
      if (!blob) { toast.error('No se pudo generar la imagen. Intenta de nuevo.'); return; }
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch (e) {
      console.error('[SharePodiumCard] renderPodium falló:', e);
      toast.error('No se pudo generar la imagen. Intenta de nuevo.');
    } finally {
      setBusy(false);
    }
  };

  const closePreview = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const onDownload = () => {
    if (!preview) return;
    const a = document.createElement('a');
    a.href = preview.url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    toast.success('Podio descargado');
  };

  const file = preview ? new File([preview.blob], fileName, { type: 'image/png' }) : null;
  const shareData = file
    ? {
        files: [file],
        title: `Top 3 ${data.category} — ${data.tournamentName}`,
        text: `Podio de ${data.tournamentName} en ATAK.GG → https://${SITE}`,
      }
    : null;
  const canNativeShare = !!shareData && typeof navigator.canShare === 'function' && navigator.canShare(shareData);

  const onNativeShare = async () => {
    if (!shareData) return;
    try { await navigator.share(shareData); }
    catch (e: any) {
      if (e?.name !== 'AbortError') {
        toast.error('Tu navegador no pudo abrir el menú de compartir. Usa "Descargar".');
      }
    }
  };

  const actionBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: 'none', borderRadius: 12, padding: '12px 22px',
    fontFamily: FONT_COND, fontWeight: 700, fontSize: 14, letterSpacing: 0.4, cursor: 'pointer',
  };

  return (
    <>
      <Tip label="Genera una imagen del Top 3 para compartir">
        <button
          type="button"
          onClick={onGenerate}
          disabled={busy}
          className="td-share-podium"
          style={style}
        >
          <Share2 size={13} />
          {busy ? 'Generando…' : 'Compartir podio'}
        </button>
      </Tip>

      {preview && createPortal(
        <div
          onClick={closePreview}
          role="dialog"
          aria-label="Vista previa del podio"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '92vw' }}>
            <img
              src={preview.url}
              alt={`Podio de ${data.tournamentName}`}
              style={{
                maxHeight: '72vh', maxWidth: '92vw', borderRadius: 16,
                boxShadow: '0 24px 80px -20px rgba(225,36,46,0.45), 0 8px 40px rgba(0,0,0,0.8)',
              }}
            />
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
              {canNativeShare && (
                <button onClick={onNativeShare} style={{ ...actionBtn, background: RED, color: '#fff' }}>
                  <Share2 size={16} /> Compartir
                </button>
              )}
              <button onClick={onDownload}
                style={{ ...actionBtn, background: canNativeShare ? 'rgba(255,255,255,0.12)' : RED, color: '#fff' }}>
                Descargar PNG
              </button>
              <button onClick={closePreview}
                style={{ ...actionBtn, background: 'transparent', color: 'rgba(255,255,255,0.55)' }}>
                Cerrar
              </button>
            </div>
            <div style={{ fontFamily: FONT_COND, fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
              Súbela a tu historia y etiqueta a ATAK.GG
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

export default SharePodiumButton;
