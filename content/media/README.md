# Media archive workflow

The public English Media archive is driven by `assets/data/media-archive.json` and rendered by `assets/js/media-archive.js`.

## Publishing model

- `status: "published"` items are eligible to render on the public Media page.
- Historical entries should preserve the best available source link and the correct content label (for example `Sponsored content`, `Podcast`, `Panel` or `Article`).
- `linkType: "archive"` is reserved for a ShoreVest-hosted archive page only after that route is intentionally enabled and the repository's rights controls are satisfied.
- `linkType: "external"`, `video`, `podcast` or `linkedin` keeps the visitor on the original third-party source.
- `linkType: "none"` keeps an item visible as a historical record without presenting a dead, disabled or unapproved link.

## Automated discovery

`.github/workflows/media-coverage-discovery.yml` runs daily and can also be started manually. It searches recent Google News RSS results for ShoreVest and Benjamin Fanger, deduplicates candidates against the existing archive, and writes metadata only.

The discovery job does **not** scrape, copy, summarize or republish article body text. New candidates are committed to the persistent `automation/media-coverage` branch and surfaced in a pull request. They do not reach the live site until that pull request is reviewed and merged.

Each automatically discovered item carries review flags. Before merging, confirm:

1. The item genuinely concerns or materially features ShoreVest.
2. The framing is appropriate for the public Media page. Do not treat automated discovery as a sentiment or editorial decision.
3. The publication, date, headline and content type are accurate.
4. The Google News discovery link is replaced with the publisher's canonical URL when practical.
5. Any labels such as `Sponsored`, `Partner Content` or `Advertorial` are preserved.
6. The item is not a duplicate or syndicated copy of an existing entry.
7. No third-party article body is hosted unless the separate permission workflow in `content/media-pdfs/README.md` has been satisfied.

Merging the discovery pull request is the approval and publishing gate.
