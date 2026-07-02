# Repository structure guide

This repository is a static ShoreVest website with a historically flat root. The current organization goal is to make new work predictable while preserving existing production paths.

## Current structure

```text
.
├── index.html and other root HTML pages
├── root-level PDFs, images, stylesheets, scripts, reports, and utilities
├── assets/
│   ├── brand/        # approved logos and brandmarks
│   ├── css/          # shared site stylesheets
│   ├── data/         # structured site data
│   ├── images/       # organized images
│   ├── img/          # organized legacy images
│   └── js/           # shared scripts
├── css/              # legacy stylesheet location
├── docs/             # repository organization guidance
└── investor-portal/  # investor portal static files
```

## Placement rules for new files

| File type | Preferred location | Notes |
| --- | --- | --- |
| Public pages | Repository root | Required while the site is served as flat static HTML. |
| Shared CSS | `assets/css/` | Avoid creating additional root-level CSS files. |
| Shared JavaScript | `assets/js/` | Avoid creating additional root-level JS files. |
| Brand assets | `assets/brand/` | Use only approved exports and descriptive filenames. |
| Reusable images | `assets/images/` or `assets/img/` | Prefer descriptive, lowercase names for new assets. |
| Structured data | `assets/data/` | Keep data separate from page templates and scripts. |
| Repository guidance | `docs/` | Use for cleanup plans and structure notes that do not affect published URLs. |
| Temporary exports | Do not commit | Keep screenshots, local generated PDFs, and scratch files untracked. |

## Safe migration checklist

The root contains many production-linked PDFs, images, stylesheets, scripts, reports, and utilities. To avoid broken links or broken maintenance workflows:

1. Confirm the file is not intentionally root-addressable in production.
2. Use `rg` to find every HTML, CSS, JavaScript, Markdown, and script reference before moving it.
3. Update all internal references in the same commit as the move.
4. Verify any external URL, CMS, or investor-portal dependency before deleting or relocating the original path.
5. Serve the site locally and spot-check affected pages.
6. Keep redirects or duplicate files only when external URLs must remain stable.

## Useful commands

```bash
# Show top-level files by extension
find . -maxdepth 1 -type f | sed 's#^./##' | awk 'function ext(name){n=split(name,a,"."); if(n==1)return "[no ext]"; return tolower(a[n])} {c[ext($0)]++} END{for(e in c) print e, c[e]}' | sort

# Find tracked files by top-level folder
git ls-files | awk -F/ '{print $1}' | sort | uniq -c | sort -nr

# Search for references before moving a file
rg -n "filename-or-path"
```
