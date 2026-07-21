/* ========================================================================== 
   ShoreVest public website — source configuration
   One small, reversible source of truth for cross-cutting public-site options.

   showShoreVestOnePublicLink
     Controls whether ShoreVest One is surfaced anywhere on the public website.
     Hiding a link is not access control; the internal preview must still be
     protected separately before it contains live data.

   careersOpenRolesEnabled
     Controls whether individual role pages may be reached from the public site.
     When false, the Careers landing page remains visible with its no-vacancies
     state and role-detail routes return visitors to that page.

   mediaArchiveEnabled
     Controls whether the historical Media article archive is displayed and
     whether article-detail routes remain publicly reachable.

   contactFormMode
     The static GitHub Pages deployment has no server-side contact endpoint.
     `mailto` opens a pre-addressed message and never claims that an inquiry was
     received before the visitor actually sends it.
   ========================================================================== */
(function (root) {
  'use strict';

  var SITE_CONFIG = {
    showShoreVestOnePublicLink: false,
    careersOpenRolesEnabled: false,
    mediaArchiveEnabled: false,
    contactFormMode: 'mailto',
    contactInquiryRecipient: 'inquiries@shorevest.com',
    mediaInquiryRecipient: 'media@shorevest.com'
  };

  root.SHOREVEST_SITE_CONFIG = SITE_CONFIG;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
  }
})(typeof self !== 'undefined' ? self : this);
