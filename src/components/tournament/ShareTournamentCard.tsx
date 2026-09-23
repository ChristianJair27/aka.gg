// Póster compartible del torneo — pensado para Instagram.
//
// 1080×1350 es el formato vertical de feed: el que más superficie ocupa en el
// teléfono sin que Instagram lo recorte. Se dibuja en un canvas propio, igual
// que ShareProfileCard, así que no hace falta html2canvas ni un servidor de
// imágenes.
//
// El flujo es generar → vista previa → compartir o descargar. Es a propósito:
// navigator.share() pierde la activación de usuario mientras cargan las
// imágenes, y en escritorio fallaba en silencio.
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, Loader2, Share2, X } from 'lucide-react';
import {
  SHARE_FONT_COND, SHARE_FONT_DISPLAY, SHARE_SITE,
  downloadBlobUrl, drawContain, loadImage, roundRectPath, shareFile, wrapText,
} from '@/lib/shareCanvas';

const W = 1080;
const H = 1350;
const SCALE = 2;
const RED = '#e1242e';
const GOLD = '#c8aa6e';
const WIN = '#2fbf8a';

export interface ShareTournamentData {
  id: string;
  name: string;
  /** Texto de formato ya resuelto, p. ej. "5v5 Suizo · Bo3". */
  format: string;
  startDate?: string | null;
  prize?: string | null;
  teamsRegistered?: number;
  teamsMax?: number;
  status?: 'registration' | 'live' | 'finished' | string;
  region?: string | null;
  logoUrl?: string | null;
}

const STATUS = (s?: string) =>
  s === 'live' ? { label: 'EN DIRECTO', color: RED }
  : s === 'finished' ? { label: 'FINALIZADO', color: '#8b8b95' }
  : { label: 'INSCRIPCIONES ABIERTAS', color: WIN };

function fmtDate(iso?: string | null) {
  if (!iso) return 'Por anunciar';
  const d = new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return 'Por anunciar';
  return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'long', year: 'numeric' });
}

async function renderPoster(t: ShareTournamentData): Promise<Blob | null> {
  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(SCALE, SCALE);
  ctx.textBaseline = 'alphabetic';

  // ── Fondo ──────────────────────────────────────────────────────────────────
  ctx.fillStyle = '#08080b';
  ctx.fillRect(0, 0, W, H);

  const glow = ctx.createRadialGradient(W / 2, 200, 0, W / 2, 200, 860);
  glow.addColorStop(0, 'rgba(225,36,46,0.28)');
  glow.addColorStop(1, 'rgba(225,36,46,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // Rejilla tenue: da textura sin competir con el texto.
  ctx.strokeStyle = 'rgba(255,255,255,0.028)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 60) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = 0; y <= H; y += 60) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Rieles de marca arriba y abajo.
  ctx.fillStyle = RED;
  ctx.fillRect(0, 0, W, 6);
  ctx.fillStyle = GOLD;
  ctx.fillRect(0, H - 4, W, 4);

  const PAD = 72;

  // ── Cabecera: logo + sitio ────────────────────────────────────────────────
  const brand = await loadImage('/atak-logo-mark.png');
  if (brand) drawContain(ctx, brand, PAD, 58, 54, 54);
  ctx.font = `700 30px ${SHARE_FONT_COND}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('ATAK.GG', PAD + (brand ? 68 : 0), 98);
  ctx.font = `600 22px ${SHARE_FONT_COND}`;
  ctx.fillStyle = 'rgba(255,255,255,0.42)';
  ctx.textAlign = 'right';
  ctx.fillText(SHARE_SITE, W - PAD, 96);
  ctx.textAlign = 'left';

  // ── Estado ────────────────────────────────────────────────────────────────
  const st = STATUS(t.status);
  ctx.font = `800 24px ${SHARE_FONT_COND}`;
  const stW = ctx.measureText(st.label).width + 44;
  ctx.fillStyle = `${st.color}22`;
  roundRectPath(ctx, PAD, 170, stW, 48, 24);
  ctx.fill();
  ctx.strokeStyle = `${st.color}88`;
  ctx.lineWidth = 2;
  roundRectPath(ctx, PAD, 170, stW, 48, 24);
  ctx.stroke();
  ctx.fillStyle = st.color;
  ctx.fillText(st.label, PAD + 22, 202);

  // ── Logo del torneo, si lo tiene ──────────────────────────────────────────
  let titleTop = 288;
  const tLogo = t.logoUrl ? await loadImage(t.logoUrl) : null;
  if (tLogo) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(PAD + 56, 306, 56, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#12121a';
    ctx.fillRect(PAD, 250, 112, 112);
    drawContain(ctx, tLogo, PAD, 250, 112, 112);
    ctx.restore();
    ctx.strokeStyle = 'rgba(200,170,110,0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(PAD + 56, 306, 56, 0, Math.PI * 2);
    ctx.stroke();
    titleTop = 420;
  }

  // ── Título ────────────────────────────────────────────────────────────────
  ctx.font = `700 76px ${SHARE_FONT_DISPLAY}`;
  const lines = wrapText(ctx, t.name.trim() || 'Torneo', W - PAD * 2, 3);
  ctx.fillStyle = '#ffffff';
  lines.forEach((ln, i) => ctx.fillText(ln, PAD, titleTop + i * 84));
  const afterTitle = titleTop + lines.length * 84;

  // Formato bajo el título.
  ctx.font = `700 30px ${SHARE_FONT_COND}`;
  ctx.fillStyle = RED;
  ctx.fillText(t.format.toUpperCase(), PAD, afterTitle + 22);

  // ── Bloque de datos ───────────────────────────────────────────────────────
  const teams = typeof t.teamsRegistered === 'number' && t.teamsMax
    ? `${t.teamsRegistered} / ${t.teamsMax}`
    : '—';
  const rows: Array<[string, string]> = [
    ['FECHA', fmtDate(t.startDate)],
    ['PREMIO', (t.prize || 'Por definir').slice(0, 28)],
    ['EQUIPOS', teams],
    ['REGIÓN', (t.region || 'LAN').toUpperCase()],
  ];

  const boxY = Math.max(afterTitle + 70, 760);
  const boxH = 232;
  ctx.fillStyle = 'rgba(255,255,255,0.035)';
  roundRectPath(ctx, PAD, boxY, W - PAD * 2, boxH, 24);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, PAD, boxY, W - PAD * 2, boxH, 24);
  ctx.stroke();

  const colW = (W - PAD * 2) / 2;
  rows.forEach(([label, value], i) => {
    const cx = PAD + 36 + (i % 2) * colW;
    const cy = boxY + 74 + Math.floor(i / 2) * 104;
    ctx.font = `700 20px ${SHARE_FONT_COND}`;
    ctx.fillStyle = 'rgba(255,255,255,0.40)';
    ctx.fillText(label, cx, cy - 30);
    ctx.font = `700 40px ${SHARE_FONT_COND}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(value, cx, cy + 12);
  });

  // ── Llamada a la acción ───────────────────────────────────────────────────
  const ctaY = boxY + boxH + 56;
  const grad = ctx.createLinearGradient(PAD, ctaY, W - PAD, ctaY + 108);
  grad.addColorStop(0, '#ef4444');
  grad.addColorStop(1, '#b91c1c');
  ctx.fillStyle = grad;
  roundRectPath(ctx, PAD, ctaY, W - PAD * 2, 108, 26);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.font = `800 38px ${SHARE_FONT_COND}`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(
    t.status === 'registration' ? 'INSCRIBE A TU EQUIPO' : 'SIGUE EL TORNEO EN VIVO',
    W / 2, ctaY + 52,
  );
  ctx.font = `600 24px ${SHARE_FONT_COND}`;
  ctx.fillStyle = 'rgba(255,255,255,0.82)';
  ctx.fillText(`${SHARE_SITE}/tournaments/${t.id}`.slice(0, 64), W / 2, ctaY + 86);
  ctx.textAlign = 'left';

  // ── Pie ───────────────────────────────────────────────────────────────────
  ctx.font = `600 23px ${SHARE_FONT_COND}`;
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'center';
  ctx.fillText('Códigos oficiales de Riot  ·  Brackets automáticos  ·  Sin anuncios', W / 2, H - 46);
  ctx.textAlign = 'left';

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/png'));
}

