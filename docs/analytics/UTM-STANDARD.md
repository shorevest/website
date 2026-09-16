# ShoreVest UTM Attribution Standard

This is the canonical naming standard for links to `shorevest.com` used in investor outreach, newsletters, events, social posts, QR codes and other campaigns.

## Required parameters

| Parameter | Rule | Examples |
|---|---|---|
| `utm_source` | Originating platform or surface. Lowercase. | `email`, `linkedin`, `whatsapp`, `qr` |
| `utm_medium` | Marketing / IR channel. Lowercase. | `ir_outreach`, `newsletter`, `social`, `event` |
| `utm_campaign` | Stable campaign identifier shared by every wave of the same campaign. | `fund3_deals_update_aug26`, `superreturn_asia_2026` |
| `utm_content` | Sender, creative or wave/version. Change this for follow-ups rather than changing the campaign. | `ben_initial`, `kelvin_followup1`, `john_reception_invite` |
| `utm_term` | Optional audience segment. Never put a person's name or other personal data here. | `asia_insurers`, `family_offices`, `fund2_lps` |

## Naming rules

1. Use lowercase ASCII and underscores only.
2. Do not put names of LP contacts, email addresses, account IDs or other personal data in a URL.
3. Keep `utm_campaign` unchanged across initial sends and follow-ups for the same campaign.
4. Use `utm_content` to distinguish sender, wave, subject-line variant or creative.
5. Use `utm_term` only for a broad audience segment when that segmentation is analytically useful.
6. Do not overwrite unrelated query parameters already required by the landing page.
7. Only tag ShoreVest-owned landing pages with the ShoreVest builder. External links keep the destination's own tracking conventions.

## Campaign families

Use these forms unless there is a clear reason not to:

- Fund III fundraising: `fund3_<campaign>_<monthyear>`
- SuperReturn Asia 2026: `superreturn_asia_2026`
- AGM 2026: `agm_2026`
- APAC Family Office Summit 2026: `apac_fo_summit_2026`
- World Family Office Forum Hong Kong 2026: `world_fo_forum_hk_2026`
- FII 2026: `fii_2026`
- Monthly broad-universe update: `monthly_ben_update_<monthyear>`

## Examples

Ben Fund III initial send:

```text
https://shorevest.com/?utm_source=email&utm_medium=ir_outreach&utm_campaign=fund3_deals_update_aug26&utm_content=ben_initial
```

Kelvin SuperReturn follow-up:

```text
https://shorevest.com/?utm_source=email&utm_medium=ir_outreach&utm_campaign=superreturn_asia_2026&utm_content=kelvin_followup1
```

John reception invitation to a broad family-office segment:

```text
https://shorevest.com/?utm_source=email&utm_medium=ir_outreach&utm_campaign=superreturn_asia_2026&utm_content=john_reception_invite&utm_term=family_offices
```

## Power Automate / MergePoint implementation

Generate the complete tagged URL before inserting it into the email body. The campaign identifier must be supplied once per campaign; follow-up flows should reuse it and change only the content value.

Recommended fields in any outreach-flow configuration:

```text
LandingUrl
UtmSource       = email
UtmMedium       = ir_outreach
UtmCampaign
UtmContent
UtmTerm         = optional
```

Do not derive `utm_campaign` from the email subject. Subjects change; attribution identifiers should not.

## Reporting interpretation

In GA4, use campaign + content together when comparing outreach waves. Example: compare `superreturn_asia_2026 / kelvin_initial` with `superreturn_asia_2026 / kelvin_followup1`, not two separate campaigns.

The objective is to reduce unattributed Direct traffic and make investor-interest events such as `contact_email_open` and `investor_portal_access` traceable back to a campaign without sending personal data to Google Analytics.
