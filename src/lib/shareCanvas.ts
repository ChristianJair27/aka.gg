// Utilidades de dibujo para las tarjetas compartibles (canvas 2D).
//
// Se dibujan a mano, sin html2canvas: pesa menos, sale idéntico en todos los
// navegadores y no depende de que el CSS del momento se rasterice bien.
//
// Nota: ShareProfileCard.tsx y SharePodiumCard.tsx todavía llevan su propia
// copia de estas funciones. No las toqué porque están probadas y en producción;
// cuando haya que editarlas, que pasen a importar de aquí.

export const SHARE_SITE = 'atakgg.revolution505.com';

export const SHARE_FONT_DISPLAY = '"Friz Quadrata Std", "Friz Quadrata", Georgia, serif';
export const SHARE_FONT_COND = '"Saira Condensed", "Saira", system-ui, sans-serif';

/**
 * Carga tolerante: si la imagen falla (red, CORS) o tarda más de 7 s devuelve
 * null y esa sección simplemente no se dibuja. Una tarjeta incompleta es mucho
 * mejor que un botón "Generando…" colgado para siempre.
 */
export function loadImage(url?: string | null): Promise<HTMLImageElement | null> {
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

export function roundRectPath(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** drawImage con recorte tipo object-fit:cover dentro de un rect. */
export function drawCover(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  x: number, y: number, w: number, h: number, biasY = 0.22,
) {
  const s = Math.max(w / img.width, h / img.height);
  const sw = w / s;
  const sh = h / s;
  const sx = (img.width - sw) / 2;
  const sy = Math.max(0, (img.height - sh) * biasY);
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

/** drawImage tipo object-fit:contain, centrado en el rect. */
export function drawContain(
  ctx: CanvasRenderingContext2D, img: HTMLImageElement,
  x: number, y: number, w: number, h: number,
) {
  const s = Math.min(w / img.width, h / img.height);
  const dw = img.width * s;
  const dh = img.height * s;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** El canvas no tiene word-wrap: partimos el texto a mano. */
export function wrapText(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines = 3,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) {
      line = test;
    } else {
      lines.push(line);
      line = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  if (lines.length === maxLines) {
    // Recorta la última línea con puntos suspensivos si aún sobra texto.
    const joined = lines.join(' ');
    if (joined.length < text.length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1);
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

/**
 * Descarga o comparte un blob ya generado.
 *
 * Importante: `navigator.share` exige activación de usuario reciente, y se
 * pierde mientras las imágenes del canvas cargan. Por eso las tarjetas primero
 * muestran una vista previa y solo entonces llaman a esto, con un clic fresco.
 */
export function shareFile(blob: Blob, fileName: string, title: string, text: string) {
  const file = new File([blob], fileName, { type: 'image/png' });
  const data: ShareData = { files: [file], title, text };
  const supported = typeof navigator.canShare === 'function' && navigator.canShare(data);
  return { data, supported };
}

export function downloadBlobUrl(url: string, fileName: string) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
