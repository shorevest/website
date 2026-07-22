#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SITE_ORIGIN = 'https://shorevest.com';
const EXCLUDED_CDD_ROUTE = '/insights/china-debt-dynamics/v7i4/';
const EXCLUDED_CDD_SOURCE = 'china-debt-dynamics-v7i4.html';
const PUBLIC_NAV_VERSION = '20260722-public-hotfix';
const validate = process.argv.includes('--validate');

function trackedFiles(...patterns) {
  return execFileSync('git', ['ls-files', ...patterns], { cwd: ROOT, encoding: 'utf8' })
    .split(/\r?\n/)
    .filter(Boolean);
}

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function writeIfChanged(rel, content) {
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) return;
  const before = fs.readFileSync(abs, 'utf8');
  if (before !== content) fs.writeFileSync(abs, content);
}

function ensureNoindex(html) {
  if (/<meta[^>]+name=["']robots["']/i.test(html)) {
    return html.replace(
      /<meta[^>]+name=["']robots["'][^>]*>/i,
      '<meta name="robots" content="noindex, nofollow">'
    );
  }
  return html.replace(
    /(<meta[^>]+name=["']viewport["'][^>]*>)/i,
    '$1\n<meta name="robots" content="noindex, nofollow">'
  );
}

function removeExcludedCddRow(html) {
  const route = EXCLUDED_CDD_ROUTE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const legacy = 'china-debt-dynamics-v7i4';
  const rowPattern = new RegExp(
    '<article\\b(?=[^>]*(?:data-href|href)=["\\\'][^"\\\']*(?:' + route + '|' + legacy + ')[^"\\\']*["\\\'])[^>]*>[\\s\\S]*?<\\/article>\\s*',
    'gi'
  );
  let output = html.replace(rowPattern, '');
  output = output
    .replace(/(<span class="cdd-stat__num">)21(<\/span><span class="cdd-stat__label">Issues in archive)/g, '$120$2')
    .replace(/(<span data-cdd-arc-count>)21(<\/span> articles)/g, '$120$2');
  return output;
}

function normalizeTokenPlumbing(content) {
  let output = content;

  output = output.replace(
    /if\s*\(\s*([A-Za-z_$][\w$]*)\.origin\s*===\s*location\.origin\s*&&\s*!\1\.searchParams\.get\((['"])t\2\)\s*\)/g,
    (_match, variable) => `if(T&&${variable}.origin===location.origin&&!${variable}.searchParams.get('t'))`
  );

  output = output.replace(
    /if\s*\(\s*!([A-Za-z_$][\w$]*)\.searchParams\.get\((['"])t\2\)\s*\)\s*\1\.searchParams\.set\((['"])t\3,\s*T\s*\);/g,
    (_match, variable) => `if(T&&!${variable}.searchParams.get('t'))${variable}.searchParams.set('t',T);`
  );

  output = output.replace(
    /function\s+([A-Za-z_$][\w$]*)\(u\)\{return\s+u\+\(u\.indexOf\((['"])\?\2\)>-1\?\2&\2:\2\?\2\)\+\2t=\2\+T;\}/g,
    (_match, fn) => `function ${fn}(u){return T?u+(u.indexOf('?')>-1?'&':'?')+'t='+T:u;}`
  );

  return output
    .replace(/&t='\+window\.__SVT\+'/g, '')
    .replace(/\?t='\+window\.__SVT\+'/g, '')
    .replace(/&t="\+window\.__SVT\+"/g, '')
    .replace(/\?t="\+window\.__SVT\+"/g, '');
}

function normalizePublicScriptVersions(content) {
  return content.replace(
    /assets\/js\/sv-navigation\.js\?v=[^"'\s<]+/g,
    `assets/js/sv-navigation.js?v=${PUBLIC_NAV_VERSION}`
  );
}

function normalizeContactFallback(content) {
  if (!/id=["']cp-form["']/i.test(content)) return content;

  let output = content
    .replace(
      /<button class="cp-form__submit" type="submit">Send inquiry <span aria-hidden="true">→<\/span><\/button>/g,
      '<button class="cp-form__submit" type="submit">Open email <span aria-hidden="true">→</span></button>'
    )
    .replace(
      /<button class="cp-form__submit" type="submit">发送查询 <span aria-hidden="true">→<\/span><\/button>/g,
      '<button class="cp-form__submit" type="submit">打开邮件 <span aria-hidden="true">→</span></button>'
    )
    .replace(
      /<p class="cp-form__consent">By submitting this form, you acknowledge that ShoreVest Partners may collect and process your personal information in accordance with applicable privacy laws\.<\/p>/g,
      '<p class="cp-form__consent">Submitting opens your email application. Your inquiry is not sent to ShoreVest until you review and send the email.</p>'
    )
    .replace(
      /<p class="cp-form__consent">提交此表格即表示您确认新岸资本可能会根据适用的隐私法律收集和处理您的个人信息。<\/p>/g,
      '<p class="cp-form__consent">提交后将打开您的邮件应用。只有在您检查并发送邮件后，查询才会送达新岸资本。</p>'
    )
    .replace(
      /(<img class="cp-office__photo"[^>]*?)loading="eager"\s+fetchpriority="high"/g,
      '$1loading="lazy"'
    );

  const fallbackPattern = /var ok=document\.createElement\('div'\);\s*ok\.className='cp-form__success';ok\.setAttribute\('role','status'\);ok\.setAttribute\('tabindex','-1'\);\s*ok\.innerHTML='[^']*';\s*form\.replaceWith\(ok\);\s*try\{ok\.focus\(\);\}catch\(_\)\{\}/g;

  const fallbackReplacement = [
    "var typeField=form.querySelector('[name=\"inquiry_type\"]');",
    "var nameField=form.querySelector('[name=\"full_name\"]');",
    "var companyField=form.querySelector('[name=\"company\"]');",
    "var emailField=form.querySelector('[name=\"email\"]');",
    "var phoneField=form.querySelector('[name=\"phone\"]');",
    "var messageField=form.querySelector('[name=\"message\"]');",
    "var typeValue=typeField?typeField.value:'general';",
    "var typeLabel=typeField&&typeField.options[typeField.selectedIndex]?typeField.options[typeField.selectedIndex].text:typeValue;",
    "var fullName=nameField?(nameField.value||'').trim():'';",
    "var chinese=document.documentElement.lang&&document.documentElement.lang.toLowerCase().indexOf('zh')===0;",
    "var recipient=typeValue==='media'?'media@shorevest.com':'inquiries@shorevest.com';",
    "var subject=chinese?'新岸资本网站查询 - '+typeLabel+(fullName?' - '+fullName:''):'ShoreVest website inquiry - '+typeLabel+(fullName?' - '+fullName:'');",
    "var lines=chinese?['查询类别：'+typeLabel,'姓名：'+fullName,'公司 / 机构：'+(companyField?(companyField.value||'').trim():''),'商务电邮：'+(emailField?(emailField.value||'').trim():''),'电话：'+(phoneField?(phoneField.value||'').trim():''),'','查询摘要：',messageField?(messageField.value||'').trim():'']:['Inquiry type: '+typeLabel,'Full name: '+fullName,'Firm / institution: '+(companyField?(companyField.value||'').trim():''),'Business email: '+(emailField?(emailField.value||'').trim():''),'Phone: '+(phoneField?(phoneField.value||'').trim():''),'','Inquiry summary:',messageField?(messageField.value||'').trim():''];",
    "window.location.href='mailto:'+recipient+'?subject='+encodeURIComponent(subject)+'&body='+encodeURIComponent(lines.join('\\n'));"
  ].join('\n      ');

  output = output.replace(fallbackPattern, fallbackReplacement);
  return output;
}

function normalizeInvestorPortalFallback(content) {
  if (!/id=["']vdr-login-form["']/i.test(content)) return content;

  return content
    .replace(
      /target="_blank"(?!\s+rel=)/g,
      'target="_blank" rel="noopener noreferrer"'
    )
    .replace(
      '<h2 class="ip-signin__title">Enter your email to open the data room.</h2>',
      '<h2 class="ip-signin__title">Open the ShoreVest data room.</h2>'
    )
    .replace(
      '<p class="ip-signin__note">Authorized investors are sent directly into the ShoreVest iDeals data room.</p>',
      '<p class="ip-signin__note">Authorized investors will continue to the secure ShoreVest iDeals data room.</p>'
    )
    .replace(
      '<h2 class="ip-signin__title">请输入您的电子邮件以继续。</h2>',
      '<h2 class="ip-signin__title">打开新岸资本数据室。</h2>'
    )
    .replace(
      '<p class="ip-signin__note">获授权投资者将直接进入 ShoreVest iDeals 数据室。</p>',
      '<p class="ip-signin__note">获授权投资者将继续前往安全的新岸资本 iDeals 数据室。</p>'
    )
    .replace(
      '<div class="form-group">',
      '<div class="form-group" hidden aria-hidden="true">'
    )
    .replace(
      /<input id="email" type="text" name="email" class="form-control" placeholder="name@website\.com" autocomplete="off" \/>/g,
      '<input id="email" type="email" name="email" class="form-control" placeholder="name@website.com" autocomplete="email" disabled />'
    )
    .replace(
      /if \(this\.validateForm\(\)\) \{\s*var email = encodeURIComponent\(_this\.emailField\.value\);\s*window\.location\.href = SHOREVEST_DATA_ROOM_URL \+ '\?email=' \+ email;\s*\}/g,
      'window.location.href = SHOREVEST_DATA_ROOM_URL;'
    );
}

function mediaAliasPairs() {
  return trackedFiles('media-*.html').map(source => {
    const slug = path.basename(source, '.html');
    return {
      legacy: `/${slug}/`,
      clean: `/media/${slug.replace(/^media-/, '')}/`
    };
  });
}

function normalizeMediaAliases(content, pairs) {
  let output = content;
  for (const { legacy, clean } of pairs) {
    output = output.split(legacy).join(clean);
  }
  return output;
}

function normalizeFiles() {
  const pairs = mediaAliasPairs();
  const publicFiles = trackedFiles('*.html', '**/*.html', '*.js', 'assets/js/*.js');

  for (const rel of [...new Set(publicFiles)]) {
    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;
    let content = fs.readFileSync(abs, 'utf8');
    content = normalizeTokenPlumbing(content);
    content = normalizePublicScriptVersions(content);
    content = normalizeMediaAliases(content, pairs);
    content = normalizeContactFallback(content);
    content = normalizeInvestorPortalFallback(content);
    if (rel === 'insights.html' || rel === 'insights/index.html') {
      content = removeExcludedCddRow(content);
    }
    if (rel === EXCLUDED_CDD_SOURCE || rel === 'insights/china-debt-dynamics/v7i4/index.html') {
      content = ensureNoindex(content);
    }
    writeIfChanged(rel, content);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function canonicalHref(html) {
  const match = html.match(/<link\s+rel=["']canonical["'][^>]*href=["']([^"']+)["'][^>]*>/i) ||
    html.match(/<link\s+href=["']([^"']+)["'][^>]*rel=["']canonical["'][^>]*>/i);
  return match ? match[1] : null;
}

function validateSafetyFallbacks() {
  const contactFiles = ['contact.html', 'contact_cn.html', 'contact/index.html', 'cn/contact/index.html'];
  for (const rel of contactFiles) {
    const html = read(rel);
    assert(!/your inquiry has been received|您的查询已收到/i.test(html), `False contact success remains in ${rel}`);
    assert(/mailto:'\+recipient|mailto:\s*'\s*\+\s*recipient/i.test(html), `Contact mailto fallback is missing in ${rel}`);
    assert(/class="cp-form__submit"[^>]*>Open email|class="cp-form__submit"[^>]*>打开邮件/i.test(html), `Contact delivery wording is stale in ${rel}`);
  }

  const portalFiles = ['investor-portal/index.html', 'investor-portal/index_cn.html', 'cn/investor-portal/index.html'];
  for (const rel of portalFiles) {
    const html = read(rel);
    assert(!/SHOREVEST_DATA_ROOM_URL\s*\+\s*['"]\?email=/i.test(html), `Investor email remains in redirect URL in ${rel}`);
    assert(/window\.location\.href\s*=\s*SHOREVEST_DATA_ROOM_URL/i.test(html), `Direct iDeals redirect is missing in ${rel}`);
    assert(/class="form-group" hidden aria-hidden="true"/i.test(html), `Investor email field is still public in ${rel}`);
    assert(/target="_blank" rel="noopener noreferrer"/i.test(html), `External portal link is missing rel protection in ${rel}`);
  }
}

function validateArticles() {
  const manifest = JSON.parse(read('assets/data/clean-url-manifest.json'));
  const articleRoutes = manifest.routes.filter(item =>
    (item.route.startsWith('/insights/china-debt-dynamics/') && item.route !== '/insights/china-debt-dynamics/print/') ||
    (item.route.startsWith('/media/') && item.route !== '/media/')
  );
  const indexableArticles = articleRoutes.filter(item => item.indexable);
  const cddArticles = indexableArticles.filter(item => item.route.startsWith('/insights/'));
  const mediaArticles = articleRoutes.filter(item => item.route.startsWith('/media/'));
  const disabledMediaArticles = mediaArticles.filter(item => item.disabled);

  for (const item of articleRoutes) {
    const abs = path.join(ROOT, item.destination);
    assert(fs.existsSync(abs), `Missing article destination: ${item.destination}`);
    const html = fs.readFileSync(abs, 'utf8');
    assert(/<title>[^<]+<\/title>/i.test(html), `Missing title in ${item.destination}`);
    assert(!/href=["']\/media-[^"']+\/["']/i.test(html), `Legacy media route remains in ${item.destination}`);
    assert(!/function\s+\w+\(u\)\{return\s+u\+\(u\.indexOf\(["']\?["']\)/.test(html), `Unguarded t helper remains in ${item.destination}`);
    assert(!/if\s*\(\s*\w+\.origin\s*===\s*location\.origin\s*&&\s*!\w+\.searchParams\.get\(["']t["']\)/.test(html), `Unguarded t propagation remains in ${item.destination}`);

    if (item.disabled) {
      const expectedCanonical = new URL(item.redirectTarget, SITE_ORIGIN).href;
      assert(/<meta[^>]+name=["']robots["'][^>]+content=["'][^"']*noindex/i.test(html), `Disabled article is indexable: ${item.destination}`);
      assert(canonicalHref(html) === expectedCanonical, `Incorrect disabled-route canonical in ${item.destination}`);
      assert(html.includes(`content="${SITE_ORIGIN}${item.route}"`), `Disabled-route marker missing in ${item.destination}`);
      assert(html.includes(item.redirectTarget), `Disabled-route target missing in ${item.destination}`);
      continue;
    }

    assert(canonicalHref(html) === `${SITE_ORIGIN}${item.route}`, `Incorrect canonical URL in ${item.destination}`);

    if (item.route.startsWith('/insights/china-debt-dynamics/') && item.route !== EXCLUDED_CDD_ROUTE) {
      const sourceMatch = html.match(/data-article-source=["']([^"']+)["']/i);
      assert(sourceMatch, `Missing article data source in ${item.destination}`);
      assert(fs.existsSync(path.join(ROOT, sourceMatch[1])), `Missing JSON data source for ${item.destination}: ${sourceMatch[1]}`);
    }
  }

  const insightsIndex = read('insights/index.html');
  for (const item of cddArticles) {
    assert(insightsIndex.includes(`href="${item.route}"`) || insightsIndex.includes(`data-href="${item.route}"`), `Insights archive does not link ${item.route}`);
  }
  assert(!insightsIndex.includes(EXCLUDED_CDD_ROUTE), 'Excluded CDD 36 route remains in the Insights archive');
  assert(/<span class="cdd-stat__num">20<\/span><span class="cdd-stat__label">Issues in archive/.test(insightsIndex), 'Insights issue count is not 20');

  const mediaIndex = read('media/index.html');
  assert(!/href=["']\/media-[^"']+\/["']/i.test(mediaIndex), 'Legacy media article links remain on the Media page');

  const sitemap = read('sitemap.xml');
  for (const item of indexableArticles) {
    assert(sitemap.includes(`<loc>${SITE_ORIGIN}${item.route}</loc>`), `Sitemap is missing ${item.route}`);
  }
  for (const item of articleRoutes.filter(item => !item.indexable)) {
    assert(!sitemap.includes(`<loc>${SITE_ORIGIN}${item.route}</loc>`), `Non-indexable article remains in sitemap: ${item.route}`);
  }
  assert(!sitemap.includes(`${SITE_ORIGIN}${EXCLUDED_CDD_ROUTE}`), 'Excluded CDD 36 route remains in sitemap.xml');

  console.log(`Validated ${cddArticles.length} published China Debt Dynamics articles and ${mediaArticles.length} media article routes (${disabledMediaArticles.length} intentionally redirected while the archive is hidden).`);
}

normalizeFiles();
if (validate) {
  validateSafetyFallbacks();
  validateArticles();
}
