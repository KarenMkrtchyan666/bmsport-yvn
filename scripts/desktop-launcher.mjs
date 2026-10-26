// Own-PC mode: loopback only, private local database, no external hosting service.
import {createApp} from '../server/app.js';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {mkdirSync} from 'node:fs';
import {spawn} from 'node:child_process';
const directory=process.env.BMSPORT_DATA_DIR || fileURLToPath(new URL('../data/',import.meta.url));
mkdirSync(directory,{recursive:true});
const {app,store}=createApp(join(directory,'bmsport.sqlite'));
const server=app.listen(Number(process.env.PORT || 0),'127.0.0.1',()=>{
 const url=`http://127.0.0.1:${server.address().port}`;
 console.log(`BMSPORT YVN: ${url}\nData: ${directory}\nKeep this window open. Press Ctrl+C to stop.`);
 process.send?.({url});
 if(process.env.BMSPORT_NO_BROWSER!=='1'){
  const [command,args]=process.platform==='win32'?['rundll32.exe',['url.dll,FileProtocolHandler',url]]:process.platform==='darwin'?['open',[url]]:['xdg-open',[url]];
  const child=spawn(command,args,{stdio:'ignore',windowsHide:true});child.on('error',()=>console.log('Open the URL above in your browser.'));child.unref();
 }
});
server.on('error',error=>{console.error(`Cannot start BMSPORT: ${error.message}`);store.close();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
