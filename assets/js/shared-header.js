/* Silence the benign, non-actionable "ResizeObserver loop completed with
   undelivered notifications" console noise (emitted by tooling/wrappers; the
   site itself uses no ResizeObserver). */
(() => {
  const swallowRO = (msg) => typeof msg === "string" && msg.indexOf("ResizeObserver loop") !== -1;
  window.addEventListener("error", (e) => { if (swallowRO(e && e.message)) { e.stopImmediatePropagation(); e.preventDefault(); } }, true);
})();

(() => {
  const currentScriptUrl = new URL(document.currentScript?.src || 'assets/js/shared-header.js', window.location.href);
  const siteRootUrl = new URL('../../', currentScriptUrl);
  const __svt = () => { const t = new URLSearchParams(window.location.search).get('t'); return t ? ('?t=' + encodeURIComponent(t)) : ''; };
  const relativeSiteHref = (path) => {
    const target = new URL(path, siteRootUrl);
    const fromDir = window.location.pathname.endsWith('/')
      ? window.location.pathname
      : window.location.pathname.replace(/[^/]*$/, '');
    const fromParts = fromDir.split('/').filter(Boolean);
    const toParts = target.pathname.split('/').filter(Boolean);
    while (fromParts.length && toParts.length && fromParts[0] === toParts[0]) {
      fromParts.shift();
      toParts.shift();
    }
    const rel = `${'../'.repeat(fromParts.length)}${toParts.join('/')}`;
    return (rel || './') + __svt();
  };
  const assetHref = relativeSiteHref;
  const pageHref = relativeSiteHref;

  const LOADER_BRAND_PNG_PATH = assetHref('assets/brand/shorevest-lockup.png');
  const LOADER_BRAND_LIGHT_PNG_PATH = assetHref('assets/brand/shorevest-lockup-light.png');

  // The header carries two stacked lockups: the default dark wordmark, and a
  // light variant (cream "SHOREVEST" + cinnabar 新岸資本) used only while the bar
  // floats transparently over a dark hero. CSS crossfades between them.
  // Official winter-tree badge mark (assets/brand/tree-mark-outline.png),
  // rendered as a CSS mask filled with `currentColor` so it can still flip
  // cream over the dark hero and dark-green once the bar settles solid.
  const BRAND_MARK_PATH = assetHref('assets/brand/tree-mark-outline.png');
  const BRAND_MARK_SVG = `<span class="nav__brand-mark-svg nav__brand-mark-art" style="-webkit-mask-image:url('${BRAND_MARK_PATH}');mask-image:url('${BRAND_MARK_PATH}')" aria-hidden="true"></span>`;

  // Official lockup artwork (transparent PNGs cut from the brand files).
  // The legacy shorevest-lockup.svg carries the wrong Chinese face — do not use it.
  const buildBrandLockup = () => `<img class="brand-lockup-svg brand-lockup-svg--dark" src="${LOADER_BRAND_PNG_PATH}" alt="ShoreVest 新岸資本" /><img class="brand-lockup-svg brand-lockup-svg--light" src="${LOADER_BRAND_LIGHT_PNG_PATH}" alt="" aria-hidden="true" />`;

  const buildLoaderBrandLockup = () => `<img class="site-loader-logo" src="${LOADER_BRAND_PNG_PATH}" alt="ShoreVest 新岸資本" />`;

  // Loader tree mark — "Ink-in" (approved option F): the outline reveals
  // first, then inks into the solid badge. Two mask-rendered layers in the
  // loader ink color; mark only, no wordmark.
  const BRAND_MARK_FILLED_PATH = assetHref('assets/brand/tree-mark-filled.png');
  const LOADER_MARK_SVG = `<span class="loader-mark-svg loader-mark-ink" aria-hidden="true"><span class="loader-mark-art loader-mark-art--out" style="-webkit-mask-image:url('${BRAND_MARK_PATH}');mask-image:url('${BRAND_MARK_PATH}')"></span><span class="loader-mark-art loader-mark-art--fill" style="-webkit-mask-image:url('${BRAND_MARK_FILLED_PATH}');mask-image:url('${BRAND_MARK_FILLED_PATH}')"></span></span>`;

  const pathname = window.location.pathname;
  const isInvestorPortalPath = /\/investor-portal(?:\.html|\/|\/index(?:_cn)?\.html)?$/i.test(pathname);
  const path = isInvestorPortalPath ? 'investor-portal' : (pathname.split('/').pop() || 'index.html');
  const localeSuffixMatch = path.match(/[-_](cn)\.html$/i);
  const localeSuffix = localeSuffixMatch ? localeSuffixMatch[1].toLowerCase() : 'en';

  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (document.body) {
    const loader = document.createElement('div');
    loader.className = 'site-loader';
    loader.setAttribute('aria-hidden', 'true');
    loader.innerHTML = `<div class="site-loader-box site-loader-box--mark">
      <div class="loader-mark-wrap">${LOADER_MARK_SVG}</div>
    </div>`;
    document.body.prepend(loader);
    document.body.classList.add('site-loader-active');

    const loaderStart = (window.performance && performance.now) ? performance.now() : Date.now();
    const nowMs = () => (window.performance && performance.now) ? performance.now() : Date.now();
    // Minimum on-screen time so the tree-draw animation can complete before
    // the loader leaves. Kept short for reduced-motion / repeat sensibilities.
    const MIN_SHOW = reducedMotionQuery.matches ? 220 : 1450;

    const dismissLoader = () => {
      if (loader.dataset.dismissed === 'true') return;
      loader.dataset.dismissed = 'true';
      // Reveal the page content as the loader begins to leave (the inline
      // boot cover in <head> kept the body hidden until now, so the loading
      // screen always paints first — never a flash of the page).
      document.documentElement.classList.remove('sv-booting');
      const removeLoader = () => {
        loader.remove();
        document.body.classList.remove('site-loader-active');
      };

      if (reducedMotionQuery.matches) {
        loader.classList.add('is-hidden-reduced');
        window.setTimeout(removeLoader, 80);
        return;
      }

      loader.classList.add('is-exiting');
      window.setTimeout(removeLoader, 620);
    };

    const dismissWhenReady = () => {
      const wait = Math.max(0, MIN_SHOW - (nowMs() - loaderStart));
      window.setTimeout(dismissLoader, wait);
    };

    if (document.readyState === 'complete') {
      dismissWhenReady();
    } else {
      window.addEventListener('load', dismissWhenReady, { once: true });
    }
    // Safety cap: never let the loader hang if `load` is delayed.
    window.setTimeout(dismissLoader, MIN_SHOW + 3500);
  }

  const mount = document.getElementById('site-header-mount');
  if (!mount || mount.dataset.sharedHeaderMounted === 'true') return;
  mount.dataset.sharedHeaderMounted = 'true';

  const isChinesePath = localeSuffix !== 'en';
  const documentLang = document.documentElement.lang || '';
  const isChinesePage = isChinesePath || /^zh/i.test(documentLang);
  const chineseTextLang = 'zh-CN';

  const basePages = [
    'index',
    'firm',
    'strategy',
    'insights',
    'press',
    'team',
    'privacy-policy',
    'cookie-notice',
    'terms-of-use',
    'legal-notices-disclaimers',
    'disclaimers',
    'investor-access',
    'investor-portal',
    'investor-access-portal-terms',
    'contact'
  ];

  const localizedPageHref = (base, locale) => pageHref(`${base}${locale === 'en' ? '' : `_${locale}`}.html`);
  const localeBase = (() => {
    if (isInvestorPortalPath) return 'investor-portal';
    const match = path.match(/^(.*?)(?:[-_]cn)?\.html$/i);
    return match && basePages.includes(match[1]) ? match[1] : 'index';
  })();
  const localeHrefs = {
    en: localeBase === 'investor-portal' ? pageHref('investor-portal/index.html') : localizedPageHref(localeBase, 'en'),
    cn: localeBase === 'investor-portal' ? pageHref('investor-portal/index_cn.html') : localizedPageHref(localeBase, 'cn')
  };

  const renderLanguageSelector = (contextClass = '') => {
    const englishActive = localeSuffix === 'en';
    const chineseActive = localeSuffix === 'cn';
    const context = contextClass ? ` ${contextClass}` : '';
    const englishClasses = ['lang-toggle', 'lang-toggle--en', 'latin-text', 'nav__text-latin', contextClass, englishActive ? 'active' : ''].filter(Boolean).join(' ');
    const chineseClasses = ['lang-toggle', 'lang-toggle--zh', 'zh', contextClass, chineseActive ? 'active' : ''].filter(Boolean).join(' ');

    return `<span class="nav__language-selector language-switch${context}">
      <a href="${localeHrefs.en}" class="${englishClasses}"${englishActive ? ' aria-current="true"' : ''}>EN</a>
      <span class="nav__lang-separator" aria-hidden="true">|</span>
      <a href="${localeHrefs.cn}" class="${chineseClasses}"${chineseActive ? ' aria-current="true"' : ''} lang="zh-Hans">中文</a>
    </span>`;
  };

  const localized = {
    en: {
      navClass: 'nav--en',
      home: pageHref('index.html'),
      wordmark: '\u65b0\u5cb8\u8cc7\u672c',
      navItems: [
        { href: pageHref('firm.html'), label: 'Firm' },
        { href: pageHref('strategy.html'), label: 'Strategy' },
        { href: pageHref('insights.html'), label: 'Insights' },
        { href: pageHref('press.html'), label: 'Media' },
        { href: pageHref('team.html'), label: 'Team' },
        { href: 'https://www.pafg.com/', label: 'PAFG', external: true }
      ],
      investorPortalHref: pageHref('investor-portal/index.html'),
      investorPortalLabel: 'Investor portal',
      headerCtaHref: pageHref('contact.html'),
      headerCtaLabel: 'Contact',
      mobileAriaLabel: 'Site navigation'
    },
    cn: {
      navClass: 'nav--cn nav--sc',
      home: pageHref('index_cn.html'),
      wordmark: '新岸資本',
      navItems: [
        { href: pageHref('firm_cn.html'), label: '公司' },
        { href: pageHref('strategy_cn.html'), label: '策略' },
        { href: pageHref('insights_cn.html'), label: '洞察' },
        { href: pageHref('press_cn.html'), label: '媒体' },
        { href: pageHref('team_cn.html'), label: '团队' },
        { href: 'https://www.pafg.com/', label: 'PAFG', external: true }
      ],
      investorPortalHref: pageHref('investor-portal/index_cn.html'),
      investorPortalLabel: '投资者门户',
      headerCtaHref: pageHref('contact_cn.html'),
      headerCtaLabel: '联系',
      mobileAriaLabel: '网站导航'
    }
  };

  const locale = localized[localeSuffix];
  const navItems = locale.navItems;
  const investorPortalHref = locale.investorPortalHref;
  const investorPortalLabel = locale.investorPortalLabel;
  const headerCtaHref = locale.headerCtaHref;
  const headerCtaLabel = locale.headerCtaLabel;
  /* ----------------------------------------------------------------------
     CANONICAL CHROME (2026-06-23)
     Emit the exact homepage .sv-header markup (not the legacy green .nav /
     .site-header). Keeps all locale data above (EN/CN nav items, hrefs,
     language switch, CTAs) and adds aria-current for the active section.
     Styling comes from the self-contained sv-chrome.css (ensured below),
     which renders .sv-header/.sv-footer independent of body.homepage. After
     rendering we return early, so every legacy nav/active/annotate routine
     further down is bypassed entirely.
     -------------------------------------------------------------------- */
  const navBases = ['firm', 'strategy', 'insights', 'press', 'team', 'pafg'];
  const svLang = localeSuffix === 'en'
    ? `<a class="sv-lang" href="${localeHrefs.cn}"><span class="on">EN</span><span class="sep">|</span>中文</a>`
    : `<a class="sv-lang" href="${localeHrefs.en}" lang="zh-Hans"><span>EN</span><span class="sep">|</span><span class="on">中文</span></a>`;
  const svLangOtherHref = localeSuffix === 'en' ? localeHrefs.cn : localeHrefs.en;
  const svLangOtherLabel = localeSuffix === 'en' ? '中文' : 'EN';

  mount.innerHTML = `<header class="sv-header">
  <div class="sv-header__inner">
    <a class="sv-header__logo" href="${locale.home}" aria-label="${localeSuffix === 'en' ? 'ShoreVest — home' : '新岸资本 — 首页'}">
      <img src="${assetHref('assets/brand/sv-lockup-fc-dark.png')}" alt="ShoreVest" width="172" height="41" />
    </a>
    <nav class="sv-nav" aria-label="${localeSuffix === 'en' ? 'Primary' : '主导航'}">
      <ul>${navItems.map((item, i) => `<li><a href="${item.href}"${item.external ? ' target="_blank" rel="noopener noreferrer"' : ''}${navBases[i] === localeBase ? ' aria-current="page"' : ''}>${item.label}</a></li>`).join('')}</ul>
    </nav>
    <div class="sv-utils">${svLang}
      <a class="sv-util-btn" href="${investorPortalHref}">${investorPortalLabel}</a>
      <a class="sv-util-btn sv-util-btn--cta" href="${headerCtaHref}">${headerCtaLabel}</a>
    </div>
    <button class="sv-burger" type="button" aria-label="${localeSuffix === 'en' ? 'Open menu' : '打开菜单'}" aria-expanded="false" aria-controls="sv-mobile-menu"><span></span></button>
  </div>
</header>
<div class="sv-mobile-menu" id="sv-mobile-menu">
  <nav aria-label="${localeSuffix === 'en' ? 'Mobile' : '移动导航'}">
    <ul>${navItems.map((item) => `<li><a href="${item.href}"${item.external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${item.label}</a></li>`).join('')}</ul>
    <div class="sv-mobile-utils">
      <a class="sv-util-btn" href="${svLangOtherHref}">${svLangOtherLabel}</a>
      <a class="sv-util-btn" href="${investorPortalHref}">${investorPortalLabel}</a>
      <a class="sv-util-btn sv-util-btn--cta" href="${headerCtaHref}">${headerCtaLabel}</a>
    </div>
  </nav>
</div>`;

  // Ensure the self-contained chrome stylesheet is present (idempotent).
  if (!document.querySelector('link[data-sv-chrome]')) {
    const chromeLink = document.createElement('link');
    chromeLink.rel = 'stylesheet';
    chromeLink.setAttribute('data-sv-chrome', '');
    chromeLink.href = assetHref('assets/css/sv-chrome.css');
    document.head.appendChild(chromeLink);
  }

  // Burger toggle (canonical behavior).
  const svBurger = mount.querySelector('.sv-burger');
  const svMenu = mount.querySelector('#sv-mobile-menu');
  if (svBurger && svMenu) {
    svBurger.addEventListener('click', () => {
      const open = svMenu.classList.toggle('is-open');
      svBurger.setAttribute('aria-expanded', open ? 'true' : 'false');
      svBurger.setAttribute('aria-label', open ? (localeSuffix === 'en' ? 'Close menu' : '关闭菜单') : (localeSuffix === 'en' ? 'Open menu' : '打开菜单'));
    });
    svMenu.addEventListener('click', (e) => {
      if (e.target.closest('a')) { svMenu.classList.remove('is-open'); svBurger.setAttribute('aria-expanded', 'false'); }
    });
  }

  // Canonical chrome fully rendered — bypass all legacy nav logic below.
  return;

  // Mobile menu panel — appended directly to <body> to avoid stacking context
  // issues caused by #nav / #site-header-mount creating their own stacking contexts.
  const mobilePanel = document.createElement('div');
  mobilePanel.className = `mobile-menu-panel ${locale.navClass}`;
  mobilePanel.setAttribute('aria-hidden', 'true');
  mobilePanel.setAttribute('role', 'dialog');
  mobilePanel.setAttribute('aria-label', locale.mobileAriaLabel);
  mobilePanel.innerHTML = `<nav class="mobile-menu-list">
    ${navItems.map((item) => `<a class="mobile-menu-link" href="${item.href}">${item.label}</a>`).join('')}
    <div class="mobile-menu-link mobile-menu-link--lang nav__language-group">${renderLanguageSelector('mobile-menu-language-link')}</div>
    <a class="mobile-menu-link mobile-menu-link--investor" href="${investorPortalHref}">${investorPortalLabel}</a>
    <a class="mobile-menu-link mobile-menu-link--contact" href="${headerCtaHref}">${headerCtaLabel}</a>
  </nav>`;
  document.body.appendChild(mobilePanel);

  const nav = document.getElementById('nav');
  const menuBtn = nav.querySelector('.nav__menu-btn');
  const navLinks = nav.querySelector('.nav__links');

  if (menuBtn && navLinks) {
    const menuBtnLabel = menuBtn.querySelector('.nav__menu-btn-label');
    const mobileMenuQuery = window.matchMedia('(max-width: 980px)');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const setMenuState = (open) => {
      nav.classList.toggle('menu-open', open);
      document.body.classList.toggle('menu-open', open);
      mobilePanel.classList.toggle('is-open', open);
      if (open && !reduceMotion) {
        mobilePanel.classList.remove('menu-frame-draw');
        window.requestAnimationFrame(() => mobilePanel.classList.add('menu-frame-draw'));
      } else if (!open) {
        mobilePanel.classList.remove('menu-frame-draw');
      }
      mobilePanel.setAttribute('aria-hidden', String(!open));
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (menuBtnLabel) menuBtnLabel.textContent = open ? 'Close' : 'Menu';
      if (mobileMenuQuery.matches) {
        navLinks.setAttribute('aria-hidden', String(!open));
      } else {
        navLinks.setAttribute('aria-hidden', 'false');
      }
    };

    menuBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const open = !nav.classList.contains('menu-open');
      setMenuState(open);
    });

    navLinks.addEventListener('click', (event) => {
      event.stopPropagation();
    });

    const closeOnOutsideInteraction = (event) => {
      if (!nav.classList.contains('menu-open')) return;
      const target = event.target;
      if (target instanceof Node && (nav.contains(target) || mobilePanel.contains(target))) return;
      setMenuState(false);
    };

    document.addEventListener('click', closeOnOutsideInteraction);
    document.addEventListener('pointerdown', closeOnOutsideInteraction);

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('menu-open')) {
        setMenuState(false);
      }
    });

    nav.querySelectorAll('.nav__links a').forEach((link) => {
      link.addEventListener('click', () => setMenuState(false));
    });

    mobilePanel.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => setMenuState(false));
    });

    window.addEventListener('resize', () => {
      if (!mobileMenuQuery.matches && nav.classList.contains('menu-open')) {
        setMenuState(false);
      }
    });

    const syncMenuMode = () => {
      if (!mobileMenuQuery.matches) {
        setMenuState(false);
        navLinks.setAttribute('aria-hidden', 'false');
      } else if (!nav.classList.contains('menu-open')) {
        navLinks.setAttribute('aria-hidden', 'true');
      }
    };

    if (typeof mobileMenuQuery.addEventListener === 'function') {
      mobileMenuQuery.addEventListener('change', syncMenuMode);
    } else if (typeof mobileMenuQuery.addListener === 'function') {
      mobileMenuQuery.addListener(syncMenuMode);
    }

    syncMenuMode();
  }


  const annotateChinesePageText = () => {
    if (!isChinesePage || !document.body) return;

    const skipTags = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'SVG', 'CANVAS', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION']);
    const skipClasses = new Set(['sv-text-en', 'sv-text-zh']);
    const languagePattern = /([\u3400-\u9fff\uf900-\ufaff]+)|([A-Za-z0-9$][^\u3400-\u9fff\uf900-\ufaff\s<>]*)/g;

    const shouldSkip = (node) => {
      let current = node.parentElement;
      while (current) {
        if (skipTags.has(current.tagName)) return true;
        if (current.id === 'site-header-mount' || (current.classList && current.classList.contains('mobile-menu-panel'))) return true;
        for (const className of skipClasses) {
          if (current.classList && current.classList.contains(className)) return true;
        }
        current = current.parentElement;
      }
      return false;
    };

    const annotateTextNode = (textNode) => {
      if (!textNode.nodeValue || shouldSkip(textNode)) return;

      languagePattern.lastIndex = 0;
      if (!languagePattern.test(textNode.nodeValue)) return;

      languagePattern.lastIndex = 0;
      const fragment = document.createDocumentFragment();
      let cursor = 0;
      let match;

      while ((match = languagePattern.exec(textNode.nodeValue)) !== null) {
        if (match.index > cursor) {
          fragment.appendChild(document.createTextNode(textNode.nodeValue.slice(cursor, match.index)));
        }

        const span = document.createElement('span');
        span.className = match[1] ? 'sv-text-zh' : 'sv-text-en';
        span.setAttribute('lang', match[1] ? chineseTextLang : 'en');
        span.textContent = match[0];
        fragment.appendChild(span);
        cursor = match.index + match[0].length;
      }

      if (cursor < textNode.nodeValue.length) {
        fragment.appendChild(document.createTextNode(textNode.nodeValue.slice(cursor)));
      }

      textNode.parentNode.replaceChild(fragment, textNode);
    };

    const annotateNode = (root) => {
      if (!root || shouldSkip(root)) return;
      if (root.nodeType === Node.TEXT_NODE) {
        annotateTextNode(root);
        return;
      }

      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode: (node) => shouldSkip(node) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
      });
      const textNodes = [];
      while (walker.nextNode()) textNodes.push(walker.currentNode);
      textNodes.forEach(annotateTextNode);
    };

    annotateNode(document.body);

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => annotateNode(node));
      });
    });

    observer.observe(document.body, { childList: true, subtree: true });
  };

  annotateChinesePageText();

  const activeMap = {
    firm: ['firm.html', 'firm_cn.html', pageHref('firm.html'), pageHref('firm_cn.html')],
    strategy: ['strategy.html', 'strategy_cn.html', pageHref('strategy.html'), pageHref('strategy_cn.html')],
    insights: ['insights.html', 'insights_cn.html', pageHref('insights.html'), pageHref('insights_cn.html')],
    press: ['press.html', 'press_cn.html', pageHref('press.html'), pageHref('press_cn.html')],
    team: ['team.html', 'team_cn.html', pageHref('team.html'), pageHref('team_cn.html')],
    investor: [pageHref('investor-portal/index.html'), 'investor-portal', 'investor-access.html', 'investor-access_cn.html', pageHref('investor-access.html'), pageHref('investor-access_cn.html')]
  };

  const inferActiveSection = (currentPath) => {
    if (isInvestorPortalPath) return 'investor';
    if (activeMap.firm.includes(currentPath)) return 'firm';
    if (activeMap.strategy.includes(currentPath)) return 'strategy';
    if (activeMap.press.includes(currentPath)) return 'press';
    if (activeMap.team.includes(currentPath)) return 'team';
    if (activeMap.investor.includes(currentPath)) return 'investor';
    if (activeMap.insights.includes(currentPath)) return 'insights';

    const insightsPatterns = [
      /^insight-/i,
      /^china-debt-dynamics/i,
      /^insight-understanding-/i
    ];

    return insightsPatterns.some((pattern) => pattern.test(currentPath))
      ? 'insights'
      : null;
  };

  const setActive = (links) => {
    links.forEach((activeLink) => {
      activeLink.classList.add('active');
      activeLink.setAttribute('aria-current', 'page');
    });
  };

  if (['contact.html', 'contact_cn.html'].includes(path)) {
    // Keep the desktop top bar structurally identical to the homepage. The
    // Contact CTA is intentionally not marked active in .nav__right, because
    // the homepage has no active CTA class there and the button row must not
    // change when switching between pages. The mobile panel can still expose
    // the current page state because it is outside the fixed top bar.
    setActive(mobilePanel.querySelectorAll(`a[href="${headerCtaHref}"]`));
  }

  const activeSection = inferActiveSection(path);
  if (activeSection) {
    activeMap[activeSection].forEach((href) => {
      // Only primary nav links receive desktop active treatment. Header CTAs
      // such as Investor Portal keep the exact same top-bar classes as the
      // homepage so their width, padding, and alignment never shift.
      const primaryNavSelector = [
        '.nav__links .nav__menu-row:not(.nav__mobile-investor)',
        ':not(.nav__mobile-contact)',
        ':not(.nav__mobile-lang)',
        ` a[href="${href}"]`
      ].join('');
      setActive(nav.querySelectorAll(primaryNavSelector));
      setActive(mobilePanel.querySelectorAll(`a[href="${href}"]`));
    });
  }

  /* ================================================================
     Transparent-over-hero top bar (desktop)
     ----------------------------------------------------------------
     On pages that open with a dark hero, the bar floats transparently
     over the hero in light type, then settles into the solid cream bar
     with a hairline as you scroll into the page. The visual treatment
     is gated to desktop in CSS (min-width: 981px); this script simply
     maintains the state classes. Mobile keeps the solid bar.
  ================================================================ */
  (() => {
    // OVERLAY DISABLED (2026-06-20): every page now uses the solid cream
    // homepage header at all times — no transparent/white float over dark or
    // cinnabar heroes. This guarantees header parity with the homepage at top
    // load and on scroll. The former scroll-driven overlay→solid machinery is
    // intentionally bypassed.
    document.body.classList.add('sv-head-solid');
    document.body.classList.remove('sv-head-overlay');
    return;

    // eslint-disable-next-line no-unreachable
    const heroSelector = '.home-hero, .firm-hero, .strategy-hero, .team-hero, .press-hero, .cp-hero, .research-hero, .insights-hero, .signin__brand';
    const hero = document.querySelector(heroSelector);
    if (!hero) {
      // Heroless interior pages (portal, legal, etc.) never float over a dark
      // hero — settle the bar into its solid cream state immediately so the
      // dark wordmark is legible on the page background.
      document.body.classList.add('sv-head-solid');
      return;
    }

    const body = document.body;
    body.classList.add('sv-head-overlay');

    const headerHeight = () => {
      const v = getComputedStyle(document.documentElement).getPropertyValue('--sv-header-height-desktop').trim();
      const n = parseFloat(v);
      return Number.isFinite(n) ? n : 72;
    };

    let ticking = false;
    const apply = () => {
      ticking = false;
      // Force solid whenever the mobile menu is open (defensive; keeps state
      // coherent across breakpoints).
      const menuOpen = body.classList.contains('menu-open');
      const rect = hero.getBoundingClientRect();
      const solid = menuOpen || rect.bottom <= headerHeight() + 16;
      // Only mutate on change so the body-class observer can't loop.
      if (solid !== body.classList.contains('sv-head-solid')) {
        body.classList.toggle('sv-head-solid', solid);
      }
    };

    const onScroll = () => {
      if (!ticking) { window.requestAnimationFrame(apply); ticking = true; }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    // Re-evaluate when the mobile menu opens/closes (toggles body.menu-open)
    // so the bar settles solid behind the open panel.
    const bodyClassObserver = new MutationObserver(apply);
    bodyClassObserver.observe(body, { attributes: true, attributeFilter: ['class'] });

    apply();
  })();
})();

