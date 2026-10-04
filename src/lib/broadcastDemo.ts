// Partida simulada para la transmisión (?demo=1 en /broadcast/:canal y en su
// overlay). Sirve para colocar el overlay en OBS y revisarlo sin transmisión:
// el reloj y el CS avanzan solos, un jugador muere y renace, suben las kills y
// cada 12 s "cae" un objetivo o una torre para ver los avisos. Misma forma que GET /api/live-feed/:canal.
export interface DemoPlayer {
  riotId: string; championName: string; team: 'ORDER' | 'CHAOS';
  level: number; kills: number; deaths: number; assists: number;
  creepScore: number; wardScore: number; isDead: boolean; respawnTimer: number; items: number[];
  position: string;
}
export interface DemoEvent { id: number; t: number; name: string; killer: string; victim: string; assisters: string[]; extra: string }

const ROSTER: Array<[string, string, 'ORDER' | 'CHAOS', string, number, number, number, number, number[]]> = [
  ['TopDiff#LAN', 'Aatrox', 'ORDER', 'TOP', 4, 2, 5, 212, [6692, 3111, 3071, 3053]],
  ['SelvaRey#LAN', 'Lee Sin', 'ORDER', 'JUNGLE', 6, 3, 9, 158, [6692, 3047, 3071, 3156]],
  ['Christian#LAN', 'Ahri', 'ORDER', 'MIDDLE', 8, 1, 6, 236, [6655, 3020, 3089, 3157, 4645]],
  ['LingLing#LAN', 'Jinx', 'ORDER', 'BOTTOM', 7, 2, 4, 251, [3031, 3006, 3094, 3085]],
  ['WardBot#LAN', 'Thresh', 'ORDER', 'UTILITY', 0, 4, 17, 34, [3190, 3117, 3109]],
  ['Garenteed#LAN', 'Garen', 'CHAOS', 'TOP', 2, 5, 3, 198, [3078, 3047, 6333]],
  ['NoSmite#LAN', 'Kayn', 'CHAOS', 'JUNGLE', 5, 6, 4, 141, [6692, 3111, 3071]],
  ['MidOrFeed#LAN', 'Zed', 'CHAOS', 'MIDDLE', 3, 7, 2, 219, [6692, 3158, 3142, 6694]],
  ['Kiting#LAN', 'Caitlyn', 'CHAOS', 'BOTTOM', 2, 4, 5, 243, [3031, 3006, 3094]],
  ['HookCity#LAN', 'Nautilus', 'CHAOS', 'UTILITY', 0, 3, 8, 41, [3190, 3047, 3050]],
];
const ev = (id: number, t: number, name: string, killer: string, extra = '', victim = ''): DemoEvent =>
  ({ id, t, name, killer, victim, assisters: [], extra });
const BASE_EVENTS: DemoEvent[] = [
  ev(1, 330, 'DragonKill', 'SelvaRey', 'Fire'),
  ev(2, 600, 'TurretKilled', 'LingLing', 'Turret_T2_L_03_A'),
  ev(3, 690, 'DragonKill', 'NoSmite', 'Water'),
  ev(4, 860, 'HeraldKill', 'SelvaRey'),
  ev(5, 900, 'TurretKilled', 'TopDiff', 'Turret_T2_C_05_A'),
  ev(6, 1040, 'DragonKill', 'SelvaRey', 'Earth'),
  ev(7, 1100, 'TurretKilled', 'Kiting', 'Turret_T1_R_03_A'),
  ev(8, 1210, 'TurretKilled', 'Christian', 'Turret_T2_C_04_A'),
  ev(9, 1385, 'ChampionKill', 'Christian', '', 'MidOrFeed'),
];
const CYCLE: Array<[string, string, string]> = [
  ['DragonKill', 'SelvaRey', 'Hextech'],
  ['TurretKilled', 'LingLing', 'Turret_T2_R_03_A'],
  ['BaronKill', 'NoSmite', ''],
  ['DragonKill', 'NoSmite', 'Air'],
];

/** `elapsed` = segundos desde que se abrió la página. */
export function demoFeed(elapsed: number, channel: string, isLqc: boolean) {
  const start = 1430;
  const fired = Math.min(CYCLE.length, Math.floor(elapsed / 12));
  const events = [
    ...BASE_EVENTS,
    ...CYCLE.slice(0, fired).map(([name, killer, extra], i) => ev(100 + i, start + (i + 1) * 12, name, killer, extra)),
  ];
  const players: DemoPlayer[] = ROSTER.map(([riotId, championName, team, position, kills, deaths, assists, cs, items], i) => {
    const dead = i === 7 && elapsed % 40 < 18;
    // Cada 17 s el mid azul suma una kill sobre el mid rojo (para ver el marcador saltar).
    const extra = Math.floor(elapsed / 17);
    return {
      riotId, championName, team, position, items,
      kills: kills + (i === 2 ? extra : 0), deaths: deaths + (i === 7 ? extra : 0), assists,
      level: 13 + ((i * 3) % 4),
      creepScore: cs + Math.floor((elapsed * (position === 'UTILITY' ? 1 : 7)) / 60),
      wardScore: position === 'UTILITY' ? 62 : 18 + i,
      isDead: dead, respawnTimer: dead ? 18 - (elapsed % 40) : 0,
    };
  });
  return {
    ok: true, seq: elapsed, ageMs: 0,
    gameTime: start + elapsed, gameMode: 'CLASSIC', mapName: 'Map11',
    matchLabel: isLqc ? 'LQC · Ronda 5 · Juego 2 de 3' : `${channel} · Juego 2 de 3`,
    streamUrl: '', tournamentId: '',
    team1: 'Lobos Negros', team2: 'Halcones Esports',
    logo1: '', logo2: '', accent: '', players, events,
  };
}
