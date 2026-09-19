const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const root=process.argv[2]||'.';
let count=0;
for(const file of fs.readdirSync(root)){
 const p=path.join(root,file);if(!fs.statSync(p).isFile())continue;
 const s=fs.readFileSync(p,'utf8');
 if(/\.(js|gs)$/.test(file)){new vm.Script(s,{filename:file});count++;}
 if(file==='appsscript.json')JSON.parse(s.replace(/^\uFEFF/,''));
 if(/\.html$/.test(file)){
  // Parse executable inline scripts without evaluating Google templates or calling services.
  const opens=(s.match(/<\?/g)||[]).length,closes=(s.match(/\?>/g)||[]).length;
  assert.equal(opens,closes,file+': unbalanced Apps Script template');
  for(const m of s.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
   if(/\bsrc\s*=/.test(m[1])||/\btype\s*=\s*["'](?:application\/(?:ld\+)?json|text\/template)/i.test(m[1]))continue;
   const js=m[2].replace(/<\?[\s\S]*?\?>/g,'null');
   new vm.Script(js,{filename:file});count++;
  }
 }
}
assert(count>0,'No JavaScript was checked');
function sandbox(file){const c=vm.createContext({console});vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),c,{timeout:5000});return c;}
if(fs.existsSync(path.join(root,'EstimateLogic.js'))){
 const c=sandbox('EstimateLogic.js');assert.equal(c.estimateRegressionPublic_().ok,true,'existing estimate regression');
 for(const buildingType of ['house','mansion']){
  const result=c.calculateEstimatePublic({buildingType,totalArea:100,scope:'full',layout:'none'});
  assert(Number.isFinite(result.total.mid)&&result.total.mid>0,'estimate result '+buildingType);
 }
 for(const totalArea of [0,1001,'invalid'])assert.throws(()=>c.calculateEstimatePublic({totalArea}));
}
if(fs.existsSync(path.join(root,'DiagnosisLogic.js'))){
 assert.equal(sandbox('DiagnosisLogic.js').diagnosisRegressionPublic_().ok,true);
}
if(fs.existsSync(path.join(root,'CustomerRegistry.js'))){
 const c=sandbox('CustomerRegistry.js');
 for(const name of ['testGoogleChatProjectClassifier','testGeneralInquiryClassifier']){
  const results=c[name]();assert(results.length>0,name+' empty');
  for(const r of results)assert.equal(r.pass,true,name+': '+(r.case||r.label));
 }
}
console.log('PASS: '+count+' JavaScript units; JSON/templates and available pure regression tests. No live services invoked.');

if(fs.existsSync(path.join(root,'Code.gs'))){
 const c=sandbox('Code.gs');
 for(const [rate,label] of [[2.99,'激レア'],[3,'かなりレア'],[4.99,'かなりレア'],[5,'💎 レア'],[9.99,'💎 レア'],[10,''],[20,'']]){
  vm.runInContext('THEORETICAL_RATE.__test='+rate,c);
  const r=c.rarityInfo_('__test');assert.equal(r.rate,rate);
  if(label)assert(r.label.includes(label));else assert.equal(r.label,'');
  assert(c.rarityText_('__test').includes('出現率'));
 }
 vm.runInContext('delete THEORETICAL_RATE.__test',c);
 const answers=vm.runInContext('QUESTION_SCORES.map(q=>Object.keys(q)[0])',c);
 const d=c.diagnoseAnimal_(answers);assert(d.typeKey&&d.hiddenTypeKey!==d.typeKey);
 assert(Object.values(d.scores).every(v=>v>=0&&v<=100));
 assert.throws(()=>c.validateResponse_({company:'test',name:'test',role:'reno',answers:[]}));
 // In-memory legacy sheet only: no spreadsheet credentials or live services.
 let columns=38,rows=[],released=0;
 const sheet={getMaxColumns:()=>columns,insertColumnsAfter:(n,k)=>{assert.equal(n,38);columns+=k;},
 getLastRow:()=>rows.length+1,getLastColumn:()=>columns,
 appendRow:row=>{assert.equal(columns,39);assert.equal(row.length,39);rows.push(row);},
 getRange:(r,col)=>({setValue:v=>assert.equal(v,'回答ID'),getValues:()=>rows,
 createTextFinder:id=>({matchEntireCell:()=>({findNext:()=>rows.find(row=>row[38]===id)||null})})})};
 c.LockService={getScriptLock:()=>({tryLock:()=>true,releaseLock:()=>released++})};
 c.Utilities={sleep:()=>{}};c.getResponseSheet_=()=>sheet;
 const payload={company:'test',name:'test',role:'reno',answers,eventId:'qa-local',responseId:'local-1'};
 assert.equal(c.submitResponse(payload).saved,true);assert.equal(c.submitResponse(payload).saved,false);
 assert.equal(rows.length,1);assert.equal(released,2);
 assert.equal(c.getDashboardData('qa-local').total,1);
 assert.equal(c.getDashboardData('another-event').total,0);
 assert.equal(c.getDashboardData('').diagnosedTotal,1);
 const html=fs.readFileSync(path.join(root,'Index.html'),'utf8');
 assert(html.includes('dashboard'),'dashboard link missing');
}

