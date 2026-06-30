(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const onIdle = (cb) => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(cb, { timeout: 700 });
      return;
    }
    window.setTimeout(cb, 120);
  };

  const markReady = () => {
    document.body.classList.add('site-ready');
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', markReady, { once: true });
  } else {
    markReady();
  }

  const primeImages = () => {
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      if (!img.getAttribute('loading')) {
        img.loading = index < 3 ? 'eager' : 'lazy';
      }
      if (!img.getAttribute('decoding')) img.decoding = 'async';
      if (!img.getAttribute('fetchpriority') && index === 0) {
        img.fetchPriority = 'high';
      }
    });
  };

  const installReveals = () => {
    if (reduceMotion || !('IntersectionObserver' in window)) return;

    const candidates = document.querySelectorAll('section, article, main > *, .card, .tile, .stat, .timeline__item');
    candidates.forEach((el, idx) => {
      if (
        el.classList.contains('rev') ||
        el.classList.contains('sv-reveal') ||
        el.closest('.hero__sliver') ||
        el.classList.contains('reading') ||
        el.closest('.reading-grid')
      ) return;
      if (idx < 2) return;
      el.classList.add('sv-reveal');
      el.style.transitionDelay = `${Math.min((idx % 5) * 60, 240)}ms`;
    });

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in');
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

    document.querySelectorAll('.sv-reveal').forEach((el) => observer.observe(el));
  };

  const installBrandLineDraw = () => {
    const drawCards = document.querySelectorAll('.card-draw-on-view');
    if (!drawCards.length) return;

    if (reduceMotion || !('IntersectionObserver' in window)) {
      drawCards.forEach((card) => card.classList.add('is-visible'));
    } else {
      const drawObserver = new IntersectionObserver((entries, obs) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          obs.unobserve(entry.target);
        });
      }, { threshold: 0.2, rootMargin: '0px 0px -10% 0px' });

      drawCards.forEach((card) => drawObserver.observe(card));
    }

    if (!reduceMotion && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
      document.querySelectorAll('.card-draw-on-hover').forEach((card) => {
        card.addEventListener('mouseenter', () => {
          card.classList.remove('is-hover-drawing');
          window.requestAnimationFrame(() => card.classList.add('is-hover-drawing'));
        });
      });
    }
  };



  const installProofStatCountup = () => {
    const statSection = document.querySelector('.firm-stats-row');
    if (!statSection) return;

    const statValues = Array.from(statSection.querySelectorAll('.firm-stat__value[data-target]'));
    if (!statValues.length) return;

    const renderValue = (el, value) => {
      const target = Number(el.dataset.target || 0);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const numericText = target >= 1000
        ? new Intl.NumberFormat('en-US').format(value)
        : String(value);
      el.textContent = `${prefix}${numericText}${suffix}`;
    };

    statValues.forEach((el) => {
      const target = Number(el.dataset.target || 0);
      const prefix = el.dataset.prefix || '';
      const suffix = el.dataset.suffix || '';
      const formattedTarget = target >= 1000 ? new Intl.NumberFormat('en-US').format(target) : String(target);
      el.style.display = 'inline-block';
      el.style.whiteSpace = 'nowrap';
      el.style.minWidth = `${prefix}${formattedTarget}${suffix}`.length + 'ch';
    });

    if (reduceMotion || !('IntersectionObserver' in window)) {
      statValues.forEach((el) => {
        renderValue(el, Number(el.dataset.target || 0));
      });
      return;
    }

    let hasAnimated = false;
    // Mobile feel: keep the count-up brisk so it completes within a typical scroll glance.
    const duration = 1800;

    const animateAll = () => {
      const starts = statValues.map(() => 0);
      const targets = statValues.map((el) => Number(el.dataset.target || 0));
      const startTime = performance.now();

      const tick = (now) => {
        const elapsed = Math.min(now - startTime, duration);
        const progress = elapsed / duration;
        const eased = 1 - Math.pow(1 - progress, 3);

        statValues.forEach((el, idx) => {
          const next = Math.round(starts[idx] + (targets[idx] - starts[idx]) * eased);
          renderValue(el, next);
        });

        if (elapsed < duration) {
          window.requestAnimationFrame(tick);
          return;
        }

        statValues.forEach((el, idx) => renderValue(el, targets[idx]));
      };

      window.requestAnimationFrame(tick);
    };

    const observer = new IntersectionObserver((entries) => {
      const visible = entries.some((entry) => entry.isIntersecting);
      if (!visible || hasAnimated) return;
      hasAnimated = true;
      animateAll();
      observer.disconnect();
    }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });

    observer.observe(statSection);
  };

  const smoothHashJump = () => {
    if (reduceMotion || !window.location.hash) return;
    const node = document.getElementById(window.location.hash.slice(1));
    if (!node) return;
    requestAnimationFrame(() => {
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const installBackToTop = () => {
    if (document.querySelector('.back-to-top, .sv-back-to-top')) return;

    const button = document.createElement('button');
    button.className = 'sv-back-to-top back-to-top';
    button.type = 'button';
    button.setAttribute('aria-label', 'Back to top');
    button.innerHTML = `
      <svg class="back-to-top__icon" viewBox="0 0 18 18" aria-hidden="true" focusable="false">
        <path d="M9 14V4.75M4.75 9 9 4.75 13.25 9" />
      </svg>
    `;

    let footerInView = false;
    const toggleVisibility = () => {
      const shouldShow = window.scrollY > 500 && !footerInView;
      button.classList.toggle('is-visible', shouldShow);
    };

    button.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    });

    document.body.appendChild(button);
    toggleVisibility();
    window.addEventListener('scroll', toggleVisibility, { passive: true });

    const footer = document.querySelector('.sv-footer, footer');
    if (!footer || !('IntersectionObserver' in window)) return;

    const footerObserver = new IntersectionObserver((entries) => {
      footerInView = entries.some((entry) => entry.isIntersecting);
      toggleVisibility();
    }, { rootMargin: '0px 0px 56px 0px', threshold: 0.01 });

    footerObserver.observe(footer);
  };

  const COUNT_UP_DURATION_MS = 1800;

  const installCountUpStats = () => {
    const sections = document.querySelectorAll('[data-count-group]');
    if (!sections.length) return;

    const renderCount = (node, value) => {
      const prefix = node.dataset.countPrefix ?? '';
      const suffix = node.dataset.countSuffix ?? '';
      const format = node.dataset.countFormat ?? '';
      const renderedValue = format === 'comma' ? value.toLocaleString('en-US') : String(value);
      const trailingBreak = node.querySelector('.firm-stat__value-break');
      node.textContent = `${prefix}${renderedValue}${suffix}`;
      if (trailingBreak) node.appendChild(trailingBreak);
    };

    const runSection = (section) => {
      if (section.dataset.countAnimated === 'true') return;
      const counters = section.querySelectorAll('[data-count-target]');
      if (!counters.length) return;
      counters.forEach((counter) => {
        const prefix = counter.dataset.countPrefix ?? '';
        const suffix = counter.dataset.countSuffix ?? '';
        const target = Number(counter.dataset.countTarget || 0);
        const format = counter.dataset.countFormat ?? '';
        const renderedValue = format === 'comma' ? target.toLocaleString('en-US') : String(target);
        const finalText = `${prefix}${renderedValue}${suffix}`;
        counter.style.display = 'inline-block';
        counter.style.minWidth = `${finalText.length}ch`;
      });

      const finish = () => {
        counters.forEach((counter) => renderCount(counter, Number(counter.dataset.countTarget || 0)));
        section.dataset.countAnimated = 'true';
      };

      if (reduceMotion) {
        finish();
        return;
      }

      const start = performance.now();
      const tick = (now) => {
        const progress = Math.min((now - start) / COUNT_UP_DURATION_MS, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        counters.forEach((counter) => {
          const target = Number(counter.dataset.countTarget || 0);
          renderCount(counter, Math.round(target * eased));
        });
        if (progress < 1) {
          requestAnimationFrame(tick);
          return;
        }
        finish();
      };
      requestAnimationFrame(tick);
    };

    if (!('IntersectionObserver' in window)) {
      sections.forEach((section) => runSection(section));
      return;
    }

    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        runSection(entry.target);
        obs.unobserve(entry.target);
      });
    }, { threshold: 0.25, rootMargin: '0px 0px -8% 0px' });

    sections.forEach((section) => observer.observe(section));
  };

  const init = () => {
    primeImages();
    smoothHashJump();
    onIdle(() => {
      installReveals();
      installBrandLineDraw();
      installBackToTop();
      installProofStatCountup();
      installCountUpStats();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
