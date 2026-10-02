'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const client = require('../assets/js/recruitment-application');
const manifest = require('../assets/data/recruitment/roles.v1.json');
const { createMemoryAdapters } = require('../api/recruitment/core/inMemoryAdapters');
const flows = require('../api/recruitment/core/flows');
const { NOTIFICATION_EVENTS } = require('../api/recruitment/core/constants');

// Exercise the actual browser entry point against the committed core protocol.
// All candidates, files, tokens and requests below are isolated test fixtures.
class Element {
  constructor() { this.hidden = true; this.attributes = {}; this.children = []; this.listeners = {}; this.value = ''; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key]; }
  removeAttribute(key) { delete this.attributes[key]; }
  appendChild(child) { this.children.push(child); }
  replaceChildren() { this.children = []; }
  addEventListener(type, handler) { this.listeners[type] = handler; }
  focus() { this.focused = true; }
  set textContent(value) { this.text = value; this.children = []; }
  get textContent() { return (this.text || '') + this.children.map(child => child.textContent).join(''); }
}

function harness(options = {}) {
  const deps = createMemoryAdapters({ manifest, now: () => new Date() });
  const elements = new Map();
  const fields = new Map();
  const errors = new Map();
  const bytes = Buffer.from('%PDF-test');
  const file = { name: 'synthetic-test.pdf', type: 'application/pdf', size: bytes.length, bytes };
  const values = {
    fullName: 'Synthetic Test', email: 'synthetic@shorevest.com', telephone: '+447700900000',
    currentLocation: 'Synthetic location', linkedinUrl: '', coverNote: 'Synthetic application.',
    willingGuangzhou: 'Yes', workAuthorization: 'Yes', earliestStartDate: 'Immediate',
    chineseProficiency: 'Professional', englishProficiency: 'Native',
    privacyAccepted: '', accuracyConfirmed: '', cv: ''
  };
  for (const [name, value] of Object.entries(values)) {
    const field = new Element(); field.value = value; field.checked = true;
    if (name === 'cv') field.files = [file];
    fields.set(name, field); errors.set(name, new Element());
  }
  errors.set('turnstile', new Element());
  for (const key of ['form', 'intro', 'state', 'errors', 'success', 'submit', 'submit-error', 'role-title', 'role-meta']) {
    elements.set(`[data-application-${key}]`, new Element());
  }
  elements.set('[data-turnstile]', new Element());
  const links = [new Element(), new Element()];
  links.forEach(link => link.setAttribute('data-application-language', options.lang === 'zh-CN' ? 'en' : 'zh-CN'));
  const doc = {
    documentElement: { lang: options.lang || 'en' },
    querySelector(selector) {
      const field = selector.match(/^\[data-field="([^"]+)"\]$/);
      if (field) return fields.get(field[1]);
      const error = selector.match(/^\[data-field-error="([^"]+)"\]$/);
      return error ? errors.get(error[1]) : elements.get(selector);
    },
    querySelectorAll(selector) {
      if (selector === '[data-field]') return [...fields.values()];
      if (selector === '[data-field-error]') return [...errors.values()];
      if (selector === '[data-application-language]') return links;
      return [];
    },
    createElement() { return new Element(); }
  };
  const calls = [];
  const timers = [];
  let started, injected = false, turnstileOptions;
  const response = body => ({ ok: true, status: 200, json: async () => body });
  const win = {
    document: doc, location: { search: '?role=legal-assistant&source=linkedin' },
    crypto: { randomUUID }, setTimeout: fn => timers.push(fn),
    turnstile: {
      render(_target, config) { turnstileOptions = config; config.callback('synthetic-bot-token'); return 1; },
      reset() { turnstileOptions.callback('synthetic-fresh-token'); }
    },
    async fetch(url, init) {
      if (url === client.PUBLIC_CONFIG_PATH) return response({ applicationsEnabled: options.enabled !== false, apiBase: 'https://recruitment.invalid', turnstileSiteKey: 'synthetic-site-key' });
      if (url === client.MANIFEST_PATH) return response(manifest);
      const stage = init.method === 'PUT' ? 'upload' : url.split('/').pop();
      const input = stage === 'upload' ? null : JSON.parse(init.body);
      calls.push({ stage, input });
      let result;
      if (stage === 'initiate') result = started = await flows.initiateApplication(input, deps);
      else if (stage === 'upload') {
        const storedFile = deps.files.get(started.fileReference);
        deps.storage.put('recruitment-quarantine', storedFile.quarantineBlobPath, init.body.bytes, init.body.type);
        result = {};
      } else if (stage === 'complete') result = await flows.completeUpload(input, deps);
      else if (stage === 'finalize') result = await flows.finalizeApplication(input, deps);
      else throw new Error('Unexpected test route');
      if (options.pause && stage === 'finalize') await options.pause;
      if (options.failAt === stage && !injected) {
        injected = true;
        if (options.malformed) return response(options.malformed);
        throw new TypeError('Synthetic lost network response');
      }
      return response(result);
    }
  };
  const form = elements.get('[data-application-form]');
  return {
    win, doc, deps, calls, fields, errors, elements, links, timers, file,
    submit() {
      let prevented = false;
      const result = form.listeners.submit({ preventDefault() { prevented = true; } });
      assert.equal(prevented, true, 'native submission is always prevented');
      return result;
    },
    success() { return elements.get('[data-application-success]'); }
  };
}

