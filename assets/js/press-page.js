/* ============================================================
   PRESS / MEDIA PAGE — archive controls
   Progressive enhancement over the server-rendered archive:
   builds the Year and Publication filters from the rows in the
   DOM, filters on change, and reveals rows in batches.
   No external data; the markup is the source of truth.
   ============================================================ */
(function () {
  "use strict";

  var PAGE_SIZE = 8;

  function ready(fn) {
    if (document.readyState !== "loading") {
      fn();
    } else {
      document.addEventListener("DOMContentLoaded", fn);
    }
  }

  ready(function () {
    var archive = document.getElementById("press-archive");
    if (!archive) return;
    // Pull approved items from the media queue and inject them into the archive
    // (by date) BEFORE building the filters, so data-driven items behave exactly
    // like the curated rows. The approval gate lives in the JSON (status field).
    injectQueue(archive, function () { runArchive(archive); });
  });

  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function buildRow(item) {
    var art = document.createElement("article");
    art.className = "press-row";
    art.setAttribute("data-type-label", String(item.type || "").toUpperCase());
    var a = document.createElement("a");
    a.href = item.url || "#";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.innerHTML =
      '<span class="press-publication">' + esc(item.publication) + "</span>" +
      '<span class="press-row__content"><span class="press-type-line"><span class="press-tag">' + esc(item.type) + "</span></span>" +
      '<span class="press-headline">' + esc(item.headline) + "</span>" +
      '<span class="press-row__summary">' + esc(item.summary) + "</span></span>" +
      '<span class="press-row__meta"><span class="press-attribution">' + esc(item.attribution || "ShoreVest commentary") + "</span>" +
      '<time class="press-date" datetime="' + esc(item.date) + '">' + esc(item.dateDisplay || item.date) + "</time></span>";
    art.appendChild(a);
    return art;
  }

  function rowDate(row) {
    var t = row.querySelector("time.press-date, time");
    return t ? (t.getAttribute("datetime") || "") : "";
  }

  function injectQueue(archive, done) {
    var url = (window.__svTok ? window.__svTok("assets/data/media-queue.json") : "assets/data/media-queue.json");
    var finished = false;
    var finish = function () { if (!finished) { finished = true; done(); } };
    // Never let a missing/failed feed block the curated archive.
    var guard = setTimeout(finish, 4000);
    try {
      fetch(url, { cache: "no-store" })
        .then(function (r) { return r.ok ? r.json() : { items: [] }; })
        .then(function (data) {
          var items = (data && data.items) || [];
          // APPROVAL GATE: only approved items render.
          var approved = items.filter(function (it) { return it && it.status === "approved" && it.url; });
          approved.forEach(function (item) {
            var row = buildRow(item);
            var d = item.date || "";
            // Insert in reverse-chronological order among existing rows.
            var rows = Array.prototype.slice.call(archive.querySelectorAll(".press-row"));
            var before = null;
            for (var i = 0; i < rows.length; i++) {
              if (d > rowDate(rows[i])) { before = rows[i]; break; }
            }
            if (before) archive.insertBefore(row, before);
            else archive.appendChild(row);
          });
          clearTimeout(guard); finish();
        })
        .catch(function () { clearTimeout(guard); finish(); });
    } catch (e) { clearTimeout(guard); finish(); }
  }

  function runArchive(archive) {
    var isChinese = (document.documentElement.lang || "").toLowerCase().indexOf("zh") === 0;

    var rows = Array.prototype.slice.call(archive.querySelectorAll(".press-row"));
    if (!rows.length) return;

    var yearSelect = document.getElementById("press-year-select");
    var pubSelect = document.getElementById("press-publication-select");
    var countEl = document.getElementById("press-results-count");
    var moreBtn = document.getElementById("press-more-btn");

    var visibleCount = PAGE_SIZE;

    // ---- Derive year + publication for each row from the DOM ----
    var data = rows.map(function (row) {
      var timeEl = row.querySelector("time.press-date, time");
      var year = "";
      if (timeEl) {
        var dt = timeEl.getAttribute("datetime") || timeEl.textContent || "";
        var match = dt.match(/\d{4}/);
        year = match ? match[0] : "";
      }
      var pubEl = row.querySelector(".press-publication");
      var pub = pubEl ? pubEl.textContent.trim() : "";
      return { row: row, year: year, pub: pub };
    });

    // ---- Populate the filter dropdowns ----
    function unique(values) {
      var seen = {};
      var out = [];
      values.forEach(function (v) {
        if (v && !seen[v]) {
          seen[v] = true;
          out.push(v);
        }
      });
      return out;
    }

    function fillSelect(select, options) {
      if (!select) return;
      options.forEach(function (value) {
        var opt = document.createElement("option");
        opt.value = value;
        opt.textContent = value;
        select.appendChild(opt);
      });
    }

    var years = unique(
      data.map(function (d) {
        return d.year;
      })
    ).sort(function (a, b) {
      return Number(b) - Number(a);
    });

    var pubs = unique(
      data.map(function (d) {
        return d.pub;
      })
    ).sort(function (a, b) {
      return a.localeCompare(b);
    });

    fillSelect(yearSelect, years);
    fillSelect(pubSelect, pubs);

    // ---- Filter + paginate ----
    function currentMatches() {
      var year = yearSelect ? yearSelect.value : "All";
      var pub = pubSelect ? pubSelect.value : "All";
      return data.filter(function (d) {
        var yearOk = year === "All" || d.year === year;
        var pubOk = pub === "All" || d.pub === pub;
        return yearOk && pubOk;
      });
    }

    function render() {
      var matches = currentMatches();
      var matchSet = matches.map(function (d) {
        return d.row;
      });

      data.forEach(function (d) {
        d.row.hidden = matchSet.indexOf(d.row) === -1;
      });

      var shown = 0;
      matches.forEach(function (d, i) {
        var visible = i < visibleCount;
        d.row.hidden = !visible;
        if (visible) shown++;
      });

      if (countEl) {
        if (matches.length === 0) {
          countEl.textContent = isChinese
            ? "没有符合所选筛选条件的项目。"
            : "No items match the selected filters.";
        } else {
          countEl.textContent = isChinese
            ? "显示 " + matches.length + " 项中的 " + shown + " 项"
            : "Showing " + shown + " of " + matches.length;
        }
      }

      if (moreBtn) {
        moreBtn.hidden = shown >= matches.length;
      }
    }

    function resetAndRender() {
      visibleCount = PAGE_SIZE;
      render();
    }

    if (yearSelect) yearSelect.addEventListener("change", resetAndRender);
    if (pubSelect) pubSelect.addEventListener("change", resetAndRender);
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        visibleCount += PAGE_SIZE;
        render();
      });
    }

    render();
  }
})();