export function ShareTournamentButton({ data, className }: {
  data: ShareTournamentData;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<{ url: string; blob: Blob } | null>(null);

  const fileName = `atak-${data.id}.png`;

  const onGenerate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const blob = await renderPoster(data);
      if (!blob) throw new Error('sin blob');
      setPreview({ url: URL.createObjectURL(blob), blob });
    } catch (e) {
      console.error('[ShareTournamentCard] falló el render:', e);
      import('@/components/ui/sonner')
        .then(({ toast }) => toast.error('No se pudo generar la imagen. Intenta de nuevo.'))
        .catch(() => window.alert('No se pudo generar la imagen.'));
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (preview) URL.revokeObjectURL(preview.url);
    setPreview(null);
  };

  const share = preview
    ? shareFile(preview.blob, fileName, `${data.name} · ATAK.GG`, `Torneo en ATAK.GG → https://${SHARE_SITE}/tournaments/${data.id}`)
    : null;

  return (
    <>
      <button type="button" onClick={onGenerate} disabled={busy} className={className}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          width: '100%', padding: '10px 14px', borderRadius: 12, cursor: busy ? 'wait' : 'pointer',
          border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)',
          color: '#fff', fontSize: 12, fontWeight: 700, letterSpacing: '1.4px',
        }}>
        {busy ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
        {busy ? 'GENERANDO…' : 'COMPARTIR PÓSTER'}
      </button>

      {preview && createPortal(
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}
          style={{
            position: 'fixed', inset: 0, zIndex: 120, display: 'grid', placeItems: 'center',
            padding: 20, background: 'rgba(4,4,6,0.86)', backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: '92vh' }}>
            <img src={preview.url} alt={`Póster de ${data.name}`}
              style={{ maxHeight: '72vh', width: 'auto', borderRadius: 16, border: '1px solid rgba(255,255,255,0.12)' }} />
            <div style={{ display: 'flex', gap: 10 }}>
              {share?.supported && (
                <button type="button"
                  onClick={() => navigator.share(share.data).catch(() => { /* cancelado */ })}
                  style={{
                    flex: 1, padding: '12px 18px', borderRadius: 12, border: 0, cursor: 'pointer',
                    background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', fontWeight: 800,
                  }}>
                  Compartir
                </button>
              )}
              <button type="button" onClick={() => downloadBlobUrl(preview.url, fileName)}
                style={{
                  flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 18px', borderRadius: 12, cursor: 'pointer', fontWeight: 700,
                  border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff',
                }}>
                <Download size={15} /> Descargar
              </button>
              <button type="button" onClick={close} aria-label="Cerrar"
                style={{
                  padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.05)', color: '#fff',
                }}>
                <X size={15} />
              </button>
            </div>
            <p style={{ margin: 0, textAlign: 'center', fontSize: 11.5, color: 'rgba(255,255,255,0.45)' }}>
              1080 × 1350 — el formato vertical de Instagram.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
