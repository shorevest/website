# Third-party media coverage PDFs

Use this folder for structured content files that are approved for a ShoreVest-hosted archival PDF. These documents are **Third-Party Coverage** items, not ShoreVest-authored research and not China Debt Dynamics issues.

## Content controls

- Do not scrape or republish paywalled articles automatically.
- Do not reproduce content merely because it is publicly viewable.
- Sponsorship, authorship, possession of a publisher PDF or subscriber access does not establish web reprint rights. Record the actual licence or publisher permission before reproducing publisher text, artwork or files.
- The default is a short original ShoreVest summary and an external original-source link. Keep subscription labels; a paywall or automated 403 is not a dead link.
- June 2025 PDI and October 2021 Pensions & Investments records were reduced to original summaries on 20 September 2026 because hosting permission was not documented. Do not restore their full text from Git history without permission evidence.
- Only add full article text when ShoreVest has supplied the source material and confirmed that it may be hosted.
- Preserve original source attribution and labels such as `Sponsored`, `Partner Content` or `Advertorial`.
- Do not invent missing authors, dates, descriptions or article text.
- Do not translate original third-party article text unless an approved translation is supplied.

## Workflow

The generator renders the branded print template in headless Chrome/Chromium, so the PDF matches `media-coverage-print.css` exactly (A4, Barlow, page-number footers). It needs Node and a local Chrome or Chromium install (auto-detected; override with `--chrome <path>` or `CHROME_PATH`).

1. Copy `example-placeholder-coverage.json` to a new lowercase, hyphenated JSON file.
2. Replace the placeholder metadata and `body` blocks with approved source material.
3. Set `permissionStatus` and `copyrightNote` accurately. Do not claim permission unless it is confirmed.
4. While rights are still unconfirmed, generate QA copies only. `--preview` writes to the git-ignored folder `templates/media-coverage/preview/` and never into `public/`:

```bash
node scripts/generate-media-coverage-pdf.mjs content/media-pdfs/<file>.json --preview
```

5. Once rights are established, set `permissionStatus` to `confirmed — <evidence, e.g. publisher email + date>` (or `shorevest-owned` for ShoreVest material) and run the same command without `--preview`. Also record `permissionEvidence.reference` (the written permission or ownership evidence), `permissionEvidence.rightsHolder`, and `permissionEvidence.scope` set to `public-web-reproduction`. The generator requires both an approved status and these evidence fields before writing into `public/media/archive-pdfs/`.
6. Confirm the generated file opens in desktop and mobile browsers, then commit it and add the PDF to the relevant Media archive entry with:

```json
{
  "linkType": "pdf",
  "url": "",
  "pdfPath": "public/media/archive-pdfs/shorevest-third-party-coverage-[publication]-[yyyy-mm-dd]-[short-title].pdf",
  "buttonLabel": "VIEW PDF →"
}
```

For external items that should remain off-site, use `linkType` values of `external`, `video`, `podcast`, `linkedin` or `none` with the appropriate `url`.

## Template locations

- Print/preview template: `templates/media-coverage/media-coverage-print.html`
- Template styles: `templates/media-coverage/media-coverage-print.css`
- Template renderer: `templates/media-coverage/media-coverage-print.js`
- Template fonts (Barlow, bundled locally so rendering is deterministic offline): `assets/fonts/barlow/`
- Generator: `scripts/generate-media-coverage-pdf.mjs`
- Public output folder (approved content only): `public/media/archive-pdfs/`
- QA preview output folder (git-ignored): `templates/media-coverage/preview/`
