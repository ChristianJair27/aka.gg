// Pantalla de éxito: el torneo ya existe y aquí se reparten los códigos.
//
// Los códigos son el único artefacto que el organizador tiene que sacar de la
// app a mano, así que copiar tiene que ser trivial: uno a uno, todos de golpe,
// y un buscador cuando hay decenas (un torneo de 32 equipos genera 64).
import { useMemo, useState } from 'react';
import { Check, Copy, CopyCheck, Search, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Callout, fieldCls } from '@/components/ui/form-bits';
import { toast } from '@/components/ui/sonner';

export function CodesPanel({
  name, riotTournamentId, codes, skippedReason,
}: {
  name: string;
  riotTournamentId?: number;
  codes: string[];
  skippedReason?: string;
}) {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return needle ? codes.filter((c) => c.toLowerCase().includes(needle)) : codes;
  }, [codes, q]);

  const copyOne = async (code: string, i: number) => {
    await navigator.clipboard.writeText(code);
    setCopiedIndex(i);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(codes.join('\n'));
    setCopiedAll(true);
    toast.success(`${codes.length} códigos copiados`);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-4">
        <p className="flex items-center gap-2 text-lg font-bold text-green-300">
          <Check className="h-5 w-5" /> ¡Torneo creado!
        </p>
        <p className="mt-1 text-gray-300">{name}</p>
        {riotTournamentId && (
          <p className="mt-1 font-mono text-[11px] text-gray-500">
            Riot Tournament ID: {riotTournamentId}
          </p>
        )}
      </div>

      {skippedReason && (
        <Callout tone="warn" title="Sin códigos de Riot">
          {skippedReason} El torneo funciona igual: los resultados se detectan por el roster
          de los equipos.
        </Callout>
      )}

      {codes.length > 0 && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 font-semibold text-purple-300">
              <Zap className="h-4 w-4" />
              Códigos generados ({codes.length})
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={copyAll}
              className="h-8 border-white/10 bg-white/[0.04] text-xs hover:bg-white/[0.08]"
            >
              {copiedAll
                ? <CopyCheck className="mr-1.5 h-3.5 w-3.5 text-green-400" />
                : <Copy className="mr-1.5 h-3.5 w-3.5" />}
              Copiar todos
            </Button>
          </div>

          <p className="text-[11.5px] text-gray-500">
            Compártelos con los equipos. Se ingresan en{' '}
            <strong className="text-gray-300">LoL → Jugar → Torneos → Buscar por código</strong>.
          </p>

          {codes.length > 12 && (
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-600" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar códigos…"
                className={`${fieldCls} pl-9`}
              />
            </div>
          )}

          <div className="grid max-h-64 grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
            {shown.map((code) => {
              const i = codes.indexOf(code);
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => copyOne(code, i)}
                  className="flex items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] p-2.5 text-left transition hover:border-purple-400/50 hover:bg-white/[0.07]"
                >
                  <span className="truncate font-mono text-[11.5px] text-purple-300">{code}</span>
                  {copiedIndex === i
                    ? <Check className="h-3.5 w-3.5 flex-shrink-0 text-green-400" />
                    : <Copy className="h-3.5 w-3.5 flex-shrink-0 text-gray-600" />}
                </button>
              );
            })}
            {shown.length === 0 && (
              <p className="col-span-full py-4 text-center text-[12px] text-gray-600">
                Ningún código coincide con «{q}».
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
