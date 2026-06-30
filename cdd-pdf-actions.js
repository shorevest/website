(function () {
  const selectors = '[data-cdd-pdf-action][data-cdd-pdf-url]';
  const elements = Array.from(document.querySelectorAll(selectors));
  if (!elements.length) return;

  const cache = new Map();

  const checkPdfExists = async (url) => {
    if (cache.has(url)) return cache.get(url);

    const resultPromise = (async () => {
      try {
        const headResponse = await fetch(url, { method: 'HEAD' });
        if (headResponse.ok) return true;

        const getResponse = await fetch(url, { method: 'GET' });
        return getResponse.ok;
      } catch (_) {
        return false;
      }
    })();

    cache.set(url, resultPromise);
    return resultPromise;
  };

  const markUnavailable = (element) => {
    const unavailableLabel = element.dataset.cddPdfLabelUnavailable || 'PDF coming soon';

    element.classList.add('is-disabled');
    element.setAttribute('aria-disabled', 'true');

    if (element.tagName === 'BUTTON') {
      element.disabled = true;
    } else if (element.tagName === 'A') {
      element.removeAttribute('href');
      element.removeAttribute('target');
      element.removeAttribute('rel');
      element.setAttribute('tabindex', '-1');
    }

    element.textContent = unavailableLabel;
  };

  const activatePdf = (element, url) => {
    if (element.tagName === 'A') {
      element.href = url;
      element.target = '_blank';
      element.rel = 'noopener';
      return;
    }

    element.addEventListener('click', () => {
      window.open(url, '_blank', 'noopener');
    });
  };

  Promise.all(
    elements.map(async (element) => {
      const pdfUrl = element.dataset.cddPdfUrl;
      if (!pdfUrl) return;

      const available = await checkPdfExists(pdfUrl);
      if (available) {
        activatePdf(element, pdfUrl);
      } else {
        markUnavailable(element);
      }
    })
  );
})();
