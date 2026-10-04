# ATAK.GG — sistema de diseño "Arena" (todo el sitio)

Fuente de verdad para rediseñar cualquier página. Nació en la sección de torneos
(`design-system/atak-torneos/MASTER.md`) y se extiende a todo el sitio con la skill `ui-ux-pro-max`
(`E:\ATAKGG\.claude\skills\ui-ux-pro-max`). Rama local `redesign/torneos-ui-ux-pro-max`. **No se despliega sin
aprobación.**

## Dirección

Retransmisión de esports: bloques sólidos, tipografía condensada enorme en itálica, un solo acento crimson,
oro para honores. El arte y los modelos 3D de League of Legends son el ambiente de cada página: entran con
fundido, se mueven despacio y nunca compiten con el dato.

Recomendaciones de la skill aplicadas: estilo "3D & Hyperrealism" + "Motion-Driven" para gaming; par tipográfico
"Sports" (Barlow Condensed + Barlow); contraste ≥ 4.5:1; texto ≥ 12px; foco visible; objetivos táctiles ≥ 44px;
`prefers-reduced-motion`; solo `transform`/`opacity` en animación; imágenes WebP con `loading="lazy"` y espacio
reservado; en three.js liberar geometría/material/texturas y pausar fuera de pantalla. Descartada: la paleta
morado/rosa que propone (la marca es crimson + oro).

## Cómo se arma una página

```tsx
import { ArenaPage, SplashBackdrop, PageHero, Champion3D, Reveal, Button, StatusChip, SectionHead,
  FilterPills, ProgressBar, RoleIcon, ClassIcon, StatIcon, UiIcon, ChampIcon, lol, stagger } from '@/components/arena';

<ArenaPage width="default|wide|narrow" backdrop={<SplashBackdrop champion="Katarina" opacity={0.45} />}>
  <PageHero kicker="…" title={<>Palabra <em>acento</em></>} lede="…" actions={…} aside={<Champion3D slug="Katarina" />} />
  <section className="ax-section">…</section>
</ArenaPage>
```

- `ArenaPage` pone `td-root ax-canvas` (tokens, tipografía, lienzo) y el contenedor `ax-wrap`.
  **Todas las clases `td-*` / `ax-*` solo funcionan dentro de `.td-root`.** Los portales (modales, drawers,
  sheets de Radix) quedan fuera: añade `className="td-root"` al contenido del portal.
- El CSS global ya está cargado (`main.tsx` importa `tournament-dashboard.css` y `arena.css`).
- CSS específico de una página: `src/styles/pages/<pagina>.css`, importado por esa página, con selectores
  bajo `.td-root`. **No edites `arena.css` ni `src/components/arena/*` ni `src/components/tournament/ui.tsx`**
  desde una página: son compartidos.

## Tokens (CSS vars en `:root` y `.td-root`)

| Uso | Token |
|---|---|
| Lienzo / panel / sub-panel / hundido | `--td-bg` `--td-card` `--td-subcard` `--td-sunken` `--td-sunken-2` `--td-strip` |
| Hairlines | `--td-border` `--td-border-soft` `--td-border-hov` |
| Marca | `--td-red` `--td-red-hover` `--td-red-deep` `--td-red-wash` `--td-red-glow` · `--td-gold` `--td-gold-bright` |
| Semánticos | `--td-green` (victoria/abierto) `--td-neg` (derrota/error) `--td-amber` (aviso) `--td-live` (lado azul) |
| Texto | `--td-text` `--td-text-2` `--td-muted` `--td-disabled` |
| Tipos | `--td-font-display` (Barlow Condensed: títulos y cifras grandes) `--td-font-mono` (Barlow Semi Condensed: datos, etiquetas) `--td-font-ui` (Barlow: cuerpo) |
| Forma | `--td-r-panel` 10px · `--td-r-ctl` 6px · `--td-r-chip` 4px |
| Movimiento | `--td-ease` · `--td-dur` 180ms |

## Clases (todas en `src/styles/arena.css`)

**Superficies**: `td-panel` (caja base) · `td-sub` (sub-caja) · `td-hoverable` · `ax-card` (padding 20) ·
`ax-artcard` + `<img class="ax-artcard-img">` (tarjeta con arte de fondo) · `ax-empty` (vacío con `<h3>`).

**Texto**: `td-over` (etiqueta en mayúsculas 11.5px) · `td-num` (cifras tabulares) · `ax-h2` / `ax-h3` ·
`ax-lede` · `ax-prose` · `ax-link` · `ax-kicker` (con raya crimson) · `ax-pagehero-title` (`<em>` crimson,
`<em data-outline>` contorno).

**Controles**: `<Button variant="primary|secondary|ghost" icon full>` (`td-btn`) · `<StatusChip kind="live|registration|finished|pos|warn|gold|dim">` ·
`<FilterPills items value onChange>` (`td-seg` / `td-seg-item[data-active]`) · `<ProgressBar kind="red|wr|#hex" pct>` ·
`td-search-wrap` + `td-search` · formularios `td-field` `td-label` `td-input` `td-select` `td-textarea` `td-help` `td-error` ·
pestañas `ax-tabs` / `ax-tab[data-active]`.

