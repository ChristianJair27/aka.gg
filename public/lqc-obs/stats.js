/* LQC · pantallas de estadísticas para OBS, con los datos de ATAK.GG:
     stats-top.html?stat=score|kda|dpm|gpm|cspm|vision|kills|winrate&min=4   ranking de jugadores
     stats-equipo.html?equipo=Hive                                           ficha del equipo
     stats-h2h.html?match=r6m2  (o ?t1=&t2=)                                 cara a cara
     stats-partido.html?match=r5m1&juego=2                                   estadísticas de un juego terminado
   Comunes: ?torneo=lqc-2026  ?tw=  ?ig=  (redes del pie) */
(function () {
  const API = 'https://atakback.revolution505.com';
  const P = new URLSearchParams(location.search);
  const q = (k, d) => (P.has(k) ? P.get(k) : d);
  const TID = q('torneo', 'lqc-2026');

  const LOGOS = { '2 DOPE': '2-dope', 'DinoRatas': 'dinoratas', 'False Promise Gaming': 'false-promise-gaming', 'Galaxy Gaming': 'galaxy-gaming', 'Heralds Of Cthulhu': 'heralds-of-cthulhu', 'Game Over Qro': 'game-over-qro', 'Requiem': 'requiem', 'Los Rokosos': 'los-rokosos', 'Nephyx Esports': 'nephyx-esports', 'RAKU': 'raku', 'REV505': 'rev505', 'Tlacuaches': 'tlacuaches', 'Mythical Dragons': 'mythical-dragons', 'The Town Boys': 'the-town-boys', 'Hive': 'hive' };
  const norm = (s) => String(s || '').trim().replace(/\s+/g, ' ');
  const same = (a, b) => norm(a).toLowerCase() === norm(b).toLowerCase();
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const lenClass = (name, a, b) => { const n = norm(name).length; return n > (b || 18) ? 'xlong' : n > (a || 12) ? 'long' : ''; };
  const fmt = (n, d = 0) => (n == null || isNaN(n) ? '–' : Number(n).toLocaleString('es-MX', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const k = (n) => (n >= 1000 ? (n / 1000).toFixed(1) + 'k' : fmt(n));
  const dur = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

  function logoHtml(name, side) {
    const key = Object.keys(LOGOS).find((x) => same(x, name));
    if (key) return `<div class="logo ${side || ''}"><img src="logos/${LOGOS[key]}.png" alt=""></div>`;
    const ini = norm(name).replace(/^(los|the|la|el)\s+/i, '').charAt(0).toUpperCase() || '?';
    return `<div class="logo ${side || ''}"><span class="mono">${esc(ini)}</span></div>`;
  }

  /* ---------- Data Dragon (iconos de campeón e ítems) ---------- */
  let DD = '15.19.1';
  async function ddVersion() {
    try { const v = await (await fetch('https://ddragon.leagueoflegends.com/api/versions.json')).json(); if (Array.isArray(v) && v[0]) DD = v[0]; } catch (e) { /* se queda la versión por defecto */ }
  }
  const champImg = (name, cls) => name ? `<img class="champ ${cls || ''}" src="https://ddragon.leagueoflegends.com/cdn/${DD}/img/champion/${encodeURIComponent(name)}.png" alt="" onerror="this.src='https://cdn.communitydragon.org/latest/champion/${encodeURIComponent(name)}/square'">` : `<span class="champ ${cls || ''}"></span>`;
  const itemImg = (id) => id ? `<img class="item" src="https://ddragon.leagueoflegends.com/cdn/${DD}/img/item/${id}.png" alt="" onerror="this.style.visibility='hidden'">` : `<span class="item empty"></span>`;

  /* ---------- datos ---------- */
  let T = null, GS = null, lastErr = null;
  async function getJson(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }
  let LIVE = null;
  async function loadT() { try { const d = await getJson(`${API}/api/tournaments/${encodeURIComponent(TID)}`); T = d.tournament || d; } catch (e) { lastErr = e.message; } try { const r = await fetch(`${API}/api/live-feed/${encodeURIComponent(TID)}`, { cache: 'no-store' }); LIVE = r.status === 200 ? await r.json() : null; } catch (e) { LIVE = null; } }
  /** Sin match= en la URL: la serie que se está jugando (feed en vivo) o la última cuyo código se activó. */
  function autoMatch() {
    const b = bracket();
    if (LIVE && LIVE.team1 && LIVE.team2) { const m = b.find((x) => (same(x.team1, LIVE.team1) && same(x.team2, LIVE.team2)) || (same(x.team1, LIVE.team2) && same(x.team2, LIVE.team1))); if (m && m.matchStatus !== 'complete') return m; }
    const act = b.filter((x) => x.matchStatus !== 'complete' && x.team2 !== 'BYE' && Number(x.codeActivatedAt) > 0).sort((a, c) => Number(c.codeActivatedAt) - Number(a.codeActivatedAt));
    return act[0] || null;
  }
  async function loadGS() { try { const d = await getJson(`${API}/api/public/v1/tournaments/${encodeURIComponent(TID)}/stats`); GS = d.data || d; lastErr = null; } catch (e) { lastErr = e.message; } }
  const players = () => (GS && Array.isArray(GS.players) ? GS.players : []);
  const standings = () => (T && Array.isArray(T.standings) ? T.standings : []);
  const bracket = () => (T && Array.isArray(T.bracket) ? T.bracket : []);
  const standing = (name) => standings().find((s) => same(s.team, name)) || null;
  const currentRound = () => bracket().reduce((m, x) => Math.max(m, Number(x.round) || 0), 0);
  const lastGameId = (m) => Math.max(0, ...((m.games || []).map((g) => Number(g.gameId) || 0)), Number(m.gameId) || 0);
  /** Serie con el juego terminado más reciente (los gameId de Riot crecen con el tiempo). */
  function latestMatch(team) {
    const list = bracket().filter((m) => m.team2 !== 'BYE' && lastGameId(m) > 0 && (!team || same(m.team1, team) || same(m.team2, team)));
    return list.sort((a, b) => lastGameId(b) - lastGameId(a))[0] || null;
  }
  function findMatch() {
    const id = q('match'), team = q('equipo'), t1 = q('t1'), t2 = q('t2');
    if (id) return bracket().find((x) => String(x.id).toLowerCase() === id.toLowerCase()) || null;
    if (t1 && t2) return bracket().find((x) => (same(x.team1, t1) && same(x.team2, t2)) || (same(x.team1, t2) && same(x.team2, t1))) || null;
    if (page === 'stats-partido') return latestMatch(team);
    if (team) return bracket().filter((x) => Number(x.round) === currentRound()).find((x) => same(x.team1, team) || same(x.team2, team)) || null;
    return autoMatch();
  }
  const splashUrl = (name) => name ? `https://ddragon.leagueoflegends.com/cdn/img/champion/splash/${encodeURIComponent(name)}_0.jpg` : '';
  const teamPlayers = (name) => players().filter((p) => same(p.team, name));
  const pname = (p) => p.summonerName || '';

  /** Agregados de un equipo a partir de sus jugadores. */
  function teamAgg(name) {
    const ps = teamPlayers(name); const s = standing(name);
    const sum = (f) => ps.reduce((a, p) => a + (Number(p[f]) || 0), 0);
    const games = ps.length ? Math.max(...ps.map((p) => p.gamesPlayed || 0)) : 0;
    const wavg = (f) => { const g = sum('gamesPlayed'); return g ? ps.reduce((a, p) => a + (Number(p[f]) || 0) * (p.gamesPlayed || 0), 0) / g : 0; };
    const K = sum('totalKills'), D = sum('totalDeaths'), A = sum('totalAssists');
    const pool = {}; ps.forEach((p) => (p.championPool || []).forEach((c) => { pool[c] = (pool[c] || 0) + 1; }));
    const topChamps = Object.entries(pool).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([c]) => c);
    const best = ps.filter((p) => p.rank).sort((a, b) => a.rank - b.rank)[0] || ps.sort((a, b) => (b.score || 0) - (a.score || 0))[0] || null;
    return {
      name, ps, s, games, kills: K, deaths: D, assists: A,
      kda: D ? (K + A) / D : K + A, killsPerGame: games ? K / games : 0,
      dpm: wavg('avgDamagePerMin'), gpm: wavg('avgGoldPerMin'), cspm: wavg('avgCsPerMin'), vpm: wavg('avgVisionPerMin'),
      gameWins: sum('wins') / Math.max(1, ps.length), gameTotal: sum('gamesPlayed') / Math.max(1, ps.length),
      multis: sum('doubleKills') + sum('tripleKills') + sum('quadraKills') + sum('pentaKills'), pentas: sum('pentaKills'),
      topChamps, best,
    };
  }

  /* ---------- piezas comunes ---------- */
  const fecha = () => new Date().toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  function headHtml(meta) {
    return `<div class="head in">
      <div class="lockup"><img src="logos/lqc-wordmark.png" alt="LQC"><i></i><span class="qc"><small>League of Legends</small>Queretaro<br>Championship</span><span class="sep"></span><span class="watch">Míralos en: <b>twitch.tv/${esc(q('tw', 'lqroc'))}</b></span></div>
      <div class="meta"><span>${esc(fecha())}</span><span class="dot"></span><b>${esc(meta || `Ronda ${currentRound()} · Fase suiza`)}</b></div>
    </div>`;
  }
  function footHtml() {
    const nets = [['twitch', 'tw', 'lqroc', (h) => `twitch.tv/${h}`], ['instagram', 'ig', 'lqro.c', (h) => `@${h}`]];
    const icons = { twitch: '<svg viewBox="0 0 24 24"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/></svg>', instagram: '<svg viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>' };
    const soc = nets.map(([ic, key, def, f]) => ({ ic, h: q(key, def), f })).filter((x) => x.h).map((x) => `<span class="social">${icons[x.ic]}<span>${esc(x.f(x.h))}</span></span>`).join('');
    const upd = GS && GS.lastUpdated ? ` · ${GS.matchesCompleted || 0} juegos analizados` : '';
    return `<div class="foot in d4"><div class="socials">${soc}</div><span class="powered"><img src="img/atak-logo-mark.png" alt=""><span>Estadísticas oficiales · <b>ATAK.GG</b>${esc(upd)}</span></span></div>`;
  }
  const titleHtml = (kicker, title, right) => `<div class="title-row"><div><div class="kicker in">${esc(kicker)}</div><div class="display in d1" style="font-size:56px">${esc(title)}</div></div><div class="right in d1">${right || ''}</div></div>`;
  const msgHtml = () => (lastErr ? `<div class="msg err">Sin conexión con ATAK.GG (${esc(lastErr)})</div>` : '');
  const barHtml = (v, max, cls) => `<div class="bar ${cls || ''}"><i style="width:${max ? Math.max(2, Math.min(100, (v / max) * 100)) : 0}%"></i></div>`;

  /* ---------- pantallas ---------- */
  const PAGES = {};

  const STATS = {
    score: { l: 'Puntuación ATAK', t: 'MVP del torneo', k: 'Ranking de jugadores', f: (p) => p.score, u: 'PTS', d: 0 },
    kda: { l: 'KDA promedio', t: 'Mejor KDA', k: 'Ranking de jugadores', f: (p) => p.avgKda, u: 'KDA', d: 2 },
    dpm: { l: 'Daño por minuto', t: 'Más daño', k: 'Ranking de jugadores', f: (p) => p.avgDamagePerMin, u: 'DPM', d: 0 },
    gpm: { l: 'Oro por minuto', t: 'Más oro', k: 'Ranking de jugadores', f: (p) => p.avgGoldPerMin, u: 'GPM', d: 0 },
    cspm: { l: 'CS por minuto', t: 'Mejor farmeo', k: 'Ranking de jugadores', f: (p) => p.avgCsPerMin, u: 'CS/MIN', d: 1 },
    vision: { l: 'Visión por minuto', t: 'Más visión', k: 'Ranking de jugadores', f: (p) => p.avgVisionPerMin, u: 'VIS/MIN', d: 2 },
    kills: { l: 'Asesinatos totales', t: 'Más asesinatos', k: 'Ranking de jugadores', f: (p) => p.totalKills, u: 'KILLS', d: 0 },
    winrate: { l: 'Porcentaje de victorias', t: 'Más victorias', k: 'Ranking de jugadores', f: (p) => p.winrate, u: '% WR', d: 0 },
  };
  PAGES['stats-top'] = (root) => {
    const st = STATS[q('stat', 'score')] || STATS.score;
    const min = Number(q('min', 4)) || 0; const n = Number(q('n', 10)) || 10;
    const list = players().filter((p) => (p.gamesPlayed || 0) >= min && st.f(p) != null).sort((a, b) => st.f(b) - st.f(a)).slice(0, n);
    const max = list.length ? st.f(list[0]) : 0;
    const row = (p, i) => `<div class="rank-row in d${Math.min(5, 1 + Math.floor(i / 4))} ${i < 3 ? 'top' : ''}">
      <span class="pos">${i + 1}</span>${champImg(p.mostPlayedChamp)}
      <div class="who"><div class="nm">${esc(pname(p))}<small>${esc(p.team || '')}</small></div>
        ${barHtml(st.f(p), max, i < 3 ? 'gold' : '')}
        <div class="sub"><span>KDA <b>${fmt(p.avgKda, 2)}</b></span><span>WR <b>${fmt(p.winrate)}%</b></span><span>Juegos <b>${p.gamesPlayed}</b></span><span>K/D/A <b>${p.totalKills}/${p.totalDeaths}/${p.totalAssists}</b></span></div></div>
      <div class="val"><div class="n">${fmt(st.f(p), st.d)}</div><div class="u">${esc(st.u)}</div></div>
    </div>`;
    root.innerHTML = `${headHtml()}${titleHtml(st.k, st.t, `<span class="chip">${esc(st.l)}</span><span class="chip">Mín. ${min} juegos</span>`)}
      <div class="body"><div class="rank-list">${list.map(row).join('')}</div></div>${footHtml()}${msgHtml()}`;
  };

  PAGES['stats-equipo'] = (root) => {
    const name = q('equipo') || (findMatch() ? findMatch().team1 : '') || (standings()[0] ? standings()[0].team : '');
    const a = teamAgg(name); const s = a.s;
    const ps = [...a.ps].sort((x, y) => (y.score || 0) - (x.score || 0));
    const maxScore = Math.max(1, ...ps.map((p) => p.score || 0));
    const row = (p, i) => `<div class="p-row in d${Math.min(5, 1 + i)}">${champImg(p.mostPlayedChamp, 'lg')}
      <div class="nm">${esc(pname(p))}<small>${p.rank ? `#${p.rank} del torneo · ` : ''}${p.soloTier ? `${esc(p.soloTier)} ${esc(p.soloDivision || '')}` : ''}</small></div>
      <div class="pool">${(p.championPool || []).slice(0, 3).map((c) => champImg(c)).join('')}</div>
      <div class="kda"><b>${p.totalKills}</b> / <i>${p.totalDeaths}</i> / <b>${p.totalAssists}</b><br><small style="color:var(--muted)">KDA ${fmt(p.avgKda, 2)}</small></div>
      <div class="wr"><span><span>WR</span><b>${fmt(p.winrate)}% · ${p.wins}V ${p.losses}D</b></span>${barHtml(p.winrate, 100)}</div>
      <div class="num">${fmt(p.avgDamagePerMin)}<small>DPM</small></div>
      <div class="num">${fmt(p.score)}<small>PTS</small></div>
    </div>`;
    root.innerHTML = `${headHtml()}
      <div class="body" style="top:150px">
        <div class="team-head in"><div>${logoHtml(name, 'blue')}</div><div><div class="display tname ${lenClass(name, 14, 20)}" style="font-size:54px">${esc(name)}</div>
          <div class="trec">${s ? `<span>Posición <b>#${s.position}</b></span><span>Series <b>${s.wins}V ${s.losses}D</b></span><span>Puntos <b>${s.points}</b></span>` : ''}<span>Juegos <b>${Math.round(a.gameWins)}V ${Math.round(a.gameTotal - a.gameWins)}D</b></span></div></div>
          <div class="pool" style="margin-left:auto;align-self:center">${a.topChamps.map((c) => champImg(c, 'lg')).join('')}</div></div>
        <div class="tiles">
          <div class="tile in d1"><div class="l">WR en juegos</div><div class="v">${pct(a.gameWins, a.gameTotal)}<small>%</small></div>${barHtml(pct(a.gameWins, a.gameTotal), 100)}</div>
          <div class="tile in d1"><div class="l">KDA de equipo</div><div class="v">${fmt(a.kda, 2)}</div><div class="l" style="margin-top:10px">${a.kills}/${a.deaths}/${a.assists}</div></div>
          <div class="tile in d2"><div class="l">Kills por juego</div><div class="v">${fmt(a.killsPerGame, 1)}</div><div class="l" style="margin-top:10px">${a.kills} en ${a.games} juegos</div></div>
          <div class="tile in d2"><div class="l">Daño por minuto</div><div class="v">${fmt(a.dpm)}</div><div class="l" style="margin-top:10px">promedio por jugador</div></div>
          <div class="tile in d3"><div class="l">Oro · CS por minuto</div><div class="v">${fmt(a.gpm)}<small>GPM</small></div><div class="l" style="margin-top:10px">${fmt(a.cspm, 1)} CS/MIN</div></div>
          <div class="tile in d3"><div class="l">Multikills</div><div class="v">${a.multis}</div><div class="l" style="margin-top:10px">${a.pentas ? `${a.pentas} PENTAKILL` : 'sin pentakills'}</div></div>
        </div>
        <div class="roster"><div class="p-row thead"><span></span><span>Jugador</span><span>Campeones</span><span style="text-align:right">K / D / A</span><span>Victorias</span><span style="text-align:right">Daño/min</span><span style="text-align:right">Puntos</span></div>${ps.map(row).join('')}</div>
      </div>${footHtml()}${msgHtml()}`;
  };

  PAGES['stats-h2h'] = (root) => {
    const m = findMatch();
    const t1 = q('t1', m ? m.team1 : ''), t2 = q('t2', m ? m.team2 : '');
    const A = teamAgg(t1), B = teamAgg(t2);
    const round = m ? m.round : currentRound(); const bo = (m && m.seriesTo ? m.seriesTo * 2 - 1 : 3);
    const rows = [
      ['WR en juegos', (a) => pct(a.gameWins, a.gameTotal), 0, '%'],
      ['KDA de equipo', (a) => a.kda, 2, ''],
      ['Kills por juego', (a) => a.killsPerGame, 1, ''],
      ['Daño por minuto', (a) => a.dpm, 0, ''],
      ['Oro por minuto', (a) => a.gpm, 0, ''],
      ['CS por minuto', (a) => a.cspm, 1, ''],
      ['Visión por minuto', (a) => a.vpm, 2, ''],
      ['Multikills', (a) => a.multis, 0, ''],
    ];
    const cmp = ([l, f, d, u], i) => { const va = f(A), vb = f(B); const max = Math.max(va, vb, 0.0001);
      return `<div class="cmp-row in d${Math.min(5, 1 + Math.floor(i / 2))}">
        <div class="side"><span class="n ${va > vb ? 'win' : ''}">${fmt(va, d)}<small>${u}</small></span>${barHtml(va, max, '')}</div>
        <span class="lbl">${esc(l)}</span>
        <div class="side r">${barHtml(vb, max, 'red')}<span class="n ${vb > va ? 'win' : ''}">${fmt(vb, d)}<small>${u}</small></span></div>
      </div>`; };
    const best = (a, cls) => a.best ? `<div class="best ${cls} in d4">${champImg(a.best.mostPlayedChamp, 'lg')}<div><div class="l">Jugador destacado${a.best.rank ? ` · #${a.best.rank} del torneo` : ''}</div><div class="nm">${esc(pname(a.best))}</div><div class="st">KDA <b>${fmt(a.best.avgKda, 2)}</b> · WR <b>${fmt(a.best.winrate)}%</b> · <b>${fmt(a.best.avgDamagePerMin)}</b> DPM</div></div><div class="pool">${a.topChamps.slice(0, 4).map((c) => champImg(c)).join('')}</div></div>` : '';
    const rec = (a) => a.s ? `<b>#${a.s.position}</b> · <b>${a.s.wins}V ${a.s.losses}D</b> · <b>${a.s.points}</b> PTS` : '';
    root.innerHTML = `${headHtml(`Ronda ${round} · Mejor de ${bo}`)}
      <div class="body" style="top:150px">
        <div class="h2h-head">
          <div class="tm in-l">${logoHtml(t1, 'blue')}<div><div class="display tname ${lenClass(t1, 12, 18)}" style="font-size:44px">${esc(t1)}</div><div class="trec">${rec(A)}</div></div></div>
          <div class="mid in d1"><div class="display">VS</div><div class="bo">Cara a cara</div></div>
          <div class="tm r in-r">${logoHtml(t2, 'red')}<div><div class="display tname ${lenClass(t2, 12, 18)}" style="font-size:44px">${esc(t2)}</div><div class="trec">${rec(B)}</div></div></div>
        </div>
        <div class="cmp">${rows.map(cmp).join('')}</div>
        <div class="h2h-foot">${best(A, '')}${best(B, 'r')}</div>
      </div>${footHtml()}${msgHtml()}`;
  };

  let MS = null, msFor = '';
  // Gráfica de la partida (oro por minuto, ancianos, larvas): /api/replays/:region/:gameId/graph
  const GR = {};
  async function loadGraph(matchId) {
    const mm = /^([A-Z0-9]+)_(\d+)$/.exec(String(matchId || '')); if (!mm || GR[matchId]) return;
    GR[matchId] = { loading: true };
    try { GR[matchId] = await getJson(`${API}/api/replays/${mm[1]}/${mm[2]}/graph`); } catch (e) { GR[matchId] = { error: e.message }; } render();
  }
  function goldChart(gr, w, h) {
    const pts = (gr && gr.gold) || []; if (pts.length < 2) return '';
    const diffs = pts.map((p) => p.blue - p.red); const max = Math.max(1000, ...diffs.map(Math.abs));
    const x = (i) => (i / (pts.length - 1)) * w, y = (v) => h / 2 - (v / max) * (h / 2 - 6);
    const line = diffs.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    const areaB = `M0,${h / 2} ` + diffs.map((v, i) => `L${x(i).toFixed(1)},${y(Math.max(0, v)).toFixed(1)}`).join(' ') + ` L${w},${h / 2} Z`;
    const areaR = `M0,${h / 2} ` + diffs.map((v, i) => `L${x(i).toFixed(1)},${y(Math.min(0, v)).toFixed(1)}`).join(' ') + ` L${w},${h / 2} Z`;
    const last = diffs[diffs.length - 1];
    const ticks = []; for (let mnt = 5; mnt < pts.length; mnt += 5) ticks.push(`<text x="${x(mnt).toFixed(1)}" y="${h - 2}" class="bd-tick">${mnt}'</text>`);
    return `<svg class="bd-svg" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
      <path d="${areaB}" class="bd-area b"/><path d="${areaR}" class="bd-area r"/>
      <line x1="0" y1="${h / 2}" x2="${w}" y2="${h / 2}" class="bd-zero"/>
      <polyline points="${line}" class="bd-line"/>
      ${ticks.join('')}
      <text x="4" y="14" class="bd-lbl b">+${k(max)}</text><text x="4" y="${h - 8}" class="bd-lbl r">−${k(max)}</text>
      <text x="${w - 4}" y="${last >= 0 ? 14 : h - 8}" class="bd-lbl ${last >= 0 ? 'b' : 'r'}" text-anchor="end">${last >= 0 ? '+' : '−'}${k(Math.abs(last))} al final</text>
    </svg>`;
  }
  PAGES['stats-partido'] = (root) => {
    const m = findMatch();
    const overlay = q('modo') === 'overlay';
    const breakdown = q('modo') === 'breakdown';
    if (overlay || breakdown) { document.body.classList.add('transparent'); document.querySelectorAll('.bg').forEach((el) => el.remove()); }
    if (!m) { root.innerHTML = (overlay || breakdown) ? '' : `${headHtml()}${titleHtml('Post-partida', 'Esperando el primer juego terminado…')}${footHtml()}${msgHtml()}`; return; }
    const games = (MS && Array.isArray(MS.games) && MS.games.length) ? MS.games : (MS && MS.blueTeam ? [MS] : []);
    if (!games.length) { root.innerHTML = (overlay || breakdown) ? '' : `${headHtml(`Ronda ${m.round}`)}${titleHtml(`${m.team1} vs ${m.team2}`, 'Procesando el juego… (1 a 3 min tras terminar)')}${footHtml()}${msgHtml()}`; return; }
    const gi = Math.min(games.length, Math.max(1, Number(q('juego', games.length)) || games.length)) - 1;
    const g = games[gi];
    // ¿Qué equipo fue azul? El bracket no lo dice: se deduce por los jugadores registrados.
    const blueNames = new Set((g.blueTeam || []).map((p) => (p.summonerName || '').toLowerCase()));
    const t1Blue = teamPlayers(m.team1).filter((p) => blueNames.has(pname(p).toLowerCase())).length >= teamPlayers(m.team2).filter((p) => blueNames.has(pname(p).toLowerCase())).length;
    const blueName = t1Blue ? m.team1 : m.team2, redName = t1Blue ? m.team2 : m.team1;
    const sumK = (t) => (t || []).reduce((a, p) => a + (p.kills || 0), 0);
    const maxDmg = Math.max(1, ...[...(g.blueTeam || []), ...(g.redTeam || [])].map((p) => p.totalDamageDealt || 0));
    const mvp = [...(g.blueTeam || []), ...(g.redTeam || [])].filter((p) => p.win).sort((a, b) => (b.kda * 1000 + b.totalDamageDealt / 100) - (a.kda * 1000 + a.totalDamageDealt / 100))[0];
    const roleOrder = { TOP: 0, JUNGLE: 1, MIDDLE: 2, BOTTOM: 3, UTILITY: 4 };
    const roleName = { TOP: 'Top', JUNGLE: 'Jungla', MIDDLE: 'Mid', BOTTOM: 'ADC', UTILITY: 'Soporte' };
    const row = (p, i) => `<div class="g-row in d${Math.min(5, 1 + i)} ${p === mvp ? 'mvp' : ''}">${champImg(p.championName)}
      <div class="nm">${esc(p.summonerName)}<small>${esc(roleName[p.teamPosition] || p.championName || '')}</small></div>
      <div class="kda"><b>${p.kills}</b> / <i>${p.deaths}</i> / <b>${p.assists}</b><small>KDA ${fmt(p.kda, 2)}</small></div>
      <div class="dmg"><span><b>${k(p.totalDamageDealt)}</b> daño</span>${barHtml(p.totalDamageDealt, maxDmg, '')}</div>
      <div class="num">${k(p.goldEarned)}<small>ORO</small></div>
      <div class="num">${p.cs}<small>CS</small></div>
      <div class="num">${p.visionScore}<small>VIS</small></div>
      <div class="items">${[0, 1, 2, 3, 4, 5].map((j) => itemImg((p.items || [])[j])).join('')}</div>
    </div>`;
    const sortRows = (t) => [...(t || [])].sort((a, b) => (roleOrder[a.teamPosition] ?? 9) - (roleOrder[b.teamPosition] ?? 9));
    const thead = `<div class="g-row thead"><span></span><span>Jugador</span><span style="text-align:center">K / D / A</span><span>Daño</span><span style="text-align:right">Oro</span><span style="text-align:right">CS</span><span style="text-align:right">Vis</span><span>Objetos</span></div>`;
    const obj = (o, cls) => o ? `<div class="obj-row ${cls} in d2"><span><img src="../lol/ui/tower.webp" alt="" onerror="this.remove()">Torres<b>${o.towerKills ?? 0}</b></span><span><img src="../lol/dragons/elder.webp" alt="" onerror="this.remove()">Dragones<b>${o.dragonKills ?? 0}</b></span><span><img src="../lol/ui/nashor.webp" alt="" onerror="this.remove()">Barones<b>${o.baronKills ?? 0}</b></span><span><img src="../lol/ui/rift_herald.webp" alt="" onerror="this.remove()">Heraldo<b>${o.riftHeraldKills ?? 0}</b></span><span>Inhibidores<b>${o.inhibitorKills ?? 0}</b></span>${o.firstTower ? '<span class="chip" style="height:26px;font-size:11px">1ª torre</span>' : ''}${o.firstDragon ? '<span class="chip" style="height:26px;font-size:11px">1er dragón</span>' : ''}</div>` : '';
    const winnerBlue = g.winner === 'blue';
    const winName = winnerBlue ? blueName : redName;
    const tabs = games.length > 1 ? `<div class="pg-tabs">${games.map((x, i) => `<span class="chip ${i === gi ? 'on' : ''}">Juego ${x.gameNumber || i + 1}</span>`).join('')}</div>` : '';
    const tot = (t, f) => (t || []).reduce((a, p) => a + (Number(p[f]) || 0), 0);
    const sumB = { dmg: tot(g.blueTeam, 'totalDamageDealt'), gold: tot(g.blueTeam, 'goldEarned'), cs: tot(g.blueTeam, 'cs'), vis: tot(g.blueTeam, 'visionScore') };
    const sumR = { dmg: tot(g.redTeam, 'totalDamageDealt'), gold: tot(g.redTeam, 'goldEarned'), cs: tot(g.redTeam, 'cs'), vis: tot(g.redTeam, 'visionScore') };
    const mvpSide = (g.blueTeam || []).includes(mvp) ? 'blue' : 'red';
    const mvpHtml = mvp ? `<div class="mvp-card ${mvpSide} in d2" style="background-image:linear-gradient(90deg, rgba(2,11,28,.97) 38%, rgba(2,11,28,.55) 70%, rgba(2,11,28,.2)), url('${splashUrl(mvp.championName)}')">
        ${champImg(mvp.championName, 'lg')}
        <div class="mvp-body"><div class="l">MVP del juego · ${esc(mvpSide === 'blue' ? blueName : redName)}</div>
          <div class="display mvp-name">${esc(mvp.summonerName)}</div>
          <div class="mvp-st"><span><b>${mvp.kills}</b>/<i>${mvp.deaths}</i>/<b>${mvp.assists}</b> · KDA ${fmt(mvp.kda, 2)}</span><span><b>${k(mvp.totalDamageDealt)}</b> daño · ${pct(mvp.totalDamageDealt, mvpSide === 'blue' ? sumB.dmg : sumR.dmg)}% del equipo</span><span><b>${k(mvp.goldEarned)}</b> oro · <b>${mvp.cs}</b> CS · <b>${mvp.visionScore}</b> visión</span>${mvp.pentaKills ? '<span class="chip gold">PENTAKILL</span>' : mvp.quadraKills ? '<span class="chip gold">QUADRA</span>' : mvp.tripleKills ? '<span class="chip">TRIPLE</span>' : ''}</div>
        </div></div>` : '';
    const cmpRow = (l, a, b, d) => { const mx = Math.max(a, b, 1); return `<div class="tcmp-row"><span class="n b">${fmt(a, d)}</span>${barHtml(a, mx, '')}<span class="lbl">${l}</span>${barHtml(b, mx, 'red')}<span class="n r">${fmt(b, d)}</span></div>`; };
    const teamCmp = `<div class="tcmp in d3">${cmpRow('Daño total', sumB.dmg, sumR.dmg)}${cmpRow('Oro total', sumB.gold, sumR.gold)}${cmpRow('CS', sumB.cs, sumR.cs)}${cmpRow('Visión', sumB.vis, sumR.vis)}</div>`;
    if (breakdown) {
      const o = (x) => x || {};
      const gr = GR[g.matchId] && GR[g.matchId].gold ? GR[g.matchId] : null;
      if (!GR[g.matchId]) loadGraph(g.matchId);
      const byDmg = (t) => [...(t || [])].sort((a, b) => (b.totalDamageDealt || 0) - (a.totalDamageDealt || 0));
      const prow = (p, side) => `<div class="bd-prow ${side}">${champImg(p.championName, 'sm')}<span class="bd-pname">${esc(p.summonerName)}</span><span class="bd-pbar"><i style="width:${pct(p.totalDamageDealt || 0, maxDmg)}%"></i></span><b class="bd-pval">${k(p.totalDamageDealt || 0)}</b></div>`;
      const sumKDA = (t) => `${(t || []).reduce((a, p) => a + (p.kills || 0), 0)}/${(t || []).reduce((a, p) => a + (p.deaths || 0), 0)}/${(t || []).reduce((a, p) => a + (p.assists || 0), 0)}`;
      const ob = o(g.blueObjectives), orr = o(g.redObjectives);
      const eld = gr ? gr.elders : null;
      const drB = ob.dragonKills ?? 0, drR = orr.dragonKills ?? 0;
      const mid = (icon, label, a, b, cls) => `<div class="bd-mrow"><b class="b ${cls || ''}">${a}</b><span class="bd-mlbl">${icon ? `<img src="${icon}" alt="" onerror="this.remove()">` : ''}${label}</span><b class="r ${cls || ''}">${b}</b></div>`;
      const teamHead = (name, side, won) => `<div class="bd-thead ${side}">${logoHtml(name, side)}<div><div class="display bd-tname ${lenClass(name, 12, 18)}">${esc(name)}</div><div class="bd-res ${won ? 'win' : 'lose'}">${won ? 'VICTORIA' : 'DERROTA'}</div></div></div>`;
      root.innerHTML = `<div class="bd in">
        <div class="bd-head"><span class="display bd-title">Post game breakdown</span><span class="bd-meta">Ronda ${m.round} · Juego ${g.gameNumber || gi + 1} · Serie <b>${Number(m.score1) || 0}–${Number(m.score2) || 0}</b></span><span class="bd-brand"><img src="logos/lqc-logo.png" alt="" onerror="this.remove()">LQC</span></div>
        <div class="bd-grid">
          <div class="bd-team b">${teamHead(blueName, 'blue', winnerBlue)}${byDmg(g.blueTeam).map((p) => prow(p, 'b')).join('')}</div>
          <div class="bd-mid">
            <div class="bd-time"><span>GAMETIME</span><b>${dur(g.gameDuration || 0)}</b></div>
            ${mid('', 'KDA', sumKDA(g.blueTeam), sumKDA(g.redTeam), 'kda')}
            ${mid('../lol/ui/gold.webp', 'ORO', k(sumB.gold), k(sumR.gold))}
            ${mid('../lol/ui/tower.webp', 'TORRETAS', ob.towerKills ?? 0, orr.towerKills ?? 0)}
            ${mid('../lol/dragons/infernal.webp', 'DRAKES', eld ? drB - eld.blue : drB, eld ? drR - eld.red : drR)}
            ${mid('../lol/dragons/elder.webp', 'DRAGÓN ANCESTRAL', eld ? eld.blue : '–', eld ? eld.red : '–')}
            ${mid('../lol/ui/nashor.webp', 'BARÓN', ob.baronKills ?? 0, orr.baronKills ?? 0)}
          </div>
          <div class="bd-team r">${teamHead(redName, 'red', !winnerBlue)}${byDmg(g.redTeam).map((p) => prow(p, 'r')).join('')}</div>
        </div>
        <div class="bd-chart"><div class="bd-clbl">DIF. DE ORO CON EL TIEMPO</div>${gr ? goldChart(gr, 1640, 150) : `<div class="bd-wait">${GR[g.matchId] && GR[g.matchId].error ? 'Sin gráfica' : 'Cargando gráfica…'}</div>`}</div>
      </div>`;
      return;
    }
    if (overlay) {
      const o = (x) => x || {};
      root.innerHTML = `<div class="pg-overlay in">
        <div class="po-score"><span class="po-team b">${logoHtml(blueName, 'blue')}<b>${esc(blueName)}</b></span><span class="po-n"><span class="b">${sumK(g.blueTeam)}</span><em>–</em><span class="r">${sumK(g.redTeam)}</span></span><span class="po-team r"><b>${esc(redName)}</b>${logoHtml(redName, 'red')}</span></div>
        <div class="po-mid"><span class="chip gold">Victoria · ${esc(winName)}</span><span class="po-meta">Ronda ${m.round} · Juego ${g.gameNumber || gi + 1} · ${dur(g.gameDuration || 0)} · Serie <b>${Number(m.score1) || 0}–${Number(m.score2) || 0}</b></span>
          <span class="po-objs"><span>Torres <b>${o(g.blueObjectives).towerKills ?? 0}</b>–<b>${o(g.redObjectives).towerKills ?? 0}</b></span><span>Dragones <b>${o(g.blueObjectives).dragonKills ?? 0}</b>–<b>${o(g.redObjectives).dragonKills ?? 0}</b></span><span>Barones <b>${o(g.blueObjectives).baronKills ?? 0}</b>–<b>${o(g.redObjectives).baronKills ?? 0}</b></span><span>Oro <b>${k(sumB.gold)}</b>–<b>${k(sumR.gold)}</b></span></span></div>
        ${mvp ? `<div class="po-mvp ${mvpSide}">${champImg(mvp.championName, 'lg')}<div><div class="l">MVP · ${esc(mvp.summonerName)}</div><div class="st"><b>${mvp.kills}</b>/<i>${mvp.deaths}</i>/<b>${mvp.assists}</b> · ${k(mvp.totalDamageDealt)} daño · ${k(mvp.goldEarned)} oro</div></div></div>` : ''}
      </div>`;
      return;
    }
    root.innerHTML = `${headHtml(`Ronda ${m.round} · Juego ${g.gameNumber || gi + 1} de la serie`)}
      <div class="body" style="top:150px">
        <div class="pg-head">
          <div class="pg-team in-l">${logoHtml(blueName, 'blue')}<div><div class="display tn ${lenClass(blueName, 14, 20)}">${esc(blueName)}</div><div class="k">Lado azul · <b>${sumK(g.blueTeam)}</b> kills${winnerBlue ? ' · <b style="color:var(--gold)">VICTORIA</b>' : ''}</div></div></div>
          <div class="pg-score in d1"><div class="n"><span class="b">${sumK(g.blueTeam)}</span><em>–</em><span class="r">${sumK(g.redTeam)}</span></div><div class="t">Duración <b>${dur(g.gameDuration || 0)}</b></div>${tabs}</div>
          <div class="pg-team r in-r">${logoHtml(redName, 'red')}<div><div class="display tn ${lenClass(redName, 14, 20)}">${esc(redName)}</div><div class="k">${!winnerBlue ? '<b style="color:var(--gold)">VICTORIA</b> · ' : ''}<b>${sumK(g.redTeam)}</b> kills · Lado rojo</div></div></div>
        </div>
        <div class="objs">${obj(g.blueObjectives, '')}${obj(g.redObjectives, 'r')}</div>
        <div class="boards"><div class="board blue">${thead}${sortRows(g.blueTeam).map(row).join('')}</div><div class="board red">${thead}${sortRows(g.redTeam).map(row).join('')}</div></div>
        <div class="pg-bottom">${mvpHtml}${teamCmp}</div>
      </div>${footHtml()}${msgHtml()}`;
  };

  /* ---------- arranque ---------- */
  const page = document.body.dataset.page;
  const root = document.getElementById('stage');
  let lastKey = '';
  async function loadMS() {
    const m = findMatch(); if (!m) return;
    if (msFor !== m.id || !MS || (MS.games || []).length < (m.games || []).length) {
      try { MS = await getJson(`${API}/api/tournaments/${encodeURIComponent(TID)}/matches/${encodeURIComponent(m.id)}/stats`); msFor = m.id; } catch (e) { lastErr = e.message; }
    }
  }
  function render() {
    const key = JSON.stringify([GS && GS.lastUpdated, GS && GS.matchesCompleted, bracket().map((m) => [m.id, m.score1, m.score2, (m.games || []).length]), msFor, MS && (MS.games || []).length, lastErr, Object.keys(GR).map((x) => [x, !!GR[x].gold, GR[x].error || ''])]);
    if (key === lastKey) return;
    const first = !lastKey; lastKey = key;
    PAGES[page](root);
    if (!first) root.querySelectorAll('.in, .in-l, .in-r, .bar > i').forEach((el) => { el.style.animation = 'none'; });
  }
  (async () => {
    await Promise.all([ddVersion(), loadT(), loadGS()]);
    if (page === 'stats-partido') await loadMS();
    render();
    setInterval(async () => { await Promise.all([loadT(), loadGS()]); if (page === 'stats-partido') await loadMS(); render(); }, 60000);
  })();
})();
