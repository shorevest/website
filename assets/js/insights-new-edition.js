/* Automatic Insights nav highlight rule.
 *
 * RULE: For two weeks (14 days) after a China Debt Dynamics edition is
 * published, the Insights nav link flashes inside a cinnabar box. Once the
 * two weeks elapse it reverts to the normal nav link automatically — no code
 * change required to turn it off.
 *
 * TO PUBLISH A NEW EDITION: set `published` below to the new edition's
 * publication date. The highlight switches on automatically from that date
 * and switches itself off two weeks later. That single value is the only
 * thing to update per edition.
 */
(function () {
  const latestIssue = {
    published: '2026-07-17T00:00:00Z',
    href: 'insights.html#archive',
    label: 'New edition',
    message: 'Read the latest China Debt Dynamics'
  };

  // Two-week window, in milliseconds.
  const HIGHLIGHT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

  const releaseTime = Date.parse(latestIssue.published);
  const now = Date.now();

  // Only highlight while we are inside the two-week window after publication.
  if (!Number.isFinite(releaseTime) || now < releaseTime || now - releaseTime > HIGHLIGHT_WINDOW_MS) return;

  const isChinesePage = document.documentElement.lang && document.documentElement.lang.toLowerCase().startsWith('zh');
  const label = isChinesePage ? '新刊' : latestIssue.label;
  const message = isChinesePage ? '查看最新一期中国债务动态' : latestIssue.message;
  const hrefPattern = isChinesePage ? /(?:^|\/)insights_cn\.html(?:$|[?#])/ : /(?:^|\/)insights\.html(?:$|[?#])/;

  const links = Array.from(document.querySelectorAll('.sv-nav a[href], .sv-mobile-menu a[href]'));
  links.forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (!hrefPattern.test(href)) return;

    link.classList.add('sv-nav__new-insights');
    link.setAttribute('data-new-edition-label', label);
    link.setAttribute('data-new-edition-message', message);

    if (!link.getAttribute('aria-label')) {
      link.setAttribute('aria-label', `${link.textContent.trim()}: ${message}`);
    }
  });
})();
