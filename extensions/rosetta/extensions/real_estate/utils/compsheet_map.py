import math
import os
import tempfile
import urllib.request
from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
from typing import Any, Dict, List

from utils.compsheet import InvalidCompsheetNameError, resolve_compsheet_directory

MAP_FILENAME = "report-map.png"
DEFAULT_MAP_WIDTH = 800
DEFAULT_MAP_HEIGHT = 600
TILE_SIZE = 256
MIN_TILE_ZOOM = 0
MAX_TILE_ZOOM = 18
TILE_REQUEST_TIMEOUT_SECONDS = 10
BLUE_MARKER = "#2563eb"
RED_MARKER = "#dc2626"
BACKGROUND_COLOR = "#f8fafc"
TEXT_COLOR = "#111827"
MARKER_LABEL_COLOR = "white"
ADDRESS_KEY_WIDTH = 300
ADDRESS_KEY_MARGIN = 20
ADDRESS_KEY_PADDING = 8
ADDRESS_KEY_LINE_HEIGHT = 16
ADDRESS_KEY_MAX_ADDRESS_CHARS = 34
WEB_MERCATOR_MAX_LATITUDE = 85.05112878
TILE_USER_AGENT = "pi-config-rosetta-real-estate/1.0 (+https://openstreetmap.org)"


class MapReportError(Exception):
    pass


@dataclass(frozen=True)
class MapPoint:
    label: str
    latitude: float
    longitude: float
    is_target: bool = False


@dataclass(frozen=True)
class TileProvider:
    name: str
    url_template: str
    attribution: str


TILE_PROVIDERS = [
    TileProvider(
        name="cartodb-positron",
        url_template="https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
        attribution="© OpenStreetMap contributors © CARTO",
    ),
    TileProvider(
        name="openstreetmap",
        url_template="https://tile.openstreetmap.org/{z}/{x}/{y}.png",
        attribution="© OpenStreetMap contributors",
    ),
]


@dataclass(frozen=True)
class MapRenderResult:
    path: Path
    renderer: str
    width: int
    height: int
    comp_count: int
    target_plotted: bool


def render_compsheet_map(
    target_summary: Dict[str, Any] | None,
    rows: List[Dict[str, str]],
    compsheet_name: str | None,
    width: int = DEFAULT_MAP_WIDTH,
    height: int = DEFAULT_MAP_HEIGHT,
) -> MapRenderResult:
    target_point, comp_points = build_map_points(target_summary, rows)
    output_path = resolve_map_output_path(compsheet_name)
    renderer_name, png_bytes = render_map_png(target_point, comp_points, width, height)
    written_path = atomic_write_png(output_path, png_bytes)
    return MapRenderResult(
        path=written_path,
        renderer=renderer_name,
        width=width,
        height=height,
        comp_count=len(comp_points),
        target_plotted=True,
    )


def render_map_png(target_point: MapPoint, comp_points: List[MapPoint], width: int, height: int) -> tuple[str, bytes]:
    try:
        return "staticmap", render_staticmap_png(target_point, comp_points, width, height)
    except Exception:
        return render_fallback_map_png(target_point, comp_points, width, height)


def render_fallback_map_png(target_point: MapPoint, comp_points: List[MapPoint], width: int, height: int) -> tuple[str, bytes]:
    try:
        return "fallback", render_fallback_png(target_point, comp_points, width, height)
    except Exception as error:
        raise MapReportError(f"Failed to render map PNG: {error}") from error


def render_staticmap_png(target_point: MapPoint, comp_points: List[MapPoint], width: int, height: int) -> bytes:
    last_error: Exception | None = None
    for provider in TILE_PROVIDERS:
        try:
            return render_tile_backed_png(target_point, comp_points, width, height, provider)
        except Exception as error:
            last_error = error

    if last_error is None:
        raise RuntimeError("No tile providers configured")

    raise RuntimeError(f"Failed to render tile backdrop: {last_error}") from last_error


