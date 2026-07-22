/* ============================================================================
   ShoreVest One — Media Library Tool
   Demonstration-only workflow for proposing, checking, adding, and removing
   website media. Records are stored locally until a deployment-backed media
   service is connected; no public website files are changed by this screen.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var R = root.SVPortalRules;
  var S = root.SVPortalStore;
  var el = U.el, esc = U.esc;

  var MEDIA_CONFIG_KEY = 'siteMediaLibrary';
  var MAX_MEDIA_BYTES = 12 * 1024 * 1024;
  var ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'svg', 'pdf'];
  var ALLOWED_MIME_PREFIXES = ['image/'];
  var ALLOWED_MIME_TYPES = ['application/pdf'];
  var BLOCKED_WORDS = ['confidential', 'private', 'internal', 'draft', 'password', 'passport', 'ssn', 'account number'];

  function nowIso() { return new Date().toISOString(); }
  function uid() { return 'MEDIA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(); }
  function library() {
    var rows = S.getConfig(MEDIA_CONFIG_KEY, []);
    return Array.isArray(rows) ? rows : [];
  }
  function saveLibrary(rows, user, reason) { S.setConfig(MEDIA_CONFIG_KEY, rows, user.name, reason); }
  function ext(name) { return String(name || '').split('.').pop().toLowerCase(); }
  function fmtBytes(n) {
    if (!n) return '—';
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return Math.round(n / 1024) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
  }
  function addCheck(checks, ok, label, detail) { checks.push({ ok: !!ok, label: label, detail: detail }); }
  function suitabilityFromForm(file, fields, dimensions) {
    var checks = [];
    var fileExt = ext(file && file.name);
    var mime = (file && file.type) || '';
    var lowerName = String(file && file.name || '').toLowerCase();
    var allText = [fields.title, fields.altText, fields.usage, fields.rights, fields.source, lowerName].join(' ').toLowerCase();
    var hasBlockedWord = BLOCKED_WORDS.some(function (w) { return allText.indexOf(w) !== -1; });
    var mimeOk = ALLOWED_MIME_TYPES.indexOf(mime) !== -1 || ALLOWED_MIME_PREFIXES.some(function (p) { return mime.indexOf(p) === 0; }) || fileExt === 'svg';

    addCheck(checks, !!file, 'File selected', file ? file.name : 'Choose a file before adding media.');
    addCheck(checks, ALLOWED_EXTENSIONS.indexOf(fileExt) !== -1 && mimeOk, 'Approved format', 'Allowed formats: JPG, PNG, WebP, SVG, and PDF.');
    addCheck(checks, file && file.size > 0 && file.size <= MAX_MEDIA_BYTES, 'Controlled file size', 'Maximum ' + fmtBytes(MAX_MEDIA_BYTES) + '; selected ' + fmtBytes(file && file.size) + '.');
    addCheck(checks, fields.title.trim().length >= 4, 'Clear public title', 'Use a descriptive title for website editors.');
    addCheck(checks, fields.altText.trim().length >= 12 || fileExt === 'pdf', 'Accessibility text', 'Images need meaningful alt text before publication.');
    addCheck(checks, fields.usage.trim().length >= 8, 'Intended placement', 'Name the intended page, section, or campaign.');
    addCheck(checks, fields.rights === 'owned' || fields.rights === 'licensed' || fields.rights === 'approved-third-party', 'Usage rights confirmed', 'Confirm ShoreVest ownership, licence, or approved third-party permission.');
    addCheck(checks, !hasBlockedWord, 'No obvious sensitive markers', 'Title, notes, source, and filename must not indicate private, draft, password, or confidential material.');
    if (dimensions) {
      addCheck(checks, dimensions.width >= 800 || fileExt === 'svg', 'Image resolution', 'Raster images should be at least 800px wide; detected ' + dimensions.width + '×' + dimensions.height + '.');
    }
    var ok = checks.every(function (c) { return c.ok; });
    return { ok: ok, status: ok ? 'Suitable' : 'Needs review', checks: checks };
  }

  function readDimensions(file, done) {
    if (!file || !file.type || file.type.indexOf('image/') !== 0 || ext(file.name) === 'svg') { done(null); return; }
    var img = new Image();
    img.onload = function () { done({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
    img.onerror = function () { done(null); URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(file);
  }

  SVOps.views.mediaLibrary = function (container, user) {
    if (!R.can(user.role, 'administer')) { container.appendChild(U.permissionDenied('manage website media')); return; }
    var page = el('div', { class: 'ops-content' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'Website Media' }),
      el('h1', { class: 'ops-h1', text: 'Add, remove, and suitability-check site media' }),
      el('p', { class: 'ops-lede', text: 'Stage public-site media in ShoreVest One with format, size, accessibility, rights, and sensitivity checks before anything is eligible for publication.' })
    ]));

    var fields = { title: '', altText: '', usage: '', rights: '', source: '' };
    var selectedFile = null;
    var dimensions = null;
    var checkHost = el('div');

    var panel = el('div', { class: 'ops-panel' });
    panel.appendChild(el('div', { class: 'ops-panel__head' }, [el('h2', { class: 'ops-panel__title', text: 'Add media candidate' }), el('span', { class: 'ops-meta', text: 'Demo records only' })]));
    var fileInput = el('input', { type: 'file', accept: '.jpg,.jpeg,.png,.webp,.svg,.pdf,image/*,application/pdf' });
    var title = el('input', { type: 'text', placeholder: 'e.g. Firm page office photo' });
    var alt = el('textarea', { placeholder: 'Meaningful alt text for images' });
    var usage = el('input', { type: 'text', placeholder: 'Intended page or section' });
    var rights = el('select');
    [ ['', 'Select rights status'], ['owned', 'Owned by ShoreVest'], ['licensed', 'Licensed for web use'], ['approved-third-party', 'Approved third-party permission'], ['unknown', 'Unknown / not ready'] ].forEach(function (o) { rights.appendChild(el('option', { value: o[0], text: o[1] })); });
    var source = el('input', { type: 'text', placeholder: 'Source, photographer, licence, or approval reference' });

    function collect() { fields = { title: title.value, altText: alt.value, usage: usage.value, rights: rights.value, source: source.value }; }
    function renderChecks() {
      collect();
      var result = suitabilityFromForm(selectedFile, fields, dimensions);
      checkHost.innerHTML = '';
      checkHost.appendChild(U.notice(result.ok ? 'ok' : 'warn', '<strong>' + esc(result.status) + '.</strong> ' + (result.ok ? 'This candidate can be staged for publication review.' : 'Resolve the failed checks before treating this as publication-ready.')));
      checkHost.appendChild(U.table([
        { key: 'ok', label: 'Result', html: function (c) { return c.ok ? U.statusHtml('Pass', 'st--ok') : U.statusHtml('Review', 'st--warn'); } },
        { key: 'label', label: 'Check' },
        { key: 'detail', label: 'Detail' }
      ], result.checks));
      return result;
    }
    [title, alt, usage, rights, source].forEach(function (node) { node.addEventListener('input', renderChecks); node.addEventListener('change', renderChecks); });
    fileInput.addEventListener('change', function () {
      selectedFile = fileInput.files && fileInput.files[0] || null;
      dimensions = null;
      readDimensions(selectedFile, function (d) { dimensions = d; renderChecks(); });
      renderChecks();
    });

    panel.appendChild(el('div', { class: 'ops-grid ops-grid--2' }, [
      el('div', { class: 'fld' }, [el('label', { text: 'Media file' }), fileInput]),
      el('div', { class: 'fld' }, [el('label', { text: 'Public title' }), title]),
      el('div', { class: 'fld' }, [el('label', { text: 'Alt text / accessibility note' }), alt]),
      el('div', { class: 'fld' }, [el('label', { text: 'Intended use' }), usage]),
      el('div', { class: 'fld' }, [el('label', { text: 'Rights status' }), rights]),
      el('div', { class: 'fld' }, [el('label', { text: 'Source / approval reference' }), source])
    ]));
    panel.appendChild(checkHost);
    panel.appendChild(el('div', { class: 'ops-actions', style: 'margin-top:12px' }, [
      el('button', { class: 'btn btn--primary', text: 'Stage media', onclick: function () {
        var result = renderChecks();
        if (!result.ok) { U.toast('Media was not staged: resolve suitability checks first.'); return; }
        var rows = library();
        rows.unshift({ id: uid(), filename: selectedFile.name, size: selectedFile.size, type: selectedFile.type || ext(selectedFile.name), title: fields.title.trim(), altText: fields.altText.trim(), usage: fields.usage.trim(), rights: fields.rights, source: fields.source.trim(), status: result.status, checks: result.checks, addedBy: user.name, addedAt: nowIso() });
        saveLibrary(rows, user, 'Staged website media candidate ' + selectedFile.name + '.');
        U.toast('Media candidate staged.');
        root.dispatchEvent(new CustomEvent('svops:render'));
      } })
    ]));
    page.appendChild(panel);

    var rows = library();
    var lib = el('div', { class: 'ops-panel', style: 'margin-top:20px' });
    lib.appendChild(el('div', { class: 'ops-panel__head' }, [el('h2', { class: 'ops-panel__title', text: 'Staged media library' }), el('span', { class: 'ops-meta', text: rows.length + ' candidate' + (rows.length === 1 ? '' : 's') })]));
    lib.appendChild(U.table([
      { key: 'filename', label: 'File', html: function (m) { return '<strong>' + esc(m.title) + '</strong><br><span class="ops-meta">' + esc(m.filename) + ' · ' + esc(fmtBytes(m.size)) + '</span>'; } },
      { key: 'usage', label: 'Intended use' },
      { key: 'rights', label: 'Rights' },
      { key: 'status', label: 'Suitability', html: function (m) { return U.statusHtml(m.status, m.status === 'Suitable' ? 'st--ok' : 'st--warn'); } },
      { key: 'addedAt', label: 'Added', html: function (m) { return esc(U.fmtDateTime(m.addedAt)); } },
      { key: 'remove', label: '', html: function (m) { return '<button class="btn btn--sm btn--danger" data-remove="' + esc(m.id) + '">Remove</button>'; } }
    ], rows, { emptyText: 'No media staged yet.' }));
    lib.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-remove]');
      if (!btn) return;
      var id = btn.getAttribute('data-remove');
      var next = library().filter(function (m) { return m.id !== id; });
      saveLibrary(next, user, 'Removed website media candidate ' + id + '.');
      U.toast('Media candidate removed.');
      root.dispatchEvent(new CustomEvent('svops:render'));
    });
    page.appendChild(lib);
    page.appendChild(U.notice('info', '<strong>Publication control.</strong> This tool stages and audits media candidates only. A deployment-backed publishing step must still move approved files into the public website.'));
    renderChecks();
    container.appendChild(page);
  };

})(typeof self !== 'undefined' ? self : this);
