import {execFileSync} from 'node:child_process';
import {openAsBlob,statSync} from 'node:fs';
import {basename} from 'node:path';
const [repository,tag,asset]=process.argv.slice(2);
if(!/^[\w.-]+\/[\w.-]+$/.test(repository || '') || !/^v[\w.-]+$/.test(tag || '') || !asset)throw new Error('Usage: node scripts/github-release.mjs owner/repo v1.1.0 path/to/portable.zip');
const git=process.env.BMSPORT_GIT || 'git';
const credential=execFileSync(git,['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'}});
const token=credential.split(/\r?\n/).find(line=>line.startsWith('password='))?.slice(9);
if(!token)throw new Error('Sign in to GitHub through Git Credential Manager first.');
const headers={Authorization:`Bearer ${token}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
const api=`https://api.github.com/repos/${repository}/releases`;
let response=await fetch(`${api}/tags/${tag}`,{headers});let release;
if(response.status===404){
 const commit=execFileSync(git,['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
 response=await fetch(api,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({tag_name:tag,target_commitish:commit,name:'BMSPORT YVN — Windows portable + native iOS source',prerelease:true,body:'Windows x64: download the ZIP, extract it completely, then run START-WINDOWS.cmd. Node.js, OCR data, and local translation models are included. No external hosting or developer PC is needed. Each copy has its own private local database. Internet is optional for vehicle photos and online VIN fallbacks.\n\niOS 17+ source is in BMSport.xcodeproj. Native PDFKit/Vision import, local VIN catalogs, brand/model/chassis selection, model history filter and Russian/English interface are included. On-device automatic translation requires iOS 18+. Requires Xcode on a Mac for building and signing; no signed IPA is included. See the iOS workflow for simulator validation and docs/IOS-UPDATE.md for limitations. No physical iPhone verification has been performed.'})});
}
if(!response.ok)throw new Error(`GitHub release request failed (${response.status})`);
release=await response.json();
const name=basename(asset),size=statSync(asset).size;
const existing=release.assets?.find(item=>item.name===name);
if(existing){if(existing.size!==size)throw new Error('An asset with this name but different size already exists.');console.log(existing.browser_download_url);process.exit(0);}
const upload=release.upload_url.replace(/\{.*\}$/,'')+'?name='+encodeURIComponent(name);
response=await fetch(upload,{method:'POST',headers:{...headers,'Content-Type':'application/zip','Content-Length':String(size)},body:await openAsBlob(asset),signal:AbortSignal.timeout(900000)});
if(!response.ok)throw new Error(`GitHub asset upload failed (${response.status})`);
const result=await response.json();console.log(release.html_url);console.log(result.browser_download_url);
