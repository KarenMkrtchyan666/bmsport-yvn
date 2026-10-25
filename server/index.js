import { createApp } from './app.js';
import { fileURLToPath } from 'node:url';
const { app, store } = createApp(process.env.BMSPORT_DB || fileURLToPath(new URL('../data/bmsport.sqlite', import.meta.url)));
const server = app.listen(Number(process.env.PORT || 3000), '127.0.0.1', () => console.log(`BMSPORT YVN: http://127.0.0.1:${server.address().port}`));
process.on('SIGINT', () => server.close(() => { store.close(); process.exit(0); }));
