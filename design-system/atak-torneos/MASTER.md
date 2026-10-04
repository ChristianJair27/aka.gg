# ATAK.GG · Torneos — sistema de diseño "Arena"

Rediseño de la sección de torneos (`/tournaments` y `/tournaments/:id`) hecho con la skill
`ui-ux-pro-max` (instalada en `E:\ATAKGG\.claude\skills\ui-ux-pro-max`). Vive en la rama local
`redesign/torneos-ui-ux-pro-max`; no está desplegado.

## Qué recomendó la skill y qué se tomó

Consulta: `"esports gaming tournament platform dark competitive" --design-system` + búsquedas por
dominio (`product`, `style`, `typography`, `ux`, `chart`).

| Tema | Recomendación | Decisión |
|---|---|---|
| Estilo | Gaming → "Motion-Driven" + "Vibrant & Block-based" (bloques, tipografía grande, alto contraste) | Tomado: bloques sólidos, títulos enormes, entradas escalonadas |
| Tipografía | "Sports/Fitness": Barlow Condensed (titulares) + Barlow (cuerpo) | Tomado. El sitio ya usaba Barlow de cuerpo; se añade la condensada y la semi condensada para datos |
| Paleta | Morado neón + rosa | **Descartada**: la marca es crimson + oro. Se conservan `#e8323c` y `#c8aa6e` |
| Accesibilidad | Contraste 4.5:1, texto ≥ 12px, foco visible, objetivos táctiles de 44px, `prefers-reduced-motion` | Tomado (ver abajo) |
| Rendimiento | Evitar blur por panel y video en bucle | Tomado: paneles opacos; fuera el fondo WebGL (Aurora) y el video en estas dos páginas |
| Gráficos de ranking | Barras horizontales ordenadas, nunca solo color | Ya era así; se mantiene |
| Iconos | SVG, sin emoji | Tomado: la llama de pentakill pasa de emoji a icono |

## Tokens (en `src/styles/arena.css`, sobre `.td-root`)

- **Superficies**: `--td-bg #0a0a0c` · `--td-card #121216` · `--td-subcard #18181d` · `--td-sunken #1f1f26`
- **Hairlines**: `--td-border` 9 % blanco · `--td-border-hov` 20 %
- **Marca**: `--td-red #e8323c` (único acento) · `--td-gold #c8aa6e` (honores: podio, premio)
- **Semánticos**: `--td-green #3ddc97` (victoria / abierto) · `--td-neg #ff6b76` (derrota) · `--td-amber #f5a524`
- **Texto**: `--td-text #f5f5f6` · `--td-text-2 #b6b6c0` · `--td-muted #8c8c98` (antes `#6b7280`, no llegaba a 4.5:1)
- **Tipos**: `--td-font-display` Barlow Condensed (títulos, cifras grandes) · `--td-font-mono` Barlow Semi Condensed
  (datos y etiquetas) · `--td-font-ui` Barlow (cuerpo)
- **Forma**: paneles 10px · controles 6px · chips 4px. Nada de píldoras.
- **Movimiento**: `--td-ease cubic-bezier(.22,1,.36,1)`, 180 ms; solo `transform`/`opacity`.

## Piezas

- **Botón** `.td-btn--primary|secondary|ghost`: mayúsculas condensadas; el primario lleva la esquina inferior
  derecha cortada. Estados en CSS (antes eran manejadores de ratón en JS).
- **Chip de estado** `.td-chip[data-kind]`: rectangular. "En vivo" es el único relleno, como el rótulo de una retransmisión.
- **Cabecera de sección** `.td-sechead`: título condensado sobre hairline con un tramo crimson al inicio.
- **Control segmentado** `.td-seg`: sustituye a las filas de píldoras (filtros, orden, métricas).
- **Héroe** `.ax-hero`: título gigante, muro de escudos de los equipos como arte de fondo y, abajo,
  el **marcador** `.ax-bug` con los datos clave (sustituye a las cuatro tarjetas sueltas).
- **Pestañas** `.ax-tabs`: barra pegajosa horizontal (sustituye al sidebar de 212px). En móvil sigue el nav inferior.
- **Posición** `.ax-pos`: bloque numerado; oro / plata / bronce para el podio.
- **Listado**: cabecera editorial, torneo destacado `.ax-feature` y filas `.ax-row` con carril de color por fase.

## Reglas al extenderlo

1. Texto de cuerpo ≥ 14px; etiquetas en mayúsculas ≥ 11.5px con la clase `.td-over`.
2. Un solo acento. El verde y el rojo claro solo significan victoria/derrota o abierto/cerrado.
3. Números siempre con `.td-num` o la display (cifras tabulares).
4. Sin `backdrop-filter` en paneles; solo en barras flotantes (pestañas, nav inferior).
5. Toda animación de entrada usa `.ax-rise` / `.ax-slide` y se apaga con `prefers-reduced-motion`.

## Para aplicarlo al resto del sitio

`arena.css` reescribe los tokens `--td-*` bajo `.td-root`. Para llevarlo a otra página basta con envolverla en
`.td-root.ax-canvas` e importar las dos hojas; las primitivas están en `src/components/tournament/ui.tsx`.
Si se adopta en todo el sitio, conviene fundir `arena.css` dentro de `tournament-dashboard.css`, mover los tokens
a `:root` y retirar las familias Archivo / Space Grotesk / Saira que dejarían de usarse.

## Pendiente (fuera de este pase)

- Modales de crear torneo e inscripción (siguen con el estilo anterior).
- Página de espectador `/tournaments/:id/live`.
- Tarjetas internas del bracket suizo y de las series (heredan colores y tipos, no la forma).
