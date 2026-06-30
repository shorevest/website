/* ============================================================
   Selected speaking appearances → auto-playing carousel
   Progressive enhancement: if JS is off the grid renders as a
   normal responsive grid. We wrap the existing grid in a
   viewport + add arrows, dots and autoplay.
   ============================================================ */
(function () {
  "use strict";

  function init() {
    var section = document.querySelector(".press-appearances");
    if (!section) return;
    var track = section.querySelector(".press-appearances__grid");
    if (!track || track.dataset.carousel === "ready") return;

    var cards = Array.prototype.slice.call(
      track.querySelectorAll(".appearance-card")
    );
    if (cards.length < 2) return;

    // --- build shell -------------------------------------------------
    track.dataset.carousel = "ready";
    track.classList.add("sv-carousel__track");

    var carousel = document.createElement("div");
    carousel.className = "sv-carousel";
    var viewport = document.createElement("div");
    viewport.className = "sv-carousel__viewport";

    track.parentNode.insertBefore(carousel, track);
    carousel.appendChild(viewport);
    viewport.appendChild(track);

    // --- controls ----------------------------------------------------
    var controls = document.createElement("div");
    controls.className = "sv-carousel__controls";

    var arrows = document.createElement("div");
    arrows.className = "sv-carousel__arrows";
    var prev = document.createElement("button");
    prev.type = "button";
    prev.className = "sv-carousel__btn";
    prev.setAttribute("aria-label", "Previous appearance");
    prev.innerHTML = "\u2190";
    var next = document.createElement("button");
    next.type = "button";
    next.className = "sv-carousel__btn";
    next.setAttribute("aria-label", "Next appearance");
    next.innerHTML = "\u2192";
    arrows.appendChild(prev);
    arrows.appendChild(next);

    var dotsWrap = document.createElement("div");
    dotsWrap.className = "sv-carousel__dots";
    dotsWrap.setAttribute("role", "tablist");
    dotsWrap.setAttribute("aria-label", "Choose appearance");

    var status = document.createElement("p");
    status.className = "sv-carousel__status";

    controls.appendChild(arrows);
    controls.appendChild(dotsWrap);
    controls.appendChild(status);
    carousel.appendChild(controls);

    // --- helpers -----------------------------------------------------
    function perView() {
      var w = window.innerWidth;
      if (w <= 640) return 1;
      if (w <= 1000) return 2;
      return 3;
    }

    var pages = [];
    var dots = [];
    var current = 0;

    function buildDots() {
      var pv = perView();
      var count = Math.max(1, Math.ceil(cards.length / pv));
      // first card index that starts each page
      pages = [];
      for (var i = 0; i < count; i++) pages.push(Math.min(i * pv, cards.length - 1));
      dotsWrap.innerHTML = "";
      dots = [];
      for (var d = 0; d < count; d++) {
        (function (idx) {
          var dot = document.createElement("button");
          dot.type = "button";
          dot.className = "sv-carousel__dot";
          dot.setAttribute("role", "tab");
          dot.setAttribute("aria-label", "Go to appearance " + (idx + 1));
          dot.addEventListener("click", function () {
            goTo(idx, true);
          });
          dotsWrap.appendChild(dot);
          dots.push(dot);
        })(d);
      }
    }

    function update() {
      for (var i = 0; i < dots.length; i++) {
        dots[i].setAttribute("aria-current", i === current ? "true" : "false");
      }
      status.textContent =
        "Auto · " + (current + 1) + " / " + dots.length;
    }

    function goTo(page, userInitiated) {
      if (page < 0) page = dots.length - 1;
      if (page >= dots.length) page = 0;
      current = page;
      var cardIndex = pages[page];
      var targetCard = cards[cardIndex];
      if (targetCard) {
        track.scrollTo({
          left: targetCard.offsetLeft - track.offsetLeft,
          behavior: "smooth"
        });
      }
      update();
      if (userInitiated) restart();
    }

    // sync the active dot when the user scrolls/swipes manually
    var scrollTimer = null;
    track.addEventListener("scroll", function () {
      if (scrollTimer) window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(function () {
        var nearest = 0;
        var min = Infinity;
        for (var i = 0; i < pages.length; i++) {
          var c = cards[pages[i]];
          var dist = Math.abs(c.offsetLeft - track.offsetLeft - track.scrollLeft);
          if (dist < min) {
            min = dist;
            nearest = i;
          }
        }
        if (nearest !== current) {
          current = nearest;
          update();
        }
      }, 90);
    });

    prev.addEventListener("click", function () {
      goTo(current - 1, true);
    });
    next.addEventListener("click", function () {
      goTo(current + 1, true);
    });

    // --- autoplay ----------------------------------------------------
    var DELAY = 4500;
    var timer = null;
    var prefersReduced =
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function play() {
      if (prefersReduced) return;
      stop();
      timer = window.setInterval(function () {
        goTo(current + 1, false);
      }, DELAY);
    }
    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }
    function restart() {
      stop();
      play();
    }

    // pause on hover / focus / when tab hidden
    carousel.addEventListener("mouseenter", stop);
    carousel.addEventListener("mouseleave", play);
    carousel.addEventListener("focusin", stop);
    carousel.addEventListener("focusout", play);
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stop();
      else play();
    });

    // --- responsive rebuild -----------------------------------------
    var lastPV = perView();
    window.addEventListener("resize", function () {
      var pv = perView();
      if (pv !== lastPV) {
        lastPV = pv;
        buildDots();
        if (current >= dots.length) current = dots.length - 1;
        goTo(current, false);
      }
    });

    // --- go ----------------------------------------------------------
    buildDots();
    update();
    play();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
