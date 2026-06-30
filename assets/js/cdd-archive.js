/* China Debt Dynamics Archive — filter chips, row navigation, keyboard a11y */
(function () {
  const root = document.querySelector('[data-cdd-arc]');
  if (!root) return;

  const rows = Array.from(root.querySelectorAll('.cdd-arc__row'));
  const chips = Array.from(root.querySelectorAll('.cdd-arc__chip'));
  const yearMarkers = Array.from(root.querySelectorAll('.cdd-arc__year'));
  const counter = root.querySelector('[data-cdd-arc-count]');

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

  /* --- Filter chips --- */
  const applyFilter = (topic) => {
    let visible = 0;

    rows.forEach((row) => {
      const match = topic === 'all' || row.getAttribute('data-topic') === topic;
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
  };

  chips.forEach((chip) => {
    chip.addEventListener('click', () => {
      chips.forEach((c) => {
        c.classList.toggle('is-active', c === chip);
        c.setAttribute('aria-selected', c === chip ? 'true' : 'false');
      });
      applyFilter(chip.getAttribute('data-topic') || 'all');
    });
  });
})();
