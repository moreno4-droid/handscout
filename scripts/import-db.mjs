// HandScout V1 – Datenimport von handball.ch in die Datenbank (Supabase). Autor: Moreno Rossi.
// Läuft auf GitHub (.github/workflows/import-db.yml). Braucht Node 18+. Holt alle Saisons, schreibt in kleinen Paketen,
// überspringt bekannte Spiele und hört nach MAX_MINUTEN auf (der nächste Lauf macht weiter).
const API = process.env.HANDBALL_API || 'https://www.handball.ch/Umbraco/Api/MatchCenter/Query';
const PAUSE = Number(process.env.PAUSE_MS || 200);
const MAX_MIN = Number(process.env.MAX_MINUTEN || 300);
const NUR = process.env.NUR_LIGEN ? new RegExp(process.env.NUR_LIGEN, 'i') : null;
const AB_ID = process.env.AB_SAISON_ID ? Number(process.env.AB_SAISON_ID) : 0;
const MAX_SAISONS = Number(process.env.MAX_SAISONS || 5); // die neuesten N Saisons (0 = alle)

const Q_SEASON = '{ season { objectId isActual } }';
const LV = 'objectId name objectType';
const Q_MENU = `query getMenu($s: Int) { menuItem(seasonId: $s) { ${LV} menuItem { ${LV} menuItem { ${LV} menuItem { ${LV} menuItem { ${LV} } } } } } }`;
const Q_NAV = 'query getGroupNavigationDetail($groupId: Int) { groupNavigationDetail(groupId: $groupId) { groupId groupName categoryName seasonName } }';
const Q_GAMES = 'query getGames($groupId: Int) { games(groupId: $groupId) { objectId homeTeamId homeTeamName homeTeamClubId homeTeamScore awayTeamId awayTeamName awayTeamClubId awayTeamScore gameDateTime } }';
const Q_CLUBS = '{ club { clubId name zipCode city canton latitude longitude } }';
const Q_PSTATS = 'query getPlayerStats($groupId: Int) { playerStats(groupId: $groupId) { playerId playerYear position hand } }';
const Q_KADER = 'query getPlayerStaff($teamId: Int) { playerStaff(teamId: $teamId) { player { playerId year position hand } } }';
const Q_STATS = 'query getGamePlayerStats($gameId: Int, $isLive: Boolean) { gamePlayerStats(gameId: $gameId, isLive: $isLive) { gameId teamId playerId dressNr playerName totalScore totalShots totalScore7m totalShots7m technicalErrors total2Minutes totalSuspension totalWarnings function totalSaves totalShotsGK totalSaves7m totalShots7mGK } }';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const zahl = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) ? n : 0; };
const liste = (x) => (Array.isArray(x) ? x : x ? [x] : []);
const erstes = (x) => (Array.isArray(x) ? x[0] : x);

// Aus dem Liga-Namen abgeleitet. Steht nichts Eindeutiges im Namen, bleibt das Feld leer (nichts wird geraten).
export const geschlecht = (l) => (/damen|frauen|women|juniorinnen|weiblich|\(w\)/i.test(l || '') ? 'W' : /herren|männer|maenner|\bmen\b|junioren|männlich|\(m\)/i.test(l || '') ? 'M' : null);
export const altersklasse = (l) => { const m = /\bU\s?(\d{2})\b/i.exec(l || ''); return m ? 'U' + m[1] : null; };

