// Read-only live checks. Never prints credentials, response bodies or user data.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
async function main(){
 const root=process.argv[2]||'deploy';
 const scriptId=JSON.parse(fs.readFileSync(path.join(root,'.clasp.json'),'utf8')).scriptId;
 assert(scriptId,'Missing configured Script ID');
 const creds=JSON.parse(fs.readFileSync(path.join(os.homedir(),'.clasprc.json'),'utf8'));
 const token=(creds.tokens?.default||creds.token||creds).access_token;
 assert(token,'No refreshed clasp access token available');
 async function api(resource){
  const response=await fetch('https://script.googleapis.com/v1/projects/'+encodeURIComponent(scriptId)+resource,{headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error('Apps Script read-only API '+resource.split('?')[0]+': HTTP '+response.status);
  return response.json();
 }
 function canonical(s,type){if(type==='JSON'){const sort=o=>Array.isArray(o)?o.map(sort):o&&typeof o==='object'?Object.fromEntries(Object.keys(o).sort().map(k=>[k,sort(o[k])])):o;return JSON.stringify(sort(JSON.parse(s)));}return s.replace(/^\uFEFF/,'').replace(/\r\n/g,'\n').trimEnd();}
 const local=fs.readdirSync(root).filter(f=>/\.(html|js|gs|json)$/.test(f)&&f!=='.clasp.json');
 const remote=await api('/content');
 assert.equal(remote.files.length,local.length,'Remote file count differs from tested payload');
 for(const file of local){
  const ext=path.extname(file),type=ext==='.html'?'HTML':ext==='.json'?'JSON':'SERVER_JS';
  const name=path.basename(file,ext),found=remote.files.find(f=>f.name===name&&f.type===type);
  assert(found,'Remote payload missing '+file);
  assert.equal(canonical(found.source,type),canonical(fs.readFileSync(path.join(root,file),'utf8'),type),'Remote source mismatch: '+file);
 }
 console.log('PASS: Apps Script HEAD matches every file in the tested payload.');
 const deployments=[];let next='';
 do{const d=await api('/deployments'+(next?'?pageToken='+encodeURIComponent(next):''));deployments.push(...(d.deployments||[]));next=d.nextPageToken||'';}while(next);
 const heads=deployments.filter(d=>!d.deploymentConfig?.versionNumber).flatMap(d=>(d.entryPoints||[]).filter(e=>e.entryPointType==='WEB_APP').map(e=>e.webApp?.url)).filter(Boolean);
 let url=process.env.DEV_URL||(heads.length===1?heads[0]:'');
 assert(url,'Existing HEAD /dev URL was not returned by the API; no deployment was created.');
 const initial=new URL(url);
 assert.equal(initial.hostname,'script.google.com');assert(initial.pathname.endsWith('/dev'),'Not a HEAD /dev URL');
 let response;
 for(let redirects=0;redirects<6;redirects++){
  const current=new URL(url);
  assert(current.protocol==='https:','Non-HTTPS redirect refused');
  assert(current.hostname==='script.google.com'||current.hostname.endsWith('.googleusercontent.com'),'Authentication redirect: GitHub Actions does not have a signed-in Google browser session.');
  response=await fetch(url,{redirect:'manual',headers:current.hostname==='script.google.com'?{Authorization:'Bearer '+token}:{},signal:AbortSignal.timeout(30000)});
  if([301,302,303,307,308].includes(response.status)){const loc=response.headers.get('location');assert(loc,'Redirect has no target');url=new URL(loc,url).href;continue;}
  break;
 }
 if(!response.ok)throw Error('Authenticated /dev probe returned HTTP '+response.status+'; release remains blocked.');
 const body=await response.text();
 if(/accounts\.google\.com\/(?:ServiceLogin|v3\/signin)|<title>Sign in/i.test(body))throw Error('Google sign-in page returned instead of /dev app; release remains blocked.');
 if(/Script function not found|スクリプト関数が見つかりません|Exception:|エラーが発生しました/.test(body))throw Error('/dev returned an application error; release remains blocked.');
 assert(body.includes('userHtml')||body.includes('HtmlService'),'Response is not a verified HtmlService preview');
 console.log('PASS: existing /dev endpoint responded with HtmlService content.');
 // HTTP/HEAD checks are only prerequisites; they cannot substitute for browser/RPC behavior.
 throw Error('Live /dev is reachable, but authenticated browser/RPC regression assertions are still required. Release remains blocked.');
}
main().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
