/* LQC · pantallas para OBS. Lee el torneo de la API de ATAK.GG (tabla, ronda,
   marcador de la serie) y rellena cada pantalla. Todo se puede forzar por URL:
     ?match=r6m1            serie del bracket (equipos, marcador y ronda salen solos)
     ?equipo=Nombre         la serie de ese equipo en la ronda actual
     ?t1=A&t2=B&s1=0&s2=0   equipos y marcador a mano (sin API)
     ?ronda=6&bo=3          rótulo de ronda / mejor de N
     ?hora=20:30            cuenta regresiva (hora local de hoy)
     ?msg=TEXTO             título de la pantalla de espera
     ?tw=lqroc&ig=lqro.c&tt=&dc=&x=&yt=   redes a mostrar (vacío = oculta)
     ?torneo=lqc-2026       otro torneo de ATAK.GG
     ?bg=1                  fondo gris de prueba en las pantallas transparentes */
(function () {
  const API = 'https://atakback.revolution505.com';
  const P = new URLSearchParams(location.search);
  const q = (k, d) => (P.has(k) ? P.get(k) : d);
  const TID = q('torneo', 'lqc-2026');
  const POLL = 15000;

  const LOGOS = {
    '2 DOPE': '2-dope', 'DinoRatas': 'dinoratas', 'False Promise Gaming': 'false-promise-gaming',
    'Galaxy Gaming': 'galaxy-gaming', 'Heralds Of Cthulhu': 'heralds-of-cthulhu', 'Game Over Qro': 'game-over-qro',
    'Requiem': 'requiem', 'Los Rokosos': 'los-rokosos', 'Nephyx Esports': 'nephyx-esports', 'RAKU': 'raku',
    'REV505': 'rev505', 'Tlacuaches': 'tlacuaches', 'Mythical Dragons': 'mythical-dragons', 'The Town Boys': 'the-town-boys', 'Hive': 'hive',
  };
  const ALIASES = { 'Nephtys': 'Nephyx Esports', 'Nephyx': 'Nephyx Esports', 'Game Over': 'Game Over Qro', 'Los Tlacuaches': 'Tlacuaches', '2D': '2 DOPE', '2Dope': '2 DOPE' };
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  const canon = (name) => {
    const n = norm(name); if (!n) return '';
    const l = n.toLowerCase();
    for (const k of Object.keys(LOGOS)) if (k.toLowerCase() === l) return k;
    for (const [k, v] of Object.entries(ALIASES)) if (k.toLowerCase() === l) return v;
    return n;
  };
  const logoFile = (name) => { const c = canon(name); return LOGOS[c] ? `logos/${LOGOS[c]}.png` : null; };
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lenClass = (name, a, b) => { const n = norm(name).length; return n > (b || 18) ? 'xlong' : n > (a || 12) ? 'long' : ''; };

  function logoHtml(name, side, extra) {
    const f = logoFile(name);
    const cls = `logo ${side || ''} ${extra || ''}`;
    if (f) return `<div class="${cls}"><img src="${f}" alt=""></div>`;
    const ini = norm(name).replace(/^(los|the|la|el)\s+/i, '').charAt(0).toUpperCase() || '?';
    return `<div class="${cls}"><span class="mono">${esc(ini)}</span></div>`;
  }

  /* ---------- redes ---------- */
  const ICONS = {
    twitch: '<svg viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>',
    discord: '<svg viewBox="0 0 24 24"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/></svg>',
    youtube: '<svg viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  };
  const NETS = [
    ['twitch', 'tw', 'lqroc', 'Twitch', (h) => `twitch.tv/${h}`],
    ['instagram', 'ig', 'lqro.c', 'Instagram', (h) => `@${h}`],
    ['tiktok', 'tt', '', 'TikTok', (h) => `@${h}`],
    ['youtube', 'yt', '', 'YouTube', (h) => `@${h}`],
    ['x', 'x', '', 'X', (h) => `@${h}`],
    ['discord', 'dc', '', 'Discord', (h) => h],
  ];
  function socials() {
    return NETS.map(([icon, key, def, label, fmt]) => ({ icon, key, label, handle: q(key, def), text: fmt(q(key, def)) })).filter((s) => s.handle);
  }
  function socialsHtml(cls) {
    return socials().map((s) => `<span class="social ${cls || ''}">${ICONS[s.icon]}<span>${esc(s.text)}</span></span>`).join('');
  }
  function poweredHtml() {
    return `<span class="powered"><img src="img/atak-logo-mark.png" alt=""><span>Estadísticas en vivo · <b>ATAK.GG</b></span></span>`;
  }

  /* ---------- datos del torneo ---------- */
  let T = null, lastErr = null;
  async function load() {
    try {
      const r = await fetch(`${API}/api/tournaments/${encodeURIComponent(TID)}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const d = await r.json(); T = d.tournament || d; lastErr = null;
    } catch (e) { lastErr = e.message || String(e); }
    try { const r2 = await fetch(`${API}/api/live-feed/${encodeURIComponent(TID)}`, { cache: 'no-store' }); LIVE = r2.status === 200 ? await r2.json() : null; } catch (e) { LIVE = null; }
    return T;
  }
  let LIVE = null;
  /** Sin match= en la URL: la serie que se está jugando (feed en vivo) o la última cuyo código se activó. */
  function autoMatch() {
    const b = bracket();
    if (LIVE && LIVE.team1 && LIVE.team2) { const m = b.find((x) => (same(x.team1, LIVE.team1) && same(x.team2, LIVE.team2)) || (same(x.team1, LIVE.team2) && same(x.team2, LIVE.team1))); if (m && m.matchStatus !== 'complete') return m; }
    // Varias series pueden estar activas a la vez: sin feed en vivo no se adivina (mejor nada que la serie equivocada).
    return null;
  }
  const bracket = () => (T && Array.isArray(T.bracket) ? T.bracket : []);
  const standings = () => (T && Array.isArray(T.standings) ? T.standings : []);
  const currentRound = () => bracket().reduce((m, x) => Math.max(m, Number(x.round) || 0), 0);
  const roundMatches = (r) => bracket().filter((m) => Number(m.round) === r && m.stage !== 'playoffs');
  const standing = (name) => { const c = canon(name).toLowerCase(); return standings().find((s) => canon(s.team).toLowerCase() === c) || null; };
  const same = (a, b) => canon(a).toLowerCase() === canon(b).toLowerCase();

  function findMatch() {
    const id = q('match'); const team = q('equipo');
    const t1 = q('t1'), t2 = q('t2');
    let m = null;
    if (id) m = bracket().find((x) => String(x.id).toLowerCase() === id.toLowerCase()) || null;
    else if (team) m = roundMatches(currentRound()).find((x) => same(x.team1, team) || same(x.team2, team)) || null;
    else if (t1 && t2) m = bracket().find((x) => (same(x.team1, t1) && same(x.team2, t2)) || (same(x.team1, t2) && same(x.team2, t1))) || null;
    else m = autoMatch();
    return m;
  }

  /** Datos de la serie a mostrar: API + lo forzado por URL. */
  function series() {
    const m = findMatch();
    const t1 = q('t1', m ? m.team1 : ''), t2 = q('t2', m ? m.team2 : '');
    const s1 = P.has('s1') ? Number(q('s1')) : (m ? Number(m.score1) || 0 : 0);
    const s2 = P.has('s2') ? Number(q('s2')) : (m ? Number(m.score2) || 0 : 0);
    const round = Number(q('ronda', m ? m.round : currentRound() || '')) || 0;
    const seriesTo = Number(q('seriesTo', m ? m.seriesTo : (T && T.seriesTo) || 2)) || 2;
    const bo = Number(q('bo', seriesTo * 2 - 1)) || 3;
    const status = m ? m.matchStatus : '';
    const winner = m ? m.winner : null;
    return { m, t1: t1 || 'Equipo azul', t2: t2 || 'Equipo rojo', s1, s2, round, bo, status, winner, hasTeams: Boolean(t1 && t2) };
  }
  const rec = (name) => { const s = standing(name); return s ? `<b>${s.wins}</b>-${s.losses} · <b>${s.points}</b> PTS` : ''; };
  const recParts = (name) => { const s = standing(name); return s ? { w: s.wins, l: s.losses, p: s.points, pos: s.position } : null; };
  const roundLabel = (S) => `${S.round ? `Ronda ${S.round}` : 'Fase suiza'} · Mejor de ${S.bo}`;
  const fecha = () => new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

  /* ---------- piezas ---------- */
  function headHtml(S) {
    return `<div class="head in">
      <div class="lockup">
        <img src="logos/lqc-wordmark.png" alt="LQC"><i></i>
        <span class="qc"><small>League of Legends</small>Queretaro<br>Championship</span>
        <span class="sep"></span>
        <span class="watch">Míralos en: <b>twitch.tv/${esc(q('tw', 'lqroc'))}</b></span>
      </div>
      <div class="meta"><span>${esc(fecha())}</span><span class="dot"></span><b>${esc(roundLabel(S))}</b></div>
    </div>`;
  }
  function footHtml() {
    return `<div class="foot in d4"><div class="socials">${socialsHtml()}</div>${poweredHtml()}</div>`;
  }
  function matchCardHtml(S) {
    if (!S.hasTeams) return '';
    return `<div class="matchcard in d2">
      <div class="side">${logoHtml(S.t1, 'blue')}<div><div class="name ${lenClass(S.t1, 14, 22)}">${esc(S.t1)}</div><div class="rec">${rec(S.t1)}</div></div></div>
      <div class="vs"><div class="score"><span>${S.s1}</span><em>–</em><span>${S.s2}</span></div><div class="bo">${esc(roundLabel(S))}</div></div>
      <div class="side r">${logoHtml(S.t2, 'red')}<div><div class="name ${lenClass(S.t2, 14, 22)}">${esc(S.t2)}</div><div class="rec">${rec(S.t2)}</div></div></div>
    </div>`;
  }
  function msgHtml() {
    if (lastErr && !P.has('t1')) return `<div class="msg err">Sin conexión con ATAK.GG (${esc(lastErr)}). Usa ?t1=&t2=&s1=&s2= para forzar los datos.</div>`;
    return '';
  }

  /* ---------- cuenta regresiva ---------- */
  function targetTime() {
    const h = q('hora'); if (!h) return null;
    const mm = /^(\d{1,2}):(\d{2})$/.exec(h.trim()); if (!mm) return null;
    const d = new Date(); d.setHours(Number(mm[1]), Number(mm[2]), 0, 0);
    if (d.getTime() < Date.now() - 6 * 3600e3) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  function countdownHtml() {
    const t = targetTime(); if (!t) return '';
    return `<div class="countdown in d3"><span class="num" id="cd">--:--</span><span class="lbl">para empezar</span></div>`;
  }
  function tickCountdown() {
    const el = document.getElementById('cd'); const t = targetTime(); if (!el || !t) return;
    let s = Math.max(0, Math.round((t - Date.now()) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
    el.textContent = s === 0 ? '¡YA CASI!' : (h ? `${h}:` : '') + `${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  /* ---------- pantallas ---------- */
  const PAGES = {};

  PAGES.espera = (root, kind) => {
    const S = series();
    const titles = { inicio: 'Empezamos en breve', pausa: 'Volvemos en breve', fin: 'Gracias por ver' };
    const kickers = { inicio: 'Transmisión / La noche empieza', pausa: 'Transmisión / Pausa técnica', fin: 'Transmisión / Hasta la próxima' };
    const title = q('msg', titles[kind]);
    root.innerHTML = `${headHtml(S)}
      <div class="center">
        <div class="kicker in">${esc(q('kicker', kickers[kind]))}</div>
        <div class="display title ${title.length > 18 ? 'long' : ''} in d1">${esc(title)}</div>
        ${kind === 'fin' ? `<div class="sub in d2">${esc(q('sub', 'Síguenos en nuestras redes y no te pierdas la siguiente jornada'))}</div>` : ''}
        ${kind === 'inicio' ? countdownHtml() : ''}
        ${kind !== 'fin' ? matchCardHtml(S) : ''}
      </div>
      ${footHtml()}${msgHtml()}`;
    tickCountdown();
  };
  PAGES.inicio = (r) => PAGES.espera(r, 'inicio');
  PAGES.pausa = (r) => PAGES.espera(r, 'pausa');
  PAGES.fin = (r) => PAGES.espera(r, 'fin');

  PAGES.versus = (root) => {
    const S = series();
    const panel = (name, side, dir) => {
      const r = recParts(name);
      return `<div class="team-panel ${side} ${dir}">
        <span class="side-tag">${side === 'blue' ? 'Lado azul' : 'Lado rojo'}</span>
        ${logoHtml(name, side, 'big-logo')}
        <div><div class="display tname ${lenClass(name, 12, 17)}">${esc(name)}</div>
        <div class="trec">${r ? `<span><b>${r.w}</b> V</span><span><b>${r.l}</b> D</span><span><b>${r.p}</b> PTS</span><span class="pos">#${r.pos}</span>` : '<span>&nbsp;</span>'}</div></div>
      </div>`;
    };
    const pips = (n, cls, rev) => { const a = Array.from({ length: Math.ceil(S.bo / 2) }, (_, i) => `<span class="pip ${i < n ? cls : ''}"></span>`); return (rev ? a.reverse() : a).join(''); };
    root.innerHTML = `${headHtml(S)}
      <div class="versus">
        ${panel(S.t1, 'blue', 'in-l')}
        <div class="vs-col in d2">
          <div class="display vs">VS</div>
          <div class="series"><span class="b" id="s1">${S.s1}</span><em>–</em><span class="r" id="s2">${S.s2}</span></div>
          <div class="pips">${pips(S.s1, 'b')}${pips(S.s2, 'r', true)}</div>
          <div class="bo">${esc(roundLabel(S))}</div>
          ${S.status === 'complete' ? `<span class="chip gold">Serie terminada</span>` : S.s1 + S.s2 > 0 ? `<span class="chip live">Juego ${S.s1 + S.s2 + 1}</span>` : ''}
        </div>
        ${panel(S.t2, 'red', 'in-r')}
      </div>
      ${footHtml()}${msgHtml()}`;
  };

  PAGES['champ-select'] = (root) => {
    const S = series();
    const game = Number(q('juego', S.s1 + S.s2 + 1)) || 1;
    const team = (name, side) => {
      const r = recParts(name);
      return `<div class="cs-team ${side === 'red' ? 'r in-r' : 'l in-l'}">
        ${logoHtml(name, side)}
        <div style="min-width:0"><div class="cname ${lenClass(name, 16, 22)}">${esc(name)}</div><div class="crec">${r ? `${r.w}-${r.l} · ${r.p} PTS · #${r.pos}` : side === 'red' ? 'Lado rojo' : 'Lado azul'}</div></div>
        <div class="cscore" id="${side === 'red' ? 's2' : 's1'}">${side === 'red' ? S.s2 : S.s1}</div>
      </div>`;
    };
    root.innerHTML = `${q('arriba', '1') !== '0' ? team(S.t1, 'blue') + team(S.t2, 'red') : ''}
      ${q('pie', '1') !== '0' ? `<div class="cs-bottom in d1">
        <div class="lockup"><img src="logos/lqc-wordmark.png" alt="LQC"><i></i><span class="qc"><small>League of Legends</small>Queretaro<br>Championship</span></div>
        <div class="round"><span class="chip">${esc(q('fase', 'Selección de campeones'))}</span><span>${esc(S.round ? `Ronda ${S.round}` : 'Fase suiza')} · <b>Juego ${game}</b> · Mejor de ${S.bo}</span></div>
        <div class="socials">${socialsHtml()}</div>${poweredHtml()}
      </div>` : ''}`;
  };

  PAGES.redes = (root) => {
    const list = socials();
    if (q('modo') === 'banner') {
      document.body.classList.add('transparent');
      document.querySelectorAll('.bg').forEach((el) => el.remove());
      const row = list.map((s) => `<span class="social">${ICONS[s.icon]}<span>${esc(s.text)}</span><small>· ${esc(s.label)}</small></span>`).join('') + `<span class="social">${poweredHtml()}</span>`;
      root.innerHTML = `<div class="banner in">
        <div class="lockup"><img src="logos/lqc-wordmark.png" alt="LQC"><i></i><span class="qc"><small>League of Legends</small>Queretaro<br>Championship</span></div>
        <div class="ticker"><div class="ticker-row">${row}${row}</div></div>
      </div>`;
      return;
    }
    const S = series();
    root.innerHTML = `${headHtml(S)}
      <div class="redes">
        <div class="kicker in">${esc(q('kicker', 'Comunidad / No te pierdas nada'))}</div>
        <div class="display title in d1">${esc(q('msg', 'Síguenos'))}</div>
        <div class="redes-grid">${list.map((s, i) => `<div class="redes-card in d${Math.min(5, i + 2)}">${ICONS[s.icon]}<div><div class="net">${esc(s.label)}</div><div class="handle ${s.text.length > 16 ? 'long' : ''}">${esc(s.text)}</div></div></div>`).join('')}</div>
      </div>
      ${footHtml()}`;
  };

  PAGES.tabla = (root) => {
    const S = series();
    const rows = standings();
    const cut = Number(q('corte', (T && T.playoffsSize) || 0)) || 0;
    const half = Math.ceil(rows.length / 2);
    const row = (s, i) => `<div class="trow in d${Math.min(5, 1 + Math.floor(i / 4))} ${cut && s.position === cut ? 'cut' : ''} ${cut && s.position <= cut ? 'qual' : ''}">
      <span class="pos">${s.position}</span>${logoHtml(s.team)}
      <span class="tn">${esc(s.team)}</span>
      <span class="wl"><b>${s.wins}</b> V · ${s.losses} D</span>
      <span class="pts">${s.points}</span>
    </div>`;
    const head = `<div class="trow thead"><span>#</span><span></span><span>Equipo</span><span style="text-align:right">V · D</span><span style="text-align:right">PTS</span></div>`;
    root.innerHTML = `${headHtml(S)}
      <div class="tabla">
        <div class="tcol">${head}${rows.slice(0, half).map(row).join('')}</div>
        <div class="tcol">${head}${rows.slice(half).map(row).join('')}</div>
      </div>
      ${footHtml()}${msgHtml()}`;
    if (!rows.length && !lastErr) root.insertAdjacentHTML('beforeend', '<div class="msg">Cargando tabla…</div>');
  };

  PAGES.partidos = (root) => {
    const S = series();
    const r = Number(q('ronda', currentRound())) || currentRound();
    const ms = roundMatches(r);
    const real = ms.filter((m) => m.team2 !== 'BYE'), byes = ms.filter((m) => m.team2 === 'BYE');
    const card = (m, i) => {
      const done = m.matchStatus === 'complete', live = (Number(m.score1) || 0) + (Number(m.score2) || 0) > 0 && !done;
      const won = done ? (m.winner === m.team1 ? 'won-1' : m.winner === m.team2 ? 'won-2' : '') : '';
      const st = done ? (m.forfeit ? 'Final · W.O.' : 'Final') : live ? `En juego · Juego ${(Number(m.score1) || 0) + (Number(m.score2) || 0) + 1}` : 'Por jugar';
      return `<div class="mcard in d${Math.min(5, 1 + Math.floor(i / 3))} ${won}">
        <span class="mid">${esc(m.id)}</span>
        <div class="t">${logoHtml(m.team1, 'blue')}<span class="mn ${lenClass(m.team1, 14, 20)}">${esc(m.team1)}</span></div>
        <div class="sc"><div class="n b">${Number(m.score1) || 0}<em>–</em>${Number(m.score2) || 0}</div><span class="st ${done ? 'done' : live ? 'live' : ''}">${st}</span></div>
        <div class="t">${logoHtml(m.team2, 'red')}<span class="mn ${lenClass(m.team2, 14, 20)}">${esc(m.team2)}</span></div>
      </div>`;
    };
    const byeCards = byes.map((m, i) => `<div class="mcard bye in d5">${logoHtml(m.team1)}<div><span class="mn">${esc(m.team1)}</span><div class="st">Descansa esta ronda</div></div></div>`).join('');
    root.innerHTML = `${headHtml({ round: r, bo: S.bo })}
      <div class="partidos">${real.map(card).join('')}${byeCards}</div>
      ${footHtml()}${msgHtml()}`;
    if (!ms.length && !lastErr) root.insertAdjacentHTML('beforeend', '<div class="msg">Cargando partidos…</div>');
  };

  /* ---------- arranque ---------- */
  const page = document.body.dataset.page;
  const root = document.getElementById('stage');
  if (P.get('bg') === '1') document.body.classList.add('preview');
  const needsApi = !(P.has('t1') && P.has('t2')) || page === 'tabla' || page === 'partidos';
  let lastKey = '';
  function render(force) {
    // Solo se vuelve a pintar si cambió algo: así las entradas no se repiten.
    const key = JSON.stringify([page, series(), standings().map((s) => [s.team, s.points]), roundMatches(currentRound()).map((m) => [m.id, m.score1, m.score2, m.matchStatus]), lastErr]);
    if (!force && key === lastKey) return;
    const prev = lastKey; lastKey = key;
    const before = root.querySelector('#s1') ? [root.querySelector('#s1').textContent, root.querySelector('#s2').textContent] : null;
    PAGES[page](root);
    if (prev && before) {
      ['s1', 's2'].forEach((id, i) => { const el = root.querySelector('#' + id); if (el && el.textContent !== before[i]) el.classList.add('score-pop'); });
      // Al actualizar, sin repetir las animaciones de entrada.
      root.querySelectorAll('.in, .in-l, .in-r').forEach((el) => { el.style.animation = 'none'; });
    }
  }
  (async () => {
    if (needsApi) await load();
    render(true);
    if (needsApi) setInterval(async () => { await load(); render(false); }, POLL);
    setInterval(tickCountdown, 1000);
  })();
})();