export function restDb(url, key) {
  const base = url.replace(/\/+$/, '') + '/rest/v1/';
  const H = { apikey: key, 'Content-Type': 'application/json', ...(/^sb_/.test(key) ? {} : { Authorization: 'Bearer ' + key }) }; // neue Schlüssel (sb_secret_…) nur als apikey, alte (eyJ…) auch als Bearer
  const api = (p, o = {}) => fetch(base + p, { ...o, headers: { ...H, ...(o.headers || {}) } });
  const check = async (res, was) => { if (!res.ok) throw new Error(`Datenbank (${was}): HTTP ${res.status} ${(await res.text()).slice(0, 300)}`); return res; };
  const alle = async (p) => { const out = []; for (let o = 0; ; o += 1000) { const j = await (await check(await api(`${p}&limit=1000&offset=${o}`), p)).json(); out.push(...j); if (j.length < 1000) return out; } };
  return {
    async upsert(table, rows, conflict) {
      for (let i = 0; i < rows.length; i += 500) await check(await api(`${table}?on_conflict=${conflict}`, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(rows.slice(i, i + 500)) }), table);
    },
    async knownGames(seasonId) { const m = new Map(); for (const g of await alle(`games?select=game_id,has_stats,game_date,home_score,groups!inner(season_id)&groups.season_id=eq.${seasonId}`)) m.set(g.game_id, g); return m; },
    async doneGroups(seasonId) { return new Set((await alle(`groups?select=group_id&season_id=eq.${seasonId}&done=eq.true`)).map((g) => g.group_id)); },
    async refresh() { await check(await api('rpc/refresh_stats', { method: 'POST', body: '{}' }), 'refresh_stats'); },
    async countGames() { const res = await check(await api('games?select=game_id', { headers: { Prefer: 'count=exact', Range: '0-0' } }), 'count'); return Number((res.headers.get('content-range') || '').split('/')[1]) || 0; },
  };
}

async function abfrage(operationName, query, variables) {
  for (let v = 1; v <= 4; v++) {
    try {
      const res = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0 HandScout', Origin: 'https://www.handball.ch', Referer: 'https://www.handball.ch/de/matchcenter/' }, body: JSON.stringify({ operationName, variables, query }) });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json = await res.json();
      if (json.errors && json.errors.length) throw new Error(json.errors[0].message);
      await sleep(PAUSE);
      return json.data;
    } catch (e) {
      if (v === 4) { console.warn(`Abfrage fehlgeschlagen (${operationName} ${JSON.stringify(variables)}): ${e.message}`); return null; }
      await sleep(1500 * v);
    }
  }
  return null;
}

