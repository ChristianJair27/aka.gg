// src/pages/NotFound.tsx — 404 de marca: el número recibe un corte limpio de daga.
// Dos mitades del "404" separadas por una línea de filo; entrada coreografiada con
// framer-motion y fallback total con useReducedMotion (todo visible sin animar).
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Home, ArrowLeft } from 'lucide-react';

// Corte diagonal compartido por las dos mitades (mismo ángulo, piezas complementarias).
const CUT_TOP    = 'polygon(0 0, 100% 0, 100% 34%, 0 60%)';
const CUT_BOTTOM = 'polygon(0 60%, 100% 34%, 100% 100%, 0 100%)';

const NotFound = () => {
  const reduce = useReducedMotion();

  const slide = (x: number, y: number) => ({
    initial: reduce ? false : { x: 0, y: 0 },
    animate: { x, y },
    transition: { delay: 0.55, duration: 0.5, ease: [0.16, 1, 0.3, 1] as const },
  });

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[#050505] px-5">
      {/* Resplandor rojo contenido */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 640px 420px at 50% 42%, rgba(239,68,68,0.10), transparent 65%)' }}
      />

      <div className="relative text-center max-w-lg mx-auto py-24">
        {/* El número, cortado */}
        <div className="relative mx-auto w-fit font-serif leading-none select-none" aria-hidden="true">
          {/* Mitad superior */}
          <motion.span
            {...slide(14, -8)}
            className="block text-[clamp(6rem,18vw,9rem)] text-white"
            style={{ clipPath: CUT_TOP }}
          >
            404
          </motion.span>
          {/* Mitad inferior (misma capa de texto, pieza complementaria) */}
          <motion.span
            {...slide(-10, 6)}
            className="absolute inset-0 block text-[clamp(6rem,18vw,9rem)] text-white/90"
            style={{ clipPath: CUT_BOTTOM }}
          >
            404
          </motion.span>
          {/* La línea del corte */}
          <motion.div
            initial={reduce ? false : { scaleX: 0, opacity: 0 }}
            animate={{ scaleX: 1, opacity: 1 }}
            transition={{ delay: 0.25, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="absolute left-[-12%] right-[-12%] top-1/2 h-px origin-left"
            style={{
              transform: 'rotate(-9deg)',
              background: 'linear-gradient(90deg, transparent, #b91c1c 20%, #ef4444 50%, #c8aa6e 78%, transparent)',
              boxShadow: '0 0 18px rgba(239,68,68,0.55)',
            }}
          />
        </div>
        <h1 className="sr-only">Error 404 — página no encontrada</h1>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.75, duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
        >
          <h2 className="mt-8 font-serif text-2xl text-white" style={{ textWrap: 'balance' }}>
            El corte fue limpio
          </h2>
          <p className="mt-3 text-[15px] leading-relaxed text-white/65">
            Esta página ya no existe — o nunca existió. Nadie vio la hoja moverse.
          </p>

          <div className="mt-9 flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-bold text-white transition-all duration-250 hover:-translate-y-0.5"
              style={{
                background: 'linear-gradient(135deg,#ef4444,#b91c1c)',
                boxShadow: '0 0 28px rgba(239,68,68,0.3), 0 4px 16px rgba(0,0,0,0.4)',
              }}
            >
              <Home className="h-4 w-4" aria-hidden="true" />
              Volver al inicio
            </Link>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold text-white/70 border border-white/12 hover:border-[#c8aa6e]/50 hover:text-white transition-all duration-250"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Volver atrás
            </button>
          </div>
        </motion.div>

        <hr className="blade-line mt-14 opacity-60" />
        <p className="mt-4 text-xs text-white/40 font-mono tracking-wide">ATAK.GG · sector inexistente</p>
      </div>
    </div>
  );
};

export default NotFound;
