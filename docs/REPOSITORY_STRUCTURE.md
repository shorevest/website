# Repository structure guide

This repository is a static ShoreVest website. Published pages and publication PDFs live at the repository root (their filenames are live URLs); everything else lives in organized folders.

## Current structure

```text
.
├── index.html and other root HTML pages   # published pages (EN + _cn Chinese)
├── *.pdf                                   # published CDD issues / white papers
├── assets/
│   ├── brand/            # approved logos, brandmarks, vector masters
│   ├── css/              # all site stylesheets
│   ├── data/             # article data (CDD issue JSON)
│   ├── email/            # HubSpot email templates (+ previews/)
│   ├── images/, img/     # organized images (img/offices/ = office photos)
│   └── js/               # all site scripts
├── docs/
│   ├── integrations/     # third-party setup notes (HubSpot, …)
│   ├── reports/          # historical implementation and QA reports
│   └── source-documents/ # bilingual legal source docs, team bios, brand specs
├── investor-portal/      # investor portal static files
└── scripts/              # maintenance/generation utilities
```

## Placement rules for new files

| File type | Location | Notes |
| --- | --- | --- |
| Public pages | Repository root | Required while the site is served as flat static HTML. |
| Published PDFs | Repository root | Filenames are live URLs linked from `insights.html` and `assets/data/*.json`. |
| CSS | `assets/css/` | Never create root-level CSS files. |
| JavaScript | `assets/js/` | Never create root-level JS files. |
| Brand assets | `assets/brand/` | Approved exports and vector masters only. |
| Images | `assets/images/` or `assets/img/` | Descriptive, lowercase names. |
| Email templates | `assets/email/` | Previews in `assets/email/previews/`. |
| Docs and guides | `docs/` | Use `docs/reports/`, `docs/integrations/`, `docs/source-documents/`. |
| Utility scripts | `scripts/` | Include usage notes in the script header. |
| Screenshots, QA captures, scratch exports | Do not commit | Covered by `.gitignore`; keep them out of the repository. |

## Conventions

- **No symlinks.** All tracked assets must be real files; static hosting does not reliably follow symlinks.
- **One copy per asset.** Do not commit hash-suffixed or " 2" duplicate variants; replace the canonical file instead.
- **Reference checks before moves.** Root HTML/PDF names are production URLs. Before renaming or moving anything, run `rg -n "filename"` across the repo and update HTML, CSS, JS, JSON, and docs in the same commit.

## Useful commands

```bash
# Find tracked files by folder
git ls-files | awk -F/ '{print $1}' | sort | uniq -c | sort -nr

# Search for references before moving a file
rg -n "filename-or-path"

# Confirm no symlinks are tracked
git ls-files -s | awk '$1=="120000"'
```

## History

The root previously held ~600 untracked-in-spirit files (QA screenshots, duplicate brand exports, superseded CSS/JS, and PDF duplicates). These were removed in the July 2026 reorganization; recover anything needed from git history.
