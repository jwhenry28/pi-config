---
name: querying-realtor-dot-com
description: Use when querying realtor.com for property data, searching sold or for-sale listings, building real estate comparables, or pulling housing market data - provides the GraphQL API endpoint, required headers, query structure, filters, and response parsing
module: none
---

# Querying Realtor.com's GraphQL API

## Overview

Realtor.com exposes an undocumented GraphQL API at `https://www.realtor.com/frontdoor/graphql` used by their search pages. You can query it directly with POST requests — no API key needed, just the right headers and query shape.

## Endpoint & Headers

```
POST https://www.realtor.com/frontdoor/graphql
```

**Required headers:**

| Header               | Value                        |
| -------------------- | ---------------------------- |
| `User-Agent`         | A standard browser UA string |
| `Content-Type`       | `application/json`           |
| `Rdc-Client-Name`    | `RDC_WEB_SRP_FS_PAGE`        |
| `Rdc-Client-Version` | `3.x.x`                      |
| `Origin`             | `https://www.realtor.com`    |

The `Rdc-Client-Name` and `Rdc-Client-Version` headers are critical — requests fail without them.

## Query Structure

The payload is a standard GraphQL POST body with `operationName`, `variables`, and `query` fields.

**Operation:** `ConsumerSearchQuery`

### Variables

```json
{
  "photosLimit": 3,
  "query": {
    /* search criteria — see below */
  },
  "client_data": { "device_data": { "device_type": "desktop" } },
  "limit": 42,
  "offset": 0,
  "sort_type": "relevant",
  "bucket": { "sort": "fractal_v6.2.2" }
}
```

- `limit` / `offset`: Pagination. Max ~200 per request.
- `sort_type`: `"relevant"` (default), or others like `"sold_date"`.

### Search Criteria (`query` object)

```json
{
  "primary": true,
  "status": ["sold"],
  "search_location": {
    "location": "Rainbow Pl, Nashville, TN",
    "buffer": 1
  },
  "sold_date": { "min": "$now-6M" }
}
```

**Key fields:**

| Field                      | Type           | Description                                     |
| -------------------------- | -------------- | ----------------------------------------------- |
| `status`                   | `string[]`     | `["sold"]`, `["for_sale"]`, `["pending"]`, etc. |
| `search_location.location` | `string`       | Free-text location (street, city+state, zip)    |
| `search_location.buffer`   | `number`       | Radius in miles around the location             |
| `sold_date.min`            | `string`       | Relative date like `$now-6M` (6 months ago)     |
| `beds`                     | `{min?, max?}` | Bedroom filter                                  |
| `baths`                    | `{min?, max?}` | Bathroom filter                                 |
| `sqft`                     | `{min?, max?}` | Square footage filter                           |

All filter fields (`beds`, `baths`, `sqft`) are optional — omit them to skip filtering.

### GraphQL Query String

See [graphql-query.md](graphql-query.md) for the full query string. It requests property details including price, description (beds/baths/sqft/sold_price/sold_date/year_built), location (address/coordinates/county), photos, agents, and flags.

## Response Structure

```
data.home_search.count       — results in this page
data.home_search.total       — total matching results
data.home_search.properties  — array of property objects
```

### Key Property Fields

```
property_id, list_price, status, permalink
description.{beds, baths_consolidated, sqft, lot_sqft, sold_price, sold_date, year_built, type, garage}
location.address.{line, city, state_code, postal_code, coordinate.{lat, lon}}
location.county.{name, fips_code}
photos[].href
advertisers[].{name, email, office.name, phones[].number}
```

Build a full listing URL: `https://www.realtor.com/realestateandhomes-detail/{permalink}`

## Quick Example (Python)

```python
import requests

url = "https://www.realtor.com/frontdoor/graphql"
headers = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
    "Content-Type": "application/json",
    "Rdc-Client-Name": "RDC_WEB_SRP_FS_PAGE",
    "Rdc-Client-Version": "3.x.x",
    "Origin": "https://www.realtor.com",
}

payload = {
    "operationName": "ConsumerSearchQuery",
    "variables": {
        "photosLimit": 3,
        "query": {
            "primary": True,
            "status": ["sold"],
            "search_location": {"location": "Nashville, TN", "buffer": 1},
            "sold_date": {"min": "$now-6M"},
            "beds": {"min": 3},
            "sqft": {"min": 1500},
        },
        "client_data": {"device_data": {"device_type": "desktop"}},
        "limit": 42,
        "offset": 0,
        "sort_type": "relevant",
        "bucket": {"sort": "fractal_v6.2.2"},
    },
    "query": open("graphql-query.md").read(),  # or inline the query string
}

resp = requests.post(url, headers=headers, json=payload, timeout=30)
data = resp.json()
props = data["data"]["home_search"]["properties"]
for p in props:
    addr = p["location"]["address"]["line"]
    price = p["description"]["sold_price"]
    print(f"{addr}: ${price:,}")
```

## Useful Derived Fields

When processing results:

- **Price per sqft**: `sold_price / sqft`
- **Price reduction**: `list_price - sold_price`
- **Search URL**: Compose with `https://www.realtor.com/realestateandhomes-search/{City_State}/{Street}/radius-1/soldwithin-{months}`

## Pagination

Use `offset` to page through results. The response's `total` field tells you how many results exist. Increment `offset` by `limit` each request until you've fetched `total` results.

## Common Mistakes

| Mistake                               | Fix                                                            |
| ------------------------------------- | -------------------------------------------------------------- |
| Missing `Rdc-Client-Name` header      | Always include it — requests return errors without it          |
| Using `price` instead of `sold_price` | `list_price` is asking price; `sold_price` is in `description` |
| Forgetting `"primary": true` in query | Required field; omitting it may return unexpected results      |
| Not handling `None`/missing fields    | Many fields are nullable — always use `.get()` or equivalent   |
| Setting `buffer` too high             | Keep to 1-5 miles; large buffers return too many results       |
