// src/components/ShareProfileCard.tsx
// Card compartible del perfil (1080x1350, formato post IG/TikTok). Se dibuja en
// un <canvas> propio — sin html2canvas — para controlar tipografía y CORS:
// DDragon y CommunityDragon sirven Access-Control-Allow-Origin:*, así que las
// imágenes cargan con crossOrigin="anonymous" y el canvas no queda "tainted".
// En móvil usa Web Share API (compartir directo a IG/TikTok/WhatsApp); en
// desktop descarga el PNG.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Share2 } from 'lucide-react';
import { memeLine } from '@/lib/memeTags';

export interface ShareProfileData {
  gameName: string;
  tagLine: string;
  platform: string;
  level?: number | null;
  profileIconUrl?: string | null;
  splashUrl?: string | null;
  emblemUrl?: string | null;
  soloRank?: { tier: string; rank: string; lp: number; wins?: number; losses?: number } | null;
  flexRank?: { tier: string; rank: string; lp: number } | null;
  topPercent?: number | string | null;
  recap?: { n: number; wins: number; losses: number; wr: number; kda: string } | null;
  /** Totales de la TEMPORADA ranked (OP.GG) — sustituyen a los 30 días cuando existen. */
  season?: { games: number; wr: number; kda: string; wins: number; losses: number } | null;
  /** Maestría del main: puntos de POR VIDA (el único total de carrera real que expone Riot). */
  mastery?: { champ: string; points: number } | null;
  bestDamage?: { value: number; champ: string } | null;
  wardsRecent?: { wards: number; games: number } | null;
  topChamps?: Array<{ iconUrl: string; name: string; games: number; wr: number }>;
}

const W = 1080;
const H = 1350;
// Render interno a 2x (2160x2700): PNG nítido en pantallas retina e IG.
const SCALE = 2;
const RED = '#e1242e';
const GOLD = '#c8aa6e';
const TEAL = '#0bc4e3';
const SITE = 'atakgg.revolution505.com';

const FONT_DISPLAY = '"Friz Quadrata Std", "Friz Quadrata", Georgia, serif';
const FONT_COND = '"Saira Condensed", "Saira", system-ui, sans-serif';

// Carga tolerante: si una imagen falla (red, CORS) o tarda más de 7s,
// devolvemos null y esa sección simplemente no se dibuja. La card nunca debe
// fallar completa ni dejar el botón "Generando…" colgado para siempre.
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

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// drawImage con recorte tipo object-fit:cover dentro de un rect.
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  const sx = (img.width - sw) / 2;
  const sy = Math.max(0, (img.height - sh) * 0.22); // sesgo hacia arriba: las caras del splash viven arriba
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

const tierLabel = (t?: string) => (t ? t.charAt(0) + t.slice(1).toLowerCase() : '');

