// Modales y vistas superpuestas que respetan el botón "Atrás".
//
// Problema: al abrir un modal, un sheet o el feed a pantalla completa, el botón
// atrás del navegador (o el gesto del móvil) salía de la página en vez de cerrar
// la capa. Esta hook empuja una entrada de historial al abrir y cierra la capa
// cuando esa entrada desaparece (popstate). Si la capa se cierra desde la UI y su
// entrada sigue arriba, se consume con history.back() para no dejar un "atrás"
// fantasma. Las capas anidadas (feed → comentarios → stickers) se cierran en
// orden porque cada una tiene su propia entrada (id distinto).
//
// Detalles que importan:
//  - Se conserva lo que React Router guarda en history.state (usr/key/idx) para
//    no desincronizar su índice interno.
//  - El back() de la limpieza se difiere un tick y se cancela si la misma capa
//    vuelve a montarse enseguida (StrictMode / Fast Refresh re-ejecutan los
//    efectos). Si no, Chrome aplicaba el back pendiente sobre la entrada nueva y
//    la capa se cerraba sola nada más abrir.
import { useEffect, useRef } from 'react';

const KEY = 'atakLayer';
const pendingBack = new Map<string, number>();

export function useHistoryModal(open: boolean, onClose: () => void, id = 'modal') {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || typeof window === 'undefined') return;
    const t = pendingBack.get(id);
    if (t != null) { window.clearTimeout(t); pendingBack.delete(id); }
    if (window.history.state?.[KEY] !== id) {
      const base = (window.history.state && typeof window.history.state === 'object') ? window.history.state : {};
      window.history.pushState({ ...base, idx: (Number(base.idx) || 0) + 1, [KEY]: id }, '', window.location.href);
    }
    let consumed = false;
    const onPop = () => {
      if (window.history.state?.[KEY] !== id) { consumed = true; closeRef.current(); }
    };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      if (consumed) return;
      const timer = window.setTimeout(() => {
        pendingBack.delete(id);
        if (window.history.state?.[KEY] === id) window.history.back();
      }, 0);
      pendingBack.set(id, timer);
    };
  }, [open, id]);
}
