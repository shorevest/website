/* Careers page: steps the Career Paths scroll-snap track one team at a time.
   The controls stay hidden until this script marks the carousel ready, so
   pages that load without it fall back to a native horizontal scroller. */
(function () {
  'use strict';

  function init() {
    var root = document.querySelector('[data-careers-carousel]');
    if (!root) return;
    var track = root.querySelector('.careers-paths');
    if (!track) return;
    var slides = track.children;
    if (slides.length < 2) return;

    var prev = root.querySelector('[data-carousel-prev]');
    var next = root.querySelector('[data-carousel-next]');
    var current = root.querySelector('[data-carousel-current]');
    var total = root.querySelector('[data-carousel-total]');
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function pad(n) { return '' + n; }

    function index() {
      return Math.max(0, Math.min(slides.length - 1, Math.round(track.scrollLeft / track.clientWidth)));
    }

    function update() {
      var i = index();
      if (current) current.textContent = pad(i + 1);
      if (prev) prev.disabled = i === 0;
      if (next) next.disabled = i === slides.length - 1;
    }

    function go(delta) {
      var i = Math.max(0, Math.min(slides.length - 1, index() + delta));
      track.scrollTo({ left: i * track.clientWidth, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }

    if (total) total.textContent = pad(slides.length);
    if (prev) prev.addEventListener('click', function () { go(-1); });
    if (next) next.addEventListener('click', function () { go(1); });
    track.addEventListener('scroll', function () { window.requestAnimationFrame(update); }, { passive: true });
    window.addEventListener('resize', update);

    root.classList.add('is-ready');
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
