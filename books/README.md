# Βιβλιοσκόπιο — Greek book arbitrage MVP

Independent application in `books/` of `labispe89/supermarket-basket`. Reuses the existing dependency-free ES module, native Node test and GitHub Pages pattern. No automatic purchases and no scraping. Greek responsive UI, local persistence, ISBN/edition matching, editable thresholds, transparent cost calculations, import/export, optional authorized-feed backend and private scheduled alert history.

## Run

Node 20+: from repository root, `npm test`, then `npm start`. Open `http://127.0.0.1:4173/books/index.html`. No install/build required. GitHub Pages serves `/supermarket-basket/books/` from the existing root publishing configuration. The existing basket service worker does not cache these paths. No secrets belong in frontend files or Pages.

## What works, and what does not

- Manual observations and JSON imports work immediately. URLs are evidence links, never fetched. External source links open the site's home/search UI for manual inspection.
- ISBN metadata can be filled on demand from the official [Open Library Search API](https://openlibrary.org/developers/api). It supplies bibliographic metadata only, never market price or availability. Requests occur only after a user action and successful responses are cached locally for 30 days, respecting Open Library's low-volume human-facing guidance and default one-request-per-second tier.
- On-demand analysis searches your observations. Remote refresh downloads configured authorized JSON feeds, then uses the same matching engine. These are different actions in the UI.
- **No production price feeds are configured. No live cross-market market scan or scheduled alerts are active by default.** No public read API/redistribution permission for all six markets was verified. An accessible webpage or undocumented internal endpoint is not treated as authorization.
- Synthetic demo is opt-in, visibly labelled, not persisted and rejected by backend feeds/import. It is not a real deal. Closing demo restores the pre-demo list.
- No automated demand or turnover measurement: those are user/feed-supplied observations. Unknown values remain unknown. Counts from this partial sample are shown separately from market-wide competition.
- No lot allocation in v1: enter one book/edition per observation. No tax calculation, realized return guarantee or automated purchase.

## Workflow

1. Record an available book (`offer`) with a supported source, its HTTPS URL, price, condition, observation time and ISBN. `retail` means a currently purchasable new copy. `asking` and `sold` are comparisons, never purchase candidates.
2. Add independent comparisons of the same edition. Do not mark asking listings as completed sales. ISBN checksums are validated; ISBN-10 converts to its equivalent ISBN-13. Conflicting valid ISBNs never match. Fallback requires exact normalized title + author + publisher, and caps confidence at 60.
3. Configure purchase ceiling, profit/ROI, WATCH range, confidence, competition, minimum demand/scarcity, turnover ceiling and freshness. Blank optional observation fields remain unknown. Unknown demand/scarcity fail a positive minimum; unknown competition/turnover prevent BUY.
4. Set fees and shipping for the intended resale destination. Global defaults are **illustrative assumptions, not platform fee schedules**. Imported per-offer feePercent/feeFixed/shippingIn/shippingOut override defaults.
5. Analyze and inspect supporting links/reasons before taking action yourself. Persisted observations do not refresh themselves; old observations become PASS. Export regularly. Import merges by id, preserving other records.

## Model

Only fresh same-edition comparisons are considered. Resale is the lower quartile of completed-sale prices when available, otherwise secondary asking prices, reduced by an adjustable discount (15% default). Only comparisons in equal/worse physical condition support resale; prices of available retail copies cap it at 75% for used books / 95% for new. Other current secondary asking prices cap it at 95%. A retail purchase itself also caps resale because another buyer could purchase it directly. A bare retail reference without secondary comparisons cannot create a resale estimate.

Total acquisition cost = purchase + inbound shipping. Fees = resale × fee percent + fixed fee. Net profit = resale − acquisition cost − fees − outbound shipping − packaging. ROI = net profit / acquisition cost × 100. Money rounds to cents. This is before taxes and personal labor.

Confidence is a **heuristic, not a probability**: exact ISBN base 50, fallback base 30, +12 per completed sale (up to 3), +5 per asking comparison (up to 3), caps 95 exact / 60 fallback. BUY requires >=2 completed-sale comparisons, exact matching, known demand/competition/turnover, minimum confidence and all financial/market filters. Asking-only evidence cannot produce BUY even if the confidence slider is reduced.

WATCH requires positive profit within the configured range, or BUY-level profit and ROI lacking the stronger BUY evidence. Hard purchase/freshness/market filters still apply. PASS explains why. Scarcity = 100/(1+declared competing listings): a descriptive inverse count, not an observed sales probability. Turnover is explicitly a supplied estimate, not inferred from wishlists. Duplicate canonical URLs are counted once; same known seller/source comparisons do not independently support a candidate.

## JSON import / authorized feed contract

```json
{
  "schemaVersion": 1,
  "observations": [{
    "id": "unique-listing-id",
    "source": "metabook",
    "url": "https://metabook.gr/REPLACE_WITH_REAL_LISTING",
    "title": "Actual title",
    "author": "Actual author",
    "publisher": "Actual publisher",
    "isbn": "9780141036137",
    "kind": "offer",
    "condition": "good",
    "price": 6,
    "currency": "EUR",
    "observedAt": "2026-09-22T08:00:00Z",
    "competition": 3,
    "demand": 12,
    "turnoverDays": 45
  }]
}
```

This is a schema example, not a verified offer. Set the actual URL, price and observation time. Sources: `metabook`, `skroutz`, `public`, `politeia`, `vendora`, `vinted`, `other`. Conditions: `new`, `like-new`, `good`, `fair`. EUR only. Import accepts an array or the envelope above. Up to 5,000 observations / 3 MB. Optional numeric fields accept omission/null; prices must be positive. HTTPS source domains must match the declared platform (`other` permits other HTTPS evidence links). Avoid private contact details.

## Optional backend deployment (Cloudflare Workers)

No backend account or credentials are assumed. Install the official Wrangler CLI in your own environment and authenticate, then from `books/backend`:

1. `npx wrangler kv namespace create SCANS`; copy the returned ID into the commented binding in `wrangler.toml` and uncomment that section.
2. `npx wrangler secret put SCANNER_TOKEN`; use a random token of at least 24 characters. Never commit it. Frontend asks for it each session and does not persist it.
3. Set `ALLOWED_ORIGIN` to the frontend origin. Configure `AUTHORIZED_FEEDS` only for feeds whose provider permits your intended collection/display. Each entry: `{"id":"provider1","name":"Licensed feed","source":"other","url":"https://provider.example/catalog.json","permissionUrl":"https://provider.example/license","authorized":true}`. This is operator attestation, not automatic legal verification. The adapter expects the normalized contract above; it is not a universal parser for retailer XML or merchant APIs.
4. `npx wrangler deploy`. Set the resulting HTTPS URL in the UI; choose sources and press feed refresh. The backend never accepts a URL from a search request, rejects redirects, bounds response size and has request timeouts. Feed credentials, if needed, require a server-side extension; never place them in URLs or the frontend.
5. Set `SCAN_SETTINGS` (query and settings) independently from browser filters. Enable the commented hourly cron only after KV and feeds are configured. The included `SCAN_HOUR_ATHENS="08"` guard runs at 08:00 Athens, including daylight saving changes. Remove the variable if every cron tick should run a scan.

`POST /scan` requires Bearer token and `{query,sources}`; returns observations, timestamps and per-source status, including explicit unsupported adapters. No cached prices substitute for failed feeds. `GET /alerts` requires the same token. Scheduled scans write up to 200 new/changed BUY or WATCH entries to private KV, suppress unchanged results and write last-scan health separately. **Alerts are an in-app pull inbox, not push/email/SMS**; external delivery is a future integration. KV is eventually consistent: use a single schedule and avoid overlapping invocations. Add rate limiting for a multi-user deployment; this MVP is private, single-operator tooling with a shared secret.

## Source access audit (2026-09-22)

| Source | MVP access | Evidence / next step |
|---|---|---|
| Metabook | Manual URLs/import | [Professional XML](https://metabook.gr/professionals) describes sellers sending inventory to Metabook; it does not grant an export of the whole marketplace. [Terms](https://metabook.gr/terms). Obtain explicit feed permission. |
| Skroutz | Manual URLs/import | [Current developer docs](https://developer.skroutz.gr/docs/) describe merchant products/orders/analytics; no unrestricted market-wide read entitlement established here. Add an official approved contract when available. |
| Public | Manual URLs/import | [Terms](https://www.public.gr/page/oroi-xrisis). Merchant upload integrations are not public export feeds. |
| Πολιτεία | Manual URLs/import | [Official site](https://www.politeianet.gr/). No approved price feed verified. |
| Vendora | Manual URLs/import | [Terms](https://support.vendora.gr/knowledge-base/terms-of-use/). No approved price feed verified. |
| Vinted | Manual URLs/import | [Greek terms](https://www.vinted.gr/terms-and-conditions). No scraping adapter, login automation or private endpoint access. |
| Other | Authorized normalized feed / manual | Operator must verify permission, provenance, units, freshness and redistribution rights. |

Metadata-only sources are intentionally separate from price evidence. Open Library is enabled for user-triggered ISBN lookup. Google Books was reviewed but is not enabled because its public-data requests require an application API key; it can be added later without OAuth access to personal bookshelves. Neither source establishes resale value.

Use each marketplace's own saved searches/alerts where available, then enter observations or import your permitted export. This MVP does not read email or platform accounts.

## Validation

`npm test` runs the existing basket tests plus `books/test/*.test.js`: ISBN checksums/conversion and conflicts, fallback matching, price caps, fees, threshold boundaries, stale/future data, unknown indicators, source selection, deduplication, authentication, bounded feed reads, partial failures and scheduled alert deduplication. No live market fixtures in production. Test fixtures are explicitly synthetic.

