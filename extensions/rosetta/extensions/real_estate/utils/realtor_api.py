from typing import Any, Dict, Optional

import requests

API_URL = "https://www.realtor.com/frontdoor/graphql"
REQUEST_HEADERS = {
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64; rv:137.0) Gecko/20100101 Firefox/137.0",
    "Content-Type": "application/json",
    "Rdc-Client-Name": "RDC_WEB_SRP_FS_PAGE",
    "Rdc-Client-Version": "3.x.x",
    "Origin": "https://www.realtor.com",
}
STATE_CODES_BY_NAME = {
    "alabama": "AL",
    "alaska": "AK",
    "arizona": "AZ",
    "arkansas": "AR",
    "california": "CA",
    "colorado": "CO",
    "connecticut": "CT",
    "delaware": "DE",
    "florida": "FL",
    "georgia": "GA",
    "hawaii": "HI",
    "idaho": "ID",
    "illinois": "IL",
    "indiana": "IN",
    "iowa": "IA",
    "kansas": "KS",
    "kentucky": "KY",
    "louisiana": "LA",
    "maine": "ME",
    "maryland": "MD",
    "massachusetts": "MA",
    "michigan": "MI",
    "minnesota": "MN",
    "mississippi": "MS",
    "missouri": "MO",
    "montana": "MT",
    "nebraska": "NE",
    "nevada": "NV",
    "new hampshire": "NH",
    "new jersey": "NJ",
    "new mexico": "NM",
    "new york": "NY",
    "north carolina": "NC",
    "north dakota": "ND",
    "ohio": "OH",
    "oklahoma": "OK",
    "oregon": "OR",
    "pennsylvania": "PA",
    "rhode island": "RI",
    "south carolina": "SC",
    "south dakota": "SD",
    "tennessee": "TN",
    "texas": "TX",
    "utah": "UT",
    "vermont": "VT",
    "virginia": "VA",
    "washington": "WA",
    "west virginia": "WV",
    "wisconsin": "WI",
    "wyoming": "WY",
    "district of columbia": "DC",
}
FOR_SALE_QUERY = """query ConsumerSearchQuery($query: HomeSearchCriteria!, $limit: Int, $offset: Int, $sort_type: SearchSortType) {\n  home_search: home_search(\n    query: $query\n    limit: $limit\n    offset: $offset\n    sort_type: $sort_type\n  ) {\n    count\n    total\n    properties: results {\n      property_id\n      href\n      list_price\n      listing_id\n      status\n      price_reduced_amount\n      list_date\n      description {\n        beds\n        baths_consolidated\n        sqft\n        lot_sqft\n        type\n        sold_price\n        sold_date\n        year_built\n        garage\n        __typename\n      }\n      location {\n        address {\n          line\n          postal_code\n          state\n          state_code\n          city\n          coordinate {\n            lat\n            lon\n            __typename\n          }\n          __typename\n        }\n        county {\n          name\n          __typename\n        }\n        __typename\n      }\n      branding {\n        name\n        __typename\n      }\n      advertisers {\n        name\n        email\n        office {\n          name\n          __typename\n        }\n        phones {\n          number\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}"""
SOLD_QUERY = """query ConsumerSearchQuery($query: HomeSearchCriteria!, $limit: Int, $offset: Int, $sort_type: SearchSortType) {\n  home_search: home_search(\n    query: $query\n    limit: $limit\n    offset: $offset\n    sort_type: $sort_type\n  ) {\n    count\n    total\n    properties: results {\n      property_id\n      href\n      list_price\n      listing_id\n      status\n      price_reduced_amount\n      list_date\n      description {\n        beds\n        baths_consolidated\n        sqft\n        lot_sqft\n        type\n        sold_price\n        sold_date\n        year_built\n        garage\n        __typename\n      }\n      location {\n        address {\n          line\n          postal_code\n          state\n          state_code\n          city\n          coordinate {\n            lat\n            lon\n            __typename\n          }\n          __typename\n        }\n        county {\n          name\n          __typename\n        }\n        __typename\n      }\n      branding {\n        name\n        __typename\n      }\n      advertisers {\n        name\n        email\n        office {\n          name\n          __typename\n        }\n        phones {\n          number\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}"""


def query_realtor_api(address: str, city: str, state: str, zipcode: str, mode: str) -> Dict[str, Any]:
    payload = build_graphql_payload(address, city, state, zipcode, mode)
    try:
        response = requests.post(API_URL, headers=REQUEST_HEADERS, json=payload, timeout=30)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as error:
        raise RealtorApiError(format_request_error(error)) from error
    except ValueError as error:
        raise RealtorApiError(f"Invalid JSON response: {error}") from error


def format_request_error(error: requests.RequestException) -> str:
    details = [error.__class__.__name__]
    error_message = str(error).strip()
    if error_message:
        details.append(error_message)

    response = error.response
    if response is not None:
        details.extend(format_response_details(response))

    return "; ".join(details)


