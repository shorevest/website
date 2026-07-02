# ShoreVest Website

Static website for ShoreVest Partners, including English and Chinese pages, the investor portal, insights, media pages, legal notices, brand assets, and PDF publications.

This repository intentionally keeps published HTML pages and many legacy assets at the repository root because the static site and external links may reference those paths directly. Use the organization notes below to keep new work tidy without breaking existing URLs.

## Quick start

Serve the site from the repository root with any simple HTTP server:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000/>.

## Repository map

| Path | Purpose |
| --- | --- |
| `index.html`, `firm.html`, `strategy.html`, `*_cn.html`, and other root HTML files | Published static pages served from the site root. |
| Root-level PDFs/images/CSS/JS | Legacy production-linked assets. Do not move them unless every reference and external URL impact is handled. |
| `assets/brand/` | Approved ShoreVest logo and brandmark files used by pages. |
| `assets/css/` and `css/` | Site stylesheets. Prefer `assets/css/` for new shared styles. |
| `assets/js/` and root `*.js` files | Site JavaScript. Prefer `assets/js/` for new shared scripts. |
| `assets/images/`, `assets/img/` | Organized image assets. Place new reusable images here instead of adding more root-level screenshots or exports. |
| `assets/data/` | Structured data used by the site. |
| `investor-portal/` | Investor portal static entry point and related files. |
| Root `*.md` reports and setup notes | Existing maintenance history kept in place for compatibility with prior references. |
| Root utility scripts | Existing one-off generation scripts kept in place until callers are known. |
| `docs/` | Repository organization guidance for future cleanup work. |

For the detailed placement rules and safe-migration checklist, see [`docs/REPOSITORY_STRUCTURE.md`](docs/REPOSITORY_STRUCTURE.md).

## Working conventions

1. **Preserve published paths by default.** Many pages still reference PDFs, images, CSS, and JavaScript from the repository root.
2. **Use organized folders for new work.** New reusable images should go under `assets/images/` or `assets/img/`, shared CSS under `assets/css/`, shared JavaScript under `assets/js/`, and structured data under `assets/data/`.
3. **Document planned migrations first.** Before moving legacy root assets, list the files, references, and external URL risks in the relevant PR.
4. **Preserve bilingual parity.** When changing public content, check the matching English and Chinese pages where applicable.
5. **Keep generated clutter out of Git.** Local caches, logs, generated screenshots, and temporary exports should remain untracked; see `.gitignore`.

## Pre-commit checks

Run these before committing structural changes:

```bash
git status --short
git diff --check
find . -maxdepth 2 -type d | sort
```

If you move files, also search for stale references with `rg` and test the relevant pages in a browser.
