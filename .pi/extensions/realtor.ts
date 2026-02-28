/**
 * Realtor.com Search Extension
 *
 * Provides a `realtor_search` tool that queries Realtor.com's GraphQL API
 * for property listings (sold or for-sale). Supports filtering by location,
 * price, square footage, lot size, bedrooms, and year built.
 */

import { Type, StringEnum } from "@mariozechner/pi-ai";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
  truncateTail,
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
} from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { moduleTag } from "./modules/api.js";

const GRAPHQL_URL = "https://www.realtor.com/frontdoor/graphql";

const USER_AGENT =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": USER_AGENT,
  "Content-Type": "application/json",
  "Rdc-Client-Name": "RDC_WEB_SRP_FS_PAGE",
  "Rdc-Client-Version": "3.x.x",
  Origin: "https://www.realtor.com",
};

const GRAPHQL_QUERY = `query ConsumerSearchQuery($query: HomeSearchCriteria!, $limit: Int, $offset: Int, $search_promotion: SearchPromotionInput, $sort: [SearchAPISort], $sort_type: SearchSortType, $client_data: JSON, $bucket: SearchAPIBucket, $mortgage_params: MortgageParamsInput, $photosLimit: Int) {
  home_search: home_search(
    query: $query
    sort: $sort
    limit: $limit
    offset: $offset
    sort_type: $sort_type
    client_data: $client_data
    bucket: $bucket
    search_promotion: $search_promotion
    mortgage_params: $mortgage_params
  ) {
    count
    total
    properties: results {
      property_id
      list_price
      status
      permalink
      price_reduced_amount
      list_date
      last_status_change_date
      description {
        beds
        baths_consolidated
        sqft
        lot_sqft
        sold_price
        sold_date
        year_built
        type
        garage
      }
      location {
        address {
          line
          postal_code
          state
          state_code
          city
          coordinate {
            lat
            lon
          }
        }
        county {
          name
          fips_code
        }
      }
      photos(limit: $photosLimit, https: true) {
        href
      }
      flags {
        is_coming_soon
        is_new_listing(days: 14)
        is_price_reduced(days: 30)
        is_foreclosure
        is_new_construction
        is_pending
        is_contingent
      }
    }
  }
}`;

interface Property {
  property_id: string;
  list_price: number | null;
  status: string;
  permalink: string;
  price_reduced_amount: number | null;
  list_date: string | null;
  last_status_change_date: string | null;
  description: {
    beds: number | null;
    baths_consolidated: string | null;
    sqft: number | null;
    lot_sqft: number | null;
    sold_price: number | null;
    sold_date: string | null;
    year_built: number | null;
    type: string | null;
    garage: number | null;
  } | null;
  location: {
    address: {
      line: string | null;
      postal_code: string | null;
      state: string | null;
      state_code: string | null;
      city: string | null;
      coordinate: { lat: number; lon: number } | null;
    } | null;
    county: { name: string | null; fips_code: string | null } | null;
  } | null;
  photos: { href: string }[] | null;
  flags: Record<string, boolean | null> | null;
}

function formatProperty(p: Property): string {
  const desc = p.description;
  const addr = p.location?.address;
  const lines: string[] = [];

  const addressLine = [
    addr?.line,
    addr?.city,
    addr?.state_code,
    addr?.postal_code,
  ]
    .filter(Boolean)
    .join(", ");

  lines.push(`📍 ${addressLine || "Unknown address"}`);

  if (p.status === "sold" && desc?.sold_price != null) {
    lines.push(`   💰 Sold: $${desc.sold_price.toLocaleString()}${desc.sold_date ? ` on ${desc.sold_date}` : ""}`);
    if (p.list_price != null) {
      lines.push(`   📋 Listed: $${p.list_price.toLocaleString()}`);
    }
  } else if (p.list_price != null) {
    lines.push(`   💰 List Price: $${p.list_price.toLocaleString()}`);
    if (p.price_reduced_amount) {
      lines.push(`   📉 Reduced: $${p.price_reduced_amount.toLocaleString()}`);
    }
  }

  const details: string[] = [];
  if (desc?.beds != null) details.push(`${desc.beds} bed`);
  if (desc?.baths_consolidated) details.push(`${desc.baths_consolidated} bath`);
  if (desc?.sqft != null) details.push(`${desc.sqft.toLocaleString()} sqft`);
  if (desc?.lot_sqft != null)
    details.push(`lot: ${desc.lot_sqft.toLocaleString()} sqft`);
  if (desc?.year_built != null) details.push(`built: ${desc.year_built}`);
  if (desc?.type) details.push(desc.type);
  if (desc?.garage != null) details.push(`${desc.garage} garage`);

  if (details.length > 0) {
    lines.push(`   🏠 ${details.join(" · ")}`);
  }

  if (p.location?.county?.name) {
    lines.push(`   📌 County: ${p.location.county.name}`);
  }

  const price =
    p.status === "sold" ? desc?.sold_price : p.list_price;
  if (price != null && desc?.sqft != null && desc.sqft > 0) {
    lines.push(
      `   📊 $/sqft: $${Math.round(price / desc.sqft).toLocaleString()}`,
    );
  }

  lines.push(
    `   🔗 https://www.realtor.com/realestateandhomes-detail/${p.permalink}`,
  );

  return lines.join("\n");
}

