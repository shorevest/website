'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright-core');
const base = process.env.HOMEPAGE_BASE_SHA;
const targets = ['home.html', 'index.html', 'home_cn.html', 'cn/index.html'];
const extract = (text, re) => { const m = text.match(re); assert(m); return m[0]; };
for (const file of targets) {
  const current = fs.readFileSync(file, 'utf8');
  const previous = execFileSync('git', ['show', base + ':' + file], {encoding:'utf8'});
  assert.equal(extract(current, /<footer[\s\S]*?<\/footer>/), extract(previous, /<footer[\s\S]*?<\/footer>/), file + ' footer/legal changed');
  assert.deepEqual(current.match(/<script\b[\s\S]*?<\/script>/g), previous.match(/<script\b[\s\S]*?<\/script>/g), file + ' scripts changed');
  const main = extract(current, /<main[\s\S]*?<\/main>/);
  assert.deepEqual([...main.matchAll(/<section id="([^"]+)"/g)].map(m => m[1]), ['hero','underwriting','research','strategy','firm','institutional-contact']);
  assert(main.includes('data-selected-research="v10i3"'));
  assert.equal((main.match(/href="\/(?:cn\/)?strategy\/"/g)||[]).length, 1);
  assert(!/sv-srow|sv-cdd__feature|home-firm-preview__proof/.test(main));
}
fs.mkdirSync('artifacts/homepage-draft', {recursive:true});
(async () => {
  const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
  const results = [];
  try {
    for (const [language, route] of [['en','/'],['zh','/cn/']]) {
      for (const [device, viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]) {
        const context = await browser.newContext({viewport,deviceScaleFactor:1});
        let analyticsLoads = 0;
        await context.route('https://shorevest.com/**', async intercept => {
          const url = new URL(intercept.request().url());
          const response = await context.request.get('http://127.0.0.1:4173' + url.pathname + url.search);
          await intercept.fulfill({response});
        });
        await context.route(/https:\/\/(?:www\.)?(?:googletagmanager|google-analytics)\.com\//, async intercept => {
          analyticsLoads++;
          await intercept.fulfill({status:200,contentType:'application/javascript',body:''});
        });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto('https://shorevest.com' + route, {waitUntil:'networkidle'});
        await page.evaluate(() => document.fonts.ready);
        await page.locator('#sv-analytics-consent').waitFor();
        assert.equal(analyticsLoads,0,'analytics before consent');
        await page.screenshot({path:'artifacts/homepage-draft/' + language + '-' + device + '-consent.png',fullPage:false});
        await page.locator('#sv-analytics-consent button[data-choice="rejected"]').click();
        assert.equal(await page.locator('#sv-analytics-consent').count(),0);
        assert.equal(analyticsLoads,0,'analytics after rejection');
        assert.equal(await page.locator('h1').count(),1);
        assert.equal(await page.locator('#hero p').count(),1);
        assert.equal(await page.locator('#research').getAttribute('data-selected-research'),'v10i3');
        assert.equal(await page.locator('#strategy a').count(),1);
        const bounds = await page.evaluate(() => ({
          width:document.documentElement.clientWidth,
          scrollWidth:document.documentElement.scrollWidth,
          mainWidth:document.querySelector('main').getBoundingClientRect().width
        }));
        assert(bounds.scrollWidth <= bounds.width + 1,'horizontal overflow');
        if (device === 'mobile') {
          const burger = page.locator('.sv-burger');
          await burger.click();
          assert.equal(await burger.getAttribute('aria-expanded'),'true');
          await burger.click();
          assert.equal(await burger.getAttribute('aria-expanded'),'false');
        }
        for (const href of await page.locator('main a').evaluateAll(links => links.map(a => a.getAttribute('href')))) {
          const resource = new URL(href,'https://shorevest.com');
          const response = await context.request.get('http://127.0.0.1:4173' + resource.pathname);
          assert.equal(response.status(),200,'missing destination ' + href);
        }
        await page.screenshot({path:'artifacts/homepage-draft/' + language + '-' + device + '-full.png',fullPage:true});
        await page.screenshot({path:'artifacts/homepage-draft/' + language + '-' + device + '-viewport.png',fullPage:false});
        await page.locator('.sv-cookie-settings-button').click();
        await page.locator('#sv-analytics-consent button[data-choice="accepted"]').click();
        await page.waitForFunction(() => window.__SV_GA4_CONFIGURED === true);
        assert(analyticsLoads > 0,'analytics not enabled after acceptance');
        assert.equal(errors.length,0,errors.join('\n'));
        results.push({language,device,bounds,selectedResearch:'v10i3',checks:'passed'});
        await context.close();
      }
    }
    fs.writeFileSync('artifacts/homepage-draft/verification.json',JSON.stringify({commit:process.env.GITHUB_SHA,results},null,2));
    console.log(JSON.stringify(results,null,2));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
