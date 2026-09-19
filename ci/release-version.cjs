const assert=require('assert/strict');
async function main(){
 const root=process.argv[2]||'deploy',version=Number(process.env.VERIFIED_VERSION),deploymentId=process.env.TARGET_DEPLOYMENT_ID;
 assert(Number.isInteger(version)&&version>0,'Missing verified version');
 assert(/^[A-Za-z0-9_-]+$/.test(deploymentId||''),'Missing existing Deployment ID');
 const {api,verify,hash}=require('./gas-integrity.cjs').createSession(root);
 assert.equal(hash,process.env.VERIFIED_HASH,'Payload differs from Preview');
 async function head(repo,token){const res=await fetch('https://api.github.com/repos/'+repo+'/commits/main',{headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});assert(res.ok,'Cannot verify current main');return (await res.json()).sha;}
 assert.equal(await head(process.env.GITHUB_REPOSITORY,process.env.GITHUB_TOKEN),process.env.GITHUB_SHA,'A newer main commit exists; refusing stale release');
 if(process.env.ESTIMATE_SHA)assert.equal(await head('Camper-1973/slowl-estimate-simulator',process.env.REPO_READ_TOKEN),process.env.ESTIMATE_SHA,'Estimate main changed after testing');
 verify(await api('/content?versionNumber='+version));
 const target='/deployments/'+encodeURIComponent(deploymentId);
 const before=await api(target);
 const urls=d=>(d.entryPoints||[]).filter(e=>e.entryPointType==='WEB_APP').map(e=>e.webApp?.url).filter(Boolean).sort();
 assert(urls(before).length>0&&before.deploymentConfig?.versionNumber,'Target is not an existing versioned Web App deployment');
 const deploymentConfig={...before.deploymentConfig,versionNumber:version,description:'CI tested '+process.env.GITHUB_SHA};
 await api(target,{method:'PUT',body:{deploymentConfig}});
 const after=await api(target);
 assert.equal(after.deploymentConfig.versionNumber,version,'Deployment update verification failed');
 assert.deepEqual(urls(after),urls(before),'Existing Web App URL changed');
 console.log('PASS: updated existing deployment to verified version '+version+'; URL unchanged; payload '+hash);
}
main().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