def render_tile_backed_png(
    target_point: MapPoint,
    comp_points: List[MapPoint],
    width: int,
    height: int,
    provider: TileProvider,
) -> bytes:
    from PIL import Image, ImageDraw

    points = [target_point, *comp_points]
    bounds = calculate_bounds(points)
    zoom = choose_tile_zoom(bounds, width, height)
    viewport = calculate_tile_viewport(bounds, zoom, width, height)
    image = Image.new("RGB", (width, height), BACKGROUND_COLOR)
    paste_map_tiles(image, provider, zoom, viewport)

    draw = ImageDraw.Draw(image)
    for index, comp_point in enumerate(comp_points, start=1):
        x, y = project_tile_point(comp_point, zoom, viewport)
        draw_comp_marker(draw, x, y, index)

    target_x, target_y = project_tile_point(target_point, zoom, viewport)
    draw_target_marker(draw, target_x, target_y)
    add_address_key(image, target_point, comp_points)
    add_attribution(image, provider.attribution)
    add_legend(image)
    return encode_png(image)


def render_fallback_png(target_point: MapPoint, comp_points: List[MapPoint], width: int, height: int) -> bytes:
    from PIL import Image, ImageDraw

    image = Image.new("RGB", (width, height), BACKGROUND_COLOR)
    draw = ImageDraw.Draw(image)
    draw.text((24, 20), "Neighborhood comparable sales map", fill=TEXT_COLOR)

    bounds = calculate_bounds([target_point, *comp_points])
    for index, comp_point in enumerate(comp_points, start=1):
        x, y = project_point(comp_point, bounds, width, height)
        draw_comp_marker(draw, x, y, index)

    target_x, target_y = project_point(target_point, bounds, width, height)
    draw_target_marker(draw, target_x, target_y)
    add_address_key(image, target_point, comp_points)
    add_legend(image)
    return encode_png(image)


def choose_tile_zoom(bounds: tuple[float, float, float, float], width: int, height: int) -> int:
    min_latitude, max_latitude, min_longitude, max_longitude = bounds
    for zoom in range(MAX_TILE_ZOOM, MIN_TILE_ZOOM - 1, -1):
        left = longitude_to_pixel_x(min_longitude, zoom)
        right = longitude_to_pixel_x(max_longitude, zoom)
        top = latitude_to_pixel_y(max_latitude, zoom)
        bottom = latitude_to_pixel_y(min_latitude, zoom)
        if right - left <= width and bottom - top <= height:
            return zoom

    return MIN_TILE_ZOOM


def calculate_tile_viewport(bounds: tuple[float, float, float, float], zoom: int, width: int, height: int) -> tuple[float, float]:
    min_latitude, max_latitude, min_longitude, max_longitude = bounds
    left = longitude_to_pixel_x(min_longitude, zoom)
    right = longitude_to_pixel_x(max_longitude, zoom)
    top = latitude_to_pixel_y(max_latitude, zoom)
    bottom = latitude_to_pixel_y(min_latitude, zoom)
    center_x = (left + right) / 2
    center_y = (top + bottom) / 2
    return (center_x - width / 2, center_y - height / 2)


def paste_map_tiles(image: Any, provider: TileProvider, zoom: int, viewport: tuple[float, float]) -> None:
    top_left_x, top_left_y = viewport
    width, height = image.size
    min_tile_x = math.floor(top_left_x / TILE_SIZE)
    max_tile_x = math.floor((top_left_x + width) / TILE_SIZE)
    min_tile_y = math.floor(top_left_y / TILE_SIZE)
    max_tile_y = math.floor((top_left_y + height) / TILE_SIZE)
    max_tile_index = 2**zoom
    failed_tiles: List[str] = []

    for tile_x in range(min_tile_x, max_tile_x + 1):
        for tile_y in range(min_tile_y, max_tile_y + 1):
            if tile_y < 0 or tile_y >= max_tile_index:
                continue

            wrapped_tile_x = tile_x % max_tile_index
            tile_url = provider.url_template.format(z=zoom, x=wrapped_tile_x, y=tile_y)
            try:
                tile_image = fetch_tile_image(tile_url)
            except Exception:
                failed_tiles.append(tile_url)
                continue

            image.paste(tile_image, (round(tile_x * TILE_SIZE - top_left_x), round(tile_y * TILE_SIZE - top_left_y)))

    if failed_tiles:
        raise RuntimeError(f"{provider.name} failed to fetch {len(failed_tiles)} map tile(s)")


