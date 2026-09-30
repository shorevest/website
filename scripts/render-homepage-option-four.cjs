'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const options=['editorial-synthesis'];
const out='artifacts/homepage-option-four';fs.mkdirSync(out,{recursive:true});
const extract=(s,re)=>s.match(re)[0];
const {execFileSync}=require('node:child_process');
const manifest=JSON.parse(fs.readFileSync('docs/homepage-option-four-copy-audit.json','utf8'));
const normalize=s=>s.replace(/\s+/g,' ').trim();
const publicRuns=h=>h.replace(/<!--[\s\S]*?-->/g,'').replace(/<(script|style)\b[\s\S]*?<\/\1>/g,'').split(/<[^>]+>/g).map(normalize).filter(Boolean);
for(const entry of manifest.languages){
 const source=execFileSync('git',['show',manifest.sourceCommit+':'+entry.source],{encoding:'utf8'});
 const draft=fs.readFileSync(entry.target,'utf8');
 assert.deepEqual(publicRuns(draft).sort(),publicRuns(source).sort(),'public copy changed');
 for(const item of entry.entries)assert(publicRuns(source).includes(item.text),'untraced copy');
 for(const re of [/<footer[\s\S]*?<\/footer>/,/<header[\s\S]*?<\/header>/])assert.equal(extract(draft,re),extract(source,re));
 assert.deepEqual(draft.match(/<script\b[\s\S]*?<\/script>/g),source.match(/<script\b[\s\S]*?<\/script>/g));
 const main=extract(draft,/<main[\s\S]*?<\/main>/);
 assert.deepEqual([...main.matchAll(/<section id="([^"]+)"/g)].map(m=>m[1]),['hero','underwriting','research','strategy','firm','institutional-contact']);
 assert.deepEqual([...main.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),[...extract(source,/<main[\s\S]*?<\/main>/).matchAll(/href="([^"]+)"/g)].map(m=>m[1]));
 for(const attribute of ['aria-label','alt','title','placeholder'])for(const m of draft.matchAll(new RegExp(attribute+'="([^"]*)"','g')))assert(source.includes(attribute+'="'+m[1]+'"'),'new public attribute');
}
fs.writeFileSync(out+'/copy-audit.json',JSON.stringify(manifest,null,2));
console.log('COPY_AUDIT_PASSED before browser launch');
(async()=>{
 const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const results=[],screens={};
 try{
 for(const lang of ['en','zh'])for(const [device,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
  screens[lang+'-'+device]=[];
  for(const option of options){
   const context=await browser.newContext({viewport,deviceScaleFactor:1});let analytics=0;
   await context.route('https://shorevest.com/**',async r=>{
    const u=new URL(r.request().url());let p=u.pathname;
    if(p==='/'||p==='/cn/')p='/internal-preview/homepage-options/'+option+'/'+(p==='/cn/'?'index_cn.html':'index.html');
    const response=await context.request.get('http://127.0.0.1:4173'+p+u.search);await r.fulfill({response});
   });
   await context.route(/https:\/\/(?:www\.)?(?:googletagmanager|google-analytics)\.com\//,async r=>{analytics++;await r.fulfill({status:200,contentType:'application/javascript',body:''});});
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://shorevest.com'+(lang==='en'?'/':'/cn/'),{waitUntil:'networkidle'});
   await page.evaluate(()=>document.fonts.ready);
   await page.locator('#sv-analytics-consent').waitFor();assert.equal(analytics,0);
   await page.locator('#sv-analytics-consent button[data-choice="rejected"]').click();assert.equal(analytics,0);
   await page.waitForFunction(()=>document.querySelector('.hp-hero-image img').complete);
   assert(await page.locator('.hp-hero-image img').evaluate(i=>i.naturalWidth>0),'hero image missing');
   assert.equal(await page.locator('#hero p').count(),1);
   assert.equal(await page.locator('#strategy a').count(),1);
   assert.equal(await page.locator('#research').getAttribute('data-selected-research'),'v10i3');
   await page.locator('.hp-publication-image img').scrollIntoViewIfNeeded();
   await page.waitForFunction(()=>document.querySelector('.hp-publication-image img').naturalWidth>0);
   await page.evaluate(()=>window.scrollTo(0,0));
   const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,footerHeight:document.querySelector('footer').getBoundingClientRect().height}));
   assert(bounds.scroll<=bounds.width+1,'overflow '+option+lang+device);
   if(device==='mobile'){const b=page.locator('.sv-burger');await b.click();assert.equal(await b.getAttribute('aria-expanded'),'true');await b.click();assert.equal(await b.getAttribute('aria-expanded'),'false');}
   for(const href of await page.locator('main a').evaluateAll(a=>a.map(x=>x.getAttribute('href')))){const u=new URL(href,'https://shorevest.com');assert.equal((await context.request.get('http://127.0.0.1:4173'+u.pathname)).status(),200,href);}
   if(option==='editorial-interactive'){
    const d=page.locator('.hp-underwriting-sequence details').first();await d.locator('summary').focus();await page.keyboard.press('Enter');assert.equal(await d.getAttribute('open'),null);await page.keyboard.press('Enter');assert.equal(await d.getAttribute('open'),'');
   }
   await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
   const prefix=out+'/'+option+'-'+lang+'-'+device;
   await page.screenshot({path:prefix+'-full.png',fullPage:true});
   await page.screenshot({path:prefix+'-viewport.png'});
   screens[lang+'-'+device].push({option,full:(await page.screenshot({type:'jpeg',quality:76,fullPage:true})).toString('base64'),viewport:(await page.screenshot({type:'jpeg',quality:82})).toString('base64')});
   await page.locator('.sv-cookie-settings-button').click();await page.locator('#sv-analytics-consent button[data-choice="accepted"]').click();await page.waitForFunction(()=>window.__SV_GA4_CONFIGURED===true);assert(analytics>0);
   const opposite=lang==='en'?'/cn/':'/';
   if(device==='mobile'){await page.locator('.sv-burger').click();await page.locator('.sv-mobile-utils a[href="'+opposite+'"]').click();}else{await page.locator('.sv-lang').click();}
   await page.waitForLoadState('networkidle');assert.equal(await page.locator('body.hp-option-4').count(),1);assert.equal(await page.locator('html').getAttribute('lang').then(s=>s.startsWith('zh')),lang==='en');
   assert.equal(errors.length,0,errors.join('\n'));results.push({option,lang,device,bounds,checks:'passed'});await context.close();
  }
 }
 for(const [key,items] of Object.entries(screens))for(const kind of ['viewport','full']){
  const b=items[0][kind];
  for(let offset=0;offset<b.length;offset+=12000)console.log('SHOREVEST_OPTION4_IMAGE '+key+'-'+kind+' '+offset/12000+' '+b.slice(offset,offset+12000));
 }
 fs.writeFileSync(out+'/verification.json',JSON.stringify({commit:process.env.GITHUB_SHA,results},null,2));console.log('SHOREVEST_RESULTS '+JSON.stringify(results));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
