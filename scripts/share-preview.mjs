// Temporary, password-protected demonstration with a separate database.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';

const password = process.env.BMSPORT_SHARE_PASSWORD || randomBytes(12).toString('base64url');
const expected = Buffer.from(`Basic ${Buffer.from(`demo:${password}`).toString('base64')}`);
const database = process.env.BMSPORT_SHARE_DB || join(mkdtempSync(join(tmpdir(), 'bmsport-share-')), 'demo.sqlite');
const { app, store } = createApp(database);
const server = createServer((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const supplied = Buffer.from(req.headers.authorization || '');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="BMSPORT Demo", charset="UTF-8"', 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Enter the demo username and password.');
    return;
  }
  app(req, res);
});
server.listen(3001, '127.0.0.1', () => console.log(`Demo ready on port 3001. Username: demo Password: ${password}`));
process.on('SIGINT', () => server.close(() => { store.close(); process.exit(0); }));
