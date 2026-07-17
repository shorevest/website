/* Highlights the Insights nav link for seven days after a China Debt Dynamics release. */
(function () {
  const latestIssue = {
    published: '2026-07-17T00:00:00Z',
    href: 'insights.html#archive',
    label: 'New edition',
    message: 'Read the latest China Debt Dynamics'
  };

  const releaseTime = Date.parse(latestIssue.published);
  const sevenDays = 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();

  if (!Number.isFinite(releaseTime) || now < releaseTime || now - releaseTime > sevenDays) return;

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
