/* ========================================================================== 
   ShoreVest One — team-organized sidebar

   Makes ownership obvious in the full demonstration profile. Navigation is
   grouped by the team that primarily uses each workspace. This is presentation
   only: it does not grant permissions or change any underlying route.
   ========================================================================== */
(function (root) {
  'use strict';

  var P = root.SVPortalPersonas;
  if (!P || !Array.isArray(P.list)) return;

  var TEAM_NAV = [
    { sep: 'Your work', hint: 'Your overview and personal queue' },
    { key: 'home', label: 'Home', hash: '#/home' },
    { key: 'my-work', label: 'My Work', hash: '#/my-work' },

    { sep: 'Client Solutions / IR', hint: 'LP relationships, outreach and delivery' },
    { key: 'relationships', label: 'Relationships', hash: '#/workspace/relationships' },
    { key: 'outreach', label: 'Outreach', hash: '#/outreach' },
    { key: 'meetings', label: 'Meetings', hash: '#/workspace/meetings' },
    { key: 'diligence', label: 'Diligence & Requests', hash: '#/workspace/diligence' },
    { key: 'investor-intelligence', label: 'Investor Intelligence', hash: '#/workspace/investor-intelligence' },
    { key: 'materials', label: 'Materials & Delivery', hash: '#/preview/materials' },
    { key: 'meeting-support', label: 'Meeting Support', hash: '#/preview/meeting-support' },

    { sep: 'Investment', hint: 'Credit screening and recovery support' },
    { key: 'asset-tracing', label: 'Asset Tracing', hash: '#/workspace/asset-tracing' },

    { sep: 'Firm & Operations', hint: 'Company resources and administration' },
    { key: 'firm', label: 'Firm', hash: '#/workspace/firm' },
    { key: 'tools', label: 'Operations Tools', hash: '#/tools', collapsible: true }
  ];

  function cloneItem(item) {
    var copy = {};
    Object.keys(item).forEach(function (key) { copy[key] = item[key]; });
    return copy;
  }

  P.list.forEach(function (persona) {
    if (persona) persona.nav = TEAM_NAV.map(cloneItem);
  });

  var HINTS = {};
  TEAM_NAV.forEach(function (item) {
    if (item.sep && item.hint) HINTS[item.sep] = item.hint;
  });

  function labelGroups(scope) {
    if (!scope || !scope.querySelectorAll) return;
    var groups = scope.querySelectorAll('.ops-nav__sep');
    Array.prototype.forEach.call(groups, function (group) {
      if (group.getAttribute('data-team-labelled') === 'true') return;
      var label = String(group.textContent || '').trim();
      var hint = HINTS[label] || '';

      group.textContent = '';
      group.setAttribute('data-team-labelled', 'true');

      var title = root.document.createElement('span');
      title.className = 'ops-nav__sep-title';
      title.textContent = label;
      group.appendChild(title);

      if (hint) {
        var description = root.document.createElement('span');
        description.className = 'ops-nav__sep-hint';
        description.textContent = hint;
        group.appendChild(description);
      }
    });
  }

  function start() {
    var mount = root.document.getElementById('svops-root');
    if (!mount) return;
    labelGroups(mount);

    if (typeof root.MutationObserver === 'function') {
      var observer = new root.MutationObserver(function () { labelGroups(mount); });
      observer.observe(mount, { childList: true, subtree: true });
      root.SVPortalSidebarTeams = { navigation: TEAM_NAV, observer: observer };
    } else {
      root.SVPortalSidebarTeams = { navigation: TEAM_NAV };
    }
  }

  if (root.document.readyState === 'loading') {
    root.document.addEventListener('DOMContentLoaded', start);
  } else {
    root.setTimeout(start, 0);
  }
})(typeof self !== 'undefined' ? self : this);
