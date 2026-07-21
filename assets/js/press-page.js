/* ============================================================
   MEDIA PAGE — temporary archive holding state
   The historical article archive is intentionally removed while
   the section is being reviewed and refreshed.
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

    /* Explicitly use the same page shell as the event ledgers. This avoids
       the archive notice drifting outside the standard desktop and mobile
       margins even if another stylesheet changes the generic shell rules. */
    shell.style.width = "100%";
    shell.style.maxWidth = "1280px";
    shell.style.marginInline = "auto";
    shell.style.paddingInline = "clamp(24px, 5vw, 48px)";
    shell.style.boxSizing = "border-box";

    shell.innerHTML = isChinese
      ? '<div class="pr-archive-hold" role="status" aria-live="polite" style="width:100%;max-width:760px;box-sizing:border-box;padding-block:clamp(20px,2vw,32px)">' +
          '<p class="pr-featured__tag" style="margin:0 0 28px">媒体资料库</p>' +
          '<h2 id="pr-archive-title" style="margin:0 0 28px;max-width:13ch;font:500 clamp(44px,5vw,68px)/1.05 var(--sv-font);letter-spacing:-0.035em;color:var(--sv-ink)">更新后的媒体资料库即将上线。</h2>' +
          '<p style="margin:0;max-width:68ch;font:400 clamp(17px,1.55vw,21px)/1.65 var(--sv-font);color:var(--sv-ink-2)">我们正在审核并更新历史媒体报道。在相关工作完成之前，媒体资料库中的文章将暂时无法访问。</p>' +
        '</div>'
      : '<div class="pr-archive-hold" role="status" aria-live="polite" style="width:100%;max-width:760px;box-sizing:border-box;padding-block:clamp(20px,2vw,32px)">' +
          '<p class="pr-featured__tag" style="margin:0 0 28px">Media archive</p>' +
          '<h2 id="pr-archive-title" style="margin:0 0 28px;max-width:13ch;font:500 clamp(44px,5vw,68px)/1.05 var(--sv-font);letter-spacing:-0.035em;color:var(--sv-ink)">Updated archive coming soon.</h2>' +
          '<p style="margin:0;max-width:68ch;font:400 clamp(17px,1.55vw,21px)/1.65 var(--sv-font);color:var(--sv-ink-2)">We are reviewing and updating the historical media coverage. Individual archive articles are temporarily unavailable while that work is completed.</p>' +
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
