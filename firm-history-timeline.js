(function () {
  const section = document.querySelector('[data-history-timeline]');
  if (!section) return;

  const milestones = [
    {
      year: '2004',
      title: 'The strategy begins',
      body:
        'The underlying strategy began in 2004 with a focused approach to onshore, asset-backed private credit in China. Early execution centered on legal enforceability, collateral quality, and downside control in a still-forming market environment.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
    {
      year: '2005',
      title: 'First institutional NPL cycle',
      body:
        'As institutional NPL activity developed, execution moved from isolated opportunities toward a repeatable underwriting and resolution process. Practical lessons came from court pathways, counterparty coordination, and recovery discipline.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
    {
      year: '2008',
      title: 'Investing through the global financial crisis',
      body:
        'During the 2008 dislocation, deployment emphasized claim enforceability, collateral coverage, and selective risk. The cycle reinforced a process-first approach rather than dependence on broad market direction.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
    {
      year: '2011–2015',
      title: 'Refining the playbook',
      body:
        'From 2011 to 2015, the team refined legal structuring, covenant design, and recovery planning standards across multiple outcomes. This period consolidated a tighter operating model across sourcing, underwriting, and servicing.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
    {
      year: '2016',
      title: 'ShoreVest is established',
      body:
        'ShoreVest was established as a formal firm in 2016. The firm structure built on strategy experience dating to 2004, with governance and reporting systems formalized for institutional continuity.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
    {
      year: '2017–2018',
      title: 'A new market window opens',
      body:
        'Regulatory and financing shifts in 2017–2018 created a new set of onshore opportunities. Execution remained selective, with an emphasis on structure, enforceability, and process certainty.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
    {
      year: '2018–2024',
      title: 'Proof through execution',
      body:
        'Across 2018–2024, outcomes were driven by disciplined deployment, active servicing, and repeatable workout execution through uneven market conditions. The record reflects process consistency across multiple cycles.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
    {
      year: '2025 onward',
      title: 'Building the hundred-year firm',
      body:
        'From 2025 onward, priorities are platform durability, governance quality, and long-horizon team continuity. The objective is to preserve a specialist onshore credit capability through changing legal and regulatory contexts.',
      archiveLabel: 'ARCHIVAL MATERIAL',
    },
  ];

  const introText =
    'This history tracks the development of a specialist onshore credit platform in China through shifting market cycles, legal frameworks, and regulatory conditions. The strategy history begins in 2004; ShoreVest as a formal firm begins in 2016.';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const useStaticTimeline = reduceMotion;
  const trackList = section.querySelector('[data-timeline-track-list]');
  const panelStack = section.querySelector('[data-timeline-panel-stack]');
  const cardStack = section.querySelector('[data-timeline-mobile-stack]');
  const introNode = section.querySelector('[data-history-intro]');
  const scrollArea = section.querySelector('[data-history-scroll-area]');
  const track = section.querySelector('.history-track');

  if (!trackList || !panelStack || !cardStack || !introNode || !scrollArea || !track) return;

  introNode.textContent = introText;
  section.classList.toggle('is-static', useStaticTimeline);

  const markerButtons = [];
  const markerItems = [];
  const panelItems = [];
  const cardItems = [];

  const createImagePanel = (milestone) => {
    const wrap = document.createElement('aside');
    wrap.className = 'history-image-panel';
    wrap.setAttribute('aria-label', `Archival material for ${milestone.year}`);

    const media = document.createElement('span');
    media.className = 'history-image-panel__media';

    const year = document.createElement('span');
    year.className = 'history-image-panel__year';
    year.textContent = milestone.year;

    const label = document.createElement('span');
    label.className = 'history-image-panel__label';
    label.textContent = milestone.archiveLabel;

    wrap.append(media, year, label);
    return wrap;
  };

  milestones.forEach((milestone, index) => {
    const markerItem = document.createElement('li');
    markerItem.className = 'history-marker';

    const markerDot = document.createElement('span');
    markerDot.className = 'history-marker__dot';
    markerDot.setAttribute('aria-hidden', 'true');

    const markerButton = document.createElement('button');
    markerButton.type = 'button';
    markerButton.className = 'history-marker__button';
    markerButton.textContent = milestone.year;
    markerButton.setAttribute('aria-controls', `history-panel-${index}`);
    markerButton.setAttribute('aria-label', `Go to ${milestone.year}`);
    markerButton.addEventListener('click', () => {
      if (window.innerWidth < 980) {
        const targetCard = cardItems[index];
        if (targetCard) {
          targetCard.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' });
        }
        return;
      }
      if (useStaticTimeline) {
        const targetPanel = panelItems[index];
        if (targetPanel) {
          targetPanel.scrollIntoView({ behavior: 'auto', block: 'start' });
        }
        return;
      }
      const viewport = window.innerHeight || 1;
      const targetProgress = milestones.length === 1 ? 0 : index / (milestones.length - 1);
      const sectionTop = window.scrollY + scrollArea.getBoundingClientRect().top;
      const totalRange = Math.max(scrollArea.offsetHeight - viewport, 1);
      const targetScroll = sectionTop + targetProgress * totalRange;
      window.scrollTo({ top: targetScroll, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    markerItem.append(markerDot, markerButton);
    trackList.appendChild(markerItem);

    markerButtons.push(markerButton);
    markerItems.push(markerItem);

    const panel = document.createElement('article');
    panel.className = 'history-panel__item';
    panel.id = `history-panel-${index}`;

    const content = document.createElement('div');
    content.className = 'history-panel__content';

    const year = document.createElement('p');
    year.className = 'history-panel__year';
    year.textContent = milestone.year;

    const title = document.createElement('h3');
    title.className = 'history-panel__title';
    title.textContent = milestone.title;

    const body = document.createElement('p');
    body.className = 'history-panel__body';
    body.textContent = milestone.body;

    content.append(year, title, body);
    panel.append(content, createImagePanel(milestone));
    panelStack.appendChild(panel);
    panelItems.push(panel);

    const card = document.createElement('article');
    card.className = 'history-card';
    card.innerHTML = `
      <p class="history-card__year">${milestone.year}</p>
      <h3 class="history-card__title">${milestone.title}</h3>
      <p class="history-card__body">${milestone.body}</p>
    `;
    card.appendChild(createImagePanel(milestone));
    cardStack.appendChild(card);
    cardItems.push(card);
  });

  function updateConnector(index, floatIndex) {
    const marker = markerItems[index];
    if (!marker) return;
    const trackRect = track.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    const x = markerRect.left + markerRect.width / 2 - trackRect.left;
    const strength = Math.max(0.2, 1 - Math.abs(index - floatIndex));

    section.style.setProperty('--sv-history-connector-x', `${x.toFixed(1)}px`);
    section.style.setProperty('--sv-history-connector-strength', strength.toFixed(3));
  }

  function updateStage(index, progress, floatIndex) {
    section.style.setProperty('--sv-history-progress', String(progress));

    markerItems.forEach((item, markerIndex) => {
      const delta = Math.abs(markerIndex - floatIndex);
      const emphasis = Math.max(0, 1 - delta);
      const isPassed = markerIndex <= floatIndex;
      const isActive = markerIndex === index;

      item.style.setProperty('--sv-node-emphasis', emphasis.toFixed(3));
      item.classList.toggle('is-passed', isPassed);
      item.classList.toggle('is-active', isActive);
    });

    markerButtons.forEach((button, markerIndex) => {
      const isActive = markerIndex === index;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-current', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    });

    panelItems.forEach((panel, panelIndex) => {
      const isActive = panelIndex === index;
      const direction = panelIndex < index ? -1 : 1;

      panel.classList.toggle('is-active', isActive);
      panel.setAttribute('aria-hidden', isActive ? 'false' : 'true');

      if (!reduceMotion) {
        panel.style.opacity = isActive ? '1' : '0';
        panel.style.transform = isActive ? 'translateY(0px)' : `translateY(${direction * 10}px)`;
      }
    });

    updateConnector(index, floatIndex);
  }

  function desktopTick() {
    if (window.innerWidth < 980) return;

    const viewport = window.innerHeight || 1;
    const rect = scrollArea.getBoundingClientRect();
    const totalScrollable = Math.max(scrollArea.offsetHeight - viewport, 1);
    const traveled = Math.min(Math.max(-rect.top, 0), totalScrollable);
    const progress = traveled / totalScrollable;

    const floatIndex = progress * (milestones.length - 1);
    const nextIndex = Math.min(milestones.length - 1, Math.max(0, Math.round(floatIndex)));

    updateStage(nextIndex, progress, floatIndex);
  }

  function resizeTimelineHeight() {
    if (window.innerWidth < 980) {
      scrollArea.style.removeProperty('--history-scroll-height');
      return;
    }

    const viewport = window.innerHeight || 1;
    const multiplier = reduceMotion ? 0.74 : 1.08;
    const totalHeight = Math.max(Math.round(viewport * (1 + (milestones.length - 1) * multiplier)), viewport * 3);
    scrollArea.style.setProperty('--history-scroll-height', `${totalHeight}px`);
  }

  let raf = null;
  const onScroll = () => {
    if (raf) return;
    raf = window.requestAnimationFrame(() => {
      desktopTick();
      raf = null;
    });
  };

  updateStage(0, 0, 0);
  resizeTimelineHeight();
  desktopTick();

  if (useStaticTimeline) {
    markerButtons.forEach((button) => {
      button.removeAttribute('aria-current');
      button.tabIndex = 0;
    });
    return;
  }

  window.addEventListener('resize', () => {
    resizeTimelineHeight();
    desktopTick();
  });
  window.addEventListener('scroll', onScroll, { passive: true });

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const cards = cardStack.querySelectorAll('.history-card');
    const observer = new IntersectionObserver(
      (entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-in');
          obs.unobserve(entry.target);
        });
      },
      { threshold: 0.2, rootMargin: '0px 0px -8% 0px' }
    );
    cards.forEach((card) => observer.observe(card));
  } else {
    cardStack.querySelectorAll('.history-card').forEach((card) => card.classList.add('is-in'));
  }
})();
