// Gemeinsame Test-Hilfen: Datenbank im Speicher (PGlite) mit denselben Rollen wie Supabase und simulierter Anmeldung.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
export async function neueDb() {
  const pg = new PGlite();
  await pg.exec("create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;");
  const sql = readFileSync(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
  await pg.exec(sql); await pg.exec(sql); // zweimal: muss wiederholbar sein
  await pg.exec('grant usage on schema public to anon, authenticated, service_role;');
  return pg;
}
// als wer ausführen: null = anon, 'x@y' = angemeldeter Benutzer mit dieser E-Mail
export async function als(pg, email, fn) {
  await pg.exec(email === null ? 'set role anon' : 'set role authenticated');
  await pg.query("select set_config('request.jwt.claims', $1, false)", [email === null ? '' : JSON.stringify({ email, role: 'authenticated' })]);
  try { return await fn(); } finally { await pg.exec('reset role'); await pg.query("select set_config('request.jwt.claims','',false)"); }
}
export const probiere = async (f) => { try { return { ok: true, v: await f() }; } catch (e) { return { ok: false, fehler: e.message }; } };
export function dbAdapter(pg) {
  return {
    async upsert(table, rows, conflict) { if (!rows.length) return; const cols = Object.keys(rows[0]); const set = cols.filter((c) => !conflict.split(',').includes(c)).map((c) => `${c}=excluded.${c}`).join(',');
      for (const r of rows) { if (Object.keys(r).join() !== cols.join()) throw new Error('uneinheitliche Spalten in ' + table); }
      const vals = rows.map((r, i) => `(${cols.map((_, j) => `$${i * cols.length + j + 1}`).join(',')})`).join(',');
      await pg.query(`insert into ${table} (${cols.join(',')}) values ${vals} on conflict (${conflict}) do ${set ? 'update set ' + set : 'nothing'}`, rows.flatMap((r) => cols.map((c) => r[c]))); },
    async knownGames(id) { const r = await pg.query('select g.game_id,g.has_stats,g.game_date,g.home_score from games g join groups gr using(group_id) where gr.season_id=$1', [id]); return new Map(r.rows.map((x) => [x.game_id, x])); },
    async doneGroups(id) { const r = await pg.query('select group_id from groups where season_id=$1 and done', [id]); return new Set(r.rows.map((x) => x.group_id)); },
    async refresh() { await pg.query('select refresh_stats()'); },
    async countGames() { return Number((await pg.query('select count(*)::int n from games')).rows[0].n); },
  };
}