export default function (pi: ExtensionAPI) {
  pi.registerTool(moduleTag(pi, "real-estate", {
    name: "realtor_search",
    label: "Realtor Search",
    description:
      "Search Realtor.com for property listings. Can search sold or for-sale properties by location, price range, square footage, lot size, bedrooms, and max year built. Provide location using postal_code, city+state_code, or address fields. When only a postal_code is given, results are scoped to that exact zip code boundary. Use radius only when you want to expand beyond the boundary.",
    parameters: Type.Object({
      postal_code: Type.Optional(
        Type.String({
          description:
            'Zip code to search in (e.g. "37204"). When provided alone, searches within the exact zip code boundary.',
        }),
      ),
      city: Type.Optional(
        Type.String({
          description:
            'City name (e.g. "Nashville"). Should be paired with state_code.',
        }),
      ),
      state_code: Type.Optional(
        Type.String({
          description:
            'Two-letter state code (e.g. "TN"). Should be paired with city.',
        }),
      ),
      address: Type.Optional(
        Type.String({
          description:
            'Street address for a specific location search (e.g. "123 Main St, Nashville, TN 37204").',
        }),
      ),
      status: Type.Optional(
        StringEnum(["for_sale", "sold"] as const, {
          description: 'Listing status. Default: "for_sale"',
        }),
      ),
      property_type: Type.Optional(
        Type.Array(
          StringEnum([
            "single_family",
            "condos",
            "townhomes",
            "multi_family",
            "mobile",
            "farm",
            "land",
          ] as const),
          {
            description:
              'Property type(s) to filter by. Values: "single_family" (House), "condos" (Condo), "townhomes" (Townhouse), "multi_family" (Multi-Family), "mobile" (Mobile), "farm" (Farm), "land" (Land). Can specify multiple.',
          },
        ),
      ),
      min_price: Type.Optional(
        Type.Number({ description: "Minimum price in dollars" }),
      ),
      max_price: Type.Optional(
        Type.Number({ description: "Maximum price in dollars" }),
      ),
      min_sqft: Type.Optional(
        Type.Number({ description: "Minimum square footage" }),
      ),
      max_sqft: Type.Optional(
        Type.Number({ description: "Maximum square footage" }),
      ),
      min_lot_sqft: Type.Optional(
        Type.Number({ description: "Minimum lot size in square feet" }),
      ),
      max_lot_sqft: Type.Optional(
        Type.Number({ description: "Maximum lot size in square feet" }),
      ),
      min_beds: Type.Optional(
        Type.Number({ description: "Minimum number of bedrooms" }),
      ),
      max_beds: Type.Optional(
        Type.Number({ description: "Maximum number of bedrooms" }),
      ),
      max_year_built: Type.Optional(
        Type.Number({
          description:
            "Maximum year built (e.g. 2017 to exclude homes built after 2017)",
        }),
      ),
      min_year_built: Type.Optional(
        Type.Number({
          description:
            "Minimum year built (e.g. 1950 to exclude homes built before 1950)",
        }),
      ),
      sold_within_months: Type.Optional(
        Type.Number({
          description:
            "Only for sold listings: limit to homes sold within this many months. Default: 6",
        }),
      ),
      radius: Type.Optional(
        Type.Number({
          description:
            "Search radius in miles to expand beyond the location boundary. Only use when the user explicitly asks to search a wider area. Not set by default — omitting it keeps results within the exact zip code or city boundary.",
        }),
      ),
      limit: Type.Optional(
        Type.Number({
          description:
            "Max number of results to return (1-200). Default: 25",
        }),
      ),
      offset: Type.Optional(
        Type.Number({ description: "Pagination offset. Default: 0" }),
      ),
    }),

    renderCall(args, theme) {
      const params = args as Record<string, unknown>;
      const loc =
        (params.address as string) ||
        [params.city, params.state_code, params.postal_code]
          .filter(Boolean)
          .join(", ") ||
        "?";
      const status = (params.status as string) || "for_sale";
      return new Text(
        theme.fg("toolTitle", theme.bold("realtor_search ")) +
          theme.fg("muted", `${status} in ${loc}`),
        0,
        0,
      );
    },

    renderResult(result, { expanded, isPartial }, theme) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Searching…"), 0, 0);
      }
      const details = result.details as
        | { total?: number; count?: number }
        | undefined;
      const total = details?.total ?? 0;
      const count = details?.count ?? 0;
      const summary = `✓ Found ${total} properties (showing ${count})`;
      return new Text(theme.fg("success", summary), 0, 0);
    },

    async execute(_toolCallId, params, signal, onUpdate, _ctx) {
      const {
        postal_code,
        city,
        state_code,
        address,
        status = "for_sale",
        property_type,
        min_price,
        max_price,
        min_sqft,
        max_sqft,
        min_lot_sqft,
        max_lot_sqft,
        min_beds,
        max_beds,
        max_year_built,
        min_year_built,
        sold_within_months = 6,
        radius,
        limit: resultLimit = 25,
        offset = 0,
      } = params as {
        postal_code?: string;
        city?: string;
        state_code?: string;
        address?: string;
        status?: "for_sale" | "sold";
        property_type?: string[];
        min_price?: number;
        max_price?: number;
        min_sqft?: number;
        max_sqft?: number;
        min_lot_sqft?: number;
        max_lot_sqft?: number;
        min_beds?: number;
        max_beds?: number;
        max_year_built?: number;
        min_year_built?: number;
        sold_within_months?: number;
        radius?: number;
        limit?: number;
        offset?: number;
      };

      if (signal?.aborted) {
        return { content: [{ type: "text", text: "Cancelled" }] };
      }

      // Build location string from structured parameters
      let location: string;
      if (address) {
        location = address;
      } else if (postal_code && city && state_code) {
        location = `${city}, ${state_code} ${postal_code}`;
      } else if (postal_code) {
        location = postal_code;
      } else if (city && state_code) {
        location = `${city}, ${state_code}`;
      } else {
        return {
          content: [
            {
              type: "text",
              text: "Error: Please provide a location. Use postal_code, city + state_code, or address.",
            },
          ],
        };
      }

      onUpdate?.({
        content: [
          {
            type: "text",
            text: `Searching Realtor.com for ${status} properties in "${location}"…`,
          },
        ],
      });

      // Build query object
      const searchLocation: Record<string, unknown> = { location };
      // Only add buffer (radius) when explicitly requested — omitting it
      // keeps results within the exact zip code or city boundary
      if (radius != null) {
        searchLocation.buffer = radius;
      }

      const query: Record<string, unknown> = {
        primary: true,
        status: [status],
        search_location: searchLocation,
      };

      // Property type filter
      if (property_type && property_type.length > 0) {
        query.type = property_type;
      }

      // Sold date filter
      if (status === "sold") {
        query.sold_date = { min: `$now-${sold_within_months}M` };
      }

      // Price filter
      if (min_price != null || max_price != null) {
        const priceFilter: Record<string, number> = {};
        if (min_price != null) priceFilter.min = min_price;
        if (max_price != null) priceFilter.max = max_price;
        // Use list_price for for_sale, sold_price for sold
        if (status === "sold") {
          query.sold_price = priceFilter;
        } else {
          query.list_price = priceFilter;
        }
      }

      // Sqft filter
      if (min_sqft != null || max_sqft != null) {
        const sqftFilter: Record<string, number> = {};
        if (min_sqft != null) sqftFilter.min = min_sqft;
        if (max_sqft != null) sqftFilter.max = max_sqft;
        query.sqft = sqftFilter;
      }

      // Lot size filter
      if (min_lot_sqft != null || max_lot_sqft != null) {
        const lotFilter: Record<string, number> = {};
        if (min_lot_sqft != null) lotFilter.min = min_lot_sqft;
        if (max_lot_sqft != null) lotFilter.max = max_lot_sqft;
        query.lot_sqft = lotFilter;
      }

      // Beds filter
      if (min_beds != null || max_beds != null) {
        const bedsFilter: Record<string, number> = {};
        if (min_beds != null) bedsFilter.min = min_beds;
        if (max_beds != null) bedsFilter.max = max_beds;
        query.beds = bedsFilter;
      }

      // Year built filter
      if (min_year_built != null || max_year_built != null) {
        const yearFilter: Record<string, number> = {};
        if (min_year_built != null) yearFilter.min = min_year_built;
        if (max_year_built != null) yearFilter.max = max_year_built;
        query.year_built = yearFilter;
      }

      const clampedLimit = Math.max(1, Math.min(200, resultLimit));

      const payload = {
        operationName: "ConsumerSearchQuery",
        variables: {
          photosLimit: 1,
          query,
          client_data: { device_data: { device_type: "desktop" } },
          limit: clampedLimit,
          offset,
          bucket: { sort: "fractal_v6.2.2" },
        },
        query: GRAPHQL_QUERY,
      };

      try {
        const response = await fetch(GRAPHQL_URL, {
          method: "POST",
          headers: HEADERS,
          body: JSON.stringify(payload),
          signal: signal ?? undefined,
        });

        if (!response.ok) {
          const body = await response.text().catch(() => "");
          return {
            content: [
              {
                type: "text",
                text: `Error: HTTP ${response.status} ${response.statusText}\n${body}`,
              },
            ],
          };
        }

        const data = await response.json();

        if (data.errors) {
          return {
            content: [
              {
                type: "text",
                text: `GraphQL errors:\n${JSON.stringify(data.errors, null, 2)}`,
              },
            ],
          };
        }

        const homeSearch = data?.data?.home_search;
        if (!homeSearch) {
          return {
            content: [
              {
                type: "text",
                text: "No results returned from Realtor.com API.",
              },
            ],
          };
        }

        const total: number = homeSearch.total ?? 0;
        const properties: Property[] = homeSearch.properties ?? [];
        const count = properties.length;

        if (count === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No properties found matching your criteria near "${location}". Try broadening your search (larger radius, wider price range, etc.)`,
              },
            ],
            details: { total: 0, count: 0, properties: [] },
          };
        }

        // Format results
        const header = `Found ${total} ${status === "sold" ? "sold" : "for-sale"} properties near "${location}" (showing ${count}, offset ${offset}):\n`;

        const formattedProperties = properties.map((p, i) => {
          return `${i + 1 + offset}. ${formatProperty(p)}`;
        });

        const output = header + "\n" + formattedProperties.join("\n\n");

        // Truncate if needed
        const truncation = truncateTail(output, {
          maxLines: DEFAULT_MAX_LINES,
          maxBytes: DEFAULT_MAX_BYTES,
        });

        let resultText = truncation.content;
        if (truncation.truncated) {
          resultText += `\n\n[Truncated: showing ${truncation.outputLines}/${truncation.totalLines} lines. Use offset parameter to paginate.]`;
        }

        if (total > count + offset) {
          resultText += `\n\n[More results available: use offset=${offset + count} to see the next page]`;
        }

        return {
          content: [{ type: "text", text: resultText }],
          details: {
            total,
            count,
            properties: properties.map((p) => ({
              address:
                [
                  p.location?.address?.line,
                  p.location?.address?.city,
                  p.location?.address?.state_code,
                ]
                  .filter(Boolean)
                  .join(", ") || "Unknown",
              price:
                p.status === "sold"
                  ? p.description?.sold_price
                  : p.list_price,
              beds: p.description?.beds,
              sqft: p.description?.sqft,
              year_built: p.description?.year_built,
              permalink: p.permalink,
            })),
          },
        };
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return { content: [{ type: "text", text: "Search cancelled." }] };
        }
        const message =
          err instanceof Error ? err.message : "Unknown error occurred";
        return {
          content: [
            { type: "text", text: `Error searching Realtor.com: ${message}` },
          ],
        };
      }
    },
  }));
}
