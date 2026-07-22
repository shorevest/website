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
    { sep: 'Your work' },
    { key: 'home', label: 'Home', hash: '#/home' },
    { key: 'my-work', label: 'My Work', hash: '#/my-work' },

    { sep: 'Client Solutions / IR' },
    { key: 'relationships', label: 'Relationships', hash: '#/workspace/relationships' },
    { key: 'outreach', label: 'Outreach', hash: '#/outreach' },
    { key: 'meetings', label: 'Meetings', hash: '#/workspace/meetings' },
    { key: 'diligence', label: 'Diligence & Requests', hash: '#/workspace/diligence' },
    { key: 'investor-intelligence', label: 'Investor Intelligence', hash: '#/workspace/investor-intelligence' },
    { key: 'materials', label: 'Materials & Delivery', hash: '#/preview/materials' },
    { key: 'meeting-support', label: 'Meeting Support', hash: '#/preview/meeting-support' },

    { sep: 'Investment' },
    { key: 'asset-tracing', label: 'Asset Tracing', hash: '#/workspace/asset-tracing' },

    { sep: 'Firm & Operations' },
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

  root.SVPortalSidebarTeams = { navigation: TEAM_NAV };
})(typeof self !== 'undefined' ? self : this);
