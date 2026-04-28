import json
from pathlib import Path
from typing import Any, Dict

from utils.compsheet import (
    CompsheetNotFoundError,
    resolve_compsheet_directory,
)

OFFER_FILENAME = "offer.json"
OFFER_FIELDS = (
    "offer_price",
    "down_payment",
    "interest_rate",
    "annual_taxes",
    "annual_home_insurance",
    "other_monthly_costs",
)


class InvalidOfferFileError(Exception):
    def __init__(self, offer_path: Path):
        self.offer_path = offer_path


def update_or_inspect_offer(stored_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
    current_offer, offer_path = read_offer(stored_name)
    supplied_offer_fields = extract_supplied_offer_fields(tool_input)
    validate_supplied_offer_fields(supplied_offer_fields)

    merged_offer = dict(current_offer)
    merged_offer.update(supplied_offer_fields)

    if supplied_offer_fields:
        write_offer(offer_path, merged_offer)

    return build_offer_result(stored_name, merged_offer)


def read_offer(stored_name: str) -> tuple[Dict[str, Any], Path]:
    offer_path = resolve_offer_path(stored_name)
    if not offer_path.exists():
        return {}, offer_path

    with offer_path.open() as offer_file:
        try:
            offer_data = json.load(offer_file)
        except json.JSONDecodeError as error:
            raise InvalidOfferFileError(offer_path) from error

    if not isinstance(offer_data, dict):
        raise InvalidOfferFileError(offer_path)

    return {k: v for k, v in offer_data.items() if k in OFFER_FIELDS}, offer_path


def write_offer(offer_path: Path, offer_data: Dict[str, Any]) -> None:
    with offer_path.open("w") as offer_file:
        json.dump(offer_data, offer_file, indent=2, sort_keys=True)
        offer_file.write("\n")


def resolve_offer_path(stored_name: str) -> Path:
    compsheet_directory = resolve_compsheet_directory(stored_name)
    if not compsheet_directory.is_dir():
        raise CompsheetNotFoundError(stored_name)

    return compsheet_directory / OFFER_FILENAME


def extract_supplied_offer_fields(tool_input: Dict[str, Any]) -> Dict[str, Any]:
    return {field: tool_input[field] for field in OFFER_FIELDS if field in tool_input}


def validate_supplied_offer_fields(fields: Dict[str, Any]) -> None:
    for field_name, value in fields.items():
        validate_number_field(field_name, value)


def validate_number_field(field_name: str, value: Any) -> None:
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise ValueError(f"{field_name} must be a number")

    if field_name == "offer_price" and value <= 0:
        raise ValueError("offer_price must be greater than 0")

    if field_name == "down_payment" and (value < 0 or value >= 100):
        raise ValueError("down_payment must be a percentage greater than or equal to 0 and less than 100")

    if field_name == "interest_rate" and value < 1:
        raise ValueError("interest_rate must be a percent value, e.g. 6.5")

    if field_name in {"annual_taxes", "annual_home_insurance", "other_monthly_costs"} and value < 0:
        raise ValueError(f"{field_name} must be greater than or equal to 0")


def build_offer_result(stored_name: str, offer_data: Dict[str, Any]) -> Dict[str, Any]:
    missing = [field for field in OFFER_FIELDS if field not in offer_data]
    result = {"name": stored_name, **{k: offer_data[k] for k in OFFER_FIELDS if k in offer_data}}

    if missing:
        result["message"] = (
            "complete all missing params to calculate the offer details. "
            f"missing params: {', '.join(missing)}"
        )
        return result

    monthly_mortgage = calculate_monthly_mortgage(offer_data)
    monthly_payment = (
        monthly_mortgage
        + (offer_data["annual_taxes"] / 12)
        + (offer_data["annual_home_insurance"] / 12)
        + offer_data["other_monthly_costs"]
    )

    result["monthly_mortgage"] = round(monthly_mortgage, 2)
    result["monthly_payment"] = round(monthly_payment, 2)
    return result


def calculate_monthly_mortgage(offer_data: Dict[str, Any]) -> float:
    principal = offer_data["offer_price"] * (1 - (offer_data["down_payment"] / 100))
    monthly_rate = (offer_data["interest_rate"] / 100) / 12
    n_payments = 360
    growth_factor = (1 + monthly_rate) ** n_payments
    return principal * monthly_rate * growth_factor / (growth_factor - 1)
