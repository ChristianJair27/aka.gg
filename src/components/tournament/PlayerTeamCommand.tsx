// ATAK.GG — PlayerTeamCommand: paleta ⌘K (cmdk) para buscar un jugador o un
// equipo dentro de las estadísticas del torneo. Capa fina sobre
// src/components/ui/command: no trae datos, solo recibe listas y devuelve la
// elección. El botón disparador muestra la pista "⌘K" y también abre con
// Ctrl/⌘ + K mientras el componente está montado.
import { useEffect, useState } from 'react';
import { Search, Users, User } from 'lucide-react';
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem,
} from '@/components/ui/command';
import { Tip } from '@/components/ui/Tip';

export interface CommandPlayer { name: string; tag?: string; team?: string | null }

export function PlayerTeamCommand({ players, teams, onPickPlayer, onPickTeam }: {
  players: CommandPlayer[];
  teams: string[];
  onPickPlayer: (name: string) => void;
  onPickTeam: (team: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

  return (
    <>
      <Tip label="Buscar jugador o equipo (⌘K / Ctrl+K)">
        <button type="button" className="td-cmd-trigger" onClick={() => setOpen(true)}>
          <Search size={13} />
          <span>Buscar</span>
          <kbd className="td-cmd-kbd">{isMac ? '⌘' : 'Ctrl'}K</kbd>
        </button>
      </Tip>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Buscar jugador o equipo…" />
        <CommandList className="max-h-[360px]">
          <CommandEmpty>Sin resultados</CommandEmpty>
          {teams.length > 0 && (
            <CommandGroup heading="Equipos">
              {teams.map((t) => (
                <CommandItem key={`t:${t}`} value={`equipo ${t}`} onSelect={() => { onPickTeam(t); setOpen(false); }}>
                  <Users className="mr-2 h-4 w-4 opacity-60" />
                  <span>{t}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          <CommandGroup heading="Jugadores">
            {players.map((p) => (
              <CommandItem
                key={`p:${p.name}#${p.tag ?? ''}`}
                value={`jugador ${p.name} ${p.tag ?? ''} ${p.team ?? ''}`}
                onSelect={() => { onPickPlayer(p.name); setOpen(false); }}
              >
                <User className="mr-2 h-4 w-4 opacity-60" />
                <span className="truncate">{p.name}</span>
                {p.tag && <span className="ml-1 text-xs opacity-40">#{p.tag}</span>}
                {p.team && <span className="ml-auto pl-3 text-xs opacity-50 truncate max-w-[40%]">{p.team}</span>}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}

export default PlayerTeamCommand;
