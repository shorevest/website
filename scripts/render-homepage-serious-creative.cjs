'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const {chromium}=require('playwright-core');
const options=['architectural-monograph','cinnabar-spine','dark-opening'];
const out='artifacts/homepage-serious-creative';fs.mkdirSync(out,{recursive:true});
const extract=(s,re)=>s.match(re)[0];
for(const option of options)for(const lang of ['en','zh']){
 const original=fs.readFileSync(lang==='en'?'home.html':'home_cn.html','utf8');
 const draft=fs.readFileSync('internal-preview/homepage-options/'+option+'/'+(lang==='en'?'index.html':'index_cn.html'),'utf8');
 for(const re of [/<footer[\s\S]*?<\/footer>/,/<header[\s\S]*?<\/header>/])assert.equal(extract(draft,re),extract(original,re));
 assert.deepEqual(draft.match(/<script\b[\s\S]*?<\/script>/g),original.match(/<script\b[\s\S]*?<\/script>/g));
 const main=extract(draft,/<main[\s\S]*?<\/main>/);
 assert.deepEqual([...main.matchAll(/<section id="([^"]+)"/g)].map(m=>m[1]),['hero','underwriting','research','strategy','firm','institutional-contact']);
 const text=s=>extract(s,/<main[\s\S]*?<\/main>/).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
 assert.equal(text(draft),text(original),'approved content changed');
 assert.deepEqual([...main.matchAll(/href="([^"]+)"/g)].map(m=>m[1]),[...extract(original,/<main[\s\S]*?<\/main>/).matchAll(/href="([^"]+)"/g)].map(m=>m[1]));
}
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
    const bounds=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth}));
    assert(bounds.scroll<=bounds.width+1,'overflow '+option+lang+device);
    if(device==='mobile'){const b=page.locator('.sv-burger');await b.click();assert.equal(await b.getAttribute('aria-expanded'),'true');await b.click();assert.equal(await b.getAttribute('aria-expanded'),'false');}
    for(const href of await page.locator('main a').evaluateAll(a=>a.map(x=>x.getAttribute('href')))){const u=new URL(href,'https://shorevest.com');assert.equal((await context.request.get('http://127.0.0.1:4173'+u.pathname)).status(),200,href);}
    await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
    await page.waitForFunction(()=>window.scrollY===0);
    const prefix=out+'/'+option+'-'+lang+'-'+device;
    await page.screenshot({path:prefix+'-full.png',fullPage:true});
    await page.screenshot({path:prefix+'-viewport.png'});
    screens[lang+'-'+device].push({option,full:(await page.screenshot({type:'jpeg',quality:76,fullPage:true})).toString('base64'),viewport:(await page.screenshot({type:'jpeg',quality:82})).toString('base64')});
    await page.locator('.sv-cookie-settings-button').click();await page.locator('#sv-analytics-consent button[data-choice="accepted"]').click();await page.waitForFunction(()=>window.__SV_GA4_CONFIGURED===true);assert(analytics>0);
    assert.equal(errors.length,0,errors.join('\n'));results.push({option,lang,device,bounds,checks:'passed'});await context.close();
   }
  }
  for(const [key,items] of Object.entries(screens))for(const kind of ['viewport','full']){
   const mobile=key.endsWith('mobile'),column=mobile?390:480;
   const page=await browser.newPage({viewport:{width:column*3,height:1100},deviceScaleFactor:1});
   await page.setContent('<html><head><style>body{margin:0;background:#eeeae2;font:16px Arial;color:#183e3f}.board{display:flex;align-items:flex-start}.col{width:'+column+'px;flex:none}h2{font-size:18px;font-weight:500;margin:0;padding:18px 12px;border-right:1px solid #b9beb8}img{display:block;width:100%;height:auto}</style></head><body><div class="board">'+items.map((x,i)=>'<div class="col"><h2>'+(i+8)+'. '+x.option.split('-').map(s=>s[0].toUpperCase()+s.slice(1)).join(' ')+'</h2><img src="data:image/jpeg;base64,'+x[kind]+'"></div>').join('')+'</div></body></html>');
   await page.waitForFunction(()=>[...document.images].every(i=>i.complete));
   await page.screenshot({path:out+'/comparison-'+key+'-'+kind+'.png',fullPage:true});
   await page.close();
  }
  fs.writeFileSync(out+'/verification.json',JSON.stringify({commit:process.env.GITHUB_SHA,results},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});