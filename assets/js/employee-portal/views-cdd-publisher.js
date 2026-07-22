/* ===========================================================================
   ShoreVest One — CDD Publisher
   Browser-only drafting assistant for China Debt Dynamics issues. It turns
   pasted article text and uploaded image assets into the website JSON payload,
   article shell, archive snippet, and PDF/print preview link. No data leaves
   the browser in demonstration mode.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var el = U.el;

  var DEFAULT_DISCLAIMER = 'This letter expresses the views of the author as of the date indicated and such views are subject to change without notice. ShoreVest Partners has no duty or obligation to update the information contained herein. Certain information contained herein concerning economic trends is based on or derived from information provided by independent third-party sources. ShoreVest Partners believes that the sources from which such information has been obtained are reliable; however, it cannot guarantee the accuracy of such information and has not independently verified the accuracy or completeness of such information or the assumptions on which such information is based. This letter, including the information contained herein, may not be copied, reproduced, republished, or posted in whole or in part, in any form without the prior written consent of ShoreVest Partners.';

  SVOps.views.cddPublisher = function (container) {
    var page = el('div', { class: 'ops-content cdd-tool' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Publishing' }),
      el('h1', { class: 'ops-h1', text: 'China Debt Dynamics publisher' }),
      el('p', { class: 'ops-lede', text: 'Upload or paste CDD copy, add image assets, and generate the website-ready issue files plus a browser print/PDF preview.' })
    ]));

    page.appendChild(U.notice('info', '<strong>Local drafting tool.</strong> Content is processed in this browser only. Download the generated files, commit them to the website, then use the PDF preview to save the final PDF.'));

    var form = el('div', { class: 'ops-panel cdd-tool__panel' });
    form.appendChild(el('div', { class: 'ops-panel__head' }, [
      el('h2', { class: 'ops-panel__title', text: 'Issue inputs' }),
      el('span', { class: 'st st--review', text: 'Draft until reviewed' })
    ]));

    var fields = {
      volume: input('Volume', '10'),
      issue: input('Issue', '2'),
      published: input('Published date', 'July 20, 2026'),
      title: input('Title', ''),
      dek: textarea('Short deck / summary', ''),
      findings: textarea('Key findings — one per line', ''),
      body: textarea('Article text — use ## headings, - bullets, and [image: filename.jpg | Caption] where images should appear', ''),
      images: el('input', { type: 'file', accept: 'image/*', multiple: true, 'aria-label': 'CDD images' })
    };

    form.appendChild(fieldWrap('Volume / Issue', row([fields.volume, fields.issue])));
    form.appendChild(fieldWrap('Publication date', fields.published));
    form.appendChild(fieldWrap('Title', fields.title));
    form.appendChild(fieldWrap('Deck', fields.dek));
    form.appendChild(fieldWrap('Key findings', fields.findings));
    form.appendChild(fieldWrap('Article text', fields.body));
    form.appendChild(fieldWrap('Images', fields.images, 'Images are referenced by their original file names. Download them into assets/images/cdd/ before publishing.'));

    var actions = el('div', { class: 'cdd-tool__actions' });
    var output = el('div', { class: 'cdd-tool__output', hidden: true });
    actions.appendChild(el('button', { type: 'button', class: 'btn btn--primary', text: 'Generate publishing pack', onclick: function () { renderPack(fields, output); } }));
    actions.appendChild(el('button', { type: 'button', class: 'btn btn--quiet', text: 'Load sample format', onclick: function () { loadSample(fields); } }));
    form.appendChild(actions);
    page.appendChild(form);
    page.appendChild(output);
    container.appendChild(page);
  };

  function input(label, value) { return el('input', { type: 'text', value: value, 'aria-label': label }); }
  function textarea(label, value) { return el('textarea', { rows: label === 'Article text' ? '14' : '4', text: value, 'aria-label': label }); }
  function row(children) { return el('div', { class: 'cdd-tool__row' }, children); }
  function fieldWrap(label, child, hint) { return el('label', { class: 'fld' }, [el('span', { text: label }), child, hint ? el('small', { text: hint }) : null]); }
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'untitled'; }
  function issueId(f) { return 'v' + f.volume.value.trim() + 'i' + f.issue.value.trim(); }
  function assetName(file) { return 'assets/images/cdd/' + file.name.replace(/[^A-Za-z0-9._-]/g, '-'); }

  function parseSections(text, files) {
    var imageMap = {};
    Array.prototype.forEach.call(files || [], function (file) { imageMap[file.name.toLowerCase()] = assetName(file); });
    var sections = [], current = { heading: null, paragraphs: [] }, para = [];
    function flushPara() { if (para.length) { current.paragraphs.push(para.join(' ')); para = []; } }
    function pushSection() { flushPara(); if (current.heading || current.paragraphs.length || current.bullets || current.images) sections.push(current); }
    String(text || '').split(/\r?\n/).forEach(function (line) {
      var trimmed = line.trim();
      var imageMatch = trimmed.match(/^\[image:\s*([^|\]]+)(?:\|\s*([^\]]+))?\]$/i);
      if (!trimmed) { flushPara(); return; }
      if (/^#{2,3}\s+/.test(trimmed)) { pushSection(); current = { heading: trimmed.replace(/^#{2,3}\s+/, ''), paragraphs: [] }; return; }
      if (/^[-*]\s+/.test(trimmed)) { flushPara(); current.bullets = current.bullets || []; current.bullets.push(trimmed.replace(/^[-*]\s+/, '')); return; }
      if (imageMatch) {
        flushPara(); current.images = current.images || [];
        var key = imageMatch[1].trim().toLowerCase();
        current.images.push({ src: imageMap[key] || assetName({ name: imageMatch[1].trim() }), alt: imageMatch[2] ? imageMatch[2].trim() : '', caption: imageMatch[2] ? imageMatch[2].trim() : '' });
        return;
      }
      para.push(trimmed);
    });
    pushSection();
    return sections;
  }

  function buildData(f) {
    return {
      series: 'China Debt Dynamics', volumeIssue: 'Volume ' + f.volume.value.trim() + ' | Issue ' + f.issue.value.trim(), published: f.published.value.trim(),
      title: f.title.value.trim(), dek: f.dek.value.trim(),
      keyFindings: f.findings.value.split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean),
      sections: parseSections(f.body.value, f.images.files), disclaimer: DEFAULT_DISCLAIMER,
      copyright: '© ' + new Date().getUTCFullYear() + ' ShoreVest Partners. All rights reserved.'
    };
  }

  function renderPack(f, output) {
    var id = issueId(f), data = buildData(f), jsonName = 'china-debt-dynamics-' + id + '.json', htmlName = 'china-debt-dynamics-' + id + '.html';
    var json = JSON.stringify(data, null, 2) + '\n';
    var html = '<!doctype html>\n<html lang="en">\n<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>' + data.title + ' | ShoreVest</title><link rel="stylesheet" href="assets/css/homepage-rebuild.css"><link rel="stylesheet" href="assets/css/cdd-article-template.css"></head>\n<body class="homepage insights-page cdd-article-page" data-article-source="assets/data/' + jsonName + '"><main class="cdd-page"><div class="cdd-topline"><div class="cdd-topline__inner"><div class="cdd-label">ShoreVest Insights Publication</div><div class="cdd-lockup" lang="zh-Hant">新岸資本 · 中國債務動態</div></div></div><div class="cdd-intro sv-hero sv-hero--gradient"><div class="cdd-intro__bar"><div class="cdd-meta" data-cdd-meta></div><div class="cdd-actions"><a class="cdd-btn" href="insights.html">Back to Insights</a><a class="cdd-btn cdd-btn--solid" href="china-debt-dynamics-print.html?source=assets/data/' + jsonName + '&pdf=1" target="_blank" rel="noopener">PDF</a></div></div><div class="cdd-intro__grid sv-hero__inner sv-hero__grid"><div class="cdd-intro__lede sv-hero__left"><h1 class="cdd-title sv-hero__title" data-cdd-title></h1><p class="cdd-dek sv-hero__body" data-cdd-dek></p></div></div></div><div class="cdd-reading-grid"><aside class="cdd-sidecard"><h3>Key Findings</h3><ul data-cdd-findings></ul></aside><article class="cdd-body" data-cdd-body></article></div><footer class="cdd-disclaimer"><h4>Legal Information and Disclosures</h4><p data-cdd-disclaimer></p><p data-cdd-copyright></p></footer></main><script src="assets/js/cdd-article-template.js"></script></body></html>\n';
    var archive = '<article class="cdd-arc__row" data-href="' + htmlName + '">\n  <span class="cdd-arc__chip-issue">' + data.volumeIssue + '</span>\n  <span class="cdd-arc__date">' + data.published + '</span>\n  <h3 class="cdd-arc__row-title">' + data.title + '</h3>\n  <p class="cdd-arc__excerpt">' + data.dek + '</p>\n  <a class="cdd-arc__read" href="' + htmlName + '">Read</a>\n  <a class="cdd-arc__pdf" href="china-debt-dynamics-print.html?source=assets/data/' + jsonName + '&pdf=1">PDF</a>\n</article>\n';
    output.hidden = false; output.innerHTML = '';
    output.appendChild(el('div', { class: 'ops-panel' }, [
      el('div', { class: 'ops-panel__head' }, [el('h2', { class: 'ops-panel__title', text: 'Publishing pack ready' })]),
      downloadLink(jsonName, 'application/json', json, 'Download article JSON'), downloadLink(htmlName, 'text/html', html, 'Download article page'), downloadLink('insights-archive-snippet-' + id + '.html', 'text/html', archive, 'Download archive snippet'),
      el('p', { class: 'ops-lede', text: 'Next: save images to assets/images/cdd/, place the JSON in assets/data/, place the HTML at the site root, paste the archive snippet into insights.html, then open the PDF link and save as PDF.' })
    ]));
    output.appendChild(el('pre', { class: 'cdd-tool__code', text: json }));
  }
  function downloadLink(name, type, content, label) { return el('a', { class: 'btn btn--quiet cdd-tool__download', download: name, href: URL.createObjectURL(new Blob([content], { type: type })), text: label + ' (' + name + ')' }); }
  function loadSample(f) { f.title.value = 'Sample CDD Title'; f.dek.value = 'A one-sentence summary of the new issue.'; f.findings.value = 'First key finding\nSecond key finding'; f.body.value = 'Opening paragraph for the issue.\n\n## First section\nA paragraph in the first section.\n\n- A supporting bullet\n- Another supporting bullet\n\n[image: chart.png | Optional chart caption]\n\n## Second section\nAnother paragraph.'; }
})(typeof self !== 'undefined' ? self : this);
