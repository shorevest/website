/* ==========================================================================
   ShoreVest public website — source configuration
   One small, reversible source of truth for cross-cutting public-site options.

   showShoreVestOnePublicLink
     Controls whether ShoreVest One (the internal demonstration environment) is
     surfaced anywhere on the public website: desktop navigation, mobile
     navigation, the footer "Access" group, any generated route manifest, the
     public client-side search index, and the public sitemap.

     Phase 2B intentionally hides ShoreVest One from the public site. The
     removal is temporary and reversible: set this flag back to `true` (and,
     for the current static footers, re-apply the single ShoreVest One access
     anchor) to restore public entry points. ShoreVest One itself is NOT
     removed — the direct preview route employee-portal/index.html stays
     reachable for internal review.

     Note: hiding the link is not a security control. The direct URL remains
     accessible to anyone who knows it; noindex/robots directives are advisory;
     the demonstration profile selector is not authentication.
   ========================================================================== */
(function (root) {
  'use strict';

  var SITE_CONFIG = {
    showShoreVestOnePublicLink: false
  };

  root.SHOREVEST_SITE_CONFIG = SITE_CONFIG;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
  }
})(typeof self !== 'undefined' ? self : this);
