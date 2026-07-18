(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.ShoreVestRecruitmentApplication = factory();
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var DEFAULT_MANIFEST_PATH = '../assets/data/recruitment/roles.v1.json';
  var SUPPORTED_LOCALES = { en: true, 'zh-CN': true };
  var SOURCE_ALLOWLIST = { website: true, linkedin: true, direct: true, other: true };
  var DEFAULT_SOURCE = 'direct';
  var PRIVACY_NOTICE_VERSION = 'recruitment-privacy-draft-2026-07';
  var APPLICATION_PAGE_VERSION = '2026-07-18';

  // Neutral, localized candidate-facing copy. No internal detail is ever surfaced.
  var STRINGS = {
    en: {
      notFound: 'This position could not be found.',
      disabled: 'Applications are not currently being accepted for this position.',
      closed: 'This position is no longer accepting applications.',
      unavailable: 'Role information could not be loaded. Please try again later.',
      errorSummaryTitle: 'Please correct the following before submitting:',
      required: 'This field is required.',
      invalidEmail: 'Please enter a valid email address.',
      invalidLinkedin: 'Please enter a valid LinkedIn profile URL.',
      invalidPhone: 'Please enter a valid telephone number.',
      privacyRequired: 'Please acknowledge the privacy statement to continue.',
      fileMissing: 'Please attach your CV.',
      fileType: 'Please upload a PDF, DOC or DOCX file.',
      fileSize: 'The selected file exceeds the 10 MB limit.',
      fileMultiple: 'Please attach a single CV file only.',
      submitting: 'Submitting…',
      submit: 'Submit application',
      genericFailure: 'Your application could not be submitted. Please review the form and try again.',
      rateLimited: 'Too many submission attempts were received. Please try again later.',
      networkFailure: 'Your application could not be submitted. Please check your connection and try again.',
      backendUnavailable: 'Applications cannot be submitted at this time. Please try again later.',
      successTitle: 'Application received',
      successBody: 'Your application has been submitted successfully. Please retain the application reference below for your records.',
      successReference: 'Application reference:',
      successFollowup: 'ShoreVest will contact candidates selected for the next stage.'
    },
    'zh-CN': {
      notFound: '未能找到该职位。',
      disabled: '该职位目前暂不接受申请。',
      closed: '该职位已停止接受申请。',
      unavailable: '暂时无法加载职位信息，请稍后再试。',
      errorSummaryTitle: '提交前请更正以下内容：',
      required: '此项为必填项。',
      invalidEmail: '请输入有效的电子邮箱地址。',
      invalidLinkedin: '请输入有效的 LinkedIn 个人主页链接。',
      invalidPhone: '请输入有效的电话号码。',
      privacyRequired: '请确认隐私声明后继续。',
      fileMissing: '请上传您的简历。',
      fileType: '请上传 PDF、DOC 或 DOCX 文件。',
      fileSize: '所选文件超过 10 MB 上限。',
      fileMultiple: '请仅上传一份简历文件。',
      submitting: '正在提交……',
      submit: '提交申请',
      genericFailure: '您的申请未能提交，请检查表单后重试。',
      rateLimited: '收到的提交尝试过多，请稍后再试。',
      networkFailure: '您的申请未能提交，请检查网络连接后重试。',
      backendUnavailable: '目前无法提交申请，请稍后再试。',
      successTitle: '申请已收到',
      successBody: '您的申请已成功提交。请保留下方的申请编号以备查询。',
      successReference: '申请编号：',
      successFollowup: 'ShoreVest 将联系进入下一轮的候选人。'
    }
  };

  // Backend error codes → neutral candidate-facing message keys. Infrastructure detail
  // (storage, Graph, SharePoint, stack traces) is never mapped through.
  var ERROR_CODE_MESSAGES = {
    ROLE_NOT_FOUND: 'notFound',
    ROLE_NOT_OPEN: 'disabled',
    ROLE_CLOSED: 'closed',
    APPLICATION_DEADLINE_PASSED: 'disabled',
    VALIDATION_FAILED: 'genericFailure',
    FILE_MISSING: 'fileMissing',
    FILE_TYPE_REJECTED: 'fileType',
    FILE_TOO_LARGE: 'fileSize',
    FILE_SIGNATURE_REJECTED: 'fileType',
    RATE_LIMITED: 'rateLimited',
    MALWARE_SCAN_FAILED: 'genericFailure',
    STORAGE_FAILED: 'genericFailure',
    SUBMISSION_FAILED: 'genericFailure'
  };

  function getLocale(doc) {
    var lang = doc && doc.documentElement ? doc.documentElement.lang : '';
    return SUPPORTED_LOCALES[lang] ? lang : null;
  }

  function isValidRoleId(roleId) {
    return typeof roleId === 'string' && /^[a-z0-9][a-z0-9-]{2,80}$/.test(roleId);
  }

  // Referral source is strictly allowlisted; anything unknown/missing collapses to 'direct'.
  // The raw query value is never rendered, reflected, or executed.
  function normalizeSource(raw) {
    if (typeof raw === 'string' && Object.prototype.hasOwnProperty.call(SOURCE_ALLOWLIST, raw)) return raw;
    return DEFAULT_SOURCE;
  }

  // Parse role and source from a query string without trusting any other parameter.
  function parseParams(search) {
    var role = null;
    var source = DEFAULT_SOURCE;
    if (typeof search === 'string') {
      var query = search.charAt(0) === '?' ? search.slice(1) : search;
      query.split('&').forEach(function (pair) {
        if (!pair) return;
        var idx = pair.indexOf('=');
        var key = idx === -1 ? pair : pair.slice(0, idx);
        var value = idx === -1 ? '' : decodeURIComponent(pair.slice(idx + 1).replace(/\+/g, ' '));
        if (key === 'role') role = value;
        else if (key === 'source') source = normalizeSource(value);
      });
    }
    return { role: role, source: source };
  }

  function deadlineHasPassed(value, now) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
    var iso = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value + 'T23:59:59Z' : value;
    var time = Date.parse(iso);
    return !isNaN(time) && time < (now ? now.getTime() : Date.now());
  }

  function getCvRules(role) {
    if (!role || !Array.isArray(role.files)) return null;
    for (var i = 0; i < role.files.length; i += 1) {
      if (role.files[i] && role.files[i].filePurpose === 'cv') return role.files[i];
    }
    return null;
  }

  // Resolve whether a role may accept an application in the current locale. Returns a reason
  // code used both for gating the UI and for choosing the neutral message.
  function resolveRole(manifest, roleId, locale, now) {
    if (!isValidRoleId(roleId)) return { ok: false, reason: 'notFound' };
    if (!manifest || !Array.isArray(manifest.roles)) return { ok: false, reason: 'unavailable' };
    var role = null;
    for (var i = 0; i < manifest.roles.length; i += 1) {
      if (manifest.roles[i] && manifest.roles[i].roleId === roleId) { role = manifest.roles[i]; break; }
    }
    if (!role) return { ok: false, reason: 'notFound' };
    if (role.status === 'closed' || role.status === 'archived') return { ok: false, reason: 'closed' };
    if (role.status !== 'active') return { ok: false, reason: 'notFound' };
    var localized = role.locales ? role.locales[locale] : null;
    if (!localized || typeof localized.title !== 'string' || localized.title.trim() === '') return { ok: false, reason: 'notFound' };
    var cvRules = getCvRules(role);
    if (!cvRules || cvRules.required !== true || !Array.isArray(cvRules.allowedExtensions) || !cvRules.allowedExtensions.length) {
      return { ok: false, reason: 'disabled' };
    }
    if (role.applicationEnabled !== true) return { ok: false, reason: 'disabled' };
    if (deadlineHasPassed(role.applicationDeadline, now)) return { ok: false, reason: 'disabled' };
    return { ok: true, role: role, localized: localized, cvRules: cvRules };
  }

  function isValidEmail(value) {
    return typeof value === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254;
  }

  function isValidPhone(value) {
    return typeof value === 'string' && /^[+()\d][\d\s()\-]{5,24}$/.test(value.trim());
  }

  function isValidLinkedin(value) {
    if (typeof value !== 'string') return false;
    var trimmed = value.trim();
    if (!/^https:\/\//i.test(trimmed)) return false;
    return /(^|\.)linkedin\.[a-z.]{2,}\//i.test(trimmed) && trimmed.length <= 300;
  }

  function extensionOf(name) {
    if (typeof name !== 'string') return '';
    var dot = name.lastIndexOf('.');
    return dot === -1 ? '' : name.slice(dot).toLowerCase();
  }

  // Client-side file check is a usability aid only; the backend must repeat every check and
  // add real signature/malware validation. fileMeta: { name, type, size } or array.
  function validateFileClientSide(fileList, cvRules) {
    if (!fileList || fileList.length === 0) return 'fileMissing';
    if (fileList.length > 1) return 'fileMultiple';
    var file = fileList[0];
    var ext = extensionOf(file.name);
    var exts = (cvRules && cvRules.allowedExtensions) || ['.pdf', '.doc', '.docx'];
    var mimes = (cvRules && cvRules.allowedMimeTypes) || [];
    var maxBytes = (cvRules && cvRules.maxSizeBytes) || 10485760;
    if (exts.indexOf(ext) === -1) return 'fileType';
    // Some browsers send an empty type; extension has already gated, so only reject a
    // present-but-disallowed MIME type.
    if (file.type && mimes.length && mimes.indexOf(file.type) === -1) return 'fileType';
    if (typeof file.size === 'number' && file.size > maxBytes) return 'fileSize';
    return null;
  }

  // Validate all candidate-entered fields. Returns { valid, errors: { fieldName: messageKey } }
  // preserving field order for the error summary. Never mutates or stores the values.
  function validateForm(values, fileList, cvRules) {
    var errors = {};
    if (!values || typeof values.fullName !== 'string' || values.fullName.trim() === '') errors.fullName = 'required';
    if (!values || typeof values.email !== 'string' || values.email.trim() === '') errors.email = 'required';
    else if (!isValidEmail(values.email.trim())) errors.email = 'invalidEmail';
    if (!values || typeof values.location !== 'string' || values.location.trim() === '') errors.location = 'required';
    if (values && typeof values.telephone === 'string' && values.telephone.trim() !== '' && !isValidPhone(values.telephone)) errors.telephone = 'invalidPhone';
    if (values && typeof values.linkedinUrl === 'string' && values.linkedinUrl.trim() !== '' && !isValidLinkedin(values.linkedinUrl)) errors.linkedinUrl = 'invalidLinkedin';
    if (!values || typeof values.applicationStatement !== 'string' || values.applicationStatement.trim() === '') errors.applicationStatement = 'required';
    var fileError = validateFileClientSide(fileList, cvRules);
    if (fileError) errors.cv = fileError;
    if (!values || values.privacyAccepted !== true) errors.privacyAccepted = 'privacyRequired';
    return { valid: Object.keys(errors).length === 0, errors: errors };
  }

  // The exact multipart field set the backend contract expects. roleTitle/roleTeam/
  // roleLocation come from the authoritative manifest (never from the URL) and are
  // treated by the backend as untrusted debug hints.
  function buildSubmissionFields(context, values) {
    return {
      roleId: context.roleId,
      roleTitle: context.roleTitle,
      roleTeam: context.roleTeam,
      roleLocation: context.roleLocation,
      locale: context.locale,
      source: context.source,
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      telephone: (values.telephone || '').trim(),
      location: values.location.trim(),
      linkedinUrl: (values.linkedinUrl || '').trim(),
      applicationStatement: values.applicationStatement.trim(),
      privacyAccepted: 'true',
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
      submittedAtClientUtc: context.submittedAtClientUtc || new Date().toISOString()
    };
  }

  function messageForErrorCode(code, strings) {
    var key = ERROR_CODE_MESSAGES[code] || 'genericFailure';
    return strings[key];
  }

  // ------------------------------------------------------------------------------------
  // DOM wiring
  // ------------------------------------------------------------------------------------

  function text(el, value) { if (el) el.textContent = value; }

  function isProductionHost(win) {
    var host = win && win.location && win.location.hostname ? win.location.hostname : '';
    return host !== '' && host !== 'localhost' && host !== '127.0.0.1' && host !== '::1';
  }

  // A development-only success mock. It is impossible to enable in production: it requires
  // both an explicit opt-in attribute AND a non-production host.
  function mockEnabled(doc, win) {
    var body = doc.body;
    var opted = body && body.getAttribute('data-recruitment-mock') === 'true';
    return Boolean(opted) && !isProductionHost(win);
  }

  function getEndpoint(doc) {
    var body = doc.body;
    var value = body ? body.getAttribute('data-recruitment-endpoint') : null;
    return value && value.trim() !== '' ? value.trim() : null;
  }

  function showGatingState(doc, reason, strings) {
    var form = doc.querySelector('[data-application-form]');
    var stateEl = doc.querySelector('[data-application-state]');
    if (form && typeof form.setAttribute === 'function') form.setAttribute('hidden', 'hidden');
    if (stateEl) {
      text(stateEl, strings[reason] || strings.notFound);
      stateEl.removeAttribute && stateEl.removeAttribute('hidden');
    }
    return reason;
  }

  function populateRoleContext(doc, context, localized, strings) {
    text(doc.querySelector('[data-application-role-title]'), localized.title);
    var metaParts = [];
    if (localized.team) metaParts.push(localized.team);
    if (localized.location) metaParts.push(localized.location);
    text(doc.querySelector('[data-application-role-meta]'), metaParts.join(' · '));
    if (localized.applicationStatementPrompt) {
      text(doc.querySelector('[data-application-statement-prompt]'), localized.applicationStatementPrompt);
    }
    // Hidden auto-submitted fields.
    setHidden(doc, 'roleId', context.roleId);
    setHidden(doc, 'roleTitle', context.roleTitle);
    setHidden(doc, 'roleTeam', context.roleTeam);
    setHidden(doc, 'roleLocation', context.roleLocation);
    setHidden(doc, 'locale', context.locale);
    setHidden(doc, 'source', context.source);
    setHidden(doc, 'privacyNoticeVersion', PRIVACY_NOTICE_VERSION);
    setHidden(doc, 'applicationPageVersion', APPLICATION_PAGE_VERSION);
  }

  function setHidden(doc, name, value) {
    var el = doc.querySelector('[data-hidden-field="' + name + '"]');
    if (el && typeof el.setAttribute === 'function') el.setAttribute('value', value == null ? '' : String(value));
  }

  // renderApplication is the pure-ish entry point: it decides gating and, when open, prepares
  // the form. Returns a status string for tests.
  function renderApplication(doc, manifest, options) {
    options = options || {};
    var locale = options.locale || getLocale(doc);
    if (!locale) return 'no-locale';
    var strings = STRINGS[locale];
    var roleId = options.roleId;
    var source = normalizeSource(options.source);

    if (manifest === null || manifest === undefined) {
      showGatingState(doc, 'unavailable', strings);
      return 'unavailable';
    }
    var resolved = resolveRole(manifest, roleId, locale, options.now);
    if (!resolved.ok) {
      showGatingState(doc, resolved.reason, strings);
      return resolved.reason;
    }

    var context = {
      roleId: resolved.role.roleId,
      roleTitle: resolved.localized.title,
      roleTeam: resolved.localized.team || '',
      roleLocation: resolved.localized.location || '',
      locale: locale,
      source: source
    };
    populateRoleContext(doc, context, resolved.localized, strings);

    var stateEl = doc.querySelector('[data-application-state]');
    if (stateEl && stateEl.setAttribute) stateEl.setAttribute('hidden', 'hidden');
    var form = doc.querySelector('[data-application-form]');
    if (form && form.removeAttribute) form.removeAttribute('hidden');

    return 'open';
  }

  function readValues(doc) {
    function val(name) {
      var el = doc.querySelector('[data-field="' + name + '"]');
      return el ? (el.value || '') : '';
    }
    var privacyEl = doc.querySelector('[data-field="privacyAccepted"]');
    return {
      fullName: val('fullName'),
      email: val('email'),
      location: val('location'),
      telephone: val('telephone'),
      linkedinUrl: val('linkedinUrl'),
      applicationStatement: val('applicationStatement'),
      privacyAccepted: Boolean(privacyEl && privacyEl.checked)
    };
  }

  function clearFieldErrors(doc) {
    var marked = doc.querySelectorAll ? doc.querySelectorAll('[data-field-error]') : [];
    Array.prototype.forEach.call(marked, function (el) { text(el, ''); });
    var inputs = doc.querySelectorAll ? doc.querySelectorAll('[data-field]') : [];
    Array.prototype.forEach.call(inputs, function (el) {
      if (el.removeAttribute) { el.removeAttribute('aria-invalid'); }
    });
  }

  function showErrorSummary(doc, errors, strings) {
    var summary = doc.querySelector('[data-application-errors]');
    if (summary) {
      summary.textContent = '';
      var title = doc.createElement('p');
      title.textContent = strings.errorSummaryTitle;
      summary.appendChild(title);
      var list = doc.createElement('ul');
      Object.keys(errors).forEach(function (field) {
        var li = doc.createElement('li');
        li.textContent = strings[errors[field]] || strings.required;
        list.appendChild(li);
        var fieldError = doc.querySelector('[data-field-error="' + field + '"]');
        if (fieldError) text(fieldError, strings[errors[field]] || strings.required);
        var input = doc.querySelector('[data-field="' + field + '"]');
        if (input && input.setAttribute) input.setAttribute('aria-invalid', 'true');
      });
      summary.appendChild(list);
      if (summary.removeAttribute) summary.removeAttribute('hidden');
      if (summary.focus) summary.focus();
    }
  }

  function hideErrorSummary(doc) {
    var summary = doc.querySelector('[data-application-errors]');
    if (summary) { summary.textContent = ''; if (summary.setAttribute) summary.setAttribute('hidden', 'hidden'); }
  }

  function showSuccess(doc, reference, strings) {
    var form = doc.querySelector('[data-application-form]');
    if (form && form.setAttribute) form.setAttribute('hidden', 'hidden');
    var success = doc.querySelector('[data-application-success]');
    if (success) {
      success.textContent = '';
      var h = doc.createElement('h2');
      h.textContent = strings.successTitle;
      success.appendChild(h);
      var p = doc.createElement('p');
      p.textContent = strings.successBody;
      success.appendChild(p);
      var ref = doc.createElement('p');
      ref.className = 'careers-application__reference';
      var refLabel = doc.createElement('strong');
      refLabel.textContent = strings.successReference + ' ';
      ref.appendChild(refLabel);
      // The backend-issued, non-sensitive reference is inserted as text only.
      ref.appendChild(doc.createTextNode(String(reference)));
      success.appendChild(ref);
      var follow = doc.createElement('p');
      follow.textContent = strings.successFollowup;
      success.appendChild(follow);
      if (success.removeAttribute) success.removeAttribute('hidden');
      if (success.focus) success.focus();
    }
  }

  function setSubmitting(doc, submitting, strings) {
    var button = doc.querySelector('[data-application-submit]');
    if (!button) return;
    if (submitting) {
      button.setAttribute('disabled', 'disabled');
      button.setAttribute('aria-busy', 'true');
      text(button, strings.submitting);
    } else {
      button.removeAttribute('disabled');
      button.removeAttribute('aria-busy');
      text(button, strings.submit);
    }
  }

  function showSubmissionError(doc, messageKeyOrText, strings) {
    var errorEl = doc.querySelector('[data-application-submit-error]');
    if (errorEl) {
      text(errorEl, strings[messageKeyOrText] || messageKeyOrText);
      if (errorEl.removeAttribute) errorEl.removeAttribute('hidden');
    }
  }

  function buildFormData(win, fields, file) {
    var fd = new win.FormData();
    Object.keys(fields).forEach(function (key) { fd.append(key, fields[key]); });
    if (file) fd.append('cv', file);
    return fd;
  }

  // Perform the submission. Honesty rule: never show success unless the backend explicitly
  // confirms it. When no endpoint is configured, show a neutral failure — never fake success.
  function submitApplication(deps) {
    var doc = deps.doc;
    var win = deps.win;
    var strings = deps.strings;
    var context = deps.context;
    var values = readValues(doc);
    var fileEl = doc.querySelector('[data-field="cv"]');
    var fileList = fileEl && fileEl.files ? fileEl.files : [];

    hideErrorSummary(doc);
    var result = validateForm(values, fileList, context.cvRules);
    if (!result.valid) {
      showErrorSummary(doc, result.errors, strings);
      return Promise.resolve('invalid');
    }

    var endpoint = deps.endpoint;
    var mock = deps.mock;
    if (!endpoint && !mock) {
      // No backend configured. Do not pretend the application was received.
      showSubmissionError(doc, 'backendUnavailable', strings);
      return Promise.resolve('no-backend');
    }

    setSubmitting(doc, true, strings);
    var fields = buildSubmissionFields(context, values);

    if (mock && !endpoint) {
      // Development-only echo. Never reachable in production (see mockEnabled()).
      setSubmitting(doc, false, strings);
      showSuccess(doc, 'DEV-MOCK-REFERENCE', strings);
      return Promise.resolve('mock-success');
    }

    var formData = buildFormData(win, fields, fileList[0]);
    return win.fetch(endpoint, { method: 'POST', body: formData, credentials: 'same-origin' })
      .then(function (response) {
        return response.json().then(function (body) { return { response: response, body: body }; }, function () { return { response: response, body: null }; });
      })
      .then(function (payload) {
        setSubmitting(doc, false, strings);
        var body = payload.body;
        if (payload.response && payload.response.ok && body && body.success === true && body.applicationReference) {
          showSuccess(doc, body.applicationReference, strings);
          return 'success';
        }
        if (body && body.errorCode) {
          showSubmissionError(doc, messageForErrorCode(body.errorCode, strings), strings);
          return 'error:' + body.errorCode;
        }
        showSubmissionError(doc, 'genericFailure', strings);
        return 'error';
      })
      .catch(function () {
        // Network or parse failure. Keep the entered data in memory; never fake success.
        setSubmitting(doc, false, strings);
        showSubmissionError(doc, 'networkFailure', strings);
        return 'network-error';
      });
  }

  function attachSubmitHandler(doc, win, context, strings, endpoint, mock) {
    var form = doc.querySelector('[data-application-form]');
    if (!form || !form.addEventListener) return;
    var inFlight = false;
    form.addEventListener('submit', function (event) {
      if (event && event.preventDefault) event.preventDefault();
      if (inFlight) return; // Prevent duplicate submissions.
      inFlight = true;
      submitApplication({ doc: doc, win: win, strings: strings, context: context, endpoint: endpoint, mock: mock })
        .then(function () { inFlight = false; })
        .catch(function () { inFlight = false; });
    });
  }

  function getManifestPath(doc) {
    var body = doc.body;
    var override = body ? body.getAttribute('data-recruitment-manifest') : null;
    return override || DEFAULT_MANIFEST_PATH;
  }

  function initApplication(win) {
    var doc = win.document;
    if (!doc || !doc.querySelector('[data-application-form]')) return Promise.resolve('no-form');
    var locale = getLocale(doc);
    if (!locale) return Promise.resolve('no-locale');
    var strings = STRINGS[locale];
    var params = parseParams(win.location ? win.location.search : '');
    var endpoint = getEndpoint(doc);
    var mock = mockEnabled(doc, win);

    if (typeof win.fetch !== 'function') {
      renderApplication(doc, null, { roleId: params.role, source: params.source, locale: locale });
      return Promise.resolve('no-fetch');
    }

    return win.fetch(getManifestPath(doc), { credentials: 'same-origin' })
      .then(function (response) {
        if (!response || !response.ok) throw new Error('Manifest unavailable');
        return response.json();
      })
      .then(function (manifest) {
        var status = renderApplication(doc, manifest, { roleId: params.role, source: params.source, locale: locale });
        if (status === 'open') {
          var resolved = resolveRole(manifest, params.role, locale);
          var localized = resolved.localized;
          var context = {
            roleId: resolved.role.roleId,
            roleTitle: localized.title,
            roleTeam: localized.team || '',
            roleLocation: localized.location || '',
            locale: locale,
            source: params.source,
            cvRules: resolved.cvRules
          };
          attachSubmitHandler(doc, win, context, strings, endpoint, mock);
        }
        return status;
      })
      .catch(function () {
        return renderApplication(doc, null, { roleId: params.role, source: params.source, locale: locale });
      });
  }

  if (typeof window !== 'undefined' && window.document) {
    initApplication(window);
  }

  return {
    initApplication: initApplication,
    renderApplication: renderApplication,
    submitApplication: submitApplication,
    resolveRole: resolveRole,
    normalizeSource: normalizeSource,
    parseParams: parseParams,
    validateForm: validateForm,
    validateFileClientSide: validateFileClientSide,
    isValidEmail: isValidEmail,
    isValidLinkedin: isValidLinkedin,
    isValidPhone: isValidPhone,
    buildSubmissionFields: buildSubmissionFields,
    messageForErrorCode: messageForErrorCode,
    mockEnabled: mockEnabled,
    isProductionHost: isProductionHost,
    deadlineHasPassed: deadlineHasPassed,
    PRIVACY_NOTICE_VERSION: PRIVACY_NOTICE_VERSION,
    APPLICATION_PAGE_VERSION: APPLICATION_PAGE_VERSION,
    DEFAULT_SOURCE: DEFAULT_SOURCE,
    SUPPORTED_SOURCES: Object.keys(SOURCE_ALLOWLIST),
    ERROR_CODE_MESSAGES: ERROR_CODE_MESSAGES
  };
});
