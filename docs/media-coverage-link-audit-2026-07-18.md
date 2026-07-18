# Media page link audit — Coverage & events (18 Jul 2026)

Audit of every outbound link on `press.html` / `press_cn.html` (hero, Upcoming events, Previous events, Coverage & events archive), plus the migration of all third-party **article** rows into the ShoreVest third-party coverage template (`templates/media-coverage/`), per the direction that third-party articles should be hosted locally because originals may be taken down.

Verification note: this audit ran in a sandboxed environment whose network policy blocks direct HTTP requests to external sites, so liveness was verified through current search-index evidence (title + exact-URL matches) rather than HTTP status codes. Links marked "unverifiable" below could not be checked either way and are worth a quick manual click.

## Link findings

### Upcoming events — all live, dates match the organisers' sites

| Link | Status |
|---|---|
| apacfamilysummit.com | Live (8–9 Sep 2026, Shanghai confirmed) |
| informaconnect.com/superreturnasia | Live (28 Sep–1 Oct 2026, Singapore confirmed) |
| asia.worldfamilyofficeforum.com | Live (15–16 Oct 2026, Hong Kong confirmed) |
| my.caproasia.com/the-2026-family-office-summit (×2 rows) | Live; organiser lists HK dates in April and Singapore on 5 Nov, so re-confirm the 15 Oct HK date with Caproasia |
| fii-institute.org/conference/fii-10th-edition | Live (26–29 Oct 2026, Riyadh confirmed) |
| Alea Global Family Office Summit row | Has no link (organiser page exists at aleaglobalgroup.com/conferences if one is wanted) |

### Previous events

| Link | Status |
|---|---|
| 3 × LinkedIn recap posts | ShoreVest-owned posts; unverifiable from the sandbox (LinkedIn blocks anonymous access) but under ShoreVest's control |
| YouTube FII panel (t9BHji_UQlA, linked 3×) | Unverifiable from the sandbox; worth a manual click |
| Asia Society roundtable | Live |

### Coverage & events archive (30 rows)

Live and kept off-site (platform/event links, per the `content/media-pdfs/README.md` guidance that video/podcast/event items remain external): YouTube FII panel, Portico Advisers podcast, Apple Podcasts episode, C*Funds podcast page, Asia Society roundtable.

Problems found:

1. **HSBC "Finding opportunities in Chinese property"** — the page linked `business.hsbc.com/en-gb/insights/finding-opportunities-in-chinese-property`, but the canonical URL is `…/en-gb/insights/market-and-regulatory-insights/finding-opportunities-in-chinese-property` (extra path segment). The old URL likely 404s. Corrected in the new archive stub's source link.
2. **Lin-gang Special Area article** — the exact URL (`…/Updates/1863526164076818434.html`) no longer appears in the search index while sibling articles do; the English site has also partially moved to `en.lingang.gov.cn`. Treated as at-risk/likely dead — exactly the takedown case the template exists for. Row now points at a local archive stub.
3. **16 archive rows pointed at the shared placeholder QA PDF** (`shorevest-third-party-coverage-example-publication-…placeholder….pdf`), so real Bloomberg/Economist/Reuters/SCMP/Nikkei entries opened a document titled "Placeholder third-party coverage item for template QA". All replaced with per-article archive pages.
4. **press_cn.html had drifted from press.html**: three duplicated rows with untranslated text (Reorg, Bloomberg "U.S. firms", Reuters "The Exchange" — the Reuters duplicate also carried a wrong date of 6 Apr 2020 instead of 15 Sep 2020), one row mislabelled "Private Debt Investor" instead of Reorg, the PDI sponsored-content row dated 8 Jun instead of 2 Jun 2025 and tagged as a plain interview, two untranslated date displays, and five rows missing entirely (AsianInvestor, PDI Loan Note, HSBC, Bloomberg "minefield", P&I Cambridge Associates). All fixed; both pages now carry the same 30 rows.

Live but paywalled (noted, no action needed): AsianInvestor interview, PDI Loan Note. Live: Portico, C*Funds, Investment Briefing/Investment Magazine item (site is investmentmagazine.com.au — the row's "Investment Briefing" label and the URL's `/2021/03/` vs the row's 28 Apr date are pre-existing oddities worth confirming with Ben).

## Changes made

- **22 archive stubs created** in `content/media-pdfs/*.json` + 22 matching root pages (`media-*.html`) using the existing third-party coverage template — one per third-party article/coverage row that previously linked off-site or at the placeholder PDF. Following the repository's content controls, the stubs contain **archive metadata and the approved press.html summary only** (plus a link to the original where known); no third-party article text was scraped or reproduced. `permissionStatus` is set to `pending — metadata-only archive stub…`, which keeps the PDF generator's publication gate closed.
- **To paste in a full article**: edit the item's JSON in `content/media-pdfs/`, replace the summary-only `body` with the ShoreVest-supplied text, set `permissionStatus` per the README, and the hosted page updates automatically (regenerate the PDF via `scripts/generate-media-coverage-pdf.mjs` if a PDF is also wanted).
- Archive rows on both pages repointed to the local pages; no archive row links to the placeholder PDF or to an external article any more.
- Chinese page parity restored (duplicates removed, dates/labels fixed, missing rows added).

## Open items for Ben

1. Supply source material (text/PDF) for each of the 22 stubs so the full articles can be pasted into the template, and confirm reproduction rights per `content/media-pdfs/README.md`.
2. Manually click the YouTube panel video and the three LinkedIn recap links (unverifiable from this environment).
3. Confirm the Caproasia Hong Kong date (15 Oct 2026) and whether the Alea summit row should carry a link.
4. Confirm the "Investment Briefing" publication name and the 28 Apr 2021 date for the investmentmagazine.com.au item.