def fetch_tile_image(tile_url: str) -> Any:
    from PIL import Image

    request = urllib.request.Request(tile_url, headers={"User-Agent": TILE_USER_AGENT})
    with urllib.request.urlopen(request, timeout=TILE_REQUEST_TIMEOUT_SECONDS) as response:
        status = getattr(response, "status", 200)
        if status != 200:
            raise RuntimeError(f"tile request returned HTTP {status}")

        tile_bytes = response.read()

    return Image.open(BytesIO(tile_bytes)).convert("RGB")


def project_tile_point(point: MapPoint, zoom: int, viewport: tuple[float, float]) -> tuple[int, int]:
    top_left_x, top_left_y = viewport
    return (
        round(longitude_to_pixel_x(point.longitude, zoom) - top_left_x),
        round(latitude_to_pixel_y(point.latitude, zoom) - top_left_y),
    )


def longitude_to_pixel_x(longitude: float, zoom: int) -> float:
    longitude = ((longitude + 180) % 360) - 180
    world_size = TILE_SIZE * 2**zoom
    return ((longitude + 180) / 360) * world_size


def latitude_to_pixel_y(latitude: float, zoom: int) -> float:
    clamped_latitude = max(min(latitude, WEB_MERCATOR_MAX_LATITUDE), -WEB_MERCATOR_MAX_LATITUDE)
    latitude_radians = math.radians(clamped_latitude)
    world_size = TILE_SIZE * 2**zoom
    mercator = math.log(math.tan(latitude_radians) + 1 / math.cos(latitude_radians))
    return (1 - mercator / math.pi) / 2 * world_size


def add_attribution(image: Any, attribution: str) -> None:
    from PIL import ImageDraw

    draw = ImageDraw.Draw(image)
    padding = 4
    margin = 8
    text_width, text_height = measure_text(draw, attribution)
    left = margin
    top = image.height - text_height - padding * 2 - margin
    right = left + text_width + padding * 2
    bottom = image.height - margin
    draw.rectangle((left, top, right, bottom), fill="white", outline="#d1d5db")
    draw.text((left + padding, top + padding), attribution, fill="#374151")


def measure_text(draw: Any, text: str) -> tuple[int, int]:
    if hasattr(draw, "textbbox"):
        left, top, right, bottom = draw.textbbox((0, 0), text)
        return (right - left, bottom - top)

    return draw.textsize(text)


def build_map_points(target_summary: Dict[str, Any] | None, rows: List[Dict[str, str]]) -> tuple[MapPoint, List[MapPoint]]:
    if target_summary is None:
        raise MapReportError("Map report requires a target property")

    target_point = build_target_point(target_summary)
    comp_points = [build_comp_point(row, index) for index, row in enumerate(rows, start=1)]
    return target_point, comp_points


def build_target_point(target_summary: Dict[str, Any]) -> MapPoint:
    return MapPoint(
        label=str(target_summary.get("address") or "Target property"),
        latitude=parse_coordinate(target_summary.get("latitude"), "target latitude"),
        longitude=parse_coordinate(target_summary.get("longitude"), "target longitude"),
        is_target=True,
    )