test('real client submits through initiate, upload, complete and finalize', async () => {
  const h = harness();
  assert.equal(await client.init(h.win), 'ready');
  await h.submit();
  assert.deepEqual(h.calls.map(call => call.stage), ['initiate', 'upload', 'complete', 'finalize']);
  assert.equal(h.success().hidden, false);
  assert.match(h.success().textContent, /Application received/);
  assert.equal(h.elements.get('[data-application-intro]').hidden, true);
  assert.equal(h.deps.applications.apps.size, 1);
});

for (const stage of ['initiate', 'upload', 'complete', 'finalize']) {
  test(`lost ${stage} response retries the original application without duplicate notifications`, async () => {
    const h = harness({ failAt: stage });
    await client.init(h.win);
    await h.submit();
    assert.equal(h.success().hidden, true, 'a lost response is not a confirmation');
    if (stage === 'finalize') {
      assert.equal(h.fields.get('fullName').disabled, true, 'ambiguous finalization locks the accepted snapshot');
      assert.equal(h.elements.get('[data-application-submit]').textContent, 'Retry submission');
    }
    await h.submit();
    assert.equal(h.success().hidden, false);
    assert.equal(h.deps.applications.apps.size, 1);
    const keys = h.calls.filter(call => call.stage === 'initiate').map(call => call.input.clientSubmissionId);
    assert.equal(new Set(keys).size, 1);
    assert.equal(h.deps.outbox.events.filter(event => event.type === NOTIFICATION_EVENTS.ApplicationReceived).length, 1);
    assert.equal(h.deps.outbox.events.filter(event => event.type === NOTIFICATION_EVENTS.CandidateAcknowledgementRequested).length, 1);
    if (stage === 'complete' || stage === 'finalize') {
      assert.equal(h.calls.filter(call => call.stage === 'upload').length, 1, 'verified upload is not repeated');
    }
  });
}

for (const malformed of [{}, { success: true }, { success: true, applicationReference: 'wrong', fileReference: 'wrong' }]) {
  test(`malformed finalization ${JSON.stringify(malformed)} never displays a confirmation`, async () => {
    const h = harness({ failAt: 'finalize', malformed });
    await client.init(h.win); await h.submit();
    assert.equal(h.success().hidden, true);
    assert.equal(h.elements.get('[data-application-submit-error]').hidden, false);
    await h.submit();
    assert.equal(h.success().hidden, false);
    assert.equal(h.deps.applications.apps.size, 1);
  });
}

test('missing completion token stops before finalization and can resume', async () => {
  const h = harness({ failAt: 'complete', malformed: { success: true } });
  await client.init(h.win); await h.submit();
  assert.equal(h.success().hidden, true);
  assert.equal(h.calls.some(call => call.stage === 'finalize'), false);
  await h.submit();
  assert.equal(h.success().hidden, false);
  assert.equal(h.deps.applications.apps.size, 1);
});

test('concurrent submit clicks issue only one application', async () => {
  let release;
  const pause = new Promise(resolve => { release = resolve; });
  const h = harness({ pause });
  await client.init(h.win);
  const first = h.submit();
  await h.submit();
  release(); await first;
  assert.equal(h.calls.filter(call => call.stage === 'initiate').length, 1);
  assert.equal(h.deps.applications.apps.size, 1);
});

for (const lang of ['en', 'zh-CN']) {
  test(`${lang} desktop and mobile language links retain the role and source even while disabled`, async () => {
    const h = harness({ lang, enabled: false });
    assert.equal(await client.init(h.win), 'disabled');
    const target = lang === 'en' ? '/cn/careers/apply/' : '/careers/apply/';
    for (const link of h.links) assert.equal(link.getAttribute('href'), `${target}?role=legal-assistant&source=linkedin`);
    assert.equal(h.elements.get('[data-application-form]').hidden, true);
    assert.equal(h.elements.get('[data-application-intro]').hidden, true);
    assert.equal(h.calls.length, 0);
    const html = fs.readFileSync(`careers/apply${lang === 'en' ? '' : '_cn'}.html`, 'utf8');
    assert.equal((html.match(/data-application-language=/g) || []).length, 2, 'both actual page controls are wired');
  });
}

test('submit handler is bound while Turnstile is still loading', async () => {
  const h = harness();
  const turnstile = h.win.turnstile;
  delete h.win.turnstile;
  const ready = client.init(h.win);
  // Let only the config/manifest promises settle; leave the verification timer pending.
  for (let i = 0; i < 12; i += 1) await Promise.resolve();
  await h.submit();
  assert.match(h.errors.get('turnstile').textContent, /security verification/);
  assert.equal(h.calls.length, 0);
  h.win.turnstile = turnstile;
  h.timers.shift()();
  await ready;
});

test('client rejects credential-bearing LinkedIn URLs and mismatched file types before upload', async () => {
  assert.equal(client.validLinkedIn('https://user:password@linkedin.com/in/test'), false);
  const h = harness();
  h.file.type = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  await client.init(h.win); await h.submit();
  assert.match(h.errors.get('cv').textContent, /PDF or DOCX/);
  assert.equal(h.calls.length, 0);
});
