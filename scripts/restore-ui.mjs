import {readFileSync,copyFileSync,existsSync,unlinkSync,realpathSync,lstatSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {createHash} from 'node:crypto';
const root=realpathSync(process.cwd()),name=JSON.parse(readFileSync(resolve(root,'.ui-backups/current.json'),'utf8')).name;
if(!/^[a-zA-Z0-9-]+$/.test(name))throw new Error('Invalid snapshot name');
const snapshot=resolve(root,'.ui-backups',name),manifest=JSON.parse(readFileSync(resolve(snapshot,'manifest.json'),'utf8'));
const allowed=new Set(['public/index.html','public/styles.css','public/app.js','scripts/browser-check.mjs','scripts/vehicle-photo-check.mjs']);
for(const file of manifest.files){
  if(!allowed.has(file.path))throw new Error('Unexpected UI snapshot file');
  const bytes=readFileSync(resolve(snapshot,file.path));if(createHash('sha256').update(bytes).digest('hex')!==file.sha256)throw new Error('Snapshot integrity check failed');
}
if(process.argv.includes('--check')){console.log(`UI snapshot verified: ${name} (${manifest.files.length} files)`);process.exit(0);}
for(const file of manifest.files){
  const target=resolve(root,file.path);
  if(!realpathSync(dirname(target)).startsWith(root+sep) || lstatSync(target).isSymbolicLink())throw new Error('UI target must stay inside the workspace');
  copyFileSync(resolve(snapshot,file.path),target);
}
for(const added of ['public/workspace-ui.js','scripts/premium-ui-check.mjs']){
  const modulePath=resolve(root,added);
  if(existsSync(modulePath)){
    if(!realpathSync(dirname(modulePath)).startsWith(root+sep) || lstatSync(modulePath).isSymbolicLink())throw new Error('UI module must stay inside the workspace');
    unlinkSync(modulePath);
  }
}
console.log(`Previous interface restored: ${name}. Refresh the browser.`);