export async function run(db, log = console.log) {
  const t0 = Date.now(), zuSpaet = () => Date.now() - t0 > MAX_MIN * 60000;
  const saisons = liste((await abfrage(null, Q_SEASON, {}))?.season).filter((s) => s.objectId >= AB_ID).sort((a, b) => b.objectId - a.objectId).slice(0, MAX_SAISONS > 0 ? MAX_SAISONS : undefined);
  if (!saisons.length) throw new Error('Keine Saisons gefunden: Abruf von handball.ch nicht möglich.');
  log(`${saisons.length} Saisons gefunden (neueste zuerst).`);

  const clubs = [];
  for (const c of liste((await abfrage(null, Q_CLUBS, {}))?.club)) {
    const lat = Number(c.latitude), lon = Number(c.longitude);
    if (c.clubId != null) clubs.push({ club_id: c.clubId, name: c.name || '', zip: c.zipCode || '', city: c.city || '', canton: c.canton || '', lat: lat || null, lon: lon || null });
  }
  if (clubs.length) await db.upsert('clubs', clubs, 'club_id');

  let unfertig = false, neueSpiele = 0, fehlerGesamt = 0;
  for (const saison of saisons) {
    if (zuSpaet()) { unfertig = true; break; }
    const baum = await abfrage('getMenu', Q_MENU, { s: saison.objectId });
    const liga = new Map();
    const gehe = (knoten, l) => { for (const m of liste(knoten)) { if (m.objectType === 'league') l = m.name; if (m.objectType === 'group' && l) liga.set(m.objectId, l); gehe(m.menuItem, l); } };
    gehe(baum?.menuItem, null);
    if (!liga.size) { log(`Saison ${saison.objectId}: keine Gruppen gefunden, übersprungen.`); continue; }
    const bekannt = await db.knownGames(saison.objectId);
    const fertig = saison.isActual ? new Set() : await db.doneGroups(saison.objectId);
    const gruppen = [...liga.keys()].filter((id) => (!NUR || NUR.test(liga.get(id))) && !fertig.has(id));
    log(`Saison ${saison.objectId}${saison.isActual ? ' (aktuell)' : ''}: ${liga.size} Gruppen, ${gruppen.length} zu prüfen, ${bekannt.size} Spiele schon in der Datenbank.`);
    let seasonName = '', angelegt = false, nr = 0;

    for (const groupId of gruppen) {
      if (zuSpaet()) { unfertig = true; break; }
      nr++;
      const nav = erstes((await abfrage('getGroupNavigationDetail', Q_NAV, { groupId }))?.groupNavigationDetail) || {};
      if (nav.seasonName && !seasonName) seasonName = nav.seasonName;
      if (!angelegt) { await db.upsert('seasons', [{ season_id: saison.objectId, name: seasonName || String(saison.objectId), is_actual: !!saison.isActual }], 'season_id'); angelegt = true; }
      const spiele = liste((await abfrage('getGames', Q_GAMES, { groupId }))?.games);
      if (!spiele.length) continue;
      const l = liga.get(groupId) || nav.categoryName || '';
      const grp = { group_id: groupId, season_id: saison.objectId, league: l, name: nav.groupName || 'Gruppe ' + groupId, gender: geschlecht(l), age_class: altersklasse(l), done: false };
      await db.upsert('groups', [grp], 'group_id');
      const teams = new Map();
      for (const g of spiele) {
        if (g.homeTeamId != null) teams.set(g.homeTeamId, { team_id: g.homeTeamId, club_id: g.homeTeamClubId ?? null, name: g.homeTeamName || '' });
        if (g.awayTeamId != null) teams.set(g.awayTeamId, { team_id: g.awayTeamId, club_id: g.awayTeamClubId ?? null, name: g.awayTeamName || '' });
      }
      await db.upsert('teams', [...teams.values()], 'team_id');

      const jetzt = Date.now();
      const todo = spiele.filter((g) => {
        if (zahl(g.homeTeamScore) + zahl(g.awayTeamScore) <= 0 || new Date(g.gameDateTime).getTime() > jetzt) return false;
        const k = bekannt.get(g.objectId); // Spiele der letzten 14 Tage ohne Statistik werden erneut versucht
        return !k || (!k.has_stats && (k.home_score == null || jetzt - new Date(k.game_date).getTime() < 14 * 864e5));
      });
      // Kommende Spiele (noch ohne Resultat) werden gespeichert, damit «Stäfa: nächste Spiele» und die Teamseiten sie zeigen.
      const offen = spiele.filter((g) => new Date(g.gameDateTime).getTime() > jetzt && !todo.includes(g) && !(bekannt.get(g.objectId)?.home_score != null))
        .map((g) => ({ game_id: g.objectId, group_id: groupId, game_date: g.gameDateTime, home_team_id: g.homeTeamId ?? null, home_name: g.homeTeamName || '', home_score: null, away_team_id: g.awayTeamId ?? null, away_name: g.awayTeamName || '', away_score: null, has_stats: false }));
      if (offen.length) await db.upsert('games', offen, 'game_id');
      let fehler = 0;
      if (todo.length) {
        const yb = new Map(), pb = new Map(), hb = new Map();
        const merke = (id, year, pos, hand) => { if (id == null) return; if (year) yb.set(id, { player_id: id, birth_year: year }); if (pos) pb.set(id, { player_id: id, position: pos }); if (hand) hb.set(id, { player_id: id, hand }); };
        for (const p of liste((await abfrage('getPlayerStats', Q_PSTATS, { groupId }))?.playerStats)) merke(p.playerId, zahl(p.playerYear), p.position, p.hand);
        if (/QHL|NLB|NLA/.test(l)) {
          const ts = new Set(); spiele.forEach((g) => { ts.add(g.homeTeamId); ts.add(g.awayTeamId); });
          for (const teamId of ts) for (const e of liste((await abfrage('getPlayerStaff', Q_KADER, { teamId }))?.playerStaff)) for (const p of e?.player || []) merke(p.playerId, zahl(p.year), p.position, p.hand);
        }
        const gRows = [], names = new Map(), sMap = new Map(); // sMap: ein Eintrag je Spiel und Spieler, falls handball.ch eine Zeile doppelt liefert
        for (const g of todo) {
          const s = await abfrage('getGamePlayerStats', Q_STATS, { gameId: g.objectId, isLive: false });
          if (s === null) { fehler++; continue; }
          let mit = false;
          for (const z of liste(s.gamePlayerStats)) {
            if ((z.function !== 'player' && z.function !== 'goalkeeper') || z.playerId == null) continue; mit = true;
            names.set(z.playerId, { player_id: z.playerId, name: z.playerName || '' });
            sMap.set(g.objectId + '|' + z.playerId, { game_id: g.objectId, player_id: z.playerId, team_id: z.teamId ?? null, name: z.playerName || '', shirt_no: zahl(z.dressNr), role: z.function === 'goalkeeper' ? 'G' : 'F',
              goals: zahl(z.totalScore), shots: zahl(z.totalShots), goals7: zahl(z.totalScore7m), shots7: zahl(z.totalShots7m), tf: zahl(z.technicalErrors), min2: zahl(z.total2Minutes), warnings: zahl(z.totalWarnings), disq: zahl(z.totalSuspension),
              saves: zahl(z.totalSaves), shots_gk: zahl(z.totalShotsGK), saves7: zahl(z.totalSaves7m), shots7_gk: zahl(z.totalShots7mGK) });
          }
          gRows.push({ game_id: g.objectId, group_id: groupId, game_date: g.gameDateTime, home_team_id: g.homeTeamId ?? null, home_name: g.homeTeamName || '', home_score: zahl(g.homeTeamScore), away_team_id: g.awayTeamId ?? null, away_name: g.awayTeamName || '', away_score: zahl(g.awayTeamScore), has_stats: mit });
        }
        const sRows = [...sMap.values()];
        if (names.size) await db.upsert('players', [...names.values()], 'player_id');
        if (yb.size) await db.upsert('players', [...yb.values()], 'player_id');
        if (pb.size) await db.upsert('players', [...pb.values()], 'player_id');
        if (hb.size) await db.upsert('players', [...hb.values()], 'player_id');
        if (gRows.length) await db.upsert('games', gRows, 'game_id');
        if (sRows.length) await db.upsert('player_game_stats', sRows, 'game_id,player_id');
        neueSpiele += gRows.length; fehlerGesamt += fehler;
      }
      const alleAlt = spiele.every((g) => new Date(g.gameDateTime).getTime() < jetzt - 30 * 864e5);
      if (!saison.isActual && fehler === 0 && alleAlt) await db.upsert('groups', [{ ...grp, done: true }], 'group_id');
      if (todo.length && nr % 10 === 1) log(`Saison ${saison.objectId}, Gruppe ${nr}/${gruppen.length} (${l} ${grp.name}): ${todo.length} neue Spiele`);
    }
    if (unfertig) break;
  }
  if (db.refresh) { try { await db.refresh(); log('Suchtabelle (mv_stats) neu berechnet.'); } catch (e) { console.warn('Neuberechnung fehlgeschlagen: ' + e.message); fehlerGesamt++; } }
  const total = await db.countGames();
  await db.upsert('sync_status', [{ id: 1, last_run: new Date().toISOString(), last_success: unfertig ? null : new Date().toISOString(), state: fehlerGesamt && !unfertig ? 'ok mit Lücken' : unfertig ? 'unfertig' : 'ok', games_total: total, note: `${neueSpiele} neue Spiele, ${fehlerGesamt} Abruffehler` }], 'id');
  log(`Fertig${unfertig ? ' (Zeitlimit erreicht, der nächste Lauf macht weiter)' : ''}: ${neueSpiele} neue Spiele, ${fehlerGesamt} Fehler, ${total} Spiele in der Datenbank.`);
  return { unfertig, neueSpiele, fehlerGesamt, total };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) { console.error('Secrets SUPABASE_URL und SUPABASE_SERVICE_KEY fehlen.'); process.exit(1); }
  run(restDb(SUPABASE_URL, SUPABASE_SERVICE_KEY)).then((r) => { if (r.unfertig && process.env.GITHUB_OUTPUT) import('node:fs').then((fs) => fs.appendFileSync(process.env.GITHUB_OUTPUT, 'unfertig=true\n')); }).catch((e) => { console.error(e.message); process.exit(1); });
}
