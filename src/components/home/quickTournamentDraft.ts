// Borrador del torneo que se escribe en la portada.
//
// El formulario de la portada está abierto para todo el mundo, pero crear un
// torneo exige cuenta. Si al enviar mandáramos a registrarse sin más, se
// perdería lo escrito y casi nadie volvería. Guardamos el borrador y lo
// recuperamos en cuanto la persona vuelve con sesión iniciada.
//
// sessionStorage y no localStorage a propósito: es un borrador de un rato, no
// algo que deba sobrevivir a cerrar el navegador.

export interface QuickTournamentDraft {
  name: string;
  gameMap: 'SR' | 'ARAM' | 'ARENA';
  teamSize: number;
  startDate: string;
  bracketType: string;
  seriesTo: string;
}

const KEY = 'atak:draft-tournament';

export function saveDraft(d: QuickTournamentDraft) {
  try { sessionStorage.setItem(KEY, JSON.stringify(d)); } catch { /* modo privado */ }
}

export function readDraft(): QuickTournamentDraft | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const d = JSON.parse(raw) as QuickTournamentDraft;
    // Validación mínima: si el objeto guardado es de otra versión, se descarta
    // en vez de meter basura en el formulario.
    if (!d || typeof d.name !== 'string' || !['SR', 'ARAM', 'ARENA'].includes(d.gameMap)) return null;
    return d;
  } catch { return null; }
}

export function clearDraft() {
  try { sessionStorage.removeItem(KEY); } catch { /* modo privado */ }
}
