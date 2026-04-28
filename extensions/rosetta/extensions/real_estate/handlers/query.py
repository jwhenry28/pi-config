from typing import Any, Dict, Optional

from utils.parsing import JsonInputError, parse_json_input, print_error, print_realtor_query_result
from utils.realtor_api import (
    MalformedApiResponseError,
    NoPropertyFoundError,
    RealtorApiError,
    extract_first_property_summary,
    query_realtor_api,
)

VALID_MODES = {"for_sale", "sold"}


def handle_query_command(raw_input: str) -> None:
    tool_input = parse_json_input(raw_input)
    if isinstance(tool_input, JsonInputError):
        print_error(tool_input.message)
        return

    validation_error = validate_query_input(tool_input)
    if validation_error is not None:
        print_error(validation_error)
        return

    address = tool_input["address"].strip()
    city = tool_input["city"].strip()
    state = tool_input["state"].strip()
    zipcode = tool_input["zipcode"].strip()
    mode = tool_input.get("mode", "for_sale")
    try:
        response_json = query_realtor_api(address, city, state, zipcode, mode)
        property_summary = extract_first_property_summary(response_json)
    except RealtorApiError as error:
        error_detail = str(error).strip()
        message = f"Failed to query realtor.com API: {error_detail}" if error_detail else "Failed to query realtor.com API"
        print_error(message)
        return
    except MalformedApiResponseError:
        print_error("Malformed API response from realtor.com")
        return
    except NoPropertyFoundError:
        print_error("No property found for the provided address")
        return

    print_realtor_query_result(property_summary)


def validate_query_input(tool_input: Dict[str, Any]) -> Optional[str]:
    for field_name in ("address", "city", "state", "zipcode"):
        value = tool_input.get(field_name)
        if not isinstance(value, str) or not value.strip():
            return f"{field_name} is required"

    mode = tool_input.get("mode")
    if mode is not None and mode not in VALID_MODES:
        return "mode must be one of: for_sale, sold"

    return None
