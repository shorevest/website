(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShoreVestRecruitmentRoleList = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var MANIFEST_PATH = 'assets/data/recruitment/roles.v1.json';
  var SUPPORTED_LOCALES = { en: true, 'zh-CN': true };
  var LINK_LABELS = { en: 'View role', 'zh-CN': '查看职位' };
  var DETAIL_PATH_PATTERN = /^careers\/[a-z0-9]+(?:-[a-z0-9]+)*(?:_cn)?\.html$/;

  function getLocale(doc) {
    var lang = doc && doc.documentElement ? doc.documentElement.lang : '';
    return SUPPORTED_LOCALES[lang] ? lang : null;
  }

  function isSafeDetailPath(path) {
    if (typeof path !== 'string') return false;
    if (!DETAIL_PATH_PATTERN.test(path)) return false;
    if (path.indexOf('://') !== -1 || path.indexOf('//') === 0) return false;
    return true;
  }

  function appendMeta(doc, row, value) {
    if (typeof value !== 'string' || value.trim() === '') return false;
    var meta = doc.createElement('p');
    meta.className = 'careers-role-row__meta';
    meta.textContent = value;
    row.appendChild(meta);
    return true;
  }

  function buildRoleRow(doc, role, locale) {
    var localized = role && role.locales ? role.locales[locale] : null;
    if (!localized || role.status !== 'active') return null;
    if (!isSafeDetailPath(localized.detailPath)) return null;
    if (typeof localized.title !== 'string' || localized.title.trim() === '') return null;

    var row = doc.createElement('div');
    row.className = 'careers-role-row';

    var title = doc.createElement('h3');
    title.className = 'careers-role-row__title';
    title.textContent = localized.title;
    row.appendChild(title);

    var hasTeam = appendMeta(doc, row, localized.team);
    var hasLocation = appendMeta(doc, row, localized.location);
    var hasEmploymentType = appendMeta(doc, row, role.employmentType);
    if (!hasTeam || !hasLocation || !hasEmploymentType) return null;

    var link = doc.createElement('a');
    link.className = 'careers-role-row__link';
    link.href = localized.detailPath;
    link.textContent = LINK_LABELS[locale];
    row.appendChild(link);

    return row;
  }

  function renderRolesFromManifest(doc, manifest) {
    var container = doc.querySelector('[data-role-list="open-roles"]');
    var locale = getLocale(doc);
    if (!container || !locale || !manifest || !Array.isArray(manifest.roles)) return 0;

    var rows = [];
    manifest.roles.forEach(function (role) {
      var row = buildRoleRow(doc, role, locale);
      if (row) rows.push(row);
    });

    if (!rows.length) return 0;
    container.replaceChildren.apply(container, rows);
    return rows.length;
  }

  function warnLoadFailure(win) {
    if (win.console && typeof win.console.warn === 'function') {
      win.console.warn('Recruitment role list unavailable.');
    }
  }

  function initRoleList(win) {
    var doc = win.document;
    if (!doc || !doc.querySelector('[data-role-list="open-roles"]') || typeof win.fetch !== 'function') return Promise.resolve(0);

    return win.fetch(MANIFEST_PATH, { credentials: 'same-origin' })
      .then(function (response) {
        if (!response || !response.ok) throw new Error('Manifest unavailable');
        return response.json();
      })
      .then(function (manifest) {
        return renderRolesFromManifest(doc, manifest);
      })
      .catch(function () {
        warnLoadFailure(win);
        return 0;
      });
  }

  if (typeof window !== 'undefined' && window.document) {
    initRoleList(window);
  }

  return {
    initRoleList: initRoleList,
    renderRolesFromManifest: renderRolesFromManifest,
    isSafeDetailPath: isSafeDetailPath,
    MANIFEST_PATH: MANIFEST_PATH
  };
});
