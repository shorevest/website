/* ShoreVest One — Outreach navigation and demo-data usability refresh. */
(function (root) {
  'use strict';

  var SVOps = root.SVOps;
  if (!SVOps || !SVOps.views || typeof SVOps.views.outreach !== 'function') return;

  var originalOutreachView = SVOps.views.outreach;
  var U = SVOps.ui;
  var P = root.SVPortalPersonas;
  var STORAGE_PREFIX = 'svops.outreach.v1.';

  var NAME_MAP = {
    'Sarah Chen': 'Arctic Fox',
    'Michael Lee': 'Capybara',
    'Anna Larsen': 'Pangolin',
    'Mikkel Holm': 'Quokka',
    'Freja Nielsen': 'Red Panda',
    'Jonas Berg': 'Saiga Antelope',
    'Claire Dubois': 'Maned Wolf',
    'Tom Eriksen': 'Axolotl',
    'Emma Wright': 'Fennec Fox',
    'Peter Novak': 'Wombat',
    'Sofia Lind': 'Kakapo',
    'Daniel Cho': 'Tapir',
    'Eva Schmidt': 'Okapi',
    'Oscar Meyer': 'Numbat',
    'Mina Park': 'Pika',
    'Henrik Dahl': 'Echidna',
    'Luca Rossi': 'Jerboa',
    'Markus Vogel': 'Tarsier',
    'Nora Andersen': 'Kinkajou',
    'Oliver Brooks': 'Aye-Aye'
  };

  var FIRM_MAP = {
    'ATP': 'Moon Jelly Pension',
    'Hamilton Endowment': 'Snowy Owl Endowment',
    'NorthBridge Pension': 'Quokka State Retirement',
    'Danish Teachers Pension': 'Capybara Teachers Pension',
    'California Public Employees': 'Fennec Municipal Employees',
    'Meridian Insurance': 'Axolotl Insurance',
    'EastGate Assurance': 'Red Panda Life',
    'Nordic Pension': 'Pangolin Retirement Fund',
    'GreenVale Capital': 'Manatee Family Office',
    'Harbour Ridge': 'Sea Otter Foundation'
  };

  var REPLACEMENTS = Object.keys(NAME_MAP).concat(Object.keys(FIRM_MAP)).sort(function (a, b) {
    return b.length - a.length;
  });

  function load(name, fallback) {
    try {
      var value = JSON.parse(localStorage.getItem(STORAGE_PREFIX + name));
      return value || fallback;
    } catch (error) {
      return fallback;
    }
  }

  function save(name, value) {
    localStorage.setItem(STORAGE_PREFIX + name, JSON.stringify(value));
  }

  function replaceDemoText(value) {
    if (typeof value !== 'string' || !value) return value;
    var output = value;
    REPLACEMENTS.forEach(function (from) {
      var to = NAME_MAP[from] || FIRM_MAP[from];
      output = output.split(from).join(to);
    });
    output = output.replace(/person(\d+)@example\.com/gi, function (_, number) {
      return 'animal' + number + '@wildlife-demo.example';
    });
    return output;
  }

  function normaliseStoredValue(value) {
    if (Array.isArray(value)) {
      return value.map(normaliseStoredValue);
    }
    if (value && typeof value === 'object') {
      Object.keys(value).forEach(function (key) {
        value[key] = normaliseStoredValue(value[key]);
      });
      return value;
    }
    return replaceDemoText(value);
  }

  function normalisePreviewData() {
    ['current', 'audiences', 'drafts', 'approvals', 'tasks'].forEach(function (key) {
      var value = load(key, null);
      if (value) save(key, normaliseStoredValue(value));
    });
  }

  function countRows(rows) {
    var counts = { Included: 0, Held: 0, Blocked: 0 };
    (rows || []).forEach(function (row) {
      if (counts[row.status] !== undefined) counts[row.status] += 1;
    });
    return counts;
  }

  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function makeLink(label, href, className) {
    var link = make('a', className || '', label);
    link.href = href;
    return link;
  }

  function append(parent) {
    for (var i = 1; i < arguments.length; i += 1) {
      if (arguments[i]) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  function routeName(params) {
    return params && params[0] ? params[0] : 'overview';
  }

  function outreachNav(activeRoute) {
    var nav = make('nav', 'outreach-nav');
    nav.setAttribute('aria-label', 'Outreach sections');
    var items = [
      ['Overview', '#/outreach', 'overview'],
      ['Build audience', '#/outreach/find', 'find'],
      ['Review people', '#/outreach/review', 'review'],
      ['Prepare messages', '#/outreach/draft', 'draft'],
      ['Approval package', '#/outreach/package', 'package'],
      ['Sent & replies', '#/outreach/sent', 'sent']
    ];
    items.forEach(function (item) {
      var link = makeLink(item[0], item[1], 'outreach-nav__link' + (activeRoute === item[2] ? ' is-active' : ''));
      if (activeRoute === item[2]) link.setAttribute('aria-current', 'page');
      nav.appendChild(link);
    });
    return nav;
  }

  function statusLine(counts) {
    return counts.Included + ' included · ' + counts.Held + ' held · ' + counts.Blocked + ' blocked';
  }

  function primaryActionCard(title, description, href, meta, primary) {
    var card = makeLink('', href, 'outreach-action-card' + (primary ? ' outreach-action-card--primary' : ''));
    var top = make('div', 'outreach-action-card__top');
    var titleNode = make('h3', 'outreach-action-card__title', title);
    var arrow = make('span', 'outreach-action-card__arrow', '→');
    arrow.setAttribute('aria-hidden', 'true');
    append(top, titleNode, arrow);
    append(card, top, make('p', 'outreach-action-card__desc', description));
    if (meta) card.appendChild(make('p', 'outreach-action-card__meta', meta));
    return card;
  }

  function attentionRow(label, count, detail, href, tone) {
    var row = makeLink('', href, 'outreach-attention__row' + (tone ? ' outreach-attention__row--' + tone : ''));
    var number = make('span', 'outreach-attention__count', String(count));
    var body = make('span', 'outreach-attention__body');
    append(body, make('strong', 'outreach-attention__label', label), make('span', 'outreach-attention__detail', detail));
    append(row, number, body, make('span', 'outreach-attention__chev', '›'));
    return row;
  }

  function progressStep(number, title, state, href) {
    var step = makeLink('', href, 'outreach-progress__step outreach-progress__step--' + state);
    var marker = make('span', 'outreach-progress__marker', state === 'done' ? '✓' : String(number));
    var copy = make('span', 'outreach-progress__copy');
    append(copy, make('strong', 'outreach-progress__title', title), make('span', 'outreach-progress__state', state === 'done' ? 'Complete' : state === 'current' ? 'Next' : 'Not started'));
    append(step, marker, copy);
    return step;
  }

  function userFocus(user) {
    var persona = P && P.byId ? P.byId(user.personaId) : null;
    var id = persona && persona.id;
    if (id === 'john') return 'Ex-Asia outreach and relationship-owner handoffs';
    if (id === 'kelvin') return 'Asia outreach and relationship-owner handoffs';
    if (id === 'celestra') return 'Held records, matching and approval assembly';
    if (id === 'nico') return 'Audience building, missing-contact research and handoffs';
    if (id === 'demo') return 'All regions and all outreach workflow stages';
    return 'Outreach preparation, exceptions and review';
  }

  function renderOverview(container, user) {
    var state = load('current', {});
    var rows = state.rows || [];
    var counts = countRows(rows);
    var audiences = load('audiences', []);
    var drafts = load('drafts', []);
    var approvals = load('approvals', []);
    var currentApproval = approvals[0];
    var handoffs = rows.filter(function (row) {
      return row.status === 'Held' && /ownership/i.test(row.heldReason || '');
    }).length;
    var draftsNeedingReview = drafts.filter(function (draft) {
      return draft.status !== 'Looks right';
    }).length;

    var page = make('div', 'ops-content outreach-page outreach-page--overview');
    var head = make('div', 'ops-pagehead outreach-pagehead');
    append(head,
      make('p', 'ops-label', 'Outreach'),
      make('h1', 'ops-h1', 'Outreach workspace'),
      make('p', 'ops-lede', 'Build the right audience, review exceptions, prepare messages and hand off for approval. Nothing is sent automatically.')
    );
    append(page, head, outreachNav('overview'));

    var focus = make('div', 'outreach-focusbar');
    append(focus,
      make('span', 'outreach-focusbar__label', 'Your focus'),
      make('span', 'outreach-focusbar__text', userFocus(user))
    );
    page.appendChild(focus);

    var startSection = make('section', 'outreach-section');
    append(startSection, make('h2', 'outreach-section__title', 'What do you need to do?'));
    var actions = make('div', 'outreach-action-grid');
    append(actions,
      primaryActionCard('Build a new audience', 'Search ShoreVest records, paste names, upload a file or reopen a saved search.', '#/outreach/find', 'Best place to start', true),
      primaryActionCard(rows.length ? 'Continue current audience' : 'Review an audience', rows.length ? 'Resume the audience already in progress and decide who can move forward.' : 'Build an audience first, then decide who can move forward.', rows.length ? '#/outreach/review' : '#/outreach/find', rows.length ? statusLine(counts) : 'No audience in progress', false),
      primaryActionCard('Check sent messages and replies', 'Review delivery status, responses and follow-up items.', '#/outreach/sent', '8 preview records', false)
    );
    startSection.appendChild(actions);
    page.appendChild(startSection);

    var workspace = make('div', 'outreach-workspace-grid');

    var currentPanel = make('section', 'outreach-panel');
    append(currentPanel, make('div', 'outreach-panel__head'));
    currentPanel.firstChild.appendChild(make('h2', 'outreach-panel__title', 'Current workflow'));
    currentPanel.firstChild.appendChild(make('p', 'outreach-panel__sub', rows.length ? (state.name || state.query || 'Current audience') : 'No audience has been started yet.'));
    var progress = make('div', 'outreach-progress');
    var hasRows = rows.length > 0;
    var hasDrafts = drafts.length > 0;
    var hasApproval = approvals.length > 0 && !currentApproval.invalidated;
    append(progress,
      progressStep(1, 'Build audience', hasRows ? 'done' : 'current', '#/outreach/find'),
      progressStep(2, 'Review people', hasRows ? (hasDrafts ? 'done' : 'current') : 'upcoming', '#/outreach/review'),
      progressStep(3, 'Prepare messages', hasDrafts ? (hasApproval ? 'done' : 'current') : 'upcoming', '#/outreach/draft'),
      progressStep(4, 'Request approval', hasApproval ? 'done' : 'upcoming', '#/outreach/package')
    );
    currentPanel.appendChild(progress);
    if (hasRows) currentPanel.appendChild(makeLink('Open current audience →', '#/outreach/review', 'outreach-panel__cta'));
    else currentPanel.appendChild(makeLink('Start building an audience →', '#/outreach/find', 'outreach-panel__cta'));

    var attentionPanel = make('section', 'outreach-panel');
    var attentionHead = make('div', 'outreach-panel__head');
    append(attentionHead, make('h2', 'outreach-panel__title', 'Needs attention'), make('p', 'outreach-panel__sub', 'Items stopping the workflow from moving forward.'));
    attentionPanel.appendChild(attentionHead);
    var attention = make('div', 'outreach-attention');
    append(attention,
      attentionRow('Held records', counts.Held, counts.Held ? 'Resolve ownership, duplicate or data-quality issues.' : 'Nothing is currently held.', '#/outreach/review', counts.Held ? 'warn' : 'calm'),
      attentionRow('Owner handoffs', handoffs, handoffs ? 'A relationship owner needs to decide what happens next.' : 'No owner decision is waiting.', '#/outreach/review', handoffs ? 'warn' : 'calm'),
      attentionRow('Drafts needing review', draftsNeedingReview, draftsNeedingReview ? 'Message groups are not ready for an approval package.' : 'No draft review is outstanding.', '#/outreach/draft', draftsNeedingReview ? 'warn' : 'calm')
    );
    if (currentApproval && currentApproval.invalidated) {
      attention.appendChild(attentionRow('Approval package changed', 1, 'The prior approval is no longer valid and must be submitted again.', '#/outreach/package', 'block'));
    }
    attentionPanel.appendChild(attention);

    append(workspace, currentPanel, attentionPanel);
    page.appendChild(workspace);

    var listsPanel = make('section', 'outreach-panel outreach-panel--wide');
    var listHead = make('div', 'outreach-panel__head outreach-panel__head--row');
    append(listHead, make('div', '', ''), makeLink('View saved searches →', '#/outreach/find', 'outreach-panel__link'));
    listHead.firstChild.appendChild(make('h2', 'outreach-panel__title', 'Recent lists'));
    listHead.firstChild.appendChild(make('p', 'outreach-panel__sub', 'Open something you were already working on.'));
    listsPanel.appendChild(listHead);
    var recentList = make('div', 'outreach-recent');
    var recentItems = audiences.slice(0, 4);
    if (!recentItems.length) {
      recentItems = [
        { name: 'SuperReturn attendees', date: 'Preview list' },
        { name: 'PitchBook cross-check batch', date: 'Preview list' },
        { name: 'Grey Wolf old To Be Contacted cleanup', date: 'Preview list' },
        { name: 'Snow Leopard stale Asia contacts', date: 'Preview list' }
      ];
    }
    recentItems.forEach(function (item, index) {
      var link = makeLink('', item.rows ? '#/outreach/review' : '#/outreach/find', 'outreach-recent__item');
      if (item.rows) {
        link.onclick = function () {
          save('current', { name: item.name || 'Saved audience', rows: item.rows, history: [] });
        };
      }
      append(link,
        make('span', 'outreach-recent__index', String(index + 1)),
        make('span', 'outreach-recent__name', replaceDemoText(item.name || 'Saved audience')),
        make('span', 'outreach-recent__meta', item.rows ? item.rows.length + ' people' : (item.date || 'Saved list')),
        make('span', 'outreach-recent__open', 'Open')
      );
      recentList.appendChild(link);
    });
    listsPanel.appendChild(recentList);
    page.appendChild(listsPanel);

    var help = make('details', 'outreach-help');
    var summary = make('summary', 'outreach-help__summary', 'How the outreach workflow works');
    var helpGrid = make('div', 'outreach-help__grid');
    [
      ['1', 'Build', 'Find people or add a list.'],
      ['2', 'Review', 'Include safe records, hold uncertain ones and block restricted contacts.'],
      ['3', 'Prepare', 'Group recipients and check the exact sender and message.'],
      ['4', 'Approve', 'Freeze the package and request approval. This still does not send.']
    ].forEach(function (item) {
      var block = make('div', 'outreach-help__item');
      append(block, make('span', 'outreach-help__num', item[0]), make('strong', 'outreach-help__title', item[1]), make('p', 'outreach-help__text', item[2]));
      helpGrid.appendChild(block);
    });
    append(help, summary, helpGrid);
    page.appendChild(help);

    var safety = U && U.notice ? U.notice('info', 'Salesforce remains the official commercial record. ShoreVest One prepares and controls work only. It does not silently send emails, create Opportunities, move stages, change owners or merge duplicates.') : null;
    if (safety) page.appendChild(safety);

    var utilities = make('details', 'outreach-utilities');
    utilities.appendChild(make('summary', 'outreach-utilities__summary', 'Preview utilities'));
    var reset = make('button', 'btn btn--quiet', 'Reset outreach preview data');
    reset.type = 'button';
    reset.onclick = function () {
      Object.keys(localStorage).filter(function (key) {
        return key.indexOf(STORAGE_PREFIX) === 0;
      }).forEach(function (key) {
        localStorage.removeItem(key);
      });
      if (U && U.toast) U.toast('Outreach preview data reset.');
      root.dispatchEvent(new Event('svops:render'));
    };
    utilities.appendChild(reset);
    page.appendChild(utilities);

    container.appendChild(page);
  }

  function simplifyLede(container, route) {
    var lede = container.querySelector('.ops-pagehead .ops-lede');
    if (!lede) return;
    var copy = {
      find: 'Choose one way to build an audience: search, upload, paste or reopen a saved list.',
      review: 'Decide who can move forward, who needs review and who is blocked. Held and blocked people will not receive messages.',
      draft: 'Edit one message group at a time. Nothing is sent from this page.',
      package: 'Check recipients, sender and delivery controls. Submitting creates an approval request only.',
      sent: 'Review delivery status, replies and follow-up work.'
    };
    if (copy[route]) lede.textContent = copy[route];
  }

  function addProgressBar(container, route) {
    var routeIndex = { find: 0, review: 1, draft: 2, package: 3 };
    if (routeIndex[route] === undefined) return;
    var existing = container.querySelector('.ops-filterbar');
    if (existing) existing.remove();
    var labels = [
      ['Build audience', '#/outreach/find'],
      ['Review people', '#/outreach/review'],
      ['Prepare messages', '#/outreach/draft'],
      ['Approval package', '#/outreach/package']
    ];
    var progress = make('div', 'outreach-route-progress');
    labels.forEach(function (item, index) {
      var state = index < routeIndex[route] ? 'done' : index === routeIndex[route] ? 'current' : 'upcoming';
      var link = makeLink('', item[1], 'outreach-route-progress__item outreach-route-progress__item--' + state);
      append(link, make('span', 'outreach-route-progress__num', state === 'done' ? '✓' : String(index + 1)), make('span', 'outreach-route-progress__label', item[0]));
      if (state === 'current') link.setAttribute('aria-current', 'step');
      progress.appendChild(link);
    });
    var nav = container.querySelector('.outreach-nav');
    var head = container.querySelector('.ops-pagehead');
    if (nav) nav.insertAdjacentElement('afterend', progress);
    else if (head) head.insertAdjacentElement('afterend', progress);
  }

  function decorateSubpage(container, route) {
    var content = container.querySelector('.ops-content');
    if (!content) return;
    content.classList.add('outreach-page', 'outreach-page--' + route);
    var head = content.querySelector('.ops-pagehead');
    if (head) head.insertAdjacentElement('afterend', outreachNav(route));
    simplifyLede(container, route);
    addProgressBar(container, route);

    var panels = content.querySelectorAll('.ops-panel');
    for (var i = 0; i < panels.length; i += 1) panels[i].classList.add('outreach-legacy-panel');

    if (route === 'find') {
      var firstPanel = content.querySelector('.ops-panel');
      if (firstPanel) {
        var choose = make('div', 'outreach-page-intro');
        append(choose, make('strong', 'outreach-page-intro__title', 'Pick one starting point'), make('span', 'outreach-page-intro__text', 'You only need to use one of the options below.'));
        firstPanel.insertAdjacentElement('beforebegin', choose);
      }
    }

    if (route === 'review') {
      var tableHeading = Array.prototype.slice.call(content.querySelectorAll('.ops-panel__title')).filter(function (node) {
        return node.textContent.trim() === 'Audience table';
      })[0];
      if (tableHeading) tableHeading.textContent = 'People in this audience';
      var headerCells = content.querySelectorAll('th');
      for (var h = 0; h < headerCells.length; h += 1) {
        if (headerCells[h].textContent.trim() === 'Salesforce plan') headerCells[h].textContent = 'Proposed record action';
      }
    }
  }

  function animaliseDom(scope) {
    if (!scope) return;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    textNodes.forEach(function (node) {
      var replaced = replaceDemoText(node.nodeValue);
      if (replaced !== node.nodeValue) node.nodeValue = replaced;
    });

    var fields = scope.querySelectorAll('input, textarea');
    for (var i = 0; i < fields.length; i += 1) {
      if (fields[i].placeholder) fields[i].placeholder = replaceDemoText(fields[i].placeholder);
      if (fields[i].value) fields[i].value = replaceDemoText(fields[i].value);
    }
  }

  function observeDynamicDrawers(container) {
    if (root.__svOutreachAnimalObserver) root.__svOutreachAnimalObserver.disconnect();
    var observer = new MutationObserver(function () {
      animaliseDom(document.body);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    root.__svOutreachAnimalObserver = observer;

    container.addEventListener('click', function () {
      setTimeout(function () {
        animaliseDom(document.body);
      }, 0);
    }, true);
  }

  SVOps.views.outreach = function (container, user, params) {
    var route = routeName(params);
    normalisePreviewData();

    if (route === 'overview') {
      renderOverview(container, user);
    } else {
      originalOutreachView(container, user, params);
      decorateSubpage(container, route);
    }

    animaliseDom(container);
    observeDynamicDrawers(container);
  };
}(typeof self !== 'undefined' ? self : this));