def build_comp_point(row: Dict[str, str], index: int) -> MapPoint:
    address = row.get("address") or f"Comparable property {index}"
    return MapPoint(
        label=address,
        latitude=parse_coordinate(row.get("latitude"), f"comp {index} latitude ({address})"),
        longitude=parse_coordinate(row.get("longitude"), f"comp {index} longitude ({address})"),
    )


def calculate_bounds(points: List[MapPoint]) -> tuple[float, float, float, float]:
    latitudes = [point.latitude for point in points]
    longitudes = [point.longitude for point in points]
    min_latitude, max_latitude = min(latitudes), max(latitudes)
    min_longitude, max_longitude = min(longitudes), max(longitudes)
    latitude_padding = max((max_latitude - min_latitude) * 0.15, 0.005)
    longitude_padding = max((max_longitude - min_longitude) * 0.15, 0.005)
    return (
        min_latitude - latitude_padding,
        max_latitude + latitude_padding,
        min_longitude - longitude_padding,
        max_longitude + longitude_padding,
    )


def project_point(point: MapPoint, bounds: tuple[float, float, float, float], width: int, height: int) -> tuple[int, int]:
    min_latitude, max_latitude, min_longitude, max_longitude = bounds
    left_padding, right_padding = 60, 60
    top_padding, bottom_padding = 70, 70
    usable_width = width - left_padding - right_padding
    usable_height = height - top_padding - bottom_padding
    x_fraction = (point.longitude - min_longitude) / (max_longitude - min_longitude)
    y_fraction = (max_latitude - point.latitude) / (max_latitude - min_latitude)
    return (round(left_padding + x_fraction * usable_width), round(top_padding + y_fraction * usable_height))


def draw_comp_marker(draw: Any, center_x: int, center_y: int, index: int) -> None:
    draw.ellipse((center_x - 9, center_y - 9, center_x + 9, center_y + 9), fill=BLUE_MARKER, outline="white", width=2)
    draw_centered_text(draw, str(index), center_x, center_y, MARKER_LABEL_COLOR)


def draw_target_marker(draw: Any, center_x: int, center_y: int) -> None:
    draw_regular_diamond(draw, center_x, center_y, 14, RED_MARKER)
    draw_centered_text(draw, "T", center_x, center_y, MARKER_LABEL_COLOR)


def draw_centered_text(draw: Any, text: str, center_x: int, center_y: int, color: str) -> None:
    text_width, text_height = measure_text(draw, text)
    draw.text((center_x - text_width / 2, center_y - text_height / 2), text, fill=color)


def add_address_key(image: Any, target_point: MapPoint, comp_points: List[MapPoint]) -> None:
    from PIL import ImageDraw

    draw = ImageDraw.Draw(image)
    entries = [("T", target_point.label, RED_MARKER), *[(str(index), point.label, BLUE_MARKER) for index, point in enumerate(comp_points, start=1)]]
    width = min(ADDRESS_KEY_WIDTH, image.width - ADDRESS_KEY_MARGIN * 2)
    left = image.width - width - ADDRESS_KEY_MARGIN
    top = ADDRESS_KEY_MARGIN
    height = ADDRESS_KEY_PADDING * 2 + ADDRESS_KEY_LINE_HEIGHT * (len(entries) + 1)
    right = left + width
    bottom = top + height

    draw.rectangle((left, top, right, bottom), fill="white", outline="#9ca3af")
    draw.text((left + ADDRESS_KEY_PADDING, top + ADDRESS_KEY_PADDING), "Properties", fill=TEXT_COLOR)

    y = top + ADDRESS_KEY_PADDING + ADDRESS_KEY_LINE_HEIGHT
    for marker_label, address, marker_color in entries:
        marker_left = left + ADDRESS_KEY_PADDING
        marker_center_y = y + ADDRESS_KEY_LINE_HEIGHT // 2
        draw.rectangle((marker_left, marker_center_y - 5, marker_left + 10, marker_center_y + 5), fill=marker_color, outline=marker_color)
        draw.text((marker_left + 16, y), marker_label, fill=TEXT_COLOR)
        draw.text((marker_left + 38, y), truncate_address(address), fill=TEXT_COLOR)
        y += ADDRESS_KEY_LINE_HEIGHT


