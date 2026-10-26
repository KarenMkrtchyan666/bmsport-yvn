// Temporary, password-protected demonstration with a separate database.
import { createServer } from 'node:http';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../server/app.js';
import express from 'express';

const password = process.env.BMSPORT_SHARE_PASSWORD || randomBytes(12).toString('base64url');
const expected = Buffer.from(`Basic ${Buffer.from(`demo:${password}`).toString('base64')}`);
const session = randomBytes(32).toString('hex');
const database = process.env.BMSPORT_SHARE_DB || join(mkdtempSync(join(tmpdir(), 'bmsport-share-')), 'demo.sqlite');
const { app, store } = createApp(database);
const gateway = express();
gateway.use((req,res,next)=>{res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');next();});
const loginPage=(error=false)=>`<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BMSPORT YVN — вход</title><style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#171a1e;color:#ddd;font:16px system-ui}form{box-sizing:border-box;width:min(90vw,380px);padding:30px;background:#212529;border:1px solid #ffffff20;border-radius:14px}h1{font-size:24px}p{color:#aeb4bc;line-height:1.5}label{display:block}input,button{box-sizing:border-box;width:100%;padding:13px;margin-top:12px;border:1px solid #ffffff35;border-radius:7px;background:#181c20;color:#eee;font:inherit}button{background:#a6c5ef;color:#152133;cursor:pointer}.error{color:#f1a6ae}</style><form method="post" action="/login"><h1>BMSPORT YVN</h1><p>Временная демо-версия / Temporary demo</p><label>Пароль / Password<input type="password" name="password" autocomplete="current-password" required autofocus maxlength="200"></label>${error?'<p class="error">Неверный пароль. Повторите ввод.</p>':''}<button>Войти / Sign in</button></form></html>`;
let failures=0,blockedUntil=0;
gateway.post('/login',express.urlencoded({extended:false,limit:'2kb'}),(req,res)=>{
 if(Date.now()<blockedUntil)return res.status(429).type('html').send(loginPage(true));
 const candidate=Buffer.from(typeof req.body?.password==='string'?req.body.password:''),secret=Buffer.from(password);
 if(candidate.length!==secret.length||!timingSafeEqual(candidate,secret)){if(++failures>=20){blockedUntil=Date.now()+30000;failures=0;}return res.status(403).type('html').send(loginPage(true));}
 failures=0;const secure=req.headers['x-forwarded-proto']==='https'||req.socket.encrypted;
 res.setHeader('Set-Cookie',`bmsport-demo=${session}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure?'; Secure':''}`);res.redirect(303,'/');
});
gateway.use((req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  const supplied = Buffer.from(req.headers.authorization || '');
  const authenticated=(req.headers.cookie || '').split(';').some(cookie=>cookie.trim()===`bmsport-demo=${session}`) || supplied.length===expected.length && timingSafeEqual(supplied,expected);
  if (!authenticated) {
    if(req.path.startsWith('/api/'))return res.status(401).json({error:'Войдите в демо-версию заново.'});
    res.status(200).type('html').send(loginPage());
    return;
  }
  app(req, res);
});
const server = createServer(gateway);
server.listen(3001, '127.0.0.1', () => console.log(`Demo ready on port 3001. Username: demo Password: ${password}`));
process.on('SIGINT', () => server.close(() => { store.close(); process.exit(0); }));
