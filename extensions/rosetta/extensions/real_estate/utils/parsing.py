import json
from typing import Any, Dict


def parse_json_input(raw_input: str) -> Dict[str, Any] | "JsonInputError":
    try:
        tool_input = json.loads(raw_input)
    except json.JSONDecodeError:
        return JsonInputError("Input must be valid JSON")

    if not isinstance(tool_input, dict):
        return JsonInputError("Input must be valid JSON")

    return tool_input


def print_realtor_query_result(property_summary: Dict[str, Any]) -> None:
    print(json.dumps({"result": property_summary}))


def print_compsheet_new_result(name: str, path: str) -> None:
    print(json.dumps({"result": {"name": name, "path": path}}))


def print_error(message: str) -> None:
    print(json.dumps({"error": message}))


class JsonInputError:
    def __init__(self, message: str):
        self.message = message