def truncate_address(address: str, max_chars: int = ADDRESS_KEY_MAX_ADDRESS_CHARS) -> str:
    normalized_address = " ".join(str(address).split())
    if len(normalized_address) <= max_chars:
        return normalized_address

    if max_chars <= 3:
        return "." * max_chars

    return f"{normalized_address[:max_chars - 3]}..."


def add_legend(image: Any) -> None:
    from PIL import ImageDraw

    draw = ImageDraw.Draw(image)
    legend_left = image.width - 190
    legend_top = image.height - 78
    draw.rectangle((legend_left, legend_top, image.width - 20, image.height - 20), fill="white", outline="#9ca3af")
    draw.ellipse((legend_left + 14, legend_top + 14, legend_left + 28, legend_top + 28), fill=BLUE_MARKER, outline=BLUE_MARKER)
    draw.text((legend_left + 38, legend_top + 12), "Comparable", fill=TEXT_COLOR)
    draw_regular_diamond(draw, legend_left + 21, legend_top + 45, 8, RED_MARKER)
    draw.text((legend_left + 38, legend_top + 36), "Target", fill=TEXT_COLOR)


def draw_regular_diamond(draw: Any, center_x: int, center_y: int, radius: int, color: str) -> None:
    draw.polygon(
        [(center_x, center_y - radius), (center_x + radius, center_y), (center_x, center_y + radius), (center_x - radius, center_y)],
        fill=color,
        outline="white",
    )


def encode_png(image: Any) -> bytes:
    output = BytesIO()
    image.save(output, format="PNG")
    return output.getvalue()


def parse_coordinate(raw_value: Any, field_label: str) -> float:
    if raw_value is None:
        raise MapReportError(f"Missing {field_label}")

    normalized_value = str(raw_value).strip()
    if not normalized_value:
        raise MapReportError(f"Missing {field_label}")

    try:
        coordinate = float(normalized_value)
    except (TypeError, ValueError) as error:
        raise MapReportError(f"Unparsable {field_label}: {raw_value}") from error

    if "latitude" in field_label and not -90 <= coordinate <= 90:
        raise MapReportError(f"Invalid {field_label}: {raw_value}")

    if "longitude" in field_label and not -180 <= coordinate <= 180:
        raise MapReportError(f"Invalid {field_label}: {raw_value}")

    return coordinate


def resolve_map_output_path(compsheet_name: str | None) -> Path:
    if compsheet_name is None:
        raise MapReportError("Map report requires a compsheet name")

    try:
        return resolve_compsheet_directory(compsheet_name) / MAP_FILENAME
    except InvalidCompsheetNameError as error:
        raise MapReportError("Invalid compsheet name for map report") from error


def atomic_write_png(output_path: Path, png_bytes: bytes) -> Path:
    try:
        output_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError as error:
        raise MapReportError(f"Failed to create map output directory: {error}") from error

    temp_path = write_temp_png(output_path, png_bytes)
    try:
        os.replace(temp_path, output_path)
    except OSError as error:
        cleanup_temp_path(temp_path)
        raise MapReportError(f"Failed to write map PNG: {error}") from error

    return output_path


def write_temp_png(output_path: Path, png_bytes: bytes) -> Path:
    try:
        with tempfile.NamedTemporaryFile(
            mode="wb",
            suffix=".tmp.png",
            prefix=f".{output_path.name}.",
            dir=output_path.parent,
            delete=False,
        ) as temp_file:
            temp_file.write(png_bytes)
            return Path(temp_file.name)
    except OSError as error:
        raise MapReportError(f"Failed to write temporary map PNG: {error}") from error


def cleanup_temp_path(temp_path: Path) -> None:
    try:
        temp_path.unlink(missing_ok=True)
    except OSError:
        pass