const fmtCompact = (n: number) =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1).replace('.0', '')}M`
  : n >= 1000 ? `${(n / 1000).toFixed(1).replace('.0', '')}k`
  : String(n);

// ── Emblema de rango en HD ───────────────────────────────────────────────────
// Los PNG de ranked-emblem traen mucho padding transparente y poca resolución
// (por eso se veía chico y borroso). Preferimos el crest SVG (vectorial, escala
// sin perder) y recortamos el padding real midiendo los píxeles con alfa.
const CDRAGON_IMG = 'https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images';

function trimTransparent(img: HTMLImageElement): { src: CanvasImageSource; w: number; h: number } {
  const S = 640; // raster grande: los SVG salen nítidos y los PNG se escalan una sola vez
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const x = c.getContext('2d');
  if (!x) return { src: img, w: img.width || 1, h: img.height || 1 };
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  const iw = img.width || S, ih = img.height || S;
  const s = Math.min(S / iw, S / ih);
  x.drawImage(img, (S - iw * s) / 2, (S - ih * s) / 2, iw * s, ih * s);
  try {
    const d = x.getImageData(0, 0, S, S).data;
    let minX = S, minY = S, maxX = -1, maxY = -1;
    for (let py = 0; py < S; py++) {
      for (let px = 0; px < S; px++) {
        if (d[(py * S + px) * 4 + 3] > 10) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
      }
    }
    if (maxX < 0) return { src: c, w: S, h: S };
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    const out = document.createElement('canvas');
    out.width = bw; out.height = bh;
    out.getContext('2d')!.drawImage(c, minX, minY, bw, bh, 0, 0, bw, bh);
    return { src: out, w: bw, h: bh };
  } catch {
    // canvas tainted (no debería: todo carga con CORS) → usar sin recorte
    return { src: c, w: S, h: S };
  }
}

async function loadEmblemAsset(tier?: string | null, fallbackUrl?: string | null) {
  const t = (tier || '').toLowerCase();
  // Primero el crest EXACTO del cliente de LoL (rcp-fe-lol-shared-components,
  // 500x500 full art); el emblema de alas viejo queda solo como fallback.
  const candidates = t
    ? [
        `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${t}.png`,
        `${CDRAGON_IMG}/ranked-emblem/emblem-${t}.png`,
        fallbackUrl,
      ]
    : [fallbackUrl];
  for (const url of candidates) {
    const img = await loadImage(url || null);
    if (img) return trimTransparent(img);
  }
  return null;
}

// Partir texto en líneas que quepan en maxWidth (canvas no tiene word-wrap).
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !cur) cur = test;
    else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines - 1) break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  return lines;
}

async function renderCard(data: ShareProfileData): Promise<Blob | null> {
  // Asegurar que las fuentes de marca estén listas antes de dibujar texto.
  try {
    await Promise.all([
      document.fonts.load(`700 60px ${FONT_DISPLAY}`),
      document.fonts.load(`800 76px ${FONT_COND}`),
      document.fonts.load(`600 30px ${FONT_COND}`),
    ]);
  } catch { /* si Font Loading API falla, el fallback serif/sans sigue siendo legible */ }

  const [splash, icon, emblem, brandMark, ...champIcons] = await Promise.all([
    loadImage(data.splashUrl),
    loadImage(data.profileIconUrl),
    loadEmblemAsset(data.soloRank?.tier, data.emblemUrl),
    loadImage('/atak-logo-mark.png'),
    ...(data.topChamps || []).slice(0, 3).map((c) => loadImage(c.iconUrl)),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  // Todo el dibujo usa coordenadas 1080x1350; el scale duplica la densidad.
  ctx.scale(SCALE, SCALE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // ── Fondo ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, W, H);

  if (splash) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    drawCover(ctx, splash, 0, 0, W, 780);
    ctx.restore();
    // Fundido del splash hacia el fondo de marca
    const fade = ctx.createLinearGradient(0, 260, 0, 800);
    fade.addColorStop(0, 'rgba(10,10,12,0)');
    fade.addColorStop(1, 'rgba(10,10,12,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, 800);
    // Oscurecer arriba para que el wordmark siempre lea
    const top = ctx.createLinearGradient(0, 0, 0, 230);
    top.addColorStop(0, 'rgba(0,0,0,0.62)');
    top.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = top;
    ctx.fillRect(0, 0, W, 230);
  }

  // Glow rojo de marca
  const glow = ctx.createRadialGradient(W * 0.85, 40, 0, W * 0.85, 40, 620);
  glow.addColorStop(0, 'rgba(225,36,46,0.20)');
  glow.addColorStop(1, 'rgba(225,36,46,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, 760);

  // ── Wordmark + región ──────────────────────────────────────────────────────
  ctx.textBaseline = 'alphabetic';
  let brandX = 64;
  if (brandMark) {
    // La daga oficial junto al wordmark (la marca completa en cada card).
    const mh = 78;
    const mw = mh * (brandMark.width / brandMark.height);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 16;
    ctx.drawImage(brandMark, 64, 52, mw, mh);
    ctx.restore();
    brandX = 64 + mw + 18;
  }
  ctx.font = `700 60px ${FONT_DISPLAY}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ATAK', brandX, 118);
  const atakW = ctx.measureText('ATAK').width;
  ctx.fillStyle = RED;
  ctx.fillText('.GG', brandX + atakW + 6, 118);

  const regionTxt = (data.platform || '').toUpperCase();
  if (regionTxt) {
    ctx.font = `700 30px ${FONT_COND}`;
    const rw = ctx.measureText(regionTxt).width + 44;
    roundRectPath(ctx, W - 64 - rw, 72, rw, 52, 26);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(regionTxt, W - 64 - rw + 22, 108);
  }

  // ── Icono + nombre ─────────────────────────────────────────────────────────
  const iconY = 250;
  if (icon) {
    ctx.save();
    roundRectPath(ctx, 64, iconY, 168, 168, 26);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(icon, 64, iconY, 168, 168);
    ctx.restore();
    roundRectPath(ctx, 64, iconY, 168, 168, 26);
    ctx.strokeStyle = RED;
    ctx.lineWidth = 5;
    ctx.stroke();
    if (data.level != null) {
      ctx.font = `700 28px ${FONT_COND}`;
      const lv = `Nv. ${data.level}`;
      const lw = ctx.measureText(lv).width + 36;
      roundRectPath(ctx, 64 + 84 - lw / 2, iconY + 168 - 22, lw, 46, 23);
      ctx.fillStyle = '#0a0a0c';
      ctx.fill();
      ctx.fillStyle = GOLD;
      ctx.fillText(lv, 64 + 84 - lw / 2 + 18, iconY + 168 + 11);
    }
  }

  const nameX = icon ? 270 : 64;
  ctx.font = `800 76px ${FONT_COND}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 18;
  // Ajuste simple: encoger si el nombre no cabe hasta el bloque del emblema
  let nameSize = 76;
  while (nameSize > 40 && ctx.measureText(data.gameName).width > 640 - (nameX - 64)) {
    nameSize -= 4;
    ctx.font = `800 ${nameSize}px ${FONT_COND}`;
  }
  ctx.fillText(data.gameName, nameX, iconY + 92);
  ctx.font = `600 42px ${FONT_COND}`;
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.fillText(`#${data.tagLine}`, nameX, iconY + 148);
  ctx.shadowBlur = 0;

  // ── Rango ──────────────────────────────────────────────────────────────────
  const rank = data.soloRank;
  const emblemCx = W - 250;
  if (emblem) {
    // Emblema recortado y grande: caja de 400x350 manteniendo su aspecto real.
    const s = Math.min(400 / emblem.w, 350 / emblem.h);
    const dw = emblem.w * s, dh = emblem.h * s;
    ctx.save();
    ctx.shadowColor = 'rgba(200,170,110,0.5)';
    ctx.shadowBlur = 70;
    ctx.drawImage(emblem.src, emblemCx - dw / 2, 565 - dh / 2, dw, dh);
    ctx.restore();
  }
  if (rank) {
    ctx.textAlign = 'center';
    ctx.font = `700 52px ${FONT_DISPLAY}`;
    ctx.fillStyle = GOLD;
    ctx.fillText(`${tierLabel(rank.tier)} ${rank.rank || ''}`.trim(), emblemCx, emblem ? 800 : 560);
    ctx.font = `600 34px ${FONT_COND}`;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillText(`${rank.lp} LP · Solo/Dúo`, emblemCx, emblem ? 846 : 606);
    // Datos extra: Flex + Top % regional (si existen)
    const extras: string[] = [];
    if (data.flexRank?.tier) extras.push(`Flex ${tierLabel(data.flexRank.tier)} ${data.flexRank.rank || ''}`.trim());
    if (data.topPercent != null && data.topPercent !== '') extras.push(`Top ${data.topPercent}% ${regionTxt}`);
    if (extras.length) {
      ctx.font = `600 27px ${FONT_COND}`;
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillText(extras.join(' · '), emblemCx, emblem ? 884 : 644);
    }
    ctx.textAlign = 'left';
  }

  // ── Chips de detalles de carrera (zona libre bajo el nombre) ──────────────
  const chips: string[] = [];
  if (data.mastery) chips.push(`${fmtCompact(data.mastery.points)} maestría · ${data.mastery.champ}`);
  if (data.bestDamage) chips.push(`Mejor daño ${fmtCompact(data.bestDamage.value)}${data.bestDamage.champ ? ` · ${data.bestDamage.champ}` : ''}`);
  if (data.wardsRecent) chips.push(`${fmtCompact(data.wardsRecent.wards)} wards · últimas ${data.wardsRecent.games} partidas`);
  chips.slice(0, 3).forEach((txt, i) => {
    const cy = 466 + i * 52;
    ctx.save();
    ctx.translate(72, cy - 9);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = RED;
    ctx.fillRect(-6, -6, 12, 12);
    ctx.restore();
    ctx.font = `600 29px ${FONT_COND}`;
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 14;
    ctx.fillText(txt, 96, cy);
    ctx.shadowBlur = 0;
  });

  // ── "El dato" (meme con datos reales de la cuenta) ────────────────────────
  const statSrc = data.season ?? data.recap ?? null;
  const meme = memeLine({
    level: data.level,
    tier: rank?.tier ?? null,
    wr: statSrc?.wr ?? null,
    kda: statSrc ? Number(statSrc.kda) || null : null,
    wins: statSrc?.wins ?? null,
    losses: statSrc?.losses ?? null,
    topChamps: (data.topChamps || []).map((c) => ({ name: c.name, games: c.games, wr: c.wr })),
  });
  if (meme) {
    const labelY = 632;
    ctx.font = `600 24px ${FONT_COND}`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    let lx = 64;
    for (const ch of 'EL DATO') {
      ctx.fillText(ch, lx, labelY);
      lx += ctx.measureText(ch).width + 6;
    }
    ctx.font = `700 40px ${FONT_COND}`;
    const lines = wrapText(ctx, `“${meme}”`, 520, 3);
    ctx.fillStyle = RED;
    ctx.fillRect(64, labelY + 18, 5, lines.length * 50 - 8);
    ctx.fillStyle = GOLD;
    lines.forEach((ln, i) => ctx.fillText(ln, 86, labelY + 58 + i * 50));
  }

  // ── Banda de stats: temporada ranked completa (fallback: últimos 30 días) ──
  const bandY = 900;
  const band = data.season
    ? { cap: `TEMPORADA · ${data.season.games} PARTIDAS`, wr: data.season.wr, kda: data.season.kda, wins: data.season.wins, losses: data.season.losses }
    : data.recap
      ? { cap: 'ÚLTIMOS 30 DÍAS', wr: data.recap.wr, kda: data.recap.kda, wins: data.recap.wins, losses: data.recap.losses }
      : null;
  if (band) {
    ctx.font = `600 26px ${FONT_COND}`;
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    const cap = band.cap;
    ctx.save();
    // letter-spacing manual (canvas no siempre soporta la propiedad)
    let cx = 64;
    for (const ch of cap) {
      ctx.fillText(ch, cx, bandY);
      cx += ctx.measureText(ch).width + 6;
    }
    ctx.restore();

    roundRectPath(ctx, 64, bandY + 22, W - 128, 170, 22);
    const bandBg = ctx.createLinearGradient(0, bandY + 22, 0, bandY + 192);
    bandBg.addColorStop(0, 'rgba(16,16,20,0.92)');
    bandBg.addColorStop(1, 'rgba(10,10,13,0.92)');
    ctx.fillStyle = bandBg;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();

    const cols = [
      { label: 'VICTORIAS', value: `${band.wr}%`, color: band.wr >= 50 ? TEAL : '#ff5a64' },
      { label: 'KDA', value: band.kda, color: '#ffffff' },
      { label: 'RÉCORD', value: `${band.wins}V - ${band.losses}D`, color: GOLD },
    ];
    const colW = (W - 128) / 3;
    cols.forEach((c, i) => {
      const cxm = 64 + colW * i + colW / 2;
      ctx.textAlign = 'center';
      ctx.font = `800 64px ${FONT_COND}`;
      ctx.fillStyle = c.color;
      ctx.fillText(c.value, cxm, bandY + 118);
      ctx.font = `600 24px ${FONT_COND}`;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillText(c.label, cxm, bandY + 164);
      if (i > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.10)';
        ctx.beginPath();
        ctx.moveTo(64 + colW * i, bandY + 52);
        ctx.lineTo(64 + colW * i, bandY + 162);
        ctx.stroke();
      }
    });
    ctx.textAlign = 'left';
  }

  // ── Top campeones ──────────────────────────────────────────────────────────
  const champs = (data.topChamps || []).slice(0, 3);
  if (champs.length) {
    const rowY = 1130;
    const colW = (W - 128) / 3;
    champs.forEach((c, i) => {
      const cxm = 64 + colW * i + colW / 2;
      const img = champIcons[i];
      if (img) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cxm, rowY, 52, 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.clip();
        ctx.drawImage(img, cxm - 52, rowY - 52, 104, 104);
        ctx.restore();
        ctx.beginPath();
        ctx.arc(cxm, rowY, 52, 0, Math.PI * 2);
        ctx.strokeStyle = c.wr >= 50 ? TEAL : 'rgba(255,255,255,0.25)';
        ctx.lineWidth = 4;
        ctx.stroke();
      }
      ctx.textAlign = 'center';
      ctx.font = `700 30px ${FONT_COND}`;
      ctx.fillStyle = '#ffffff';
      ctx.fillText(c.name, cxm, rowY + 96);
      ctx.font = `600 26px ${FONT_COND}`;
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillText(`${c.wr}% WR · ${c.games}J`, cxm, rowY + 132);
      ctx.textAlign = 'left';
    });
  }

  // ── Footer de marca ────────────────────────────────────────────────────────
  ctx.fillStyle = RED;
  ctx.fillRect(64, H - 58, 64, 5);
  ctx.font = `700 30px ${FONT_COND}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(SITE, 144, H - 48);
  ctx.font = `600 26px ${FONT_COND}`;
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.textAlign = 'right';
  ctx.fillText('Sin anuncios · 100% en tu navegador', W - 64, H - 48);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

// Flujo: generar → MOSTRAR vista previa → el usuario elige Compartir/Descargar.
// El intento anterior (share/descarga directa tras el render asíncrono) fallaba
// en silencio en desktop: navigator.share() pierde la "activación de usuario"
// durante la carga de imágenes y Edge/Chrome lo rechazan con AbortError, que
// tratábamos como "canceló el usuario". Con el modal, Compartir/Descargar se
// disparan con un clic fresco (activación válida) y siempre hay feedback visual.
export function ShareProfileButton({ data, style }: { data: ShareProfileData; style?: React.CSSProperties }) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);

  const fileName = `atak-${data.gameName.replace(/\s+/g, '-').toLowerCase()}.png`;

  const notify = (msg: string) => {
    // toast si sonner está montado; alert como red de seguridad para no volver
    // a fallar en silencio.
    import('@/components/ui/sonner')
      .then(({ toast }) => toast.error(msg))
      .catch(() => window.alert(msg));
  };

  const onGenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await renderCard(data);
      if (!blob) {
        notify('No se pudo generar la imagen. Intenta de nuevo.');
        return;
      }
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch (e) {
      console.error('[ShareProfileCard] renderCard falló:', e);
      notify('No se pudo generar la imagen. Intenta de nuevo.');
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
  };

  const file = preview ? new File([preview.blob], fileName, { type: 'image/png' }) : null;
  const shareData = file
    ? {
        files: [file],
        title: `${data.gameName}#${data.tagLine} en ATAK.GG`,
        text: `Mis stats en ATAK.GG → https://${SITE}`,
      }
    : null;
  const canNativeShare = !!shareData && typeof navigator.canShare === 'function' && navigator.canShare(shareData);

  const onNativeShare = async () => {
    if (!shareData) return;
    try {
      await navigator.share(shareData);
    } catch (e: any) {
      if (e?.name !== 'AbortError') {
        console.error('[ShareProfileCard] navigator.share falló:', e);
        notify('Tu navegador no pudo abrir el menú de compartir. Usa "Descargar".');
      }
    }
  };

  const actionBtn: React.CSSProperties = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    border: 'none', borderRadius: 12, padding: '12px 22px',
    fontFamily: FONT_COND, fontWeight: 700, fontSize: 14, letterSpacing: 0.4,
    cursor: 'pointer',
  };

  return (
    <>
      <button
        onClick={onGenerate}
        disabled={busy}
        title="Genera una imagen de tu perfil para compartir en Instagram, TikTok o WhatsApp"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: busy ? 'rgba(225,36,46,0.35)' : RED,
          color: '#fff', border: 'none', borderRadius: 999,
          padding: '9px 18px', fontFamily: FONT_COND, fontWeight: 700, fontSize: 14,
          cursor: busy ? 'wait' : 'pointer', letterSpacing: 0.4,
          transition: 'background 160ms ease, transform 120ms ease',
          ...style,
        }}
        onMouseEnter={(e) => { if (!busy) (e.currentTarget as HTMLButtonElement).style.background = '#ff5a64'; }}
        onMouseLeave={(e) => { if (!busy) (e.currentTarget as HTMLButtonElement).style.background = RED; }}
      >
        <Share2 size={16} />
        {busy ? 'Generando…' : 'Compartir'}
      </button>

      {/* Portal a <body>: los paneles del perfil animan con filter/transform
          (framer-motion) y eso convierte position:fixed en relativo al panel —
          sin portal, el modal quedaba atrapado DENTRO de la card. */}
      {preview && createPortal(
        <div
          onClick={closePreview}
          role="dialog"
          aria-label="Vista previa de tu card"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: '92vw' }}>
            <img
              src={preview.url}
              alt={`Card de ${data.gameName}`}
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
              <button onClick={onDownload} style={{ ...actionBtn, background: canNativeShare ? 'rgba(255,255,255,0.12)' : RED, color: '#fff' }}>
                Descargar PNG
              </button>
              <button onClick={closePreview} style={{ ...actionBtn, background: 'transparent', color: 'rgba(255,255,255,0.55)' }}>
                Cerrar
              </button>
            </div>
            <div style={{ fontFamily: FONT_COND, fontSize: 13, color: 'rgba(255,255,255,0.45)', textAlign: 'center' }}>
              Súbela a tu historia o post y etiqueta a ATAK.GG
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
