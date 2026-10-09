// Menú de compartir un clip: copiar enlace, WhatsApp, X, Facebook, Telegram, descargar MP4 y el
// compartir nativo del móvil. El enlace compartido es la página /share del backend, que lleva Open Graph
// con el MP4: WhatsApp, Discord, Telegram, Facebook y X muestran el video reproducible en la
// previsualización y un botón "Ver en ATAK.GG". Instagram no previsualiza enlaces: ahí se sube el archivo.
import { useEffect, useRef, useState } from 'react';
import { Share2, Link as LinkIcon, Download, Smartphone, X as CloseIcon } from 'lucide-react';
import { toast } from '@/components/ui/sonner';

export function ShareMenu({ url, mp4, title, text, compact = false, className = '' }: { url: string; mp4?: string | null; title: string; text?: string; compact?: boolean; className?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [open]);
  const msg = `${text || title} ${url}`;
  const enc = encodeURIComponent;
  const copy = async () => { try { await navigator.clipboard.writeText(url); toast('Enlace copiado'); } catch { toast(url); } setOpen(false); };
  const native = async () => { try { await navigator.share({ title, text: text || title, url }); } catch { /* cancelado */ } setOpen(false); };
  const canNative = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  const links: Array<{ label: string; href: string; color: string }> = [
    { label: 'WhatsApp', href: `https://wa.me/?text=${enc(msg)}`, color: '#25d366' },
    { label: 'X', href: `https://twitter.com/intent/tweet?text=${enc(text || title)}&url=${enc(url)}`, color: '#ffffff' },
    { label: 'Facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`, color: '#1877f2' },
    { label: 'Telegram', href: `https://t.me/share/url?url=${enc(url)}&text=${enc(text || title)}`, color: '#2aabee' },
  ];
  const btn = compact
    ? 'grid h-8 w-8 place-items-center rounded-md border border-white/[0.1] text-gray-300 hover:border-white/30 hover:text-white'
    : 'inline-flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-bold border text-gray-400 border-white/[0.08] hover:text-white hover:border-white/20 transition-colors';
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" title="Compartir" className={btn}>
        <Share2 className="h-3.5 w-3.5" />{!compact && <span>Compartir</span>}
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-white/[0.1] bg-[#121216] p-2 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.9)]">
          <div className="flex items-center justify-between px-2 pb-2 pt-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-gray-400">Compartir clip</span>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="text-gray-500 hover:text-white"><CloseIcon className="h-3.5 w-3.5" /></button>
          </div>
          <button type="button" role="menuitem" onClick={copy} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-200 hover:bg-white/[0.06]"><LinkIcon className="h-4 w-4 text-gray-400" /> Copiar enlace <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">con video</span></button>
          {canNative && <button type="button" role="menuitem" onClick={native} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-gray-200 hover:bg-white/[0.06]"><Smartphone className="h-4 w-4 text-gray-400" /> Compartir con…</button>}
          <div className="my-1 grid grid-cols-2 gap-1">
            {links.map((l) => (
              <a key={l.label} role="menuitem" href={l.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-200 hover:bg-white/[0.06]"><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />{l.label}</a>
            ))}
          </div>
          {mp4 && <a role="menuitem" href={mp4} download onClick={() => setOpen(false)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-sm text-gray-200 hover:bg-white/[0.06]"><Download className="h-4 w-4 text-gray-400" /> Descargar MP4 <span className="ml-auto text-[10px] uppercase tracking-wider text-gray-500">Instagram / TikTok</span></a>}
        </div>
      )}
    </div>
  );
}

/** URL de la página /share del backend a partir de la URL del MP4 (…/api/replays/REG/ID/clips/KEY). */
export function shareUrlFromMedia(mediaUrl?: string | null): string | null {
  const m = /^(https?:\/\/[^/]+)\/api\/replays\/([A-Za-z0-9]+)\/(\d+)\/clips\/([^/?#]+)/.exec(String(mediaUrl || ''));
  return m ? `${m[1]}/api/replays/share/${m[2]}/${m[3]}/${m[4]}` : null;
}
