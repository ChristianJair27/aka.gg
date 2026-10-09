// Selector de stickers para los comentarios: favoritos, populares, míos y subir uno nuevo (png/gif/webp/jpg ≤ 2 MB).
// Un sticker que sube cualquier usuario queda disponible para todos; cada quien lo guarda en favoritos con la estrella.
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Star, Upload, X } from 'lucide-react';
import axiosInstance from '@/lib/axios';
import { toast } from '@/components/ui/sonner';

export interface Sticker { id: number; name?: string | null; mime: string; url: string; fav: boolean; uses?: number }
type Scope = 'favs' | 'recent' | 'mine';

export async function uploadMedia(file: Blob, kind: 'video' | 'image' | 'sticker', name?: string, onProgress?: (p: number) => void): Promise<{ id: number; url: string; mime: string }> {
  const { data } = await axiosInstance.post('/api/social/media', file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream', 'X-Media-Kind': kind, 'X-Media-Name': encodeURIComponent(name || '') },
    onUploadProgress: (e) => { if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100)); },
    maxBodyLength: Infinity, maxContentLength: Infinity,
  });
  return data;
}

export function StickerPicker({ open, onClose, onPick, isAuth }: { open: boolean; onClose: () => void; onPick: (s: Sticker) => void; isAuth: boolean }) {
  const [scope, setScope] = useState<Scope>('favs');
  const [items, setItems] = useState<Sticker[]>([]);
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = async (sc: Scope) => {
    setLoading(true);
    try { const { data } = await axiosInstance.get('/api/social/stickers', { params: { scope: sc } }); setItems(data || []); } catch { setItems([]); } finally { setLoading(false); }
  };
  useEffect(() => { if (open) void load(scope); }, [open, scope]);
  const fav = async (s: Sticker, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuth) return toast('Inicia sesión para guardar stickers');
    try { const { data } = await axiosInstance.post(`/api/social/stickers/${s.id}/fav`); setItems((xs) => xs.map((x) => (x.id === s.id ? { ...x, fav: !!data?.fav } : x))); toast(data?.fav ? 'Sticker guardado en favoritos' : 'Quitado de favoritos'); } catch { toast('No se pudo guardar'); }
  };
  const upload = async (f: File | undefined) => {
    if (!f) return;
    if (!isAuth) return toast('Inicia sesión para subir stickers');
    if (f.size > 2 * 1024 * 1024) return toast('El sticker debe pesar menos de 2 MB');
    try { const m = await uploadMedia(f, 'sticker', f.name.replace(/\.[^.]+$/, '')); await axiosInstance.post(`/api/social/stickers/${m.id}/fav`).catch(() => {}); toast('Sticker creado y guardado en tus favoritos'); setScope('mine'); void load('mine'); } catch (e: any) { toast(e?.response?.data?.error || 'No se pudo subir'); }
  };
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} transition={{ duration: 0.18 }} className="absolute bottom-full left-0 right-0 z-20 mb-2 rounded-xl border border-white/[0.1] bg-[#121216] p-2 shadow-[0_18px_44px_-14px_rgba(0,0,0,0.9)]">
          <div className="flex items-center gap-1 pb-2">
            {(['favs', 'recent', 'mine'] as Scope[]).map((sc) => (
              <button key={sc} type="button" onClick={() => setScope(sc)} className={`h-8 rounded-md px-3 text-[11px] font-bold uppercase tracking-[0.12em] ${scope === sc ? 'bg-red-500/15 text-white' : 'text-gray-400 hover:text-white'}`}>{sc === 'favs' ? 'Favoritos' : sc === 'recent' ? 'Populares' : 'Míos'}</button>
            ))}
            <button type="button" onClick={() => fileRef.current?.click()} className="ml-auto inline-flex h-8 items-center gap-1 rounded-md border border-white/[0.12] px-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-gray-200 hover:border-white/30"><Upload className="h-3.5 w-3.5" /> Subir</button>
            <input ref={fileRef} type="file" accept="image/png,image/gif,image/webp,image/jpeg" className="hidden" onChange={(e) => { void upload(e.target.files?.[0]); e.target.value = ''; }} />
            <button type="button" onClick={onClose} aria-label="Cerrar" className="ml-1 text-gray-500 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          <div className="grid max-h-56 grid-cols-5 gap-2 overflow-y-auto sm:grid-cols-6">
            {loading && <div className="col-span-full py-6 text-center text-xs text-gray-500">Cargando…</div>}
            {!loading && items.length === 0 && <div className="col-span-full py-6 text-center text-xs text-gray-500">{scope === 'favs' ? 'Guarda stickers con la estrella y aparecerán aquí.' : scope === 'mine' ? 'Sube tu primer sticker (png, gif o webp).' : 'Aún no hay stickers. Sube el primero.'}</div>}
            {items.map((s) => (
              <motion.button key={s.id} type="button" whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }} onClick={() => onPick(s)} title={s.name || 'sticker'} className="group relative aspect-square overflow-hidden rounded-lg bg-white/[0.04]">
                <img src={s.url} alt={s.name || ''} loading="lazy" className="h-full w-full object-contain" />
                <span onClick={(e) => fav(s, e)} role="button" aria-label="Favorito" className={`absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 ${s.fav ? 'text-amber-300' : 'text-gray-400 opacity-0 group-hover:opacity-100'}`}><Star className="h-3.5 w-3.5" fill={s.fav ? 'currentColor' : 'none'} /></span>
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
