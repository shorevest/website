/* ==========================================================================
   ShoreVest One — HR job-opening intake tool

   Demonstration-only workspace for HR to draft new roles for the public careers
   site. Records stay in browser storage and can be exported as JSON for review;
   nothing is published or sent to an external system.
   ========================================================================== */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  var U = SVOps.ui;
  var S = root.SVPortalStore;
  var el = U.el, esc = U.esc;

  function value(node) { return (node.value || '').trim(); }
  function splitLines(text) {
    return String(text || '').split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
  }
  function downloadJson(filename, payload) {
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function rerender() { root.dispatchEvent(new CustomEvent('svops:render')); }

  SVOps.views.jobOpenings = function (container, user) {
    var page = el('div', { class: 'ops-content' });
    page.appendChild(el('div', { class: 'ops-pagehead' }, [
      el('p', { class: 'ops-label', text: 'HR tool' }),
      el('h1', { class: 'ops-h1', text: 'Add a job opening' }),
      el('p', { class: 'ops-lede', text: 'Create a structured recruitment draft for HR review before it is added to the public Careers role data. Demonstration mode stores drafts locally only.' })
    ]));
    page.appendChild(U.notice('info', '<strong>Demonstration</strong> Job openings created here are local ShoreVest One drafts. They are not published to the website and no applicant flow is enabled.'));

    var form = el('div', { class: 'ops-panel' });
    form.appendChild(el('div', { class: 'ops-panel__head' }, [
      el('h2', { class: 'ops-panel__title', text: 'Opening details' })
    ]));

    var title = el('input', { type: 'text', placeholder: 'e.g. Investor Relations Associate' });
    var team = el('input', { type: 'text', placeholder: 'e.g. Investor Relations' });
    var location = el('input', { type: 'text', placeholder: 'e.g. Hong Kong' });
    var employment = el('select', {});
    ['Full-time', 'Part-time', 'Contract', 'Internship'].forEach(function (x) { employment.appendChild(el('option', { value: x, text: x })); });
    var summary = el('textarea', { placeholder: 'Brief role summary for HR and approval review.' });
    var responsibilities = el('textarea', { placeholder: 'One responsibility per line.' });
    var requirements = el('textarea', { placeholder: 'One requirement per line.' });

    form.appendChild(el('div', { class: 'ops-grid ops-grid--2' }, [
      el('div', { class: 'fld' }, [el('label', { text: 'Role title' }), title]),
      el('div', { class: 'fld' }, [el('label', { text: 'Team' }), team]),
      el('div', { class: 'fld' }, [el('label', { text: 'Location' }), location]),
      el('div', { class: 'fld' }, [el('label', { text: 'Employment type' }), employment])
    ]));
    form.appendChild(el('div', { class: 'fld' }, [el('label', { text: 'Summary' }), summary]));
    form.appendChild(el('div', { class: 'ops-grid ops-grid--2' }, [
      el('div', { class: 'fld' }, [el('label', { text: 'Responsibilities' }), responsibilities]),
      el('div', { class: 'fld' }, [el('label', { text: 'Requirements' }), requirements])
    ]));
    form.appendChild(el('div', { class: 'ops-actions' }, [
      el('button', { class: 'btn btn--primary', text: 'Save draft opening', onclick: function () {
        if (!value(title) || !value(team) || !value(location)) { U.toast('Add title, team, and location before saving.'); return; }
        S.createJobOpening({
          roleId: value(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
          title: value(title), team: value(team), location: value(location), employmentType: value(employment),
          summary: value(summary), responsibilities: splitLines(value(responsibilities)), requirements: splitLines(value(requirements))
        }, user.name);
        U.toast('Job-opening draft saved.'); rerender();
      } })
    ]));
    page.appendChild(form);

    var drafts = S.getJobOpenings();
    var panel = el('div', { class: 'ops-panel', style: 'margin-top:22px' });
    panel.appendChild(el('div', { class: 'ops-panel__head' }, [
      el('h2', { class: 'ops-panel__title', text: 'Draft openings' }),
      el('span', { class: 'ops-meta', text: drafts.length + ' local draft' + (drafts.length === 1 ? '' : 's') })
    ]));
    panel.appendChild(U.table([
      { key: 'title', label: 'Role', html: function (j) { return '<strong>' + esc(j.title) + '</strong>'; } },
      { key: 'team', label: 'Team', html: function (j) { return esc(j.team); } },
      { key: 'location', label: 'Location', html: function (j) { return esc(j.location); } },
      { key: 'status', label: 'Status', html: function (j) { return esc(j.status); } },
      { key: 'updatedAt', label: 'Updated', html: function (j) { return esc(U.fmtDateTime(j.updatedAt)); } }
    ], drafts, { emptyText: 'No HR job-opening drafts yet.' }));
    panel.appendChild(el('div', { class: 'ops-actions', style: 'margin-top:12px' }, [
      el('button', { class: 'btn btn--sm', text: 'Export drafts JSON', onclick: function () {
        downloadJson('shorevest-one-job-openings-drafts.json', { exportedAtUtc: new Date().toISOString(), openings: S.getJobOpenings() });
      } })
    ]));
    page.appendChild(panel);
    container.appendChild(page);
  };
})(typeof self !== 'undefined' ? self : this);
