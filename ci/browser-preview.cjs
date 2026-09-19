const fs=require('fs'),path=require('path'),{chromium,expect}=require('@playwright/test');
module.exports=async function({url,token,root}){
 const portal=fs.existsSync(path.join(root,'ProjectManagerPage.html'));
 const survey=fs.existsSync(path.join(root,'Code.gs'));
 if(!portal&&!survey)throw Error('Read-only browser assertions are not yet configured for this application.');
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();
  await context.route('https://script.google.com/**',route=>route.continue({headers:{...route.request().headers(),Authorization:'Bearer '+token}}));
  const page=await context.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.name)); // Do not record page text or private data.
  await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  const app=page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
  if(portal){
  await expect(app.locator('#app')).toBeVisible({timeout:60000});
  await expect(app.locator('#homeView')).toBeVisible();
  await expect(app.locator('#generatedAt')).not.toHaveText('');
  console.log('PASS: live /dev home and bootstrap rendering');
  await app.locator('[data-view="projectManager"]').click();
  await expect(app.locator('#projectManagerView')).toBeVisible();
  // Unconfigured data is an accepted application state, not a failing fixture.
  await expect(app.locator('#projectManagerList')).not.toContainText('案件を整理しています',{timeout:60000});
  console.log('PASS: live project manager renders configured or unconfigured state');
  await app.locator('[data-view="learning"]').click();
  await expect(app.locator('#learningView')).toBeVisible();
  await expect(app.locator('#learningView')).not.toHaveText('');
  console.log('PASS: live weekly learning navigation');
  }
  if(survey){
   await expect(app.locator('#surveyForm')).toBeVisible({timeout:60000});
   await expect(app.locator('#questions .card')).toHaveCount(10);
   for(let i=0;i<10;i++)await app.locator('#q'+i+' input').first().check();
   await app.locator('#role input').first().check();
   const vm=require('vm'),c=vm.createContext({});
   vm.runInContext(fs.readFileSync(path.join(root,'Code.gs'),'utf8'),c);
   const result=vm.runInContext("(()=>{const d=diagnoseAnimal_(QUESTION_SCORES.map(q=>Object.keys(q)[0]));return {...d,axes:AXES,type:publicType_(TYPES[d.typeKey],d.typeKey,true),hiddenType:publicType_(TYPES[d.hiddenTypeKey],d.hiddenTypeKey,false)}})()",c);
   await app.locator('#app').evaluate((el,r)=>el.ownerDocument.defaultView.renderResult(r),JSON.parse(JSON.stringify(result)));
   await expect(app.locator('.result')).toBeVisible();
   await expect(app.locator('.axes .track')).toHaveCount(6);
   const href=await app.locator('a.dashboardButton').getAttribute('href');
   if(new URL(href).searchParams.get('mode')!=='dashboard')throw Error('Result dashboard link invalid');
   console.log('PASS: live survey form, 10 selections, fixture result rendering and dashboard link; submitResponse never called');
   const dashboard=new URL(url);dashboard.searchParams.set('mode','dashboard');dashboard.searchParams.set('event','ci-readonly');
   await page.goto(dashboard.href,{waitUntil:'domcontentloaded',timeout:60000});
   const dash=page.frameLocator('#sandboxFrame').frameLocator('#userHtmlFrame');
   await expect(dash.locator('#content')).not.toContainText('読み込んでいます',{timeout:60000});
   await expect(dash.locator('#content .error')).toHaveCount(0);
   await expect(dash.locator('#total')).toHaveText(/^\d+$/);
   console.log('PASS: live read-only dashboard RPC and rendering');
  }
  if(errors.length)throw Error('Browser JavaScript errors: '+errors.length);
 }finally{await browser.close();}
};
