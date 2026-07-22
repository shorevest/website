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

  /* ------------------------------------------------------------------------
     Public-site content corrections (22 July 2026)
     ------------------------------------------------------------------------ */
  var ADA_LINKEDIN_URL = 'https://www.linkedin.com/in/ada-bi-cpa-fcca-6185a218?utm_source=share_via&utm_content=profile&utm_medium=member_ios';
  var SHADOW_BANKING_SOURCE = '/assets/data/china-debt-dynamics-v5i4.json?v=20260722-full-article';

  function eachNode(nodes, callback) {
    Array.prototype.forEach.call(nodes || [], callback);
  }

  function whenDocumentReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
    } else {
      callback();
    }
  }

  function fixAdaLinkedIn(rootNode) {
    var scope = rootNode && rootNode.querySelectorAll ? rootNode : document;

    eachNode(scope.querySelectorAll('a.team-profile__linkedin[href]'), function (link) {
      var profile = link.closest ? link.closest('.team-profile') : null;
      var name = profile && profile.querySelector('.team-profile__name');
      var href = link.getAttribute('href') || '';
      var isAda = name && (name.textContent || '').trim().toLowerCase() === 'ada bi';

      if (isAda || /linkedin\.com\/in\/ada-bi-cpa-(?:cga-)?fcca-6185a218/i.test(href)) {
        link.setAttribute('href', ADA_LINKEDIN_URL);
        link.setAttribute('target', '_blank');
        link.setAttribute('rel', 'noopener noreferrer');
      }
    });
  }

  function isShadowBankingIssue() {
    var pathname = (window.location.pathname || '').replace(/\/{2,}/g, '/');
    return /\/insights\/china-debt-dynamics\/v5i4\/?$/i.test(pathname) ||
      /\/china-debt-dynamics-v5i4\.html$/i.test(pathname);
  }

  function cleanFindingText(value) {
    return String(value == null ? '' : value)
      .replace(/\uFFFD/g, '')
      .replace(/^[\s□■▪▫●○?]+/, '')
      .trim();
  }

  function installFindingMarkerFix() {
    if (document.getElementById('sv-cdd-finding-marker-fix')) return;

    var style = document.createElement('style');
    style.id = 'sv-cdd-finding-marker-fix';
    style.textContent = [
      'body.cdd-article-page .cdd-sidecard ul { list-style: none !important; padding-left: 0 !important; }',
      'body.cdd-article-page .cdd-sidecard ul li { position: relative !important; padding-left: 16px !important; }',
      'body.cdd-article-page .cdd-sidecard ul li::before {',
      '  content: "" !important;',
      '  position: absolute !important;',
      '  left: 0 !important;',
      '  top: 0.72em !important;',
      '  width: 6px !important;',
      '  height: 6px !important;',
      '  background: var(--sv-cinnabar, #c64832) !important;',
      '  font-family: inherit !important;',
      '}'
    ].join('\n');
    document.head.appendChild(style);
  }

  function renderShadowBankingArticle(data) {
    var body = document.querySelector('[data-cdd-body]');
    if (!body || !data || !Array.isArray(data.sections)) return false;

    body.innerHTML = '';
    data.sections.forEach(function (section) {
      if (section && section.heading) {
        var heading = document.createElement('h2');
        heading.textContent = String(section.heading);
        body.appendChild(heading);
      }

      eachNode(section && section.paragraphs, function (paragraph) {
        var p = document.createElement('p');
        p.textContent = String(paragraph == null ? '' : paragraph);
        body.appendChild(p);
      });

      if (section && Array.isArray(section.bullets) && section.bullets.length) {
        var list = document.createElement('ul');
        section.bullets.forEach(function (item) {
          var li = document.createElement('li');
          li.textContent = cleanFindingText(item);
          list.appendChild(li);
        });
        body.appendChild(list);
      }
    });

    var title = document.querySelector('[data-cdd-title]');
    var dek = document.querySelector('[data-cdd-dek]');
    var findings = document.querySelector('[data-cdd-findings]');
    var disclaimer = document.querySelector('[data-cdd-disclaimer]');
    var copyright = document.querySelector('[data-cdd-copyright]');

    if (title && data.title) title.textContent = String(data.title);
    if (dek && data.dek) dek.textContent = String(data.dek);
    if (disclaimer && data.disclaimer) disclaimer.textContent = String(data.disclaimer);
    if (copyright && data.copyright) copyright.textContent = String(data.copyright);

    if (findings) {
      findings.innerHTML = '';
      eachNode(data.keyFindings, function (finding) {
        var li = document.createElement('li');
        li.textContent = cleanFindingText(finding);
        findings.appendChild(li);
      });
    }

    document.body.dataset.cddReady = 'true';
    return (body.textContent || '').trim().length > 500;
  }

  function ensureFullShadowBankingArticle() {
    if (!isShadowBankingIssue()) return;

    installFindingMarkerFix();

    eachNode(document.querySelectorAll('[data-cdd-findings] li'), function (item) {
      item.textContent = cleanFindingText(item.textContent);
    });

    window.setTimeout(function () {
      var body = document.querySelector('[data-cdd-body]');
      if (body && (body.textContent || '').trim().length > 500) return;

      fetch(SHADOW_BANKING_SOURCE, { cache: 'no-store', credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('Unable to load the full Shadow Banking issue.');
          return response.json();
        })
        .then(function (data) {
          renderShadowBankingArticle(data);
        })
        .catch(function (error) {
          console.error('Shadow Banking article fallback failed.', error);
        });
    }, 900);
  }

  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    whenDocumentReady(function () {
      fixAdaLinkedIn(document);
      ensureFullShadowBankingArticle();

      if (window.MutationObserver) {
        new MutationObserver(function (mutations) {
          mutations.forEach(function (mutation) {
            eachNode(mutation.addedNodes, function (node) {
              if (node.nodeType === 1) fixAdaLinkedIn(node);
            });
          });
        }).observe(document.documentElement, { childList: true, subtree: true });
      }
    });
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SITE_CONFIG;
  }
})(typeof self !== 'undefined' ? self : this);
