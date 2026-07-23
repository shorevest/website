(() => {
  const DESKTOP_BREAKPOINT = 1180;
  const TABLET_BREAKPOINT = 700;
  const isChinesePage = document.documentElement.lang
    .toLowerCase()
    .startsWith("zh");

  const applyEditorialSectionIntroStyles = () => {
    if (document.getElementById("team-section-intro-editorial-styles")) return;

    const style = document.createElement("style");
    style.id = "team-section-intro-editorial-styles";
    style.textContent = `
      html body.team-page-v2 .group__head {
        grid-template-columns: minmax(230px, max-content) minmax(420px, 660px) !important;
        justify-content: space-between !important;
        align-items: end !important;
        gap: clamp(32px, 4vw, 64px) !important;
        margin-bottom: clamp(30px, 3vw, 40px) !important;
        padding-bottom: clamp(20px, 2.2vw, 28px) !important;
        border-bottom: 1px solid var(--tr-border) !important;
      }

      html body.team-page-v2 .group__summary {
        box-sizing: border-box;
        width: min(100%, 580px) !important;
        max-width: 580px !important;
        justify-self: end !important;
        align-self: end !important;
        margin: 0 !important;
        padding: 0 0 1px clamp(18px, 1.8vw, 24px) !important;
        background: transparent !important;
        border: 0 !important;
        border-left: 2px solid var(--tr-cinnabar) !important;
        font: 400 clamp(12.5px, 0.9vw, 14px) / 1.62 var(--tr-font) !important;
        letter-spacing: 0 !important;
        text-transform: none !important;
        color: var(--tr-muted) !important;
        text-align: left !important;
        text-wrap: pretty;
      }

      html body.team-page-v2.team-page--cn .group__summary {
        font-size: clamp(13px, 0.92vw, 14px) !important;
        line-height: 1.75 !important;
        letter-spacing: 0 !important;
      }

      @media (max-width: 900px) {
        html body.team-page-v2 .group__head {
          grid-template-columns: minmax(200px, 0.72fr) minmax(340px, 1.28fr) !important;
          gap: 28px !important;
        }
      }

      @media (max-width: 760px) {
        html body.team-page-v2 .group__head {
          grid-template-columns: 1fr !important;
          align-items: start !important;
          gap: 14px !important;
          padding-bottom: 20px !important;
        }

        html body.team-page-v2 .group__summary {
          width: 100% !important;
          max-width: none !important;
          justify-self: stretch !important;
          padding: 14px 0 0 !important;
          border-left: 0 !important;
          border-top: 2px solid var(--tr-cinnabar) !important;
          font-size: 13px !important;
          line-height: 1.65 !important;
          letter-spacing: 0 !important;
          text-align: left !important;
        }
      }
    `;
    document.head.appendChild(style);
  };

  const hideIncompleteFunctionsGroup = () => {
    const group = document.querySelector(".group--risk-finance-people");
    if (!group) return;

    group.hidden = true;
    group.setAttribute("aria-hidden", "true");
  };

  const getProfilesPerRow = (grid) => {
    const width = window.innerWidth;
    if (width <= TABLET_BREAKPOINT) return 1;
    if (grid) {
      const columns = getComputedStyle(grid)
        .gridTemplateColumns.split(" ")
        .filter(Boolean).length;
      if (columns) return columns;
    }
    if (width <= DESKTOP_BREAKPOINT) return 2;
    return 4;
  };

  const closeGrid = (grid) => {
    const panel = grid.querySelector(".team-bio-panel");
    if (panel) panel.remove();

    grid.querySelectorAll(".team-profile.is-active").forEach((profile) => {
      profile.classList.remove("is-active");
      const toggle = profile.querySelector(".team-profile__bio-toggle");
      if (toggle) toggle.setAttribute("aria-expanded", "false");
    });
  };

  const closeAllGrids = () => {
    document.querySelectorAll("[data-team-grid]").forEach(closeGrid);
  };

  const createPanel = (profile, bioSource) => {
    const panel = document.createElement("div");
    panel.className = "team-bio-panel";

    const meta = document.createElement("div");
    meta.className = "team-bio-panel__meta";

    const title = document.createElement("h3");
    const profileNameElement = profile.querySelector(".team-profile__name");
    title.innerHTML = profileNameElement?.innerHTML?.trim() || "";

    const role = document.createElement("p");
    const profileRoleElement = profile.querySelector(".team-profile__role");
    role.innerHTML = profileRoleElement?.innerHTML?.trim() || "";

    const closeButton = document.createElement("button");
    closeButton.type = "button";
    closeButton.className = "team-bio-panel__close";
    closeButton.textContent = isChinesePage ? "关闭简介" : "Close bio";
    closeButton.setAttribute(
      "aria-label",
      isChinesePage ? "关闭简介面板" : "Close biography panel",
    );

    meta.append(title, role, closeButton);

    const body = document.createElement("div");
    body.className = "team-bio-panel__body";

    const paragraphs = bioSource.querySelectorAll("p");
    paragraphs.forEach((paragraph) =>
      body.appendChild(paragraph.cloneNode(true)),
    );

    panel.append(meta, body);
    return { panel, closeButton };
  };

  const openProfile = (grid, profile, bioId) => {
    const bioSource = grid.querySelector(`#${CSS.escape(bioId)}`);
    if (!bioSource) return;

    const alreadyActive = profile.classList.contains("is-active");
    closeAllGrids();
    if (alreadyActive) return;

    profile.classList.add("is-active");
    const toggle = profile.querySelector(".team-profile__bio-toggle");
    if (toggle) toggle.setAttribute("aria-expanded", "true");

    const profiles = Array.from(
      grid.querySelectorAll(".team-profile[data-team-profile]"),
    );
    const profileIndex = profiles.indexOf(profile);
    const profilesPerRow = getProfilesPerRow(grid);
    const rowEndIndex = Math.min(
      Math.ceil((profileIndex + 1) / profilesPerRow) * profilesPerRow - 1,
      profiles.length - 1,
    );
    const rowAnchor = profiles[rowEndIndex];

    const { panel, closeButton } = createPanel(profile, bioSource);
    rowAnchor.insertAdjacentElement("afterend", panel);

    closeButton.addEventListener("click", () => closeAllGrids());
  };

  const initGrid = (grid) => {
    const profiles = grid.querySelectorAll(".team-profile[data-team-profile]");

    profiles.forEach((profile) => {
      const toggle = profile.querySelector(".team-profile__bio-toggle");
      const photo = profile.querySelector(
        ".team-profile__photo[data-team-photo]",
      );

      const activate = (bioId) => {
        if (!bioId) return;
        openProfile(grid, profile, bioId);
      };

      if (toggle) {
        toggle.addEventListener("click", () => {
          const bioId = toggle.getAttribute("aria-controls");
          activate(bioId);
        });
      }

      if (
        photo &&
        photo.dataset.teamPhoto &&
        grid.querySelector(`#${CSS.escape(photo.dataset.teamPhoto)}`)
      ) {
        photo.setAttribute("role", "button");
        photo.setAttribute("tabindex", "0");
        const profileName =
          profile.querySelector(".team-profile__name")?.textContent?.trim() ||
          (isChinesePage ? "团队成员" : "team member");
        photo.setAttribute(
          "aria-label",
          isChinesePage
            ? `阅读${profileName}简介`
            : `Read bio for ${profileName}`,
        );
        photo.addEventListener("click", () =>
          activate(photo.dataset.teamPhoto),
        );
        photo.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate(photo.dataset.teamPhoto);
          }
        });

        // Keep placeholder slots interactive without browser drag/context-menu affordances.
        const blockEvent = (event) => event.preventDefault();
        photo.addEventListener("contextmenu", blockEvent);
        photo.addEventListener("dragstart", blockEvent);
        photo.addEventListener("copy", blockEvent);
        const photoImg = photo.querySelector("img");
        if (photoImg) {
          photoImg.setAttribute("draggable", "false");
          photoImg.addEventListener("dragstart", blockEvent);
          photoImg.addEventListener("contextmenu", blockEvent);
        }
      }
    });
  };

  const initPortraitPrivacy = () => {
    const photos = document.querySelectorAll(
      ".team-profile__photo, .team-profile__photo img",
    );
    const blockEvent = (event) => event.preventDefault();

    photos.forEach((photo) => {
      photo.addEventListener("contextmenu", blockEvent);
      photo.addEventListener("dragstart", blockEvent);
      photo.addEventListener("copy", blockEvent);
      photo.addEventListener("cut", blockEvent);
      photo.addEventListener("selectstart", blockEvent);
      if (photo.tagName === "IMG") {
        photo.setAttribute("draggable", "false");
      }
    });

    let privacyTimer;
    const showPrivacyShield = () => {
      document.body.classList.add("team-portrait-privacy-active");
      window.clearTimeout(privacyTimer);
      privacyTimer = window.setTimeout(() => {
        document.body.classList.remove("team-portrait-privacy-active");
      }, 2500);
    };

    document.addEventListener(
      "keydown",
      (event) => {
        const key = event.key ? event.key.toLowerCase() : "";
        const isPrintScreen = key === "printscreen";
        const isSaveOrPrint =
          (event.metaKey || event.ctrlKey) && (key === "s" || key === "p");

        if (!isPrintScreen && !isSaveOrPrint) return;
        showPrivacyShield();

        if (isPrintScreen && navigator.clipboard?.writeText) {
          navigator.clipboard
            .writeText(
              isChinesePage
                ? "团队头像受保护，请勿复制或截屏。"
                : "Team portraits are protected. Please do not copy or screenshot.",
            )
            .catch(() => {});
        }
      },
      true,
    );

    window.addEventListener("beforeprint", showPrivacyShield);
    window.addEventListener("afterprint", () => {
      document.body.classList.remove("team-portrait-privacy-active");
    });
  };

  const initAllGrids = () => {
    if (isChinesePage) document.body.classList.add("team-page--cn");
    applyEditorialSectionIntroStyles();
    hideIncompleteFunctionsGroup();
    const grids = Array.from(document.querySelectorAll("[data-team-grid]"));
    grids.forEach(initGrid);
    initPortraitPrivacy();
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAllGrids);
  } else {
    initAllGrids();
  }
})();
