# ShoreVest Media / News audit

**Review draft — 20 September 2026. Not deployed.**

Implementation branch: `content/media-audit-20260920`. Baseline: `shorevest/website` main commit `11a73f527bd788e38226736654061bbd6576d5ff`. The live English data matched that baseline when inspected. Work was isolated from other website changes; production approval is still required.

## Decisions at a glance

- Retain all 20 existing English archive records. Add six substantive, publisher-verified records. The draft contains 26 records: 18 external source links and eight clearly labeled historical records whose original URLs remain unresolved. Of the 18 linked items, 16 have publisher-page/official-channel evidence; two retained records have incomplete independent verification (Pensions & Investments and Asia Society).
- Restore the Chinese archive: its old controller replaced the section with a “coming soon” message. Replace its divergent 21-row archive with the same reviewed 26 records, translated summaries and labels. Merge the duplicate Portico listing, including its incorrect 9 June 2022 date.
- Recover missing destinations for the Economist podcast, Reuters Exchange podcast and AIM Summit webinar. Update HSBC to its current canonical page and correct misleading dates, titles and attribution.
- Preserve all 13 existing ShoreVest media detail URLs, rebuilt with existing site styles and original summaries. Remove the PDI and Pensions & Investments full-text reproductions. Remove the PDI PDF and the QA placeholder PDF from the proposed public tree; Git history remains intact.
- Improve nine exact News/Insights aliases and four former asset routes to reach specific archive records. Do not substitute a similar story from another publisher for a lost original.
- Audit 128 unique URLs: 121 returned HTTP 200, four returned 404, two Reuters links returned 401, and Asia Society returned 403. HTTP 200 can still mean an HTML redirect rather than original content. Access restrictions are not classified as dead links.
- Retain current typography, colors, row/card treatment and responsive breakpoints. Add original-source/access labels and static content, with filters as an enhancement. Automatic discovery now creates pending-review leads instead of immediately publishable records.

## Economist podcast: resolved

**Money Talks: How much trouble is China’s economy in? — The Economist, 8 February 2024.** The official Acast episode page and Economist feed identify Benjamin Fanger as the ShoreVest guest. The old ShoreVest date, 14 February, is corrected to the publisher’s episode date. The feed timestamp is 8 February 2024, 18:09:33 GMT.

