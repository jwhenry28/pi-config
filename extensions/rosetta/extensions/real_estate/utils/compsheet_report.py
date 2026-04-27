from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional, Protocol

from utils.compsheet_map import MapReportError, render_compsheet_map


@dataclass(frozen=True)
class ReportContext:
    rows: List[Dict[str, str]]
    target_summary: Optional[Dict[str, Any]] = None
    compsheet_name: Optional[str] = None


class CompsheetMetric(Protocol):
    key: str

    def calculate(self, context: ReportContext) -> Dict[str, Any]:
        ...


class NumericColumnMetric:
    def __init__(self, key: str, column_name: str):
        self.key = key
        self.column_name = column_name

    def calculate(self, context: ReportContext) -> Dict[str, Any]:
        values = collect_metric_values(context.rows, self.extract_value)
        return summarize_metric_values(values)

    def extract_value(self, row: Dict[str, str]) -> Optional[float]:
        return parse_numeric_value(row.get(self.column_name, ""))


class PricePerSqftMetric:
    key = "price_per_sqft"

    def calculate(self, context: ReportContext) -> Dict[str, Any]:
        values = collect_metric_values(context.rows, self.extract_value)
        return summarize_metric_values(values)

    def extract_value(self, row: Dict[str, str]) -> Optional[float]:
        sold_price = parse_numeric_value(row.get("sold_price", ""))
        sqft = parse_numeric_value(row.get("sqft", ""))
        if sold_price is None or sqft is None or sqft == 0:
            return None

        return sold_price / sqft


class MapMetric:
    key = "map"

    def calculate(self, context: ReportContext) -> Dict[str, Any]:
        render_result = render_compsheet_map(context.target_summary, context.rows, context.compsheet_name)
        return {
            "path": str(render_result.path),
            "mime_type": "image/png",
            "width": render_result.width,
            "height": render_result.height,
            "count": render_result.comp_count,
            "target": {"plotted": render_result.target_plotted},
            "renderer": render_result.renderer,
        }


MetricValue = Dict[str, Any]
TargetExtractor = Callable[[Dict[str, Any]], Optional[float]]


ALL_METRIC_KEYS = ["sqft", "sale", "list", "price_per_sqft", "map"]
REGISTERED_METRICS: Dict[str, CompsheetMetric] = {
    "sqft": NumericColumnMetric("sqft", "sqft"),
    "sale": NumericColumnMetric("sale", "sold_price"),
    "list": NumericColumnMetric("list", "list_price"),
    "price_per_sqft": PricePerSqftMetric(),
    "map": MapMetric(),
}


def build_compsheet_report(
    rows: List[Dict[str, str]],
    metrics_selector: str,
    target_summary: Optional[Dict[str, Any]] = None,
    compsheet_name: Optional[str] = None,
) -> Dict[str, Any]:
    context = ReportContext(rows=rows, target_summary=target_summary, compsheet_name=compsheet_name)
    metric_keys = select_metric_keys(metrics_selector)
    return {metric_key: build_metric_report(metric_key, context) for metric_key in metric_keys}


def build_metric_report(metric_key: str, context: ReportContext) -> Dict[str, Any]:
    metric_report = REGISTERED_METRICS[metric_key].calculate(context)
    if context.target_summary is not None and metric_key in TARGET_METRICS:
        target_value = TARGET_METRICS[metric_key](context.target_summary)
        metric_report["target"] = format_target_metric_value(target_value)

    return metric_report


def extract_target_price_per_sqft(target_summary: Dict[str, Any]) -> Optional[float]:
    list_price = parse_numeric_value(target_summary.get("list_price"))
    sqft = parse_numeric_value(target_summary.get("sqft"))
    if list_price is None or sqft is None or sqft == 0:
        return None

    return list_price / sqft


def format_target_metric_value(value: Optional[float]) -> Optional[Dict[str, Any]]:
    if value is None:
        return None

    return {"value": format_number(value)}


TARGET_METRICS: Dict[str, TargetExtractor] = {
    "sqft": lambda target_summary: parse_numeric_value(target_summary.get("sqft")),
    "list": lambda target_summary: parse_numeric_value(target_summary.get("list_price")),
    "price_per_sqft": extract_target_price_per_sqft,
}


def select_metric_keys(metrics_selector: str) -> List[str]:
    if metrics_selector == "all":
        return ALL_METRIC_KEYS.copy()

    return [metrics_selector]


def is_supported_metrics_selector(metrics_selector: str) -> bool:
    return metrics_selector == "all" or metrics_selector in REGISTERED_METRICS


def collect_metric_values(rows: List[Dict[str, str]], extract_value) -> List[MetricValue]:
    metric_values = []
    for row in rows:
        value = extract_value(row)
        if value is None:
            continue

        metric_values.append({"value": value, "address": row.get("address", "")})

    return metric_values


def summarize_metric_values(metric_values: List[MetricValue]) -> Dict[str, Any]:
    if not metric_values:
        return {"count": 0, "mean": None, "min": None, "max": None}

    raw_values = [metric_value["value"] for metric_value in metric_values]
    min_metric_value = min(metric_values, key=lambda metric_value: metric_value["value"])
    max_metric_value = max(metric_values, key=lambda metric_value: metric_value["value"])
    return {
        "count": len(metric_values),
        "mean": format_number(sum(raw_values) / len(raw_values)),
        "min": format_extreme(min_metric_value),
        "max": format_extreme(max_metric_value),
    }


def format_extreme(metric_value: MetricValue) -> Dict[str, Any]:
    return {
        "value": format_number(metric_value["value"]),
        "address": metric_value["address"],
    }


def parse_numeric_value(raw_value: Any) -> Optional[float]:
    if raw_value is None:
        return None

    normalized_value = str(raw_value).strip().replace(",", "").replace("$", "")
    if not normalized_value:
        return None

    try:
        return float(normalized_value)
    except ValueError:
        return None


def format_number(value: float) -> int | float:
    rounded_value = round(value, 2)
    if rounded_value.is_integer():
        return int(rounded_value)

    return rounded_value
