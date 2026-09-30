# Homepage first draft

Locked hierarchy: mandate → underwriting discipline → selected published judgment → strategy scope → people/execution → institutional contact.

Research is an editorial selection, pinned to Volume 10 Issue 3, September 2026, “Perceptions Versus Reality in China Real Estate”. It does not follow the newest-issue feed. Changing the selection is an explicit editorial update.

## Content sources

- Mandate: existing homepage; supporting sentence: strategy.html / strategy_cn.html.
- Underwriting lead: assets/data/china-debt-dynamics-v10i3.json, opening section, secured-credit investor question.
- Collateral paragraph: existing strategy margin-of-safety explanation plus the selected issue's “What Matters for Credit Investors” guidance on recent transaction evidence.
- Legal position, recovery routes and risk note: strategy.html / strategy_cn.html, common underwriting considerations.
- Research: selected issue's existing title, date, dek and opening paragraph; dated-view note from its disclaimer.
- Strategy scope: existing strategy.html / strategy_cn.html descriptions.
- Execution: existing firm local-execution paragraph and team description of ShoreVest Asset Solutions.
- Contact: existing strategy institutional-inquiry copy.
- Chinese research/underwriting text faithfully translates selected English source passages where corresponding Chinese source copy is absent. No new investment facts are introduced. The selected full report remains at its existing English URL, explicitly labelled in Chinese.

## Preserved behavior

Header, mobile navigation, footer/legal content, metadata and existing scripts are retained. The legacy index_cn.html redirect is retained. Existing anchor IDs hero, strategy, research and firm remain. A homepage-only stylesheet uses hp-* classes to avoid legacy feature-card treatments and shared copy overrides.

## Rendering

The branch-only workflow serves repository files on localhost in an ephemeral runner. It intercepts the public-domain browser requests to that local server so consent is exercised without visiting or publishing the live site. Analytics endpoints are stubbed. It captures English/Chinese at 1440×1000 and 390×844, both with the initial consent prompt and after rejection, and checks source preservation, link destinations, overflow, mobile menu, and consent rejection/acceptance.

This is the first composition draft. No deployment, main update or merge is authorized.
