import csv
import json
import re
import shutil
from pathlib import Path
from typing import Any, Dict, List

COMPSHEET_ROOT_PARTS = (".pi", "rosetta", "real_estate", "compsheets")
COMPSHEET_FILENAME = "compsheet.csv"
TARGET_FILENAME = "target.json"
COMPSHEET_HEADER = [
    "property_id",
    "href",
    "list_price",
    "listing_id",
    "status",
    "price_reduced_amount",
    "list_date",
    "beds",
    "baths",
    "sqft",
    "lot_sqft",
    "property_type",
    "sold_price",
    "sold_date",
    "year_built",
    "garage",
    "address",
    "postal_code",
    "state",
    "state_code",
    "city",
    "county",
    "latitude",
    "longitude",
    "branding_name",
    "agent_name",
    "agent_email",
    "office_name",
    "agent_phone",
]


def normalize_compsheet_name(name: str) -> str:
    trimmed_lowercase_name = name.strip().lower()
    return re.sub(r"\s+", "-", trimmed_lowercase_name)


def create_compsheet_csv(normalized_name: str) -> Path:
    compsheet_path = build_compsheet_path(normalized_name)
    compsheet_path.parent.mkdir(parents=True, exist_ok=True)
    with compsheet_path.open("x", newline="") as csv_file:
        writer = csv.writer(csv_file, lineterminator="\n")
        writer.writerow(COMPSHEET_HEADER)

    return compsheet_path


def create_compsheet_with_target(normalized_name: str, target_summary: Dict[str, Any]) -> tuple[Path, Path]:
    compsheet_path = create_compsheet_csv(normalized_name)
    target_path = write_target_summary(normalized_name, target_summary)
    return compsheet_path, target_path


def list_compsheet_names() -> List[str]:
    compsheets_root = get_compsheets_root()
    if not compsheets_root.exists():
        return []

    compsheet_names = [
        path.name
        for path in compsheets_root.iterdir()
        if path.is_dir() and path.joinpath(COMPSHEET_FILENAME).is_file()
    ]
    return sorted(compsheet_names)


