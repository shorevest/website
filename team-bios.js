(() => {
  const groups = Array.from(document.querySelectorAll('.group .grid'));
  if (!groups.length) return;

  groups.forEach((grid) => {
    const profiles = Array.from(grid.querySelectorAll('[data-team-profile]'));
    if (!profiles.length) return;

    const closeAll = () => {
      profiles.forEach((profile) => {
        const button = profile.querySelector('.team-profile__bio-toggle');
        const bio = profile.querySelector('.team-profile__bio');
        if (!button || !bio) return;

        bio.hidden = true;
        button.setAttribute('aria-expanded', 'false');
        button.textContent = 'Read Bio';
      });
    };

    profiles.forEach((profile) => {
      const button = profile.querySelector('.team-profile__bio-toggle');
      const bio = profile.querySelector('.team-profile__bio');
      if (!button || !bio) return;

      bio.hidden = true;
      button.setAttribute('aria-expanded', 'false');

      button.addEventListener('click', () => {
        const willOpen = bio.hidden;
        closeAll();

        if (willOpen) {
          bio.hidden = false;
          button.setAttribute('aria-expanded', 'true');
          button.textContent = 'Hide Bio';
        }
      });
    });
  });
})();
