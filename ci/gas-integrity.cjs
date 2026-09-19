const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict');
function canonical(s,type){
 if(type==='JSON'){const sort=o=>Array.isArray(o)?o.map(sort):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,sort(o[k])])):o;return JSON.stringify(sort(JSON.parse(s)));}
 return s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trimEnd();
}
function snapshot(files){
 const names=new Set();
 return files.map(f=>{const key=f.type+':'+f.name;assert(!names.has(key),'Duplicate payload file');names.add(key);return {name:f.name,type:f.type,source:canonical(f.source,f.type)};}).sort((a,b)=>(a.type+':'+a.name).localeCompare(b.type+':'+b.name));
}
function createSession(root){
 const scriptId=JSON.parse(fs.readFileSync(path.join(root,'.clasp.json'),'utf8')).scriptId;
 assert(/^[A-Za-z0-9_-]+$/.test(scriptId),'Invalid configured Script ID');
 const creds=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.clasprc.json'),'utf8'));
 const token=(creds.tokens?.default||creds.token||creds).access_token;assert(token,'Missing refreshed clasp token');
 const files=fs.readdirSync(root).filter(f=>/\.(html|js|gs|json)$/.test(f)&&f!=='.clasp.json').map(f=>{
  const ext=path.extname(f);return {name:path.basename(f,ext),type:ext==='.html'?'HTML':ext==='.json'?'JSON':'SERVER_JS',source:fs.readFileSync(path.join(root,f),'utf8')};
 });
 const expected=JSON.stringify(snapshot(files));
 const hash=crypto.createHash('sha256').update(expected).digest('hex');
 async function api(resource,options={}){
  const response=await fetch('https://script.googleapis.com/v1/projects/'+encodeURIComponent(scriptId)+resource,{
   method:options.method||'GET',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
   body:options.body?JSON.stringify(options.body):undefined,signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Apps Script API '+(options.method||'GET')+' '+resource.split('?')[0]+': HTTP '+response.status);
  return response.json();
 }
 function verify(remote){assert.equal(JSON.stringify(snapshot(remote.files||[])),expected,'GAS source differs from the tested payload');}
 return {api,verify,hash,token};
}
module.exports={createSession,canonical,snapshot};
