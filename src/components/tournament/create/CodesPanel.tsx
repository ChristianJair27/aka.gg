// Pantalla de éxito: el torneo ya existe y aquí se reparten los códigos.
//
// Los códigos son el único artefacto que el organizador tiene que sacar de la
// app a mano, así que copiar tiene que ser trivial: uno a uno, todos de golpe,
// y un buscador cuando hay decenas (un torneo de 32 equipos genera 64).
//
// Piel "Arena" (necesita un ancestro .td-root): aviso verde con el nombre en la
// display condensada, cabecera de sección para los códigos y cada código como
// una fila de 44px que se copia al pulsarla.
import { useMemo, useState } from 'react';
import { Check, Copy, CopyCheck, KeySquare, Search } from 'lucide-react';
import { Button } from '@/components/tournament/ui';
import { Notice } from '@/components/tournament/forms';
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
    <div className="tf-form">
      <Notice tone="ok" icon={<Check size={18} />} title="¡Torneo creado!">
        <p className="tf-done-name">{name}</p>
        {riotTournamentId && (
          <p className="td-num" style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--td-text-2)' }}>
            Riot Tournament ID: {riotTournamentId}
          </p>
        )}
      </Notice>

      {skippedReason && (
        <Notice tone="warn" title="Sin códigos de Riot">
          {skippedReason} El torneo funciona igual: los resultados se detectan por el roster
          de los equipos.
        </Notice>
      )}

      {codes.length > 0 && (
        <div>
          <div className="td-sechead tf-sechead">
            <span className="td-sechead-ico" aria-hidden><KeySquare size={16} /></span>
            <h3 className="td-sechead-title" style={{ margin: 0 }}>
              Códigos generados <span className="td-num" style={{ color: 'var(--td-muted)' }}>({codes.length})</span>
            </h3>
            <span className="td-sechead-right">
              <Button
                variant="secondary" onClick={copyAll}
                icon={copiedAll
                  ? <CopyCheck size={15} color="var(--td-green)" aria-hidden />
                  : <Copy size={15} aria-hidden />}
              >
                Copiar todos
              </Button>
            </span>
          </div>

          <p className="td-help" style={{ margin: '0 0 12px', fontSize: 14 }}>
            Compártelos con los equipos. Se ingresan en{' '}
            <strong style={{ color: 'var(--td-text)', fontWeight: 600 }}>LoL → Jugar → Torneos → Buscar por código</strong>.
          </p>

          {codes.length > 12 && (
            <label className="tf-ico-wrap" style={{ marginBottom: 10 }}>
              <Search size={16} aria-hidden />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Filtrar códigos…"
                aria-label="Filtrar códigos"
                className="td-input tf-has-ico"
              />
            </label>
          )}

          <div className="tf-codes">
            {shown.map((code) => {
              const i = codes.indexOf(code);
              const copied = copiedIndex === i;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => copyOne(code, i)}
                  className="tf-code"
                  data-copied={copied}
                  aria-label={`Copiar código ${code}`}
                >
                  <span>{code}</span>
                  {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
                </button>
              );
            })}
            {shown.length === 0 && (
              <p className="td-help" style={{ gridColumn: '1 / -1', margin: 0, padding: '14px 0', textAlign: 'center' }}>
                Ningún código coincide con «{q}».
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
