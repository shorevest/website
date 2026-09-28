# ShoreVest Website Design System

This file records intentional visual decisions for Impeccable and future website work. Implementation remains the source of truth when it is more current. Do not treat legacy overrides or one-off page fixes as design-system rules.

## Design direction
Institutional private-credit website with an editorial, document-like rhythm. The design should communicate control, permanence, local expertise, and analytical depth. It should not resemble a generic fintech, SaaS landing page, lifestyle brand, or AI-generated beige editorial template.

## Palette
- Cinnabar: `#C93B2A` — primary action/accent and structural emphasis.
- Blue-Green / Qing: `#3D7070` — secondary brand accent and restrained structural use.
- Ink Green: `#2E4A18` — brand ink/deep green where appropriate.
- Xuan Paper: `#F2ECD8` — core warm paper tone.
- Xuan Light / Ivory: `#FCF9F1` or the existing approved light-paper token — reading surfaces.
- Near-black ink: use the existing dark ink/charcoal tokens for body and dark sections.
- Dawn Redwood Gold: `#C89A2E` — rare ceremonial/featured-research emphasis only.

Do not introduce literal colors casually. Prefer existing CSS custom properties. Avoid decorative gradients.

## Typography
- English: DIN 2014 first; Barlow is the approved web fallback where the DIN face is unavailable.
- Chinese: Noto Serif SC where the current bilingual system specifies it.
- Body copy should generally be at least 15.5–16px on web with comfortable line height.
- Keep reading measure roughly 55–75 characters for long prose.
- Use clear hierarchy through size, weight, spacing, and composition rather than adding a label above every heading.
- Short contextual eyebrows are allowed only when they add information not already carried by the heading.
- Avoid italic-display-editorial styling as a generic flourish.

## Layout
- Use the established centered max-width shell and 12-column grid where already implemented.
- Prefer open spacing, rules, and alignment over nested surfaces.
- Related elements should sit closer together than unrelated sections; do not use monotonous equal spacing.
- Keep desktop and mobile hierarchy consistent rather than simply stacking desktop blocks.
- Avoid horizontal overflow. Interactive targets must remain usable on narrow screens.

## Shape and surfaces
- Default corner radius: 0 for primary public-site components.
- Do not add rounded feature cards, floating panels, or card-inside-card structures.
- Use a single edge treatment. Do not combine hairline borders with broad shadows unless there is a functional layering reason.
- Use thin rules and changes in background tone to establish hierarchy.

## Interaction
- Links and buttons need visible focus states.
- Hover treatments should be quiet: color, underline/rule, or small directional movement.
- Avoid side-tab accent bars, bouncing icons, glow, scale effects, or large elevation changes on ordinary content rows.
- Respect `prefers-reduced-motion`.

## Components
### Header
Compact, fixed, calm, with the ShoreVest lockup as the strongest brand element. Navigation should not compete with the page content.

### Hero
Lead with the proposition itself. Do not place a generic badge/eyebrow above the main headline unless it adds necessary context. Keep the headline substantial but leave room for explanatory copy within the first screen.

### Section introductions
A contextual label such as “Firm” or “Strategy” may remain when the heading itself is conceptual and the label materially orients the reader. Remove labels that merely restate the heading.

### Strategy rows
Treat as an institutional list, not feature cards. Use rules, typography, and a restrained arrow. No decorative side-tab border, layered hover wash, or shadow lift.

### Featured research
Treat the feature as an editorial lead story. Gold may mark featured status, but the block should remain flat and document-like rather than becoming a card.

## Anti-patterns to reject
- Badge above hero headline without useful information.
- Repeated label-above-heading treatment everywhere.
- Identical feature-card grids when content has different importance.
- Side-tab accent borders on ordinary cards or rows.
- Hairline border plus broad drop shadow on the same surface.
- Cream/beige used as a substitute for the actual ShoreVest palette.
- Generic startup calls to action or conversion-funnel language.
- Decorative icons, gradients, blobs, glassmorphism, and novelty animation.

## Validation
Use Impeccable's detector as an additional check, not as an automatic redesign authority:

```bash
npx impeccable detect index.html
npx impeccable detect assets/css/
npx impeccable detect --viewport 390x844 https://shorevest.com/
```

After approved visual changes, run `/impeccable document` in a supported coding agent to refresh generated metadata in `.impeccable/design.json`. Do not hand-edit that generated file.