[Official episode](https://shows.acast.com/theeconomistmoneytalks/episodes/money-talks-how-much-trouble-is-chinas-economy-in) · [Official feed](https://feeds.acast.com/public/shows/theeconomistmoneytalks)

**Recommendation implemented:** feature the episode with a short original description and external Listen link, labeled “Subscription may be required.” Acast supplies an official player option, but no embed is necessary for this draft. No audio is downloaded, copied or made available outside the publisher’s access controls. The old MP3 recovery path points to the archive record.

## PDI PDF: reproduction permission not established

**Shorevest Partners on the case for China — Private Debt Investor / PEI, 2 June 2025.** The official page identifies sponsored coverage involving Benjamin Fanger. The repository file `ShoreVest_PDI_Jun25.pdf` matches this interview; the magazine title is “The case for China.”

[Official PDI/PEI article](https://www.pei-privatecredit.com/shorevest-partners-on-the-case-for-china/)

The two-page PDF carries magazine pagination 30–31, expert-commentary styling and a ShoreVest sponsor label. Its metadata identifies Adobe InDesign 19.5 and Adobe PDF Library 17, with a creation date of 22 May 2025. This is consistent with a publisher-produced magazine extract. It is not proof of a licensed web reprint. No reprint authorization, distribution licence, rights notice granting ShoreVest reproduction, or accompanying written permission was located. The file alone cannot distinguish an authorized client reprint from a downloaded/subscriber extract.

This is the strongest matching PDI item in the repository. Ben’s exact recent message/attachment was not available for a conclusive identity match. Sponsorship and receipt of the PDF do not resolve rights.

**Recommendation implemented:** keep the entry, mark it Sponsored content, link to PDI, and remove the PDF and the copied Q&A from the proposed published tree. Written permission specifying public website reproduction would be needed before reconsidering hosting. No publisher images, scans or page screenshots are included in this deliverable.

**Publisher-terms point for review:** PEI’s current terms restrict reproduction and also contain a non-homepage-link permission clause (section 20.3). The draft uses the requested direct external article link rather than rehosting. This is a rights/terms question to resolve with PEI or ShoreVest counsel; this audit does not assert that the deep link has been expressly licensed. [PEI terms](https://www.pei.group/terms-and-conditions/)

## Current archive: item-by-item disposition

The first date/title in this table is the existing archive record. “Historical only” means title, date and firm involvement are retained as prior ShoreVest metadata, not newly independently verified. Those records are not presented as recovered articles.

| Existing date / publisher | Existing title | Proposed disposition | Source |
|---|---|---|---|
| 2025-11-06 / FII Institute | Private credit market discussion | Correct date to 2025-12-22; Use verified title shown below; Retain original link | [Publisher source](https://www.youtube.com/watch?v=t9BHji_UQlA) |
| 2025-06-02 / Private Debt Investor | ShoreVest Partners on the case for China | Retain original link; Sponsored label; remove full text/PDF | [Publisher source](https://www.pei-privatecredit.com/shorevest-partners-on-the-case-for-china/) |
| 2024-10-02 / HSBC | Finding opportunities in Chinese property | Use current canonical publisher URL; Attribute comments to Rebekah Woo, not Ben | [Publisher source](https://www.business.hsbc.com/en-gb/insights/finding-opportunities-in-chinese-property) |
| 2024-02-14 / The Economist | The Economist speaks with ShoreVest on China's financial system and distressed debt | Correct date to 2024-02-08; Use verified title shown below; Recover original source link | [Publisher source](https://shows.acast.com/theeconomistmoneytalks/episodes/money-talks-how-much-trouble-is-chinas-economy-in) |
| 2022-07-14 / Portico Advisers | Ben Fanger on distressed debt in China | Use verified title shown below; Retain original link | [Publisher source](https://www.porticopodcast.com/1894108/episodes/10958676-ben-fanger-on-distressed-debt-in-china) |
| 2021-12-14 / C*Funds | Capital Radio — Benjamin Fanger, Founding Partner of ShoreVest Partners | Retain original link | [Publisher source](https://www.cfunds.io/s1e8-capital-radio-benjamin-fanger-founding-partner-of-shorevest-partners/) |
| 2021-10-18 / Pensions & Investments | Few foreign investors positioned for China NPLs | Use current canonical publisher URL; Remove full article copy; source verification remains limited | [Publisher source](https://www.pionline.com/investing/few-foreign-investors-positioned-china-npls/) |
| 2021-05-13 / AllAboutAlpha | A comparative analysis of Chinese private debt | Historical only; retain metadata and label missing source | No verified original URL |
| 2021-04-28 / Investment Briefing | The credit crunch happening in China: defaults and the efficient allocation | Correct date to 2021-03-30; Publisher: Investment Magazine; Use verified title shown below; Retain original link | [Publisher source](https://www.investmentmagazine.com.au/2021/03/benjamin-fanger-the-credit-crunch-happening-in-china-defaults-and-the-efficient-allocation/) |
| 2020-09-15 / Reuters | The Exchange: China's bad debt opportunity | Publisher: Reuters Breakingviews; Recover original source link | [Publisher source](https://www.reuters.com/article/breakingviews/breakingviews-the-exchange-chinas-bad-debt-opportunity-idUSKBN26607Z/) |
| 2020-07-08 / AIM Summit | Unique post-COVID-19 dynamics in private credit (Europe & Asia) | Correct date to 2020-07-09; Use verified title shown below; Recover original source link | [Publisher source](https://www.youtube.com/watch?v=JAdw9sjZBo8) |
| 2020-06-04 / Debtwire | The new global NPL markets | Historical only; retain metadata and label missing source | No verified original URL |
| 2020-05-17 / Investment Magazine | Ben Fanger: special situations, recovery rates and Chinese distressed debt | Retain original link | [Publisher source](https://www.investmentmagazine.com.au/2020/05/ben-fanger-special-situations-recovery-rates-and-chinese-distressed-debt-2/) |
| 2020-05-07 / ShoreVest | China's credit environment in the wake of COVID-19 | Historical only; retain metadata and label missing source | No verified original URL |
| 2020-01-17 / Reorg | China NPL investors call the US-China trade deal a positive development | Historical only; retain metadata and label missing source | No verified original URL |
| 2020-01-16 / Bloomberg | U.S. firms could win a lucrative role in cleaning up China's bad debt | Historical only; retain metadata and label missing source | No verified original URL |
| 2019-10-30 / Asia Society | Executive Roundtable on China debt markets | Retain original link; 403; retain, not declared dead | [Publisher source](https://asiasociety.org/northern-california/executive-roundtable-benjamin-fanger-and-howard-chao) |
| 2019-01-17 / The Economist | As China's debt soars, the market for buying bad loans revs up | Historical only; retain metadata and label missing source | No verified original URL |
| 2017-06-01 / Nikkei Asia | China debt 'could prompt $7.7 trillion asset sale' | Historical only; retain metadata and label missing source | No verified original URL |
| 2016-05-07 / The Economist | Breaking bad | Historical only; retain metadata and label missing source | No verified original URL |

## Six recommended additions

Each addition has a verified original publisher page, publication date, and ShoreVest relevance. Gated metadata is used only for what it establishes; no inaccessible interview claims are invented. All six are short original summaries linking externally. None authorizes hosting or reproduction.

| Date | Publisher | Verified title | Why it merits inclusion |
|---|---|---|---|
| 2025-04-01 | Private Debt Investor | [Asia-Pacific is a tough market to crack](https://www.pei-privatecredit.com/asia-pacific-is-a-tough-market-to-crack/) | PEI examines distressed debt fundraising and investment conditions in Asia-Pacific, with ShoreVest among the firms covered. |
| 2024-09-11 | Reuters Breakingviews | [China’s banks have a nasty case of indigestion](https://www.reuters.com/breakingviews/chinas-banks-have-nasty-case-indigestion-2024-09-10/) | Robyn Mak examines pressure on Chinese banks and quotes Benjamin Fanger on cash-generating collateral behind distressed loans. |
| 2023-10-16 | DealStreetAsia | [IFC proposes $150m investment in ShoreVest’s SPV for distressed assets in China](https://www.dealstreetasia.com/stories/ifc-shorevest-spv-367122) | DealStreetAsia reports on IFC’s proposed investment in a ShoreVest vehicle targeting distressed assets in China. |
| 2020-06-01 | Private Debt Investor | [Why lending in China may be safer than you think](https://www.pei-privatecredit.com/why-lending-in-china-may-be-safer-than-you-think/) | Private Debt Investor examines China real estate lending and creditor protections, with ShoreVest among the managers covered. |
| 2017-06-13 | Private Debt Investor | [ShoreVest targets $750m for China fund](https://www.pei-privatecredit.com/shorevest-targets-750m-for-china-fund/) | Coverage of ShoreVest’s 2017 fundraising plans and a co-investment arrangement for larger transactions. |
| 2016-11-15 | Private Debt Investor | [Shoreline founder launches new distressed debt firm](https://www.pei-privatecredit.com/shoreline-founder-launches-new-distressed-debt-firm/) | Private Debt Investor reports on Benjamin Fanger’s launch of ShoreVest and the team’s focus on Chinese distressed debt. |

The 2023 IFC story concerns a **proposed** investment, not a confirmed closing. The 2017 fund story concerns a historic fundraising **target**, not capital raised.

## Verification and rights register — all 26 proposed records

Default disposition: link to the original publisher; do not host publisher text, imagery, PDFs or recordings. “Not established” is not an allegation of infringement; it means no permission evidence was available for this publication decision. Publication dates may differ from event dates or ShoreVest’s former posting dates.

### 1. Is Private Credit in a Bubble?

- **Publisher / date / format:** FII Institute / 2025-12-22 / Panel.
- **Original URL:** [Open original source](https://www.youtube.com/watch?v=t9BHji_UQlA).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Official video publication date; the previous 6 November date is not the upload date.
- **Actual feature/quotation evidence:** FII Institute official YouTube description names Benjamin Fanger, Founder & Managing Partner, ShoreVest Partners.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Benjamin Fanger joins a panel on private credit risk and differences between lending markets in North America, Brazil and China.

### 2. ShoreVest Partners on the case for China

- **Publisher / date / format:** Private Debt Investor / 2025-06-02 / Sponsored content.
- **Original URL:** [Open original source](https://www.pei-privatecredit.com/shorevest-partners-on-the-case-for-china/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Publisher headline, standfirst and sponsored label name ShoreVest and Benjamin Fanger. The repository PDF matches this interview.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** In this sponsored interview, Benjamin Fanger discusses lending structures, collateral and creditor enforcement in China.

### 3. Asia-Pacific is a tough market to crack

- **Publisher / date / format:** Private Debt Investor / 2025-04-01 / Article.
- **Original URL:** [Open original source](https://www.pei-privatecredit.com/asia-pacific-is-a-tough-market-to-crack/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Publisher metadata confirms Amy Carroll, publication date and ShoreVest as a key mention; full article is subscription-restricted.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established; external link and original ShoreVest summary only.
- **Proposed original description:** PEI examines distressed debt fundraising and investment conditions in Asia-Pacific, with ShoreVest among the firms covered.

### 4. Finding opportunities in Chinese property

- **Publisher / date / format:** HSBC / 2024-10-02 / Article.
- **Original URL:** [Open original source](https://www.business.hsbc.com/en-gb/insights/finding-opportunities-in-chinese-property).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Quotes Rebekah Woo in her stated ShoreVest LP/LPAC capacity; does not quote Benjamin Fanger.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** HSBC discusses China property investment opportunities, with comments from Rebekah Woo, identified as a ShoreVest limited partner and LPAC member.

### 5. China’s banks have a nasty case of indigestion

- **Publisher / date / format:** Reuters Breakingviews / 2024-09-11 / Commentary.
- **Original URL:** [Open original source](https://www.reuters.com/breakingviews/chinas-banks-have-nasty-case-indigestion-2024-09-10/).
- **Verification:** verified. Direct HTTP audit: 401 on 2026-09-20. Access restriction; not evidence of a dead link. See featureEvidence for independent publisher-page evidence.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Original Reuters page identifies Robyn Mak and directly quotes Benjamin Fanger; published 11 September 2024 UTC despite 10 September URL slug.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established; external link and original ShoreVest summary only.
- **Proposed original description:** Robyn Mak examines pressure on Chinese banks and quotes Benjamin Fanger on cash-generating collateral behind distressed loans.

### 6. Money Talks: How much trouble is China’s economy in?

- **Publisher / date / format:** The Economist / 2024-02-08 / Podcast.
- **Original URL:** [Open original source](https://shows.acast.com/theeconomistmoneytalks/episodes/money-talks-how-much-trouble-is-chinas-economy-in).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** 8 February 2024 from official episode page and RSS; 14 February was the ShoreVest archive date.
- **Actual feature/quotation evidence:** Official Economist Acast episode page and RSS feed explicitly list Ben Fanger, founder of ShoreVest Partners, as a guest.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Benjamin Fanger joins Money Talks to discuss China’s economic slowdown, property market stress and the outlook for investors.

### 7. IFC proposes $150m investment in ShoreVest’s SPV for distressed assets in China

- **Publisher / date / format:** DealStreetAsia / 2023-10-16 / Article.
- **Original URL:** [Open original source](https://www.dealstreetasia.com/stories/ifc-shorevest-spv-367122).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Original publisher headline names ShoreVest and describes a proposed investment; author Mars W. Mosqueda Jr., dated 16 October 2023. Do not imply a completed transaction.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established; external link and original ShoreVest summary only.
- **Proposed original description:** DealStreetAsia reports on IFC’s proposed investment in a ShoreVest vehicle targeting distressed assets in China.

### 8. Ben Fanger on Distressed Debt in China

- **Publisher / date / format:** Portico Advisers / 2022-07-14 / Podcast.
- **Original URL:** [Open original source](https://www.porticopodcast.com/1894108/episodes/10958676-ben-fanger-on-distressed-debt-in-china).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Official Portico episode 16 page names Ben Fanger and ShoreVest Partners; Apple episode is a duplicate distribution channel.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Mike Casey interviews Benjamin Fanger about China’s distressed debt market, non-performing loans and special situations investing.

### 9. Capital Radio — Benjamin Fanger, Founding Partner of ShoreVest Partners

- **Publisher / date / format:** C*Funds / 2021-12-14 / Podcast.
- **Original URL:** [Open original source](https://www.cfunds.io/s1e8-capital-radio-benjamin-fanger-founding-partner-of-shorevest-partners/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Publisher episode page names Benjamin Fanger as the guest and founding partner of ShoreVest.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Benjamin Fanger discusses China’s business environment, geopolitical risk and competition in distressed debt investing.

### 10. Few foreign investors positioned for China NPLs

- **Publisher / date / format:** Pensions & Investments / 2021-10-18 / Article.
- **Original URL:** [Open original source](https://www.pionline.com/investing/few-foreign-investors-positioned-china-npls/).
- **Verification:** access-limited. Direct HTTP audit: 200 on 2026-09-20. Canonical trailing-slash destination retrieved; initial access checks returned 403.
- **Date basis:** 18 October 2021 in repository publisher copy, by Douglas Appell.
- **Actual feature/quotation evidence:** Existing publisher copy in the repository contains Benjamin Fanger and ShoreVest commentary.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Pensions & Investments reports on overseas participation in China’s non-performing-loan market, including commentary from Benjamin Fanger.

### 11. A comparative analysis of Chinese private debt

- **Publisher / date / format:** AllAboutAlpha / 2021-05-13 / Article.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Background on how Chinese credit can be assessed relative to the broader private-debt market.

### 12. Benjamin Fanger: The credit crunch happening in China: Defaults and the efficient allocation

- **Publisher / date / format:** Investment Magazine / 2021-03-30 / Conference session.
- **Original URL:** [Open original source](https://www.investmentmagazine.com.au/2021/03/benjamin-fanger-the-credit-crunch-happening-in-china-defaults-and-the-efficient-allocation/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** 30 March 2021, 23:36, as displayed by the publisher; replaces 28 April archive date.
- **Actual feature/quotation evidence:** Original Investment Magazine session page identifies Benjamin Fanger as speaker and ShoreVest managing partner.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** A conference session with Benjamin Fanger on Chinese corporate defaults, liquidity pressures and distressed investment opportunities.

### 13. The Exchange: China's bad debt opportunity

- **Publisher / date / format:** Reuters Breakingviews / 2020-09-15 / Podcast.
- **Original URL:** [Open original source](https://www.reuters.com/article/breakingviews/breakingviews-the-exchange-chinas-bad-debt-opportunity-idUSKBN26607Z/).
- **Verification:** verified. Direct HTTP audit: 401 on 2026-09-20. Access restriction; not evidence of a dead link. See featureEvidence for independent publisher-page evidence.
- **Date basis:** 15 September 2020 UTC from Reuters; 14 September displayed in US Pacific time.
- **Actual feature/quotation evidence:** Reuters original episode introduction explicitly names Benjamin Fanger, ShoreVest and interviewer Pete Sweeney.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Pete Sweeney interviews Benjamin Fanger about bank failures, credit-market reform and opportunities for foreign investors in Chinese distressed debt.

### 14. Unique Market Dynamics in Private Credit Post COVID-19

- **Publisher / date / format:** AIM Summit / 2020-07-09 / Webinar.
- **Original URL:** [Open original source](https://www.youtube.com/watch?v=JAdw9sjZBo8).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** 9 July 2020 official video publication date; original archive used 8 July.
- **Actual feature/quotation evidence:** Official AIM Summit YouTube description names Benjamin Fanger, Managing Partner at ShoreVest Partners.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Benjamin Fanger joins an AIM Summit discussion of the pandemic’s effects on private credit conditions in Asia and Europe.

### 15. The new global NPL markets

- **Publisher / date / format:** Debtwire / 2020-06-04 / Webinar.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** A discussion of China's non-performing-loan market alongside other distressed-credit markets during a period of broad credit stress.

### 16. Why lending in China may be safer than you think

- **Publisher / date / format:** Private Debt Investor / 2020-06-01 / Article.
- **Original URL:** [Open original source](https://www.pei-privatecredit.com/why-lending-in-china-may-be-safer-than-you-think/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Publisher metadata names Adalla Kim, date and ShoreVest as a key mention; archived firm date of 27 May is not the publisher date.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established; external link and original ShoreVest summary only.
- **Proposed original description:** Private Debt Investor examines China real estate lending and creditor protections, with ShoreVest among the managers covered.

### 17. Ben Fanger: special situations, recovery rates and Chinese distressed debt

- **Publisher / date / format:** Investment Magazine / 2020-05-17 / Podcast.
- **Original URL:** [Open original source](https://www.investmentmagazine.com.au/2020/05/ben-fanger-special-situations-recovery-rates-and-chinese-distressed-debt-2/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** 17 May 2020, 04:00 from publisher page.
- **Actual feature/quotation evidence:** Publisher page identifies episode 7 with Ben Fanger of ShoreVest and hosts an official Transistor player.
- **Publication method:** External link; original ShoreVest summary only. Access: open.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Alex Proimos interviews Benjamin Fanger about special situations, debt recoveries and investing in China’s distressed credit market.

### 18. China's credit environment in the wake of COVID-19

- **Publisher / date / format:** ShoreVest / 2020-05-07 / Firm webinar.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** An investor briefing recorded during the early months of the COVID-19 disruption.

### 19. China NPL investors call the US-China trade deal a positive development

- **Publisher / date / format:** Reorg / 2020-01-17 / Article.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Coverage of investor reactions to the trade agreement and the continuing practical constraints in China's NPL market.

### 20. U.S. firms could win a lucrative role in cleaning up China's bad debt

- **Publisher / date / format:** Bloomberg / 2020-01-16 / Press coverage.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Early coverage of China's distressed-debt market opening to foreign participants.

### 21. Executive Roundtable on China debt markets

- **Publisher / date / format:** Asia Society / 2019-10-30 / Roundtable.
- **Original URL:** [Open original source](https://asiasociety.org/northern-california/executive-roundtable-benjamin-fanger-and-howard-chao).
- **Verification:** access-limited. Direct HTTP audit: 403 on 2026-09-20. Access restriction; not evidence of a dead link. See featureEvidence for independent publisher-page evidence.
- **Date basis:** 30 October 2019 from existing ShoreVest event record.
- **Actual feature/quotation evidence:** Named Asia Society event URL and existing firm archive; live body could not be revalidated.
- **Publication method:** External link; original ShoreVest summary only. Access: access-limited.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Asia Society’s executive roundtable with Benjamin Fanger and Howard Chao on China’s debt markets and trade-policy environment.

### 22. As China's debt soars, the market for buying bad loans revs up

- **Publisher / date / format:** The Economist / 2019-01-17 / Article.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Third-party background on the development of China's non-performing-loan investment market.

### 23. ShoreVest targets $750m for China fund

- **Publisher / date / format:** Private Debt Investor / 2017-06-13 / Article.
- **Original URL:** [Open original source](https://www.pei-privatecredit.com/shorevest-targets-750m-for-china-fund/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Publisher headline names ShoreVest; author Christie Ou and 13 June 2017 date verified. Historical target, not an assertion of funds raised.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established; external link and original ShoreVest summary only.
- **Proposed original description:** Coverage of ShoreVest’s 2017 fundraising plans and a co-investment arrangement for larger transactions.

### 24. China debt 'could prompt $7.7 trillion asset sale'

- **Publisher / date / format:** Nikkei Asia / 2017-06-01 / Opinion.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Commentary on the scale of potential asset sales associated with China's debt burden.

### 25. Shoreline founder launches new distressed debt firm

- **Publisher / date / format:** Private Debt Investor / 2016-11-15 / Article.
- **Original URL:** [Open original source](https://www.pei-privatecredit.com/shoreline-founder-launches-new-distressed-debt-firm/).
- **Verification:** verified. Direct HTTP audit: 200 on 2026-09-20.
- **Date basis:** Publisher publication date
- **Actual feature/quotation evidence:** Original publisher page identifies ShoreVest as a key mention; Christie Ou, 15 November 2016. Firm launch corroborated by existing archive record.
- **Publication method:** External link; original ShoreVest summary only. Access: subscription.
- **Rights concern:** Not established; external link and original ShoreVest summary only.
- **Proposed original description:** Private Debt Investor reports on Benjamin Fanger’s launch of ShoreVest and the team’s focus on Chinese distressed debt.

### 26. Breaking bad

- **Publisher / date / format:** The Economist / 2016-05-07 / Article.
- **Original URL:** No verified original URL.
- **Verification:** historical. No verified original URL recovered.
- **Date basis:** Existing ShoreVest archive; original publication date not independently confirmed.
- **Actual feature/quotation evidence:** Retained from the existing ShoreVest archive; original source requires confirmation.
- **Publication method:** Metadata only; no active publisher link. Access: unavailable.
- **Rights concern:** Not established. No publisher content or assets may be rehosted.
- **Proposed original description:** Historical coverage of China's non-performing-loan market during an earlier phase of the credit cycle.

## Broken links, duplicates and legacy routing

**Confirmed 404s:**

| URL | Decision |
|---|---|
| [Broken destination](https://porticoadvisers.com/2022/07/14/ben-fanger/) | Replace with the official Portico episode page; merge the Apple duplicate. |
| [Broken destination](https://shorevest.com/wp-content/uploads/2020/04/South-China-Morning-Post-Opportunity-of-a-lifetime-for-distress-investors-as-companies-from-HNA-to-Chinas-LVMH-flounder-and-bad-debts-balloon.pdf) | Do not reconstruct or rehost the publisher PDF. Original publisher replacement remains unverified; preserve the existing recovery path and flag it as unresolved. |
| [Broken destination](https://shorevest.com/wp-content/uploads/2017/06/ShoreVest-launches-750m-fund-to-tap-NPL-portfolios-in-China.pdf) | Do not reconstruct or rehost the publisher PDF. Original publisher replacement remains unverified; preserve the existing recovery path and flag it as unresolved. |
| [Broken destination](https://shorevest.com/wp-content/uploads/2018/01/China-Aims-at-Orderly-Deflating-of-the-Worlds-Largest-Credit-Excess.pdf) | Do not reconstruct or rehost the publisher PDF. Original publisher replacement remains unverified; preserve the existing recovery path and flag it as unresolved. |

The three missing ShoreVest publisher-PDF paths return HTTP 404. The existing 404 script offers a generic Media recovery, so a JavaScript visitor may eventually reach an archive, but the original asset is still absent. They are not falsely reported as restored articles.

Older News/Insights HTML aliases generally return 200 and use meta/JavaScript redirects, often to the generic Media page. These are content-loss or poor-destination issues, not all HTTP 404s. Existing CDD/research redirects and unrelated analytics changes are preserved.

| Exact alias / asset route | Proposed specific archive destination |
|---|---|
| `/news-insights/the-economist-money-talks` | `/media/#the-economist-2024-02-14-money-talks` |
| `/news-insights/the-case-for-china` | `/media/#private-debt-investor-2025-06-02-shorevest-partners-on-the-case-for-china` |
| `/news-insights/aim-summits-webinar-unique-market-dynamics-in-private-credit-post-covid-19-europe-asia` | `/media/#aim-summit-2020-07-08-post-covid-private-credit` |
| `/news-insights/debtwires-webinar-the-new-global-npl-markets` | `/media/#debtwire-2020-06-04-new-global-npl-markets` |
| `/news-insights/shorevests-webinar-chinas-credit-environment-in-the-wake-of-covid-19` | `/media/#shorevest-2020-05-07-credit-environment-wake-of-covid-19` |
| `/news-insights/china-debt-prompt-7-7-trillion-asset-sale` | `/media/#nikkei-asia-2017-06-01-china-debt-asset-sale` |
| `/news-insights/why-lending-in-china-may-be-safer-than-you-think` | `/media/#private-debt-investor-2020-06-01-why-lending-in-china` |
| `/news-insights/shoreline-founder-launches-new-distressed-debt-firm` | `/media/#private-debt-investor-2016-11-15-shorevest-launch` |
| `/news-insights/investment-magazines-podcast-ben-fanger-special-situations-recovery-rates-and-chinese-distressed-debt` | `/media/#investment-magazine-2020-05-17-special-situations-recovery-rates` |
| `/wp-content/uploads/2024/02/Economist-Money-Talks-Interview-1.mp3` | `/media/#the-economist-2024-02-14-money-talks` |
| `/wp-content/uploads/2020/05/PDI-Why-lending-in-China-may-be-safer-than-you-think.pdf` | `/media/#private-debt-investor-2020-06-01-why-lending-in-china` |
| `/wp-content/uploads/2017/06/ShoreVest-targets-750m-for-China-distress-fund.pdf` | `/media/#private-debt-investor-2017-06-13-shorevest-china-fund` |
| `/ShoreVest_PDI_Jun25.pdf` | `/media/#private-debt-investor-2025-06-02-shorevest-partners-on-the-case-for-china` |

The nine known HTML aliases are updated directly. The four former media-asset routes use the existing 404 recovery mechanism. This preserves visitor recovery but cannot turn a missing PDF request into an HTTP 301 on GitHub Pages; a true server-level redirect would require a separate hosting configuration change.

## Events and additional research leads

- **PDI APAC Forum, Singapore, 24–25 June 2026:** official agenda names Benjamin Fanger on the 24 June panel about Asian distressed debt and special situations. Retain the existing event record and make its description specific. Do not duplicate it as a new press article. [Official agenda](https://www.peievents.com/en/event/pdi-apac-forum/)
- **APAC Family Office Investment Summit:** ShoreVest currently lists 8–9 September 2026; the organiser currently states 20–21 October 2026 in Shanghai. Flag for internal schedule confirmation; date not silently changed. The organiser’s speaker/agenda text reviewed did not establish Fanger participation. [Organiser](https://apacfamilysummit.com/)
- **Caproasia Hong Kong:** ShoreVest lists 15 October 2026; the organiser currently states 14 October. Flag for confirmation. Singapore 5 November agrees with the organiser. Shared event URL is not by itself a duplicate: Hong Kong and Singapore are separate events. [Organiser](https://my.caproasia.com/the-2026-family-office-summit/)
- **SuperReturn Asia:** the current organiser states 28 September–1 October 2026, matching the repository. Do not replace it with an unverified alternative date. [Organiser](https://informaconnect.com/superreturnasia/)
- **World Family Office Forum Asia:** official site states 15–16 October 2026 in Hong Kong, matching the repository. [Organiser](https://asia.worldfamilyofficeforum.com/)
- All existing event destination links were included in the 128-URL check. A working event landing page does not by itself verify ShoreVest attendance, a speaking role, or the historic session date. Existing LinkedIn recaps remain; no publisher event photography is imported.
- FT historical stories (2017 ShoreVest launch/fund and 2019 NPL disposals), SCMP’s 2020 distressed-assets story, Bloomberg’s 2020 defaults story, the P&I Cambridge Associates story, and other old aliases remain research leads. They are not added as verified new coverage where the original page/date/firm feature could not be established together. The eight existing unresolved records remain visible. No claim is made that this search exhausted every historic or recent mention.

## Implementation, checks and approval

- Shared reviewed JSON drives both language archives and 13 preserved detail pages. All 26 records are readable without JavaScript. Filtering/pagination are optional enhancements.
- Source-access and sponsored-content labels are visible. Chinese summaries are original translations, while original publication titles remain in English.
- The PDF publication script now requires specific rights evidence fields in addition to an approved status. Automated media discovery produces pending-review records, which public rendering excludes.
- Passed: JavaScript syntax; generated archive/detail consistency; unique IDs and source URLs; English/Chinese filters and combined filters; load more; empty results; malformed hashes; old-entry deep links; pending-review exclusion; no-JavaScript and failed-enhancement readability; static content in all 13 detail pages; absence of the removed PDI PDF; and Git whitespace checks.
- **Visual QA limitation:** the browser service blocks local-file preview navigation. A standalone interactive preview is supplied with desktop/mobile-width and language controls, but a browser-rendered desktop/mobile visual sign-off has not been completed. Mobile CSS retains the existing one-column breakpoint, with wrapping metadata and headlines.
- Preview files contain existing ShoreVest design/assets and proposed archive content. External article links go to publishers. Event-date discrepancies remain explicitly flagged rather than quietly overwritten.
- **Approval required before production:** review the audit, preview and diff; resolve the noted PEI terms/reprint question if necessary and event-date discrepancies with the relevant owner. No production merge or deployment has been performed.

## Complete link-check ledger

Checked 20 September 2026. HTTP results are a snapshot, not a promise of continuing availability. Publisher restrictions can vary by client. The feature evidence in the register may come from a successful publisher/web-index retrieval even where a direct request is restricted.

| URL / context | HTTP | Final / HTML redirect |
|---|---|---|
| [Current EN archive: Private credit market discussion / Reviewed archive: Is Private Credit in a Bubble? / Events ledger / Current CN archive / Current CN archive](https://www.youtube.com/watch?v=t9BHji_UQlA) | 200 | Same URL |
| [Current EN archive: ShoreVest Partners on the case for China / Reviewed archive: ShoreVest Partners on the case for China](https://www.pei-privatecredit.com/shorevest-partners-on-the-case-for-china/) | 200 | Same URL |
| [Current EN archive: Finding opportunities in Chinese property](https://www.gbm.hsbc.com/en-gb/insights/market-and-regulatory-insights/finding-opportunities-in-chinese-property) | 200 | https://www.business.hsbc.com/en-gb/insights/finding-opportunities-in-chinese-property |
| [Current EN archive: Ben Fanger on distressed debt in China / Reviewed archive: Ben Fanger on distressed debt in China](https://www.porticopodcast.com/1894108/episodes/10958676-ben-fanger-on-distressed-debt-in-china) | 200 | Same URL |
| [Current EN archive: Capital Radio — Benjamin Fanger, Founding Partner of ShoreVest Partners / Reviewed archive: Capital Radio — Benjamin Fanger, Founding Partner of ShoreVest Partners / Current CN archive](https://www.cfunds.io/s1e8-capital-radio-benjamin-fanger-founding-partner-of-shorevest-partners/) | 200 | Same URL |
| [Current EN archive: Few foreign investors positioned for China NPLs / Reviewed archive: Few foreign investors positioned for China NPLs](https://www.pionline.com/investing/few-foreign-investors-positioned-china-npls) | 200 | https://www.pionline.com/investing/few-foreign-investors-positioned-china-npls/ |
| [Current EN archive: The credit crunch happening in China: defaults and the efficient allocation / Reviewed archive: Benjamin Fanger: The credit crunch happening in China: Defaults and the efficient allocation / Current CN archive](https://www.investmentmagazine.com.au/2021/03/benjamin-fanger-the-credit-crunch-happening-in-china-defaults-and-the-efficient-allocation/) | 200 | Same URL |
| [Current EN archive: Ben Fanger: special situations, recovery rates and Chinese distressed debt / Reviewed archive: Ben Fanger: special situations, recovery rates and Chinese distressed debt / Current CN archive](https://www.investmentmagazine.com.au/2020/05/ben-fanger-special-situations-recovery-rates-and-chinese-distressed-debt-2/) | 200 | Same URL |
| [Current EN archive: Executive Roundtable on China debt markets / Reviewed archive: Executive Roundtable on China debt markets / Events ledger / Current CN archive](https://asiasociety.org/northern-california/executive-roundtable-benjamin-fanger-and-howard-chao) | 403 | Same URL |
| [Reviewed archive: Asia-Pacific is a tough market to crack](https://www.pei-privatecredit.com/asia-pacific-is-a-tough-market-to-crack/) | 200 | Same URL |
| [Reviewed archive: Finding opportunities in Chinese property](https://www.business.hsbc.com/en-gb/insights/finding-opportunities-in-chinese-property) | 200 | Same URL |
| [Reviewed archive: China’s banks have a nasty case of indigestion](https://www.reuters.com/breakingviews/chinas-banks-have-nasty-case-indigestion-2024-09-10/) | 401 | Same URL |
| [Reviewed archive: Money Talks: How much trouble is China’s economy in?](https://shows.acast.com/theeconomistmoneytalks/episodes/money-talks-how-much-trouble-is-chinas-economy-in) | 200 | Same URL |
| [Reviewed archive: IFC proposes $150m investment in ShoreVest’s SPV for distressed assets in China](https://www.dealstreetasia.com/stories/ifc-shorevest-spv-367122) | 200 | Same URL |
| [Reviewed archive: The Exchange: China's bad debt opportunity](https://www.reuters.com/article/breakingviews/breakingviews-the-exchange-chinas-bad-debt-opportunity-idUSKBN26607Z/) | 401 | Same URL |
| [Reviewed archive: Unique Market Dynamics in Private Credit Post COVID-19](https://www.youtube.com/watch?v=JAdw9sjZBo8) | 200 | Same URL |
| [Reviewed archive: Why lending in China may be safer than you think](https://www.pei-privatecredit.com/why-lending-in-china-may-be-safer-than-you-think/) | 200 | Same URL |
| [Reviewed archive: ShoreVest targets $750m for China fund](https://www.pei-privatecredit.com/shorevest-targets-750m-for-china-fund/) | 200 | Same URL |
| [Reviewed archive: Shoreline founder launches new distressed debt firm](https://www.pei-privatecredit.com/shoreline-founder-launches-new-distressed-debt-firm/) | 200 | Same URL |
| [Events ledger](https://apacfamilysummit.com/) | 200 | Same URL |
| [Events ledger](https://informaconnect.com/superreturnasia/) | 200 | Same URL |
| [Events ledger](https://asia.worldfamilyofficeforum.com/) | 200 | Same URL |
| [Events ledger / Events ledger](https://my.caproasia.com/the-2026-family-office-summit/) | 200 | Same URL |
| [Events ledger](https://fii-institute.org/conference/fii-10th-edition/) | 200 | Same URL |
| [Events ledger](https://www.peievents.com/en/event/pdi-apac-forum/) | 200 | Same URL |
| [Events ledger](https://www.linkedin.com/posts/shorevest-partners_pdi-asian-privatecredit-activity-7477857736379031552-1dRs) | 200 | Same URL |
| [Events ledger](https://informaconnect.com/superreturn-emerging-markets/) | 200 | Same URL |
| [Events ledger](https://www.linkedin.com/posts/shorevest-partners_emergingmarkets-privatecredit-uncorrelated-activity-7473668678174154754-BwaO) | 200 | Same URL |
| [Events ledger](https://www.linkedin.com/embed/feed/update/urn:li:share:7473668676995469312?collapsed=1) | 200 | Same URL |
| [Events ledger](https://events.bloomberglive.com/event/InvestHK_2026/summary?RefId=blive_tile) | 200 | Same URL |
| [Events ledger](https://www.linkedin.com/posts/shorevest-partners_privatecredit-asiaprivatecredit-chinaprivatecredit-activity-7443141209809862659-14J4) | 200 | Same URL |
| [Current CN archive](https://www.business.hsbc.com/en-gb/insights/market-and-regulatory-insights/finding-opportunities-in-chinese-property) | 200 | https://www.business.hsbc.com/en-gb/insights/finding-opportunities-in-chinese-property |
| [Current CN archive](https://porticoadvisers.com/2022/07/14/ben-fanger/) | 404 | Same URL |
| [Current CN archive](https://podcasts.apple.com/us/podcast/ben-fanger-on-distressed-debt-in-china/id1519258360?i=1000569858021) | 200 | Same URL |
| [Existing News/Insights alias](https://shorevest.com/news-insights/aim-summits-webinar-unique-market-dynamics-in-private-credit-post-covid-19-europe-asia/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/big-ignore-internationalisation-chinese-balance-sheets/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/cambridge-associates-touts-fleeting-china-real-estate-opportunity/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/china-can-deflate-worlds-largest-credit-bubble-orderly-fashion/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/china-debt-prompt-7-7-trillion-asset-sale/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/china-tipped-to-see-more-npl-deal-flow/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/chinas-credit-excess-unlike-anything-world-ever-seen/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/chinas-legal-system-came-long-way-enforcing-creditor-claims-bad-debt/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/debtwires-webinar-the-new-global-npl-markets/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/doing-your-homework-pays-in-chinese-distressed-debt/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/ex_shoreline_executives_reform_as_shorevest/) | 200 | /firm/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/four-reasons-china-opening-bond-market-world/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/global-investors-return-to-chinas-bad-debt-market/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/) | 200 | /insights/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/industry-qa-benjamin-fanger/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/into-the-shadows-of-us-private-credit-a-china-perspective/) | 200 | /insights/china-debt-dynamics/v9i3/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/investment-magazines-podcast-ben-fanger-special-situations-recovery-rates-and-chinese-distressed-debt/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/investors-see-return-of-npl-opportunities-in-2h20-with-potential-price-drop-debtwire-webinar/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/new-firm-shorevest-launches-to-invest-in-chinese-distressed-debt/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/opportunity-of-a-lifetime-for-distress-investors-as-companies-from-hna-to-chinas-lvmh-flounder-and-bad-debts-balloon/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/playing-doctor/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/shoreline-founder-launches-new-distressed-debt-firm/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/shorevest-capital-taps-growing-global-interest-china-npls/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/shorevest-china-aims-orderly-deflating-worlds-largest-credit-excess/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/shorevest-launches-750m-fund-tap-npl-portfolios-china/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/shorevests-benjamin-fanger-on-private-market-solutions-for-npls/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/shorevests-webinar-chinas-credit-environment-in-the-wake-of-covid-19/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/the-case-for-china/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/the-economist-money-talks/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/the-end-of-the-chinas-univestable-myth/) | 200 | /insights/china-debt-dynamics/v10i1/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/views-from-the-field-reflecting-on-2013-and-the-outlook-for-em-pe-in-2014/) | 200 | /media/ |
| [Existing News/Insights alias](https://shorevest.com/news-insights/why-lending-in-china-may-be-safer-than-you-think/) | 200 | /media/ |
| [Existing media detail URL](https://shorevest.com/media/aim-summit-unique-post-covid-19-dynamics-in-private-credit/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/allaboutalpha-a-comparative-analysis-of-chinese-private-debt/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/bloomberg-us-firms-could-win-a-lucrative-role-in-cleaning-up-chinas-bad-debt/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/debtwire-the-new-global-npl-markets/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/nikkei-asia-china-debt-could-prompt-7-7-trillion-asset-sale/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/pensions-investments-few-foreign-investors-positioned-for-china-npls/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/private-debt-investor-shorevest-partners-on-the-case-for-china/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/reorg-china-npl-investors-call-the-us-china-trade-deal-a-positive-development/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/reuters-the-exchange-chinas-bad-debt-opportunity/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/shorevest-chinas-credit-environment-in-the-wake-of-covid-19/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/the-economist-as-chinas-debt-soars-the-market-for-buying-bad-loans-revs-up/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/the-economist-breaking-bad/) | 200 | Same URL |
| [Existing media detail URL](https://shorevest.com/media/the-economist-money-talks-china-financial-system-distressed-debt/) | 200 | Same URL |
| [Legacy Media recovery path](https://shorevest.com/china-debt-dynamics/comparative-analysis-of-chinese-private-credit) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/china-approaching-lehman-moment) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/china-crackdown-bad-debt-forces-wave-loans-market) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/china-debt-prompt-7-7-trillion-asset-sale) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/china-npl-investors-call-us-china-trade-deal-positive-development-agreement-unlikely-to-remove-main-hurdles-for-investors) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/distressed-funds-find-treasure-chinas-mounting-bad-debts) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/empea-professional-development-webcast-chinese-pe-market-overview) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/empea-professional-development-webcast-chinese-private-distressed-debt-investing-opportunities-challenges) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/new-firm-shorevest-launches-to-invest-in-chinese-distressed-debt) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/new-firm-shorevest-launches-to-invest-in-chinese-distressed-debt) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/big-ignore-internationalisation-chinese-balance-sheets) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/cambridge-associates-touts-fleeting-china-real-estate-opportunity) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/china-can-deflate-worlds-largest-credit-bubble-orderly-fashion) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/china-tipped-to-see-more-npl-deal-flow) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/chinas-credit-excess-unlike-anything-world-ever-seen) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/chinas-legal-system-came-long-way-enforcing-creditor-claims-bad-debt) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/doing-your-homework-pays-in-chinese-distressed-debt) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/four-reasons-china-opening-bond-market-world) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/industry-qa-benjamin-fanger) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/industry-qa-benjamin-fanger) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/investors-see-return-of-npl-opportunities-in-2h20-with-potential-price-drop-debtwire-webinar) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/opportunity-of-a-lifetime-for-distress-investors-as-companies-from-hna-to-chinas-lvmh-flounder-and-bad-debts-balloon) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/wp-content/uploads/2020/04/South-China-Morning-Post-Opportunity-of-a-lifetime-for-distress-investors-as-companies-from-HNA-to-Chinas-LVMH-flounder-and-bad-debts-balloon.pdf) | 404 | Same URL |
| [Legacy Media recovery path](https://shorevest.com/news-insights/playing-doctor) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/playing-doctor) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/shorevest-china-aims-orderly-deflating-worlds-largest-credit-excess) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/shorevest-china-aims-orderly-deflating-worlds-largest-credit-excess) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/shorevest-launches-750m-fund-tap-npl-portfolios-china) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/wp-content/uploads/2017/06/ShoreVest-launches-750m-fund-to-tap-NPL-portfolios-in-China.pdf) | 404 | Same URL |
| [Legacy Media recovery path](https://shorevest.com/shorevest-eyeing-chinas-bad-debt-industry-750m-fund) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/shorevests-benjamin-fanger-on-private-market-solutions-for-npls) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/views-from-the-field-reflecting-on-2013-and-the-outlook-for-em-pe-in-2014) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/views-from-the-field-reflecting-on-2013-and-the-outlook-for-em-pe-in-2014) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/news-insights/global-investors-return-to-chinas-bad-debt-market) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/podcast-benjamin-fanger-ballooning-bad-loans-in-china-are-the-next-great-opportunity) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/benjamin-fanger-ballooning-bad-loans-in-china-are-the-next-great-opportunity-transcript-of-podcast) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/shoreline-capitals-fanger-on-chinas-coming-debt-crisis) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/andrew-brown-china-committed-market-based-solution-excess-debt-challenge) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/as-chinas-debt-soars-the-market-for-buying-bad-loans-revs-up) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/cbrc-stepping-enforcement-prohibited-accounting-practices) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/the-beauty-and-the-beast-of-chinas-non-performing-loans) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/thick-skins-local-savvy-needed-chinas-bad-debt-markets) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/worlds-biggest-debt-load-lures-distressed-funds-to-china) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/zombies-hidden-china-debt-swaps-keep-distressed-funds-wary) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/with-few-big-deals-private-equity-moves-to-be-asias-new-banker) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/welcome-to-the-1-5-trillion-minefield-of-defaulted-chinese-debt-2) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/nikkei-asian-review/evergrandes-liquidation-will-not-pay-off-for-foreign-investors-nikkei-asia) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/uncategorized/webinar-china-private-debt-comparative-risk-return) | 200 | /media/ |
| [Legacy Media recovery path](https://shorevest.com/wp-content/uploads/2018/01/China-Aims-at-Orderly-Deflating-of-the-Worlds-Largest-Credit-Excess.pdf) | 404 | Same URL |