def read_compsheet_rows(stored_name: str) -> List[Dict[str, str]]:
    compsheet_path = resolve_existing_compsheet_csv_path(stored_name)
    with compsheet_path.open(newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        validate_compsheet_header(compsheet_path, reader.fieldnames)
        return list(reader)


def write_target_summary(stored_name: str, target_summary: Dict[str, Any]) -> Path:
    target_path = build_target_path(stored_name)
    target_path.parent.mkdir(parents=True, exist_ok=True)
    with target_path.open("w") as target_file:
        json.dump(target_summary, target_file, indent=2, sort_keys=True)
        target_file.write("\n")

    return target_path


def read_target_summary(stored_name: str) -> Dict[str, Any]:
    target_path = resolve_existing_target_path(stored_name)
    with target_path.open() as target_file:
        try:
            target_summary = json.load(target_file)
        except json.JSONDecodeError as error:
            raise InvalidTargetSummaryError(target_path) from error

    if not isinstance(target_summary, dict):
        raise InvalidTargetSummaryError(target_path)

    return target_summary


def append_property_summary(stored_name: str, property_summary: Dict[str, Any]) -> None:
    compsheet_path = resolve_existing_compsheet_csv_path(stored_name)
    validate_property_is_not_duplicate(stored_name, property_summary)
    with compsheet_path.open("a", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=COMPSHEET_HEADER, lineterminator="\n")
        writer.writerow(build_compsheet_row(property_summary))


def remove_property_rows(stored_name: str, property_id: str) -> int:
    compsheet_path = resolve_existing_compsheet_csv_path(stored_name)
    rows = read_compsheet_rows(stored_name)
    remaining_rows = [row for row in rows if row.get("property_id") != property_id]
    removed_count = len(rows) - len(remaining_rows)
    if removed_count == 0:
        raise PropertyNotFoundInCompsheetError(property_id)

    write_compsheet_rows(compsheet_path, remaining_rows)
    return removed_count


def delete_compsheet_directory(stored_name: str) -> None:
    compsheet_directory = resolve_existing_compsheet_directory(stored_name)
    shutil.rmtree(compsheet_directory)


def validate_property_is_not_duplicate(stored_name: str, property_summary: Dict[str, Any]) -> None:
    property_id = str(property_summary.get("property_id") or "")
    rows = read_compsheet_rows(stored_name)
    if any(row.get("property_id") == property_id for row in rows):
        raise DuplicatePropertyError(property_id)


def build_compsheet_row(property_summary: Dict[str, Any]) -> Dict[str, Any]:
    return {field_name: property_summary.get(field_name) for field_name in COMPSHEET_HEADER}


def write_compsheet_rows(compsheet_path: Path, rows: List[Dict[str, str]]) -> None:
    with compsheet_path.open("w", newline="") as csv_file:
        writer = csv.DictWriter(csv_file, fieldnames=COMPSHEET_HEADER, lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)


def resolve_existing_compsheet_csv_path(stored_name: str) -> Path:
    compsheet_path = resolve_compsheet_csv_path(stored_name)
    if not compsheet_path.is_file():
        raise CompsheetNotFoundError(stored_name)

    return compsheet_path


def resolve_existing_target_path(stored_name: str) -> Path:
    target_path = build_target_path(stored_name)
    if not target_path.is_file():
        raise TargetSummaryNotFoundError(stored_name)

    return target_path


def resolve_existing_compsheet_directory(stored_name: str) -> Path:
    compsheet_directory = resolve_compsheet_directory(stored_name)
    compsheet_path = compsheet_directory / COMPSHEET_FILENAME
    if not compsheet_directory.is_dir() or not compsheet_path.is_file():
        raise CompsheetNotFoundError(stored_name)

    validate_path_is_inside_compsheets_root(compsheet_path)
    return compsheet_directory


def validate_compsheet_header(compsheet_path: Path, fieldnames: List[str] | None) -> None:
    if fieldnames != COMPSHEET_HEADER:
        raise InvalidCompsheetHeaderError(compsheet_path)


def build_compsheet_path(normalized_name: str) -> Path:
    return resolve_compsheet_csv_path(normalized_name)


def build_target_path(normalized_or_stored_name: str) -> Path:
    return resolve_target_path(normalized_or_stored_name)


def resolve_compsheet_csv_path(stored_name: str) -> Path:
    validate_stored_compsheet_name(stored_name)
    compsheet_path = get_compsheets_root() / stored_name / COMPSHEET_FILENAME
    validate_path_is_inside_compsheets_root(compsheet_path)
    return compsheet_path


def resolve_target_path(stored_name: str) -> Path:
    validate_stored_compsheet_name(stored_name)
    target_path = get_compsheets_root() / stored_name / TARGET_FILENAME
    validate_path_is_inside_compsheets_root(target_path)
    return target_path


def resolve_compsheet_directory(stored_name: str) -> Path:
    validate_stored_compsheet_name(stored_name)
    compsheet_directory = get_compsheets_root() / stored_name
    validate_path_is_inside_compsheets_root(compsheet_directory)
    return compsheet_directory


def get_compsheets_root() -> Path:
    return Path.home().joinpath(*COMPSHEET_ROOT_PARTS)


def validate_stored_compsheet_name(stored_name: str) -> None:
    if not isinstance(stored_name, str) or not stored_name.strip():
        raise InvalidCompsheetNameError()

    if stored_name in {".", ".."}:
        raise InvalidCompsheetNameError()

    if "/" in stored_name or "\\" in stored_name:
        raise InvalidCompsheetNameError()

    if Path(stored_name).name != stored_name:
        raise InvalidCompsheetNameError()


def validate_path_is_inside_compsheets_root(path: Path) -> None:
    root = get_compsheets_root().resolve(strict=False)
    resolved_path = path.resolve(strict=False)
    try:
        resolved_path.relative_to(root)
    except ValueError as error:
        raise InvalidCompsheetNameError() from error


class InvalidCompsheetNameError(Exception):
    pass


class CompsheetNotFoundError(Exception):
    def __init__(self, stored_name: str):
        self.stored_name = stored_name


class TargetSummaryNotFoundError(Exception):
    def __init__(self, stored_name: str):
        self.stored_name = stored_name


class InvalidTargetSummaryError(Exception):
    def __init__(self, target_path: Path):
        self.target_path = target_path


class InvalidCompsheetHeaderError(Exception):
    def __init__(self, compsheet_path: Path):
        self.compsheet_path = compsheet_path


class DuplicatePropertyError(Exception):
    def __init__(self, property_id: str):
        self.property_id = property_id


class PropertyNotFoundInCompsheetError(Exception):
    def __init__(self, property_id: str):
        self.property_id = property_id
