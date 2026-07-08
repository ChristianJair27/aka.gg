// src/lib/dominantColor.ts — color dominante de una imagen (p.ej. splash del
// campeón) para teñir ambientes. DDragon sirve con CORS abierto, así que el
// canvas no se "taintea". Promedio ponderado por saturación: ignora negros y
// blancos (los splash son oscuros) y pesa los píxeles con color real.
import { useEffect, useState } from 'react';

const cache = new Map<string, { r: number; g: number; b: number } | null>();

export async function dominantColor(url: string): Promise<{ r: number; g: number; b: number } | null> {
  if (cache.has(url)) return cache.get(url)!;
  try {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    await new Promise<void>((res, rej) => {
      img.onload = () => res();
      img.onerror = () => rej(new Error('img'));
      img.src = url;
    });
    const N = 32;
    const c = document.createElement('canvas');
    c.width = N; c.height = N;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    if (!ctx) { cache.set(url, null); return null; }
    ctx.drawImage(img, 0, 0, N, N);
    const { data } = ctx.getImageData(0, 0, N, N);
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < data.length; i += 4) {
      const R = data[i], G = data[i + 1], B = data[i + 2];
      const mx = Math.max(R, G, B), mn = Math.min(R, G, B);
      const lum = (R + G + B) / 3;
      if (lum < 26 || lum > 235) continue;   // fuera negros/blancos
      const wt = (mx - mn) + 6;              // peso = saturación (+base)
      r += R * wt; g += G * wt; b += B * wt; w += wt;
    }
    if (!w) { cache.set(url, null); return null; }
    const out = { r: Math.round(r / w), g: Math.round(g / w), b: Math.round(b / w) };
    cache.set(url, out);
    return out;
  } catch {
    cache.set(url, null);
    return null;
  }
}

/** rgba() a partir del color extraído. */
export const tintRgba = (c: { r: number; g: number; b: number }, a: number) =>
  `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

/** Hook: color dominante de una URL (null mientras carga o si falla). */
export function useDominantColor(url?: string | null) {
  const [color, setColor] = useState<{ r: number; g: number; b: number } | null>(null);
  useEffect(() => {
    let on = true;
    if (!url) { setColor(null); return; }
    dominantColor(url).then(v => { if (on) setColor(v); });
    return () => { on = false; };
  }, [url]);
  return color;
}
