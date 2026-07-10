/* China Debt Dynamics Archive — filter chips, row navigation, keyboard a11y */
(function () {
  const root = document.querySelector('[data-cdd-arc]');
  if (!root) return;

  const rows = Array.from(root.querySelectorAll('.cdd-arc__row'));
  const chips = Array.from(root.querySelectorAll('.cdd-arc__chip'));
  const yearMarkers = Array.from(root.querySelectorAll('.cdd-arc__year'));
  const counter = root.querySelector('[data-cdd-arc-count]');
  const search = root.querySelector('[data-cdd-arc-search]');
  const empty = root.querySelector('[data-cdd-arc-empty]');
  const reset = root.querySelector('[data-cdd-arc-reset]');

  // Cache each row's searchable text once (title + excerpt + category).
  rows.forEach((row) => {
    row.dataset.cddArcText = (row.textContent || '').toLowerCase().replace(/\s+/g, ' ').trim();
  });

  let activeTopic = 'all';
  let activeQuery = '';

  /* --- Whole-row navigation + keyboard (Enter opens article) --- */
  rows.forEach((row) => {
    const href = row.getAttribute('data-href');
    if (!href) return;

    row.addEventListener('click', (event) => {
      // Let real links (Read / PDF) behave normally.
      if (event.target.closest('a')) return;
      window.open(href, '_blank', 'noopener');
    });

    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        window.open(href, '_blank', 'noopener');
      }
    });
  });

  /* --- Combined topic + search filter --- */
  const applyFilter = () => {
    let visible = 0;

    rows.forEach((row) => {
      const topicMatch = activeTopic === 'all' || row.getAttribute('data-topic') === activeTopic;
      const textMatch = !activeQuery || (row.dataset.cddArcText || '').indexOf(activeQuery) !== -1;
      const match = topicMatch && textMatch;
      row.hidden = !match;
      // Request-only placeholders (no readable article) are shown under "All"
      // but never counted as readable articles.
      if (match && !row.hasAttribute('data-cdd-arc-exclude')) visible += 1;
    });

    // Hide a year marker when none of its rows are visible.
    yearMarkers.forEach((marker) => {
      let next = marker.nextElementSibling;
      let hasVisible = false;
      while (next && !next.classList.contains('cdd-arc__year')) {
        if (next.classList.contains('cdd-arc__row') && !next.hidden) {
          hasVisible = true;
          break;
        }
        next = next.nextElementSibling;
      }
      marker.hidden = !hasVisible;
    });

    if (counter) {
      counter.textContent = String(visible);
    }
    if (empty) {
      empty.hidden = visible !== 0;
    }
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.toggle('is-active', c === chip);
        c.setAttribute('aria-selected', c === chip ? 'true' : 'false');
      });
      activeTopic = chip.getAttribute('data-topic') || 'all';
      applyFilter();
    });
  });

  if (search) {
    search.addEventListener('input', () => {
      activeQuery = search.value.toLowerCase().trim();
      applyFilter();
    });
  }

  /* --- Clear-filters button in the empty state --- */
  if (reset) {
    reset.addEventListener('click', () => {
      activeQuery = '';
      activeTopic = 'all';
      if (search) search.value = '';
      chips.forEach((c) => {
        const isAll = c.getAttribute('data-topic') === 'all';
        c.classList.toggle('is-active', isAll);
        c.setAttribute('aria-selected', isAll ? 'true' : 'false');
      });
      applyFilter();
      if (search) search.focus();
    });
  }
})();
