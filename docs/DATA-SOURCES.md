# Price sources — audit 2026-09-22

The deployed v5 used an unofficial GitHub mirror as if it were live. The downloaded runtime file contains 9,231 product rows (the source's aggregate stats report 9,453) and `generated_at: 2026-07-12T09:43:13.275Z`. Its retailer prices have no observation timestamps. A successful HTTP fetch is NOT evidence of fresh prices.

Sources checked:

- Official service listing: https://www.gov.gr/en/upourgeia/upourgeio-anaptuxes/anaptuxes/sugkrise-timon-katanalotikon-proionton-lianopoleton-posokanei
- Ministry announcement: https://www.mindev.gov.gr/takis-theodorikakos-enisxyoume-ti-diafaneia-kai-ton-igyi-antagonismo-pros-ofelos-ton-noikokyrion/
- Official website: https://posokanei.gov.gr/ (HTTP 403 from this development environment).
- https://api.posokanei.gov.gr/openapi.json returned 404. No supported, documented, licensed third-party live feed was verified during this audit. No access-control bypass was attempted.
- Existing mirror: https://github.com/spirosrap/posokanei-basket-demo (MIT software license). A software license does not by itself establish rights to the underlying third-party price database. v6 uses this existing source for diagnostic matching only and does not redistribute its dataset in this repository.

## Current behavior

`providers.json` deliberately contains no authorized feeds. The app can diagnose the shopping list using the existing mirror, but cannot name a cheapest store until a permitted current price feed is connected. Offline fallback is also diagnostics-only. No fixture prices are shipped to the application.

## Connecting a permitted feed

Obtain an official API/data-reuse agreement or a retailer-authorized feed, document its permitted use and request limits, and expose a normalized HTTPS JSON endpoint with CORS for this GitHub Pages origin. Secrets must stay in a server-side collector, never in this public repository. Add `{ "name": "Provider name", "url": "https://provider.example/catalog.json", "permissionUrl": "https://provider.example/data-permission" }` to `authorizedFeeds`. Review the permission document before adding the entry; a URL is an audit reference, not automatic legal verification.

The provider adapter must emit:

```json
{
  "schemaVersion": 1,
  "generatedAt": "2026-09-22T09:00:00Z",
  "products": [{
    "id": "stable-provider-product-id",
    "name": "Product name and package size",
    "brand": "Verified brand",
    "category": "Verified product category",
    "subcategory": "Optional parent category",
    "private_label": false,
    "unit": "kg",
    "unit_quantity": 0.2,
    "offers": [{
      "store": "sklavenitis",
      "price": 2.15,
      "currency": "EUR",
      "priceBasis": "package",
      "available": true,
      "unconditional": true,
      "observedAt": "2026-09-22T08:00:00Z",
      "sourceUrl": "https://provider.example/product"
    }]
  }]
}
```

The JSON above illustrates the contract, not real prices. `observedAt` must be the source observation time, not the import time. Unknown stock/availability, loyalty-only offers, missing price basis, missing source URLs, unknown timestamps, future timestamps and observations older than 48 hours are excluded. Snapshot generation must also be within 48 hours. Catalog availability is not branch stock assurance. The current five supported chains are explicit in `optimizer.js`.

Loose produce sold per kg is not a package. It must not be relabeled `priceBasis: package`; weighted-purchase quantities need a separate future adapter/UI extension. A generic request currently means one admissible package; displayed package identity makes its weight visible.

## Acceptance run against the actual mirror

| Request | Result |
| --- | --- |
| καρότα | No admissible fresh product; cat food, juice and frozen carrots excluded |
| αγγούρια | ΚΗΠΟΣ ΞΑΝΘΗΣ Αγγουράκια Μίνι Συσκευασμένα 750g |
| Γιαούρτι ΝΟΥΝΟΥ Εκλεκτό | No exact family found; no substitution |
| ΝΟΥΝΟΥ Gouda 200g | Two distinct catalog IDs; explicit choice required (not silently merged) |
| ψωμί τοστ επώνυμο ≥600g | 12 candidates from the verified bread-brand allowlist; private/unknown labels, smaller packs and conflicting weights excluded |

All stores are rejected for price ranking with this old, unverified mirror. This is a successful integrity check, not evidence of working live prices.