/* ================================================================
   IMAGE PLACEHOLDERS (site-wide)
   ----------------------------------------------------------------
   Turns any image spot that still needs a real asset into a clear,
   on-brand "Add image" box, so it's obvious exactly where to drop a
   final photo. It catches three cases:
     1. <img> that fail to load / have no usable source (broken);
     2. temporary AI stand-in headshots (filename "ChatGPT Image…");
     3. empty image containers ([data-team-photo] with no <img>).
   Header/footer chrome and logos are excluded. To opt any element
   out, add the attribute  data-no-placeholder.
================================================================ */
(() => {
  var STYLE_ID = 'sv-img-placeholder-css';
  if (!document.getElementById(STYLE_ID)) {
    var css =
      '.sv-img-ph{position:absolute;inset:0;z-index:3;display:flex;flex-direction:column;' +
      'align-items:center;justify-content:center;gap:9px;box-sizing:border-box;padding:16px;' +
      'text-align:center;cursor:default;' +
      'background:repeating-linear-gradient(45deg,rgba(201,59,42,0.06) 0 11px,rgba(201,59,42,0) 11px 22px),#FAF6EE;' +
      'border:2px dashed rgba(201,59,42,0.55);color:#8A1F12;}' +
      '.sv-img-ph--block{position:relative;inset:auto;width:100%;min-height:220px;}' +
      '.sv-img-ph__icon{width:30px;height:30px;opacity:.72;margin-bottom:1px;}' +
      '.sv-img-ph__title{font:700 12px/1 "DIN 2014","DIN2014",system-ui,sans-serif;' +
      'letter-spacing:.18em;text-transform:uppercase;}' +
      '.sv-img-ph__hint{font:500 11px/1.35 "DIN 2014","DIN2014",system-ui,sans-serif;' +
      'letter-spacing:.02em;color:#C93B2A;opacity:.9;max-width:88%;}' +
      // keep the team-card border frame visible above the placeholder
      '.team-profile__photo .sv-img-ph{z-index:1;}';
    var st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = css;
    document.head.appendChild(st);
  }

  var ICON =
    '<svg class="sv-img-ph__icon" viewBox="0 0 24 24" fill="none" ' +
    'stroke="currentColor" stroke-width="1.6" stroke-linecap="round" ' +
    'stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="14" rx="0.5"></rect>' +
    '<circle cx="8.5" cy="9.5" r="1.6"></circle>' +
    '<path d="M21 15l-5-5L7 19"></path>' +
    '<path d="M12 21v0M9 21h6"></path></svg>';

  function isTempSrc(s) {
    return !!s && /chatgpt image|placeholder|\bplaceholder\b/i.test(s);
  }

  function inChrome(el) {
    return !!el.closest(
      '#site-header-mount, .site-header, .sv-footer, [data-shared-footer], ' +
      '.brand-lockup, .nav__logo-lockup, [data-no-placeholder]'
    );
  }

  function makePlaceholder(hint) {
    var d = document.createElement('div');
    d.className = 'sv-img-ph';
    d.setAttribute('role', 'img');
    d.setAttribute('aria-label', 'Image placeholder — ' + (hint || 'add image'));
    d.innerHTML =
      ICON +
      '<span class="sv-img-ph__title">Add image</span>' +
      (hint ? '<span class="sv-img-ph__hint">' + hint + '</span>' : '');
    return d;
  }

  function fill(container, hint) {
    if (!container || container.querySelector(':scope > .sv-img-ph')) return;
    var ph = makePlaceholder(hint);
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }
    // If the container has no real height of its own, fall back to a
    // self-sizing block so the box is still visible.
    if (container.getBoundingClientRect().height < 28) {
      ph.classList.add('sv-img-ph--block');
    }
    container.appendChild(ph);
  }

  function hintFor(img) {
    var alt = (img.getAttribute('alt') || '').trim();
    if (alt) return alt;
    var holder = img.closest('[data-team-photo]');
    if (holder) {
      var nameEl = holder.parentElement &&
        holder.parentElement.querySelector('.team-profile__name');
      if (nameEl) return nameEl.textContent.trim();
    }
    return '';
  }

  function boxImage(img) {
    if (img.dataset.svPh === '1' || inChrome(img)) return;
    img.dataset.svPh = '1';
    img.style.visibility = 'hidden';
    fill(img.parentElement, hintFor(img));
  }

  function scan() {
    var imgs = document.querySelectorAll('img');
    imgs.forEach(function (img) {
      if (img.dataset.svPh === '1' || inChrome(img)) return;
      var raw = img.getAttribute('data-svsrc') || '';
      var live = img.currentSrc || img.getAttribute('src') || '';
      // (2) temporary AI stand-in
      if (isTempSrc(raw) || isTempSrc(live)) { boxImage(img); return; }
      // (1) broken / no source
      if (img.complete) {
        if ((live || raw) && img.naturalWidth === 0) boxImage(img);
      } else {
        img.addEventListener('error', function () { boxImage(img); }, { once: true });
        img.addEventListener('load', function () {
          if (img.naturalWidth === 0) boxImage(img);
        }, { once: true });
      }
    });
    // (3) empty image containers
    document.querySelectorAll('[data-team-photo]').forEach(function (c) {
      if (inChrome(c)) return;
      if (!c.querySelector('img')) fill(c, hintFor({ getAttribute: function () { return ''; }, closest: function () { return c; } }) || 'Headshot');
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scan);
  } else {
    scan();
  }
  // Second pass after the data-svsrc loader has resolved real URLs / errors.
  window.addEventListener('load', function () { setTimeout(scan, 400); });
})();
