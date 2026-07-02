# ShoreVest Website

Static website for ShoreVest Partners, including English and Chinese pages, the investor portal, insights, media pages, legal notices, brand assets, and PDF publications.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `*_cn.html`, and other root HTML files | Published static pages served from the site root. Keep these at the root unless links and hosting rules are updated together. |
| `assets/pdfs/` | Published China Debt Dynamics issues and white papers linked from `insights.html`, article pages, and `assets/data/*.json`. Filenames are live URLs — do not rename or move without updating every reference. |
| `assets/brand/` | Approved ShoreVest logo, brandmark, and vector master files. |
| `assets/css/` | All site stylesheets. |
| `assets/js/` | All site JavaScript. |
| `assets/data/` | Structured article data (China Debt Dynamics issue JSON). |
| `assets/email/` | HubSpot welcome-email templates and previews (see `docs/integrations/HUBSPOT_SETUP.md`). |
| `assets/img/` | Organized image assets. Place new reusable images here, never at the repository root. |
| `investor-portal/` | Investor portal static entry point. |
| `docs/` | Maintenance notes, setup guides, and source documents (`docs/source-documents/`). |
| `scripts/` | Utility scripts for one-off generation or content maintenance tasks. |

For a more detailed organization guide, see [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md).

## Working conventions

1. **Published URLs stay stable.** Root HTML pages and `assets/pdfs/` files are live URLs. Rename or move them only when you also update every reference and verify the affected pages.
2. **Use organized folders for new work.** New documentation belongs in `docs/`, new utilities in `scripts/`, CSS in `assets/css/`, JS in `assets/js/`, PDFs in `assets/pdfs/`, and images in `assets/img/`. Do not add new CSS, JS, images, PDFs, screenshots, or working files to the repository root.
3. **Preserve bilingual parity.** When changing public content, check the matching English and Chinese pages where applicable.
4. **Keep generated clutter out of Git.** Local caches, logs, QA screenshots, and temporary exports should remain untracked; see `.gitignore`.
5. **No symlinks.** Asset files under `assets/` must be real files — static hosts do not reliably follow symlinks.

## Local development

Because the site is static, you can serve it from the repository root with any simple HTTP server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Pre-commit checks

Run these before committing structural changes:

```bash
git status --short
find . -maxdepth 2 -type d | sort
python3 -m compileall scripts
```

If you move files, also search for stale references with `rg` and test the relevant pages in a browser.
