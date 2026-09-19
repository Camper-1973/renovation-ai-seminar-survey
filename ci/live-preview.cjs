// Read-only live checks. Never prints credentials, response bodies or user data.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
async function main(){
 const root=process.argv[2]||'deploy';
 const {api,verify,hash,token}=require('./gas-integrity.cjs').createSession(root);
 verify(await api('/content'));
 console.log('PASS: Apps Script HEAD matches every file in the tested payload.');
 const deployments=[];let next='';
 do{const d=await api('/deployments'+(next?'?pageToken='+encodeURIComponent(next):''));deployments.push(...(d.deployments||[]));next=d.nextPageToken||'';}while(next);
 const heads=deployments.filter(d=>!d.deploymentConfig?.versionNumber).flatMap(d=>(d.entryPoints||[]).filter(e=>e.entryPointType==='WEB_APP').map(e=>e.webApp?.url)).filter(Boolean);
 let url=process.env.DEV_URL||(heads.length===1?heads[0].replace(/\/exec$/, '/dev'):'');
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
 await require('./browser-preview.cjs')({url:initial.href,token,root});
 console.log('PASS: authenticated browser regression checks.');
 verify(await api('/content'));
 const version=await api('/versions',{method:'POST',body:{description:'CI verified '+process.env.GITHUB_SHA}});
 assert(Number.isInteger(version.versionNumber)&&version.versionNumber>0,'Invalid immutable version');
 verify(await api('/content?versionNumber='+version.versionNumber));
 assert(process.env.GITHUB_OUTPUT,'Missing Actions output path');
 fs.appendFileSync(process.env.GITHUB_OUTPUT,'version='+version.versionNumber+'\npayload_hash='+hash+'\n');
 console.log('PASS: immutable version '+version.versionNumber+' bound to tested payload '+hash);

}
main().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
