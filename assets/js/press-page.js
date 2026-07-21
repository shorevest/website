/* ============================================================
   MEDIA PAGE — temporary archive holding state
   The article archive is intentionally removed from the rendered
   page while the section is being refreshed.
   ============================================================ */
(function () {
  "use strict";

  function ready(fn) {
    if (document.readyState !== "loading") fn();
    else document.addEventListener("DOMContentLoaded", fn);
  }

  ready(function () {
    var section = document.getElementById("archive");
    if (!section) return;

    var shell = section.querySelector(".sv-shell");
    if (!shell) {
      section.hidden = true;
      return;
    }

    var isChinese = (document.documentElement.lang || "")
      .toLowerCase()
      .indexOf("zh") === 0;

    /* Replace the archive markup completely so no article rows,
       filters, featured item or load-more control remain visible. */
    shell.innerHTML = isChinese
      ? '<div class="pr-section-head"><div class="pr-section-head__l"><h2 class="pr-section-title" id="pr-archive-title">媒体资料库</h2></div></div>' +
        '<div class="pr-featured pr-archive-coming-soon" role="status" aria-live="polite">' +
          '<div class="pr-featured__meta"><span class="pr-featured__tag">更新中</span><span class="pr-featured__pub">媒体资料库</span></div>' +
          '<div class="pr-featured__body"><h3 class="pr-featured__title">即将上线</h3><p class="pr-featured__desc">我们正在更新此部分，更新后的媒体资料库将于近期发布。</p></div>' +
        '</div>'
      : '<div class="pr-section-head"><div class="pr-section-head__l"><h2 class="pr-section-title" id="pr-archive-title">Media archive</h2></div></div>' +
        '<div class="pr-featured pr-archive-coming-soon" role="status" aria-live="polite">' +
          '<div class="pr-featured__meta"><span class="pr-featured__tag">Update</span><span class="pr-featured__pub">Media archive</span></div>' +
          '<div class="pr-featured__body"><h3 class="pr-featured__title">Coming soon</h3><p class="pr-featured__desc">We are updating this section and will publish the refreshed media archive soon.</p></div>' +
        '</div>';

    var archiveLink = document.querySelector('.sv-hero__cta a[href="#archive"]');
    if (archiveLink) {
      archiveLink.innerHTML =
        (isChinese ? "媒体资料库即将上线" : "Media archive coming soon") +
        '<span aria-hidden="true">→</span>';
    }

    var panelRows = document.querySelectorAll(".sv-hero__panel-row");
    Array.prototype.forEach.call(panelRows, function (row) {
      var term = row.querySelector("dt");
      var value = row.querySelector("dd");
      if (!term || !value) return;

      var label = term.textContent.trim().toLowerCase();
      if (
        label === "archive" ||
        label.indexOf("档案") !== -1 ||
        label.indexOf("资料") !== -1
      ) {
        value.textContent = isChinese ? "即将更新" : "Updating soon";
      }
    });
  });
})();
