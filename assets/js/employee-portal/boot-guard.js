/* ========================================================================== 
   ShoreVest One — startup guard

   Keeps a failed or partially cached startup from leaving users with a blank
   screen. This file does not authenticate, call an API or transmit data.
   ========================================================================== */
(function (root) {
  'use strict';

  var errorMessage = '';
  var CHECK_DELAY = 5500;

  function cleanMessage(value) {
    return String(value || '').replace(/\s+/g, ' ').trim().slice(0, 240);
  }

  function appIsVisible() {
    return !!root.document.querySelector('.login, .ops-shell');
  }

  function freshUrl() {
    var url = new URL(root.location.href);
    url.searchParams.set('portal-refresh', String(Date.now()));
    return url.toString();
  }

  function button(label, onClick, primary) {
    var el = root.document.createElement('button');
    el.type = 'button';
    el.textContent = label;
    el.style.cssText = 'border:1px solid ' + (primary ? '#9f1d2d' : '#b8b8b8') + ';background:' + (primary ? '#9f1d2d' : '#fff') + ';color:' + (primary ? '#fff' : '#222') + ';padding:10px 14px;font:600 13px/1.2 Arial,sans-serif;cursor:pointer;';
    el.addEventListener('click', onClick);
    return el;
  }

  function showRecovery() {
    if (appIsVisible()) return;
    var mount = root.document.getElementById('svops-root');
    if (!mount || mount.getAttribute('data-boot-recovery') === 'true') return;
    mount.setAttribute('data-boot-recovery', 'true');
    mount.innerHTML = '';

    var wrap = root.document.createElement('div');
    wrap.setAttribute('role', 'alert');
    wrap.style.cssText = 'max-width:620px;margin:72px auto;padding:28px 30px;border:1px solid #d7d7d7;border-top:3px solid #9f1d2d;background:#fff;color:#222;font-family:Arial,sans-serif;box-sizing:border-box;';

    var eyebrow = root.document.createElement('p');
    eyebrow.textContent = 'SHOREVEST ONE';
    eyebrow.style.cssText = 'margin:0 0 12px;color:#9f1d2d;font-size:11px;font-weight:700;letter-spacing:.12em;';
    wrap.appendChild(eyebrow);

    var title = root.document.createElement('h1');
    title.textContent = 'ShoreVest One did not finish loading';
    title.style.cssText = 'margin:0 0 10px;font-size:22px;line-height:1.25;';
    wrap.appendChild(title);

    var copy = root.document.createElement('p');
    copy.textContent = 'The browser may have kept an older portal file. Reloading with fresh files normally resolves this.';
    copy.style.cssText = 'margin:0 0 18px;color:#555;font-size:14px;line-height:1.55;';
    wrap.appendChild(copy);

    if (errorMessage) {
      var detail = root.document.createElement('p');
      detail.textContent = 'Startup detail: ' + errorMessage;
      detail.style.cssText = 'margin:0 0 18px;padding:10px 12px;background:#f5f5f5;color:#555;font-size:12px;line-height:1.45;word-break:break-word;';
      wrap.appendChild(detail);
    }

    var actions = root.document.createElement('div');
    actions.style.cssText = 'display:flex;flex-wrap:wrap;gap:10px;';
    actions.appendChild(button('Reload with fresh files', function () {
      root.location.replace(freshUrl());
    }, true));
    actions.appendChild(button('Reset demo session', function () {
      try { root.sessionStorage.removeItem('svops.session.v2'); } catch (e) { /* ignore */ }
      try { root.localStorage.removeItem('svops.sidebar.collapsed'); } catch (e) { /* ignore */ }
      root.location.replace(freshUrl());
    }, false));
    wrap.appendChild(actions);
    mount.appendChild(wrap);
  }

  root.addEventListener('error', function (event) {
    errorMessage = cleanMessage(event && (event.message || (event.error && event.error.message)));
  });
  root.addEventListener('unhandledrejection', function (event) {
    var reason = event && event.reason;
    errorMessage = cleanMessage(reason && (reason.message || reason));
  });

  root.setTimeout(showRecovery, CHECK_DELAY);
  root.SVPortalBootGuard = { check: showRecovery };
})(typeof self !== 'undefined' ? self : this);
