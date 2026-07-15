# Third-party media coverage PDFs

Use this folder for structured content files that are approved for a ShoreVest-hosted archival PDF. These documents are **Third-Party Coverage** items, not ShoreVest-authored research and not China Debt Dynamics issues.

## Content controls

- Do not scrape or republish paywalled articles automatically.
- Do not reproduce content merely because it is publicly viewable.
- Only add full article text when ShoreVest has supplied the source material and confirmed that it may be hosted.
- Preserve original source attribution and labels such as `Sponsored`, `Partner Content` or `Advertorial`.
- Do not invent missing authors, dates, descriptions or article text.
- Do not translate original third-party article text unless an approved translation is supplied.

## Workflow

1. Copy `example-placeholder-coverage.json` to a new lowercase, hyphenated JSON file.
2. Replace the placeholder metadata and `body` blocks with approved source material.
3. Set `permissionStatus` and `copyrightNote` accurately. Do not claim permission unless it is confirmed.
4. Run:

```bash
node scripts/generate-media-coverage-pdf.mjs content/media-pdfs/<file>.json
```

5. Confirm the generated file is in `public/media/archive-pdfs/` and opens in desktop and mobile browsers.
6. Add the PDF to the relevant Media archive entry with:

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
- Generator: `scripts/generate-media-coverage-pdf.mjs`
- Public output folder: `public/media/archive-pdfs/`
