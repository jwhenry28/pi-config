import json
from typing import Any, Dict, Optional

from utils.compsheet import (
    CompsheetNotFoundError,
    DuplicatePropertyError,
    InvalidCompsheetHeaderError,
    InvalidCompsheetNameError,
    PropertyNotFoundInCompsheetError,
    append_property_summary,
    build_compsheet_path,
    create_compsheet_csv,
    delete_compsheet_directory,
    list_compsheet_names,
    normalize_compsheet_name,
    read_compsheet_rows,
    remove_property_rows,
)
from utils.parsing import JsonInputError, parse_json_input, print_compsheet_new_result, print_error
from utils.realtor_api import (
    MalformedApiResponseError,
    NoPropertyFoundError,
    RealtorApiError,
    extract_first_property_summary,
    query_realtor_api,
)


def handle_compsheet_new_command(raw_input: str) -> None:
    tool_input = parse_json_input(raw_input)
    if isinstance(tool_input, JsonInputError):
        print_error(tool_input.message)
        return

    validation_error = validate_compsheet_new_input(tool_input)
    if validation_error is not None:
        print_error(validation_error)
        return

    normalized_name = normalize_compsheet_name(tool_input["name"])
    if not normalized_name:
        print_error("name is required")
        return

    try:
        compsheet_path = create_compsheet_csv(normalized_name)
    except InvalidCompsheetNameError:
        print_error("Invalid compsheet name")
        return
    except FileExistsError:
        print_error(f"Compsheet already exists: {build_compsheet_path(normalized_name)}")
        return
    except OSError as error:
        print_error(f"Failed to create compsheet: {error}")
        return

    print_compsheet_new_result(normalized_name, str(compsheet_path))


def handle_compsheet_list_command(raw_input: str) -> None:
    tool_input = parse_json_input(raw_input)
    if isinstance(tool_input, JsonInputError):
        print_error(tool_input.message)
        return

    try:
        compsheet_names = list_compsheet_names()
    except OSError as error:
        print_error(f"Failed to list compsheets: {error}")
        return

    print_result({"names": compsheet_names})


def handle_compsheet_add_command(raw_input: str) -> None:
    tool_input = parse_json_input(raw_input)
    if isinstance(tool_input, JsonInputError):
        print_error(tool_input.message)
        return

    validation_error = validate_compsheet_add_input(tool_input)
    if validation_error is not None:
        print_error(validation_error)
        return

    name = tool_input["name"].strip()
    try:
        property_summary = fetch_sold_property_summary(tool_input)
        require_property_id(property_summary)
        append_property_summary(name, property_summary)
    except RealtorApiError:
        print_error("Failed to query realtor.com API")
        return
    except MalformedApiResponseError:
        print_error("Malformed API response from realtor.com")
        return
    except NoPropertyFoundError:
        print_error("No property found for the provided address")
        return
    except MissingPropertyIdError:
        print_error("property_id is required")
        return
    except InvalidCompsheetNameError:
        print_error("Invalid compsheet name")
        return
    except CompsheetNotFoundError as error:
        print_error(f"Compsheet not found: {error.stored_name}")
        return
    except InvalidCompsheetHeaderError as error:
        print_error(f"Compsheet has invalid header: {error.compsheet_path}")
        return
    except DuplicatePropertyError as error:
        print_error(f"Property already exists in compsheet: {error.property_id}")
        return
    except OSError as error:
        print_error(f"Failed to update compsheet: {error}")
        return

    print_result({"name": name, "property": property_summary})


def handle_compsheet_dump_command(raw_input: str) -> None:
    tool_input = parse_json_input(raw_input)
    if isinstance(tool_input, JsonInputError):
        print_error(tool_input.message)
        return

    validation_error = validate_compsheet_dump_input(tool_input)
    if validation_error is not None:
        print_error(validation_error)
        return

    name = tool_input["name"].strip()
    try:
        rows = read_compsheet_rows(name)
    except InvalidCompsheetNameError:
        print_error("Invalid compsheet name")
        return
    except CompsheetNotFoundError as error:
        print_error(f"Compsheet not found: {error.stored_name}")
        return
    except InvalidCompsheetHeaderError as error:
        print_error(f"Compsheet has invalid header: {error.compsheet_path}")
        return
    except OSError as error:
        print_error(f"Failed to read compsheet: {error}")
        return

    properties = rows if tool_input.get("full") is True else summarize_compsheet_rows(rows)
    print_result({"name": name, "properties": properties})