**Datos**: `<SectionHead icon title right size>` · `ax-table` (+ `ax-table-scroll`) · `ax-pos[data-pos]` (bloque de
posición; 1-3 oro/plata/bronce) · `ax-tier[data-tier]` (S/A/B) · `td-tile` + `td-tile-value` · `ax-bug` / `ax-bug-cell` /
`ax-bug-value` (tira de datos) · `ax-counters` / `ax-counter`.

**Layout**: `ax-wrap` (1240) `ax-wrap--wide` (1480) `ax-wrap--narrow` (880) · `ax-section` (separación entre bloques) ·
`ax-grid` con `--cols` · `ax-pagehero` · `ax-list` / `ax-row[data-phase]` (filas tipo cartelera) · `ax-feature`.

**Movimiento**: `ax-rise` / `ax-slide` (entrada al montar, escalonada con `style={stagger(i)}`) · `<Reveal index>`
(entrada al entrar en vista) · `ax-sweep` · `td-dot-pulse`.

Referencia viva: `src/pages/Tournaments.tsx`, `src/components/tournament/dashboard/Hero.tsx`,
`src/pages/Home.tsx`, `src/pages/ChampionPage.tsx`.

## Assets de League of Legends

`import { lol } from '@/components/arena'` (`src/lib/lolAssets.ts`):

- Locales, del repo `noxelisdev/LoL_DDragon` (WebP en `/public/lol`): `lol.lane(rol)` · `lol.champClass(tag)` ·
  `lol.stat('attack_damage'…)` · `lol.dragon('infernal'…)` · `lol.ui('gold'|'tower'|'nashor'|'minion'…)` ·
  `lol.map('summoners-rift'|'howling-abyss'|'clash'|'postgame'|'shadow-isles'|'mist')`.
  Componentes: `<RoleIcon lane>` `<ClassIcon tag>` `<StatIcon stat>` `<UiIcon name>` `<DragonIcon dragon>`.
- Por campeón (CDN de Riot): `lol.splash(slug)` 1215×717 · `lol.centered(slug)` 1280×720 (campeón centrado) ·
  `lol.loading(slug)` 308×560 vertical · `lol.tile(slug)` 380×380 · `lol.iconById(id)`; el icono cuadrado sigue
  en `dd.champion(slug)` (`@/lib/dataDragon`). `<ChampIcon src name size>`.
- `useChampions()` (`@/hooks/use-ddragon`) da `byId[slug]` y `byKey[idNumérico]` → `{ id, key, name, image }`.

Uso natural, no decorativo: el arte debe ser **el del dato** (el campeón del jugador, el mapa del torneo, el
campeón más jugado), con `SplashBackdrop` de ambiente (opacidad 0.35–0.55) o `ax-artcard`. Siempre `alt=""` si es
decorativo, `loading="lazy"`, y `onError` que oculte la imagen.

## Modelos 3D

`<Champion3D slug champId? skin? clip="idle|dance|taunt|laugh|joke|recall" spin follow drag accent art="centered|loading|none" />`

- Dale alto al contenedor (`style={{ height: 420 }}` o por CSS): no tiene caja, se apoya en un charco de luz.
- Monta el `<Canvas>` solo al entrar en pantalla, lo congela al salir, limita DPR a 1.5 y respeta
  `prefers-reduced-motion`. Sondea el GLB: si pesa más que el presupuesto (12 MB escritorio / 5 MB móvil), no hay
  WebGL o hay ahorro de datos, se queda con el arte 2D. Libera GPU al desmontar.
- **Un solo `Champion3D` por página** (contextos WebGL limitados) y nunca el mismo modelo dos veces.
- Colócalo donde el campeón sea el protagonista del dato: héroe de la página, campeón principal del jugador.

## Reglas

1. Cuerpo ≥ 14px (15–16 en texto corrido); etiquetas en mayúsculas ≥ 11.5px (`td-over`). Nada de 9–10px.
2. Un solo acento (crimson). Verde y rojo claro solo significan victoria/derrota o abierto/cerrado. Oro = honores.
3. Cifras con `td-num` o la display. Sin emoji como iconos (lucide o los iconos de LoL).
4. Paneles opacos; `backdrop-filter` solo en barras flotantes. Radios 10/6/4, sin píldoras.
5. Animación solo con `transform`/`opacity`, 150–300 ms en micro-interacciones, apagada con reduced-motion.
6. Todo lo clicable: `cursor: pointer`, estado hover y foco visible, ≥ 44px en táctil.
7. Sin scroll horizontal a 375px. Tablas anchas en `ax-table-scroll`.
8. No cambies lógica de datos, rutas, hooks ni textos legales: es un rediseño visual.
9. Español (México) en toda la interfaz.
