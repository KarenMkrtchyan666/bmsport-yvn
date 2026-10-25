import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export function openStore(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS visits (id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  return {
    list: () => db.prepare('SELECT payload FROM visits ORDER BY rowid DESC').all().map(row => JSON.parse(row.payload)),
    get: id => { const row = db.prepare('SELECT payload FROM visits WHERE id = ?').get(id); return row ? JSON.parse(row.payload) : null; },
    vehicles: () => db.prepare("SELECT json_extract(payload,'$.vin') AS vin, json_extract(payload,'$.brand') AS brand, json_extract(payload,'$.model') AS model, json_extract(payload,'$.vehicle') AS vehicle, json_extract(payload,'$.bodyStyle') AS bodyStyle, json_extract(payload,'$.modelYear') AS modelYear FROM visits").all(),
    save: visit => db.prepare('INSERT INTO visits (id,payload) VALUES (?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload').run(visit.id, JSON.stringify(visit)),
    close: () => db.close()
  };
}