def handle_compsheet_remove_command(raw_input: str) -> None:
    tool_input = parse_json_input(raw_input)
    if isinstance(tool_input, JsonInputError):
        print_error(tool_input.message)
        return

    validation_error = validate_compsheet_remove_input(tool_input)
    if validation_error is not None:
        print_error(validation_error)
        return

    name = tool_input["name"].strip()
    property_id = tool_input["property_id"].strip()
    try:
        removed_count = remove_property_rows(name, property_id)
    except InvalidCompsheetNameError:
        print_error("Invalid compsheet name")
        return
    except CompsheetNotFoundError as error:
        print_error(f"Compsheet not found: {error.stored_name}")
        return
    except InvalidCompsheetHeaderError as error:
        print_error(f"Compsheet has invalid header: {error.compsheet_path}")
        return
    except PropertyNotFoundInCompsheetError as error:
        print_error(f"Property not found in compsheet: {error.property_id}")
        return
    except OSError as error:
        print_error(f"Failed to update compsheet: {error}")
        return

    print_result({"name": name, "property_id": property_id, "removed": removed_count})


def handle_compsheet_delete_command(raw_input: str) -> None:
    tool_input = parse_json_input(raw_input)
    if isinstance(tool_input, JsonInputError):
        print_error(tool_input.message)
        return

    validation_error = validate_compsheet_delete_input(tool_input)
    if validation_error is not None:
        print_error(validation_error)
        return

    name = tool_input["name"].strip()
    try:
        delete_compsheet_directory(name)
    except InvalidCompsheetNameError:
        print_error("Invalid compsheet name")
        return
    except CompsheetNotFoundError as error:
        print_error(f"Compsheet not found: {error.stored_name}")
        return
    except OSError as error:
        print_error(f"Failed to delete compsheet: {error}")
        return

    print_result({"name": name, "deleted": True})


def validate_compsheet_new_input(tool_input: Dict[str, Any]) -> Optional[str]:
    name = tool_input.get("name")
    if not isinstance(name, str) or not name.strip():
        return "name is required"

    return None


def validate_compsheet_add_input(tool_input: Dict[str, Any]) -> Optional[str]:
    name_error = validate_required_string(tool_input, "name")
    if name_error is not None:
        return name_error

    for field_name in ("address", "city", "state", "zipcode"):
        field_error = validate_required_string(tool_input, field_name)
        if field_error is not None:
            return field_error

    return None


def validate_compsheet_dump_input(tool_input: Dict[str, Any]) -> Optional[str]:
    name_error = validate_required_string(tool_input, "name")
    if name_error is not None:
        return name_error

    full = tool_input.get("full")
    if full is not None and not isinstance(full, bool):
        return "full must be a boolean"

    return None


def validate_compsheet_remove_input(tool_input: Dict[str, Any]) -> Optional[str]:
    name_error = validate_required_string(tool_input, "name")
    if name_error is not None:
        return name_error

    return validate_required_string(tool_input, "property_id")


def validate_compsheet_delete_input(tool_input: Dict[str, Any]) -> Optional[str]:
    return validate_required_string(tool_input, "name")


def validate_required_string(tool_input: Dict[str, Any], field_name: str) -> Optional[str]:
    value = tool_input.get(field_name)
    if not isinstance(value, str) or not value.strip():
        return f"{field_name} is required"

    return None


def fetch_sold_property_summary(tool_input: Dict[str, Any]) -> Dict[str, Any]:
    response_json = query_realtor_api(
        tool_input["address"].strip(),
        tool_input["city"].strip(),
        tool_input["state"].strip(),
        tool_input["zipcode"].strip(),
        "sold",
    )
    return extract_first_property_summary(response_json)


def require_property_id(property_summary: Dict[str, Any]) -> None:
    property_id = property_summary.get("property_id")
    if property_id is None or not str(property_id).strip():
        raise MissingPropertyIdError()


def summarize_compsheet_rows(rows: list[Dict[str, str]]) -> list[Dict[str, str]]:
    return [
        {
            "property_id": row.get("property_id", ""),
            "address": row.get("address", ""),
        }
        for row in rows
    ]


def print_result(result: Dict[str, Any]) -> None:
    print(json.dumps({"result": result}))


class MissingPropertyIdError(Exception):
    pass
