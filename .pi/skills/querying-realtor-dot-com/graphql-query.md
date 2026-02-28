# ConsumerSearchQuery — Full GraphQL Query String

Use this as the `"query"` field in the POST payload.

```graphql
query ConsumerSearchQuery($query: HomeSearchCriteria!, $limit: Int, $offset: Int, $search_promotion: SearchPromotionInput, $sort: [SearchAPISort], $sort_type: SearchSortType, $client_data: JSON, $bucket: SearchAPIBucket, $mortgage_params: MortgageParamsInput, $photosLimit: Int) {
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
    search_promotion {
      names
      slots
      promoted_properties {
        id
        from_other_page
        __typename
      }
      __typename
    }
    mortgage_params {
      interest_rate
      __typename
    }
    properties: results {
      property_id
      list_price
      rmn_listing_attribution
      search_promotions {
        name
        asset_id
        __typename
      }
      primary_photo(https: true) {
        href
        __typename
      }
      listing_id
      matterport
      virtual_tours {
        href
        type
        __typename
      }
      status
      products {
        products
        brand_name
        __typename
      }
      source {
        id
        name
        type
        spec_id
        plan_id
        agents {
          office_name
          __typename
        }
        listing_id
        __typename
      }
      lead_attributes {
        show_contact_an_agent
        market_type
        opcity_lead_attributes {
          cashback_enabled
          flip_the_market_enabled
          __typename
        }
        lead_type
        ready_connect_mortgage {
          show_contact_a_lender
          show_veterans_united
          __typename
        }
        __typename
      }
      community {
        description {
          name
          __typename
        }
        property_id
        permalink
        advertisers {
          office {
            hours
            phones {
              type
              number
              primary
              trackable
              __typename
            }
            __typename
          }
          __typename
        }
        promotions {
          description
          href
          headline
          __typename
        }
        __typename
      }
      permalink
      price_reduced_amount
      description {
        name
        beds
        baths_consolidated
        sqft
        lot_sqft
        baths_max
        baths_min
        beds_min
        beds_max
        sqft_min
        sqft_max
        type
        sub_type
        sold_price
        sold_date
        year_built
        garage
        __typename
      }
      location {
        street_view_url
        address {
          line
          postal_code
          state
          state_code
          city
          coordinate {
            lat
            lon
            __typename
          }
          __typename
        }
        county {
          name
          fips_code
          __typename
        }
        __typename
      }
      open_houses {
        start_date
        end_date
        __typename
      }
      branding {
        type
        name
        photo
        __typename
      }
      flags {
        is_coming_soon
        is_new_listing(days: 14)
        is_price_reduced(days: 30)
        is_foreclosure
        is_new_construction
        is_pending
        is_contingent
        __typename
      }
      list_date
      photos(limit: $photosLimit, https: true) {
        href
        __typename
      }
      advertisers {
        type
        fulfillment_id
        name
        builder {
          name
          href
          logo
          fulfillment_id
          __typename
        }
        email
        office {
          name
          __typename
        }
        phones {
          number
          __typename
        }
        __typename
      }
      consumer_advertisers {
        type
        agent_id
        name
        __typename
      }
      last_status_change_date
      last_price_change_amount
      __typename
    }
    __typename
  }
  commute_polygon: get_commute_polygon(query: $query) {
    areas {
      id
      breakpoints {
        width
        height
        zoom
        __typename
      }
      radius
      center {
        lat
        lng
        __typename
      }
      __typename
    }
    boundary
    __typename
  }
}
```