def format_response_details(response: requests.Response) -> list[str]:
    details = [f"status={response.status_code}"]
    reason = response.reason.strip() if response.reason else ""
    if reason:
        details.append(f"reason={reason}")

    body_snippet = response.text.strip()[:500]
    if body_snippet:
        details.append(f"body={body_snippet}")

    return details


def build_graphql_payload(address: str, city: str, state: str, zipcode: str, mode: str) -> Dict[str, Any]:
    query = build_property_query(address, city, state, zipcode, mode)
    variables = {
        "query": query,
        "limit": 1,
        "offset": 0,
        "sort_type": "relevant",
    }

    if mode == "sold":
        graphql_query = SOLD_QUERY
    else:
        graphql_query = FOR_SALE_QUERY

    return {
        "operationName": "ConsumerSearchQuery",
        "variables": variables,
        "query": graphql_query,
    }


def build_property_query(address: str, city: str, state: str, zipcode: str, mode: str) -> Dict[str, Any]:
    state_code = normalize_state_code(state)
    full_address = f"{address}, {city}, {state_code} {zipcode}"
    return {
        "primary": True,
        "status": [mode],
        "search_location": {
            "location": full_address,
            "buffer": 1,
        },
        "address": address,
        "city": city,
        "state_code": state_code,
        "postal_code": zipcode,
    }


def normalize_state_code(state: str) -> str:
    stripped_state = state.strip()
    if len(stripped_state) == 2:
        return stripped_state.upper()

    return STATE_CODES_BY_NAME.get(stripped_state.lower(), stripped_state.upper())


def extract_first_property_summary(response_json: Dict[str, Any]) -> Dict[str, Any]:
    properties = get_properties(response_json)
    if not properties:
        raise NoPropertyFoundError()

    property_data = properties[0]
    return summarize_property(property_data)


def get_properties(response_json: Dict[str, Any]) -> Any:
    if not isinstance(response_json, dict):
        raise MalformedApiResponseError()

    data = response_json.get("data")
    if not isinstance(data, dict):
        raise MalformedApiResponseError()

    home_search = data.get("home_search")
    if not isinstance(home_search, dict):
        raise MalformedApiResponseError()

    properties = home_search.get("properties")
    if not isinstance(properties, list):
        raise MalformedApiResponseError()

    return properties


def summarize_property(property_data: Dict[str, Any]) -> Dict[str, Any]:
    description = property_data.get("description") or {}
    location = property_data.get("location") or {}
    address = location.get("address") or {}
    county = location.get("county") or {}
    coordinate = extract_coordinate(location)
    branding = property_data.get("branding") or {}
    advertisers = property_data.get("advertisers") or []
    primary_advertiser = advertisers[0] if advertisers else {}
    office = primary_advertiser.get("office") or {}
    phones = primary_advertiser.get("phones") or []
    primary_phone = phones[0] if phones else {}

    return {
        "property_id": property_data.get("property_id"),
        "href": property_data.get("href"),
        "list_price": property_data.get("list_price"),
        "listing_id": property_data.get("listing_id"),
        "status": property_data.get("status"),
        "price_reduced_amount": property_data.get("price_reduced_amount"),
        "list_date": property_data.get("list_date"),
        "beds": description.get("beds"),
        "baths": description.get("baths_consolidated"),
        "sqft": description.get("sqft"),
        "lot_sqft": description.get("lot_sqft"),
        "property_type": description.get("type"),
        "sold_price": description.get("sold_price"),
        "sold_date": description.get("sold_date"),
        "year_built": description.get("year_built"),
        "garage": description.get("garage"),
        "address": address.get("line"),
        "postal_code": address.get("postal_code"),
        "state": address.get("state"),
        "state_code": address.get("state_code"),
        "city": address.get("city"),
        "county": county.get("name"),
        "latitude": coordinate.get("latitude"),
        "longitude": coordinate.get("longitude"),
        "branding_name": get_branding_name(branding),
        "agent_name": primary_advertiser.get("name"),
        "agent_email": primary_advertiser.get("email"),
        "office_name": office.get("name"),
        "agent_phone": primary_phone.get("number"),
    }


def extract_coordinate(location: Dict[str, Any]) -> Dict[str, Any]:
    address = location.get("address") or {}
    if not isinstance(address, dict):
        address = {}

    coordinate = (
        address.get("coordinate")
        or address.get("coordinates")
        or location.get("coordinate")
        or location.get("coordinates")
        or {}
    )
    if not isinstance(coordinate, dict):
        coordinate = {}

    return {
        "latitude": get_first_present_value(coordinate, ["lat", "latitude"]),
        "longitude": get_first_present_value(coordinate, ["lon", "lng", "longitude"]),
    }


def get_first_present_value(values: Dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        value = values.get(key)
        if value is not None:
            return value

    return None


def get_branding_name(branding: Any) -> Optional[str]:
    if isinstance(branding, list):
        if not branding:
            return None
        first_branding = branding[0] or {}
        return first_branding.get("name")

    if isinstance(branding, dict):
        return branding.get("name")

    return None


class RealtorApiError(Exception):
    pass


class NoPropertyFoundError(Exception):
    pass


class MalformedApiResponseError(Exception):
    pass
