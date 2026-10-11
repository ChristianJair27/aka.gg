// Vista previa del perfil ATAK.GG detrás de un Riot ID (para invitar a un
// torneo o a un equipo): avatar, nombre y si tiene cuenta vinculada. Consulta
// con retardo mientras se escribe; devuelve `null` si no parece un Riot ID.
import { useEffect, useState } from 'react';
import { CheckCircle2, UserX, Loader2 } from 'lucide-react';
import { axiosInstance } from '@/lib/axios';
import { dd } from '@/lib/dataDragon';

export interface RiotLookupResult {
  found: boolean; riotId: string; userId?: number; name?: string;
  avatarUrl?: string | null; profileIcon?: number | null; self?: boolean;
}

export const looksLikeRiotId = (v: string) => /^.+#.{2,}$/.test(v.trim());

export function useRiotLookup(riotId: string) {
  const [state, setState] = useState<{ loading: boolean; result: RiotLookupResult | null }>({ loading: false, result: null });
  useEffect(() => {
    const q = riotId.trim();
    if (!looksLikeRiotId(q)) { setState({ loading: false, result: null }); return; }
    let alive = true;
    setState((s) => ({ ...s, loading: true }));
    const t = window.setTimeout(() => {
      axiosInstance.get('/api/tournaments/users/lookup', { params: { riotId: q } })
        .then((r) => { if (alive) setState({ loading: false, result: r.data }); })
        .catch(() => { if (alive) setState({ loading: false, result: { found: false, riotId: q } }); });
    }, 350);
    return () => { alive = false; window.clearTimeout(t); };
  }, [riotId]);
  return state;
}

/** Chip de resultado. `compact` para dentro de un slot de roster. */
export function RiotLookupChip({ riotId, compact = false }: { riotId: string; compact?: boolean }) {
  const { loading, result } = useRiotLookup(riotId);
  if (!looksLikeRiotId(riotId)) return null;
  if (loading && !result) {
    return <span className="tf-lookup" data-state="loading"><Loader2 size={14} className="td-spin" aria-hidden /> Buscando en ATAK.GG…</span>;
  }
  if (!result) return null;
  if (!result.found) {
    return (
      <span className="tf-lookup" data-state="missing">
        <UserX size={14} aria-hidden /> {result.riotId} no tiene cuenta ATAK.GG vinculada{compact ? '' : ' — invítalo por correo o pídele que vincule su cuenta'}
      </span>
    );
  }
  const avatar = result.avatarUrl || (result.profileIcon ? dd.profileIcon(result.profileIcon) : null);
  return (
    <span className="tf-lookup" data-state="found">
      {avatar ? <img src={avatar} alt="" className="tf-lookup-avatar" /> : <span className="tf-lookup-avatar" aria-hidden />}
      <b>{result.name}</b>
      <span className="tf-mono">{result.riotId}</span>
      <CheckCircle2 size={14} aria-hidden /> {result.self ? 'eres tú' : 'cuenta ATAK.GG'}
    </span>
  );
}
