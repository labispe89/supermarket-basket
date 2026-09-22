# Supermarket Basket

## Book arbitrage scanner

The independent Greek book scanner is available at [`books/`](./books/). See
[setup, source limitations, feed contract and deployment](./books/README.md).
It supports manual observations, ISBN matching, adjustable BUY/WATCH thresholds
and an optional authorized-feed backend. No live price feeds are preconfigured.

Mobile-first PWA prototype for comparing one complete shopping basket across supermarkets.

Version 6 adds strict intent/brand/size matching, full-basket-only optimization,
per-item diagnostics, variant selection, editable quantities, multiline input,
safe text rendering, source freshness checks and an offline app shell.

Run `npm test` (Node 20+) and `npm start` to preview at http://127.0.0.1:4173.
There are no runtime dependencies or build steps. GitHub Pages can serve the repository root.
The Tests workflow runs on pushes and pull requests; it does not change the existing Pages configuration.

**Live price integration is not complete.** The former mirror is stale and has no
per-offer observation timestamps. It is now diagnostics-only, never a fallback
price winner. See [source audit and provider contract](docs/DATA-SOURCES.md).
Authorized JSON providers can be added without changing the matcher or optimizer.

`node scripts/audit-catalog.js /path/to/catalog-runtime.json` reproduces the five
requested searches against a separately downloaded real catalog. Unit tests use
explicit synthetic fixtures, never production prices.

Brand requests keep their exact brand and all requested words. Multiple product
IDs require a selection. Generic requests choose the lowest package cost among
all admissible products; no lexical top-N truncation is used. Fresh produce needs
positive category evidence and a conservative plain-produce name. Unknown names
fail closed. Branded toast uses an explicit verified-brand allowlist or provider
metadata; unknown brands do not count as verified national brands. This rule-based
matcher intentionally favors a visible unmatched result over an unsafe substitution.

The app-shell cache is versioned, network-first, and excludes feed configuration
and price responses. Increment `CACHE` in `sw.js` for subsequent shell releases.
