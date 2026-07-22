/* ==========================================================================
   ShoreVest One — Asset Tracing interaction compatibility

   The shell re-renders the whole routed view. The case-list search therefore
   records text locally while typing and applies the filter on Enter or blur,
   rather than re-rendering after every keystroke and dropping keyboard focus.
   ========================================================================== */
(function (root) {
  'use strict';

  function isCaseSearch(target) {
    return target && target.matches && target.matches('.at-filters input[type="search"]');
  }

  root.document.addEventListener('input', function (event) {
    if (!isCaseSearch(event.target)) return;
    var SVOps = root.SVOps;
    var filters = SVOps.state.assetTracingFilters || (SVOps.state.assetTracingFilters = { q: '', status: 'All' });
    filters.q = event.target.value;
    /* Prevent the prototype view's immediate full-shell re-render. The browser
       still performs the text input because default behaviour is not cancelled. */
    event.stopImmediatePropagation();
  }, true);

  root.document.addEventListener('keydown', function (event) {
    if (!isCaseSearch(event.target) || event.key !== 'Enter') return;
    event.preventDefault();
    root.dispatchEvent(new CustomEvent('svops:render'));
  }, true);

  root.document.addEventListener('change', function (event) {
    if (!isCaseSearch(event.target)) return;
    root.dispatchEvent(new CustomEvent('svops:render'));
  }, true);
})(typeof self !== 'undefined' ? self : this);
