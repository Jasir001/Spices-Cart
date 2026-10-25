# Market prices

The public page is available at `/market-prices`. It deliberately starts with no
price observations: the current workspace contains a React/Vite frontend only,
not a protected API, database, or approved live-data provider.

## CSV preview

The CSV upload is a local browser preview. It does not publish, persist, or
independently verify the imported values. Review the source URL and its access
terms before importing. Rows are labeled as source-unverified, and observations
older than 72 hours are labeled stale.

Download [`public/market-prices-template.csv`](../public/market-prices-template.csv)
for wholesale/auction listings, or use the page's CSV template button. The
retail preview also ships with a matching
[`public/retail-prices-template.csv`](../public/retail-prices-template.csv)
file for branded pack-price imports. Required columns:

`spice,market,state,variety,grade,priceType,priceMeasure,minPrice,maxPrice,pricePerKg,sourceName,sourceUrl,observedAt,fetchedAt`

Use `wholesale`, `auction`, or `indicative` for `priceType`; use `average`,
`modal`, or `reported` for `priceMeasure`; prices are INR/kg.
Dates must be ISO-compatible, `fetchedAt` must not predate `observedAt`, and a
reported price must fall within the supplied minimum and maximum. The page
converts the same observation to 100 g, 250 g, and 500 g reference amounts; these
are arithmetic conversions, not retail quotes.

## Data sources and limitations

- [Spices Board of India domestic current market prices](https://www.indianspices.com/marketing/price/domestic/current-market-price.html)
- [Spices Board of India daily auction prices](https://www.indianspices.com/marketing/price/domestic/daily-price)
- [Government of India AGMARKNET catalog](https://www.data.gov.in/catalog/current-daily-price-various-commodities-various-markets-mandi)

The pages could not be reached from the development environment during this
implementation, and public page visibility does not establish API permission.
No scraping, synchronization schedule, retail feed, or current price is claimed.
Before publishing a shared feed, add a server-side importer/API with access
approval, admin authentication, durable historical snapshots, and audit logs.

Product-card prices remain sample store-listing values and are not derived from
market data. Confirm store prices and MRP with the store owner before accepting
orders. Online checkout is not configured.
