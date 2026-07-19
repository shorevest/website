(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShoreVestRecruitmentRoleDetail = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Role-detail pages live in /careers/, so the shared manifest is one directory up.
  // A page may override this with data-recruitment-manifest for other locations.
  var DEFAULT_MANIFEST_PATH = '../assets/data/recruitment/roles.v1.json';
  var SUPPORTED_LOCALES = { en: true, 'zh-CN': true };
  var ACTIVE_STATUSES = { active: true };
  var CLOSED_STATUSES = { closed: true, archived: true };

  var STRINGS = {
    en: {
      eyebrow: 'Careers',
      overview: 'Role Overview',
      responsibilities: 'Responsibilities',
      requirements: 'Requirements',
      preferred: 'Preferred Qualifications',
      reportingLine: 'Reporting Line',
      deadline: 'Application Deadline',
      applicationStatus: 'Application Status',
      apply: 'Apply for this role',
      disabled: 'Applications are not currently being accepted for this position.',
      closed: 'This position is no longer accepting applications.',
      notFound: 'This position could not be found.',
      unavailable: 'Role information could not be loaded. Please try again later.',
      backToCareers: 'View all roles',
      privacyNote: 'ShoreVest processes recruitment information in line with its recruitment privacy notice. Recruiting communications take place only through official ShoreVest channels, and ShoreVest never asks candidates to make a payment.',
      employmentType: { 'Full-time': 'Full-time', 'Part-time': 'Part-time', Internship: 'Internship', Contract: 'Contract' },
      applyPage: 'apply.html'
    },
    'zh-CN': {
      eyebrow: '人才招聘',
      overview: '职位概述',
      responsibilities: '工作职责',
      requirements: '任职要求',
      preferred: '优先条件',
      reportingLine: '汇报关系',
      deadline: '申请截止日期',
      applicationStatus: '申请状态',
      apply: '申请该职位',
      disabled: '该职位目前暂不接受申请。',
      closed: '该职位已停止接受申请。',
      notFound: '未能找到该职位。',
      unavailable: '暂时无法加载职位信息，请稍后再试。',
      backToCareers: '查看所有职位',
      privacyNote: 'ShoreVest 依据其招聘隐私声明处理招聘信息。招聘沟通仅通过 ShoreVest 官方渠道进行，ShoreVest 绝不会要求候选人支付任何费用。',
      employmentType: { 'Full-time': '全职', 'Part-time': '兼职', Internship: '实习', Contract: '合同制' },
      applyPage: 'apply_cn.html'
    }
  };

  function getLocale(doc) {
    var lang = doc && doc.documentElement ? doc.documentElement.lang : '';
    return SUPPORTED_LOCALES[lang] ? lang : null;
  }

  function isValidRoleId(roleId) {
    return typeof roleId === 'string' && /^[a-z0-9][a-z0-9-]{2,80}$/.test(roleId);
  }

  function findRole(manifest, roleId) {
    if (!manifest || !Array.isArray(manifest.roles)) return null;
    for (var i = 0; i < manifest.roles.length; i += 1) {
      if (manifest.roles[i] && manifest.roles[i].roleId === roleId) return manifest.roles[i];
    }
    return null;
  }

  function deadlineHasPassed(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
    var iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T23:59:59Z' : value;
    var time = Date.parse(iso);
    return !isNaN(time) && time < Date.now();
  }

  function el(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (typeof text === 'string' && text !== '') node.textContent = text;
    return node;
  }

  function appendList(doc, parent, heading, items) {
    if (!Array.isArray(items)) return;
    var clean = items.filter(function (item) { return typeof item === 'string' && item.trim() !== ''; });
    if (!clean.length) return;
    parent.appendChild(el(doc, 'h3', null, heading));
    var list = el(doc, 'ul', 'careers-list');
    clean.forEach(function (item) { list.appendChild(el(doc, 'li', null, item)); });
    parent.appendChild(list);
  }

  // Render a single neutral status message (used for not-found, unavailable, closed).
  function renderStatusOnly(doc, hero, body, strings, message) {
    hero.replaceChildren(
      el(doc, 'p', 'careers-eyebrow', strings.eyebrow),
      el(doc, 'h1', 'careers-title', strings.eyebrow)
    );
    var copy = el(doc, 'div', 'careers-copy' + (strings === STRINGS['zh-CN'] ? ' careers-copy--cn' : ''));
    copy.appendChild(el(doc, 'p', 'careers-pending', message));
    var back = el(doc, 'a', 'sv-textlink', strings.backToCareers);
    back.href = strings === STRINGS['zh-CN'] ? '../careers_cn.html' : 'https://shorevest.github.io/website/careers/?t=';
    copy.appendChild(back);
    var wrap = el(doc, 'div', 'sv-shell careers-two-col');
    var head = el(doc, 'div');
    head.appendChild(el(doc, 'h2', 'careers-h2', strings.eyebrow));
    wrap.appendChild(head);
    wrap.appendChild(copy);
    body.replaceChildren(wrap);
  }

  function buildMeta(role, localized, strings) {
    var parts = [];
    if (typeof localized.team === 'string' && localized.team.trim()) parts.push(localized.team);
    if (typeof localized.location === 'string' && localized.location.trim()) parts.push(localized.location);
    var employmentLabel = strings.employmentType[role.employmentType];
    if (employmentLabel) parts.push(employmentLabel);
    return parts.join(' · ');
  }

  function renderRole(doc, hero, body, strings, locale, role, localized) {
    var isCn = locale === 'zh-CN';
    var status = role.status;
    var closed = Object.prototype.hasOwnProperty.call(CLOSED_STATUSES, status);
    var active = Object.prototype.hasOwnProperty.call(ACTIVE_STATUSES, status);
    // Applications open only when the role is active, enabled, and the deadline has not passed.
    var applyOpen = active && role.applicationEnabled === true && !deadlineHasPassed(role.applicationDeadline);

    // --- Hero -------------------------------------------------------------------------
    var heroChildren = [
      el(doc, 'p', 'careers-eyebrow', strings.eyebrow),
      el(doc, 'h1', 'careers-title', localized.title)
    ];
    var meta = buildMeta(role, localized, strings);
    if (meta) heroChildren.push(el(doc, 'p', 'careers-hero__meta', meta));
    hero.replaceChildren.apply(hero, heroChildren);

    // --- Body -------------------------------------------------------------------------
    var wrap = el(doc, 'div', 'sv-shell careers-two-col');
    var head = el(doc, 'div');
    head.appendChild(el(doc, 'h2', 'careers-h2', strings.overview));
    wrap.appendChild(head);

    var copy = el(doc, 'div', 'careers-copy' + (isCn ? ' careers-copy--cn' : ''));

    if (typeof localized.summary === 'string' && localized.summary.trim()) {
      copy.appendChild(el(doc, 'p', null, localized.summary));
    }

    appendList(doc, copy, strings.responsibilities, localized.responsibilities);
    appendList(doc, copy, strings.requirements, localized.requirements);
    appendList(doc, copy, strings.preferred, localized.preferredQualifications);

    // Reporting line: only when present and explicitly approved.
    if (role.reportingLine && role.reportingLine.approved === true && role.reportingLine.locales && role.reportingLine.locales[locale]) {
      copy.appendChild(el(doc, 'h3', null, strings.reportingLine));
      copy.appendChild(el(doc, 'p', null, role.reportingLine.locales[locale]));
    }

    // Deadline: only when present.
    if (typeof role.applicationDeadline === 'string' && role.applicationDeadline.trim()) {
      copy.appendChild(el(doc, 'h3', null, strings.deadline));
      copy.appendChild(el(doc, 'p', null, role.applicationDeadline.slice(0, 10)));
    }

    // Application status + apply control or neutral message.
    copy.appendChild(el(doc, 'h3', null, strings.applicationStatus));
    if (closed) {
      copy.appendChild(el(doc, 'p', 'careers-pending', strings.closed));
    } else if (applyOpen) {
      var apply = el(doc, 'a', 'careers-action', strings.apply);
      apply.href = strings.applyPage + '?role=' + encodeURIComponent(role.roleId) + '&source=website';
      copy.appendChild(apply);
    } else {
      copy.appendChild(el(doc, 'p', 'careers-pending', strings.disabled));
    }

    copy.appendChild(el(doc, 'p', 'careers-meta-note', strings.privacyNote));

    wrap.appendChild(copy);
    body.replaceChildren(wrap);
  }

  // Pure render entry point. Returns a short status string for testing.
  function renderRoleDetail(doc, manifest, options) {
    options = options || {};
    var hero = doc.querySelector('[data-role-detail="hero"]');
    var body = doc.querySelector('[data-role-detail="body"]');
    var locale = options.locale || getLocale(doc);
    if (!hero || !body || !locale) return 'no-target';
    var strings = STRINGS[locale];

    var roleId = options.roleId;
    if (!isValidRoleId(roleId)) {
      renderStatusOnly(doc, hero, body, strings, strings.notFound);
      return 'invalid-role';
    }
    if (manifest === null || manifest === undefined) {
      renderStatusOnly(doc, hero, body, strings, strings.unavailable);
      return 'unavailable';
    }
    var role = findRole(manifest, roleId);
    if (!role) {
      renderStatusOnly(doc, hero, body, strings, strings.notFound);
      return 'not-found';
    }
    var localized = role.locales ? role.locales[locale] : null;
    if (!localized || typeof localized.title !== 'string' || localized.title.trim() === '') {
      renderStatusOnly(doc, hero, body, strings, strings.notFound);
      return 'missing-locale';
    }
    // Draft roles are not publicly viewable through a direct URL.
    if (role.status === 'draft') {
      renderStatusOnly(doc, hero, body, strings, strings.notFound);
      return 'draft';
    }
    renderRole(doc, hero, body, strings, locale, role, localized);
    if (Object.prototype.hasOwnProperty.call(CLOSED_STATUSES, role.status)) return 'closed';
    if (role.applicationEnabled === true && !deadlineHasPassed(role.applicationDeadline)) return 'apply-open';
    return 'disabled';
  }

  function getRoleId(doc) {
    var body = doc.body;
    return body ? body.getAttribute('data-recruitment-role-id') : null;
  }

  function getManifestPath(doc) {
    var body = doc.body;
    var override = body ? body.getAttribute('data-recruitment-manifest') : null;
    return override || DEFAULT_MANIFEST_PATH;
  }

  function initRoleDetail(win) {
    var doc = win.document;
    if (!doc || !doc.querySelector('[data-role-detail="hero"]')) return Promise.resolve('no-target');
    var roleId = getRoleId(doc);
    var locale = getLocale(doc);
    if (!locale) return Promise.resolve('no-locale');
    if (typeof win.fetch !== 'function') {
      renderRoleDetail(doc, null, { roleId: roleId, locale: locale });
      return Promise.resolve('no-fetch');
    }
    return win.fetch(getManifestPath(doc), { credentials: 'same-origin' })
      .then(function (response) {
        if (!response || !response.ok) throw new Error('Manifest unavailable');
        return response.json();
      })
      .then(function (manifest) {
        return renderRoleDetail(doc, manifest, { roleId: roleId, locale: locale });
      })
      .catch(function () {
        return renderRoleDetail(doc, null, { roleId: roleId, locale: locale });
      });
  }

  if (typeof window !== 'undefined' && window.document) {
    initRoleDetail(window);
  }

  return {
    initRoleDetail: initRoleDetail,
    renderRoleDetail: renderRoleDetail,
    isValidRoleId: isValidRoleId,
    deadlineHasPassed: deadlineHasPassed,
    DEFAULT_MANIFEST_PATH: DEFAULT_MANIFEST_PATH
  };
});
