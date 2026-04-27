import csv
import importlib.util
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

MODULE_PATH = Path(__file__).with_name("main.py")
sys.path.insert(0, str(MODULE_PATH.parent))

from handlers import compsheet as handle_compsheet
from handlers import query as handle_query
from utils import compsheet
from utils import compsheet_map
from utils import compsheet_report
from utils import realtor_api

spec = importlib.util.spec_from_file_location("real_estate_main", MODULE_PATH)
real_estate = importlib.util.module_from_spec(spec)
spec.loader.exec_module(real_estate)


class RealEstateMainTest(unittest.TestCase):
    def run_command(self, handler, raw_input):
        output = io.StringIO()
        with redirect_stdout(output):
            handler(raw_input)
        return json.loads(output.getvalue())

    def test_query_preserves_validation_errors(self):
        result = self.run_command(handle_query.handle_query_command, json.dumps({"mode": "sold"}))

        self.assertEqual(result, {"error": "address is required"})

        result = self.run_command(
            handle_query.handle_query_command,
            json.dumps({"address": "123 Main St", "city": "Austin", "state": "TX"}),
        )

        self.assertEqual(result, {"error": "zipcode is required"})

    def test_query_success_prints_result(self):
        property_summary = {"address": "123 Main St", "status": "for_sale"}
        with patch.object(handle_query, "query_realtor_api", return_value={"data": {"home_search": {"properties": [{}]}}}) as query_mock, \
             patch.object(handle_query, "extract_first_property_summary", return_value=property_summary):
            result = self.run_command(
                handle_query.handle_query_command,
                json.dumps(
                    {
                        "address": " 123 Main St ",
                        "city": " Austin ",
                        "state": " tx ",
                        "zipcode": " 78701 ",
                        "mode": "sold",
                    }
                ),
            )

        self.assertEqual(result, {"result": property_summary})
        query_mock.assert_called_once_with("123 Main St", "Austin", "tx", "78701", "sold")

    def test_build_property_query_uses_explicit_address_parts(self):
        query = realtor_api.build_property_query("123 Main St", "Austin", "Texas", "78701", "sold")

        self.assertEqual(
            query,
            {
                "primary": True,
                "status": ["sold"],
                "search_location": {
                    "location": "123 Main St, Austin, TX 78701",
                    "buffer": 1,
                },
                "address": "123 Main St",
                "city": "Austin",
                "state_code": "TX",
                "postal_code": "78701",
            },
        )

    def test_sold_graphql_payload_omits_unused_parameters(self):
        payload = realtor_api.build_graphql_payload("123 Main St", "Austin", "TX", "78701", "sold")

        self.assertIn("address {\n          line\n          postal_code\n          state\n          state_code\n          city\n          coordinate {", payload["query"])
        self.assertNotIn("location {\n        coordinate", payload["query"])
        self.assertNotIn("photosLimit", payload["variables"])
        self.assertNotIn("client_data", payload["variables"])
        self.assertNotIn("bucket", payload["variables"])
        self.assertNotIn("$photosLimit", payload["query"])
        self.assertNotIn("$client_data", payload["query"])
        self.assertNotIn("$bucket", payload["query"])
        self.assertNotIn("$search_promotion", payload["query"])
        self.assertNotIn("$sort:", payload["query"])
        self.assertNotIn("sort: $sort", payload["query"])
        self.assertNotIn("$mortgage_params", payload["query"])

    def test_summarize_property_extracts_coordinate_fields(self):
        property_data = {
            "property_id": "prop-1",
            "location": {
                "address": {
                    "line": "123 Main St",
                    "city": "Austin",
                    "state_code": "TX",
                    "coordinate": {"lat": 30.2672, "lon": -97.7431},
                },
            },
        }

        summary = realtor_api.summarize_property(property_data)

        self.assertEqual(summary["latitude"], 30.2672)
        self.assertEqual(summary["longitude"], -97.7431)

    def test_summarize_property_accepts_alternate_coordinate_keys(self):
        property_data = {
            "property_id": "prop-1",
            "location": {
                "coordinates": {"latitude": "30.2672", "lng": "-97.7431"},
                "address": {"line": "123 Main St", "city": "Austin", "state_code": "TX"},
            },
        }

        summary = realtor_api.summarize_property(property_data)

        self.assertEqual(summary["latitude"], "30.2672")
        self.assertEqual(summary["longitude"], "-97.7431")

    def test_query_realtor_api_wraps_network_errors(self):
        with patch.object(realtor_api.requests, "post", side_effect=realtor_api.requests.Timeout):
            with self.assertRaises(realtor_api.RealtorApiError):
                realtor_api.query_realtor_api("123 Main St", "Austin", "TX", "78701", "sold")

    def test_query_realtor_api_includes_http_response_details(self):
        response = realtor_api.requests.Response()
        response.status_code = 403
        response.reason = "Forbidden"
        response._content = b"blocked by realtor"
        http_error = realtor_api.requests.HTTPError("403 Client Error", response=response)

        with patch.object(realtor_api.requests, "post", side_effect=http_error):
            with self.assertRaises(realtor_api.RealtorApiError) as context:
                realtor_api.query_realtor_api("123 Main St", "Austin", "TX", "78701", "sold")

        self.assertEqual(
            str(context.exception),
            "HTTPError; 403 Client Error; status=403; reason=Forbidden; body=blocked by realtor",
        )

    def test_query_command_prints_realtor_api_errors(self):
        with patch.object(handle_query, "query_realtor_api", side_effect=realtor_api.RealtorApiError):
            result = self.run_command(
                handle_query.handle_query_command,
                json.dumps({"address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
            )

        self.assertEqual(result, {"error": "Failed to query realtor.com API"})

    def test_query_command_prints_detailed_realtor_api_errors(self):
        with patch.object(handle_query, "query_realtor_api", side_effect=realtor_api.RealtorApiError("Timeout: read timed out")):
            result = self.run_command(
                handle_query.handle_query_command,
                json.dumps({"address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
            )

        self.assertEqual(result, {"error": "Failed to query realtor.com API: Timeout: read timed out"})

    def test_compsheet_new_derives_name_queries_for_sale_and_writes_target(self):
        target_summary = self.report_property("target-1", "123 Main St", "1800", "", "400000")
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            with patch.object(handle_compsheet, "query_realtor_api", return_value={"api": "response"}) as query_mock, \
                 patch.object(handle_compsheet, "extract_first_property_summary", return_value=target_summary) as extract_mock:
                result = self.run_command(
                    handle_compsheet.handle_compsheet_new_command,
                    json.dumps({"address": " 123 Main St ", "city": " Austin ", "state": " tx ", "zipcode": " 78701 "}),
                )

            expected_path = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets" / "123-main-st" / "compsheet.csv"
            expected_target_path = expected_path.with_name("target.json")

            self.assertEqual(
                result,
                {
                    "result": {
                        "name": "123-main-st",
                        "path": str(expected_path),
                        "target_path": str(expected_target_path),
                        "target": target_summary,
                    }
                },
            )
            query_mock.assert_called_once_with("123 Main St", "Austin", "tx", "78701", "for_sale")
            extract_mock.assert_called_once_with({"api": "response"})
            self.assertTrue(expected_path.exists())
            with expected_path.open(newline="") as csv_file:
                rows = list(csv.reader(csv_file))
            self.assertEqual(rows, [compsheet.COMPSHEET_HEADER])
            self.assertEqual(json.loads(expected_target_path.read_text()), target_summary)

    def test_compsheet_new_rejects_missing_blank_and_malformed_address_fields(self):
        required_inputs = [
            ({}, "address is required"),
            ({"address": "   ", "city": "Austin", "state": "TX", "zipcode": "78701"}, "address is required"),
            ({"address": 123, "city": "Austin", "state": "TX", "zipcode": "78701"}, "address is required"),
            ({"address": "123 Main St", "state": "TX", "zipcode": "78701"}, "city is required"),
            ({"address": "123 Main St", "city": "Austin", "zipcode": "78701"}, "state is required"),
            ({"address": "123 Main St", "city": "Austin", "state": "TX"}, "zipcode is required"),
        ]

        results = [
            self.run_command(handle_compsheet.handle_compsheet_new_command, json.dumps(tool_input))
            for tool_input, _ in required_inputs
        ]
        malformed_result = self.run_command(handle_compsheet.handle_compsheet_new_command, "not-json")

        self.assertEqual(results, [{"error": expected_error} for _, expected_error in required_inputs])
        self.assertEqual(malformed_result, {"error": "Input must be valid JSON"})

    def test_compsheet_new_existing_file_errors_before_query_without_overwriting(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            compsheet_dir = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets" / "existing-sheet"
            compsheet_dir.mkdir(parents=True)
            existing_path = compsheet_dir / "compsheet.csv"
            existing_path.write_text("do-not-change\n")

            with patch.object(handle_compsheet, "query_realtor_api") as query_mock:
                result = self.run_command(
                    handle_compsheet.handle_compsheet_new_command,
                    json.dumps({"address": "Existing Sheet", "city": "Austin", "state": "TX", "zipcode": "78701"}),
                )

            self.assertEqual(result, {"error": f"Compsheet already exists: {existing_path}"})
            query_mock.assert_not_called()
            self.assertEqual(existing_path.read_text(), "do-not-change\n")

    def test_compsheet_new_lookup_failures_do_not_create_local_files(self):
        failure_cases = [
            (realtor_api.RealtorApiError("Timeout"), "Failed to query realtor.com API: Timeout"),
            (realtor_api.MalformedApiResponseError(), "Malformed API response from realtor.com"),
            (realtor_api.NoPropertyFoundError(), "No property found for the provided address"),
        ]

        for error, expected_message in failure_cases:
            with self.subTest(expected_message=expected_message):
                with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
                    root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
                    with patch.object(handle_compsheet, "query_realtor_api", return_value={}), \
                         patch.object(handle_compsheet, "extract_first_property_summary", side_effect=error):
                        result = self.run_command(
                            handle_compsheet.handle_compsheet_new_command,
                            json.dumps({"address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
                        )

                    self.assertEqual(result, {"error": expected_message})
                    self.assertFalse((root / "123-main-st").exists())

    def test_compsheet_list_returns_empty_list_when_root_is_missing(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            result = self.run_command(handle_compsheet.handle_compsheet_list_command, "{}")

        self.assertEqual(result, {"result": {"names": []}})

    def test_compsheet_list_returns_sorted_names_for_directories_with_csvs(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "zeta" / "compsheet.csv")
            self.write_compsheet(root / "alpha" / "compsheet.csv")
            (root / "missing-csv").mkdir(parents=True)

            result = self.run_command(handle_compsheet.handle_compsheet_list_command, "{}")

        self.assertEqual(result, {"result": {"names": ["alpha", "zeta"]}})

    def test_lookup_operations_require_exact_stored_name_without_normalizing(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "downtown-flip-comps" / "compsheet.csv")

            result = self.run_command(
                handle_compsheet.handle_compsheet_dump_command,
                json.dumps({"name": "Downtown Flip Comps"}),
            )

        self.assertEqual(result, {"error": "Compsheet not found: Downtown Flip Comps"})

    def test_lookup_operations_reject_unsafe_names(self):
        unsafe_inputs = ["../outside", "nested/sheet", "nested\\sheet", ".", ".."]
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            results = [
                self.run_command(handle_compsheet.handle_compsheet_dump_command, json.dumps({"name": unsafe_name}))
                for unsafe_name in unsafe_inputs
            ]

        self.assertEqual(results, [{"error": "Invalid compsheet name"}] * len(unsafe_inputs))

    def test_compsheet_add_validates_required_inputs(self):
        required_inputs = [
            ({"address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}, "name is required"),
            ({"name": "sheet", "city": "Austin", "state": "TX", "zipcode": "78701"}, "address is required"),
            ({"name": "sheet", "address": "123 Main St", "state": "TX", "zipcode": "78701"}, "city is required"),
            ({"name": "sheet", "address": "123 Main St", "city": "Austin", "zipcode": "78701"}, "state is required"),
            ({"name": "sheet", "address": "123 Main St", "city": "Austin", "state": "TX"}, "zipcode is required"),
        ]

        results = [
            self.run_command(handle_compsheet.handle_compsheet_add_command, json.dumps(tool_input))
            for tool_input, _ in required_inputs
        ]

        self.assertEqual(results, [{"error": expected_error} for _, expected_error in required_inputs])

    def test_compsheet_add_queries_sold_mode_and_appends_full_summary(self):
        property_summary = self.sample_property_summary("prop-1")
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            compsheet_path = root / "sheet" / "compsheet.csv"
            self.write_compsheet(compsheet_path)

            with patch.object(handle_compsheet, "query_realtor_api", return_value={"api": "response"}) as query_mock, \
                 patch.object(handle_compsheet, "extract_first_property_summary", return_value=property_summary) as extract_mock:
                result = self.run_command(
                    handle_compsheet.handle_compsheet_add_command,
                    json.dumps(
                        {
                            "name": " sheet ",
                            "address": " 123 Main St ",
                            "city": " Austin ",
                            "state": " tx ",
                            "zipcode": " 78701 ",
                        }
                    ),
                )

            rows = self.read_compsheet_rows(compsheet_path)

        self.assertEqual(result, {"result": {"name": "sheet", "property": property_summary}})
        query_mock.assert_called_once_with("123 Main St", "Austin", "tx", "78701", "sold")
        extract_mock.assert_called_once_with({"api": "response"})
        self.assertEqual(rows, [property_summary])

    def test_compsheet_add_persists_coordinate_columns(self):
        property_summary = self.sample_property_summary("prop-1")
        property_summary["latitude"] = "30.2672"
        property_summary["longitude"] = "-97.7431"
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            compsheet_path = root / "sheet" / "compsheet.csv"
            self.write_compsheet(compsheet_path)

            with patch.object(handle_compsheet, "query_realtor_api", return_value={}), \
                 patch.object(handle_compsheet, "extract_first_property_summary", return_value=property_summary):
                self.run_command(
                    handle_compsheet.handle_compsheet_add_command,
                    json.dumps({"name": "sheet", "address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
                )

            with compsheet_path.open(newline="") as csv_file:
                csv_rows = list(csv.DictReader(csv_file))

        self.assertIn("latitude", compsheet.COMPSHEET_HEADER)
        self.assertIn("longitude", compsheet.COMPSHEET_HEADER)
        self.assertEqual(csv_rows[0]["latitude"], "30.2672")
        self.assertEqual(csv_rows[0]["longitude"], "-97.7431")

    def test_compsheet_new_persists_target_coordinates(self):
        target_summary = self.sample_property_summary("target-1")
        target_summary["latitude"] = 30.2672
        target_summary["longitude"] = -97.7431
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            with patch.object(handle_compsheet, "query_realtor_api", return_value={}), \
                 patch.object(handle_compsheet, "extract_first_property_summary", return_value=target_summary):
                result = self.run_command(
                    handle_compsheet.handle_compsheet_new_command,
                    json.dumps({"address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
                )

            target_path = Path(result["result"]["target_path"])
            stored_target = json.loads(target_path.read_text())

        self.assertEqual(stored_target["latitude"], 30.2672)
        self.assertEqual(stored_target["longitude"], -97.7431)

    def test_compsheet_add_requires_non_empty_property_id(self):
        property_summary = self.sample_property_summary("")
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv")

            with patch.object(handle_compsheet, "query_realtor_api", return_value={}), \
                 patch.object(handle_compsheet, "extract_first_property_summary", return_value=property_summary):
                result = self.run_command(
                    handle_compsheet.handle_compsheet_add_command,
                    json.dumps({"name": "sheet", "address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
                )

        self.assertEqual(result, {"error": "property_id is required"})

    def test_compsheet_add_rejects_duplicate_property_id(self):
        property_summary = self.sample_property_summary("prop-1")
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", [property_summary])

            with patch.object(handle_compsheet, "query_realtor_api", return_value={}), \
                 patch.object(handle_compsheet, "extract_first_property_summary", return_value=property_summary):
                result = self.run_command(
                    handle_compsheet.handle_compsheet_add_command,
                    json.dumps({"name": "sheet", "address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
                )

        self.assertEqual(result, {"error": "Property already exists in compsheet: prop-1"})

    def test_compsheet_dump_returns_default_summary_or_full_rows(self):
        first_property = self.sample_property_summary("prop-1")
        second_property = self.sample_property_summary("prop-2")
        second_property["address"] = "456 Oak Ave"
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", [first_property, second_property])

            default_result = self.run_command(handle_compsheet.handle_compsheet_dump_command, json.dumps({"name": "sheet"}))
            full_result = self.run_command(handle_compsheet.handle_compsheet_dump_command, json.dumps({"name": "sheet", "full": True}))
            invalid_full_result = self.run_command(handle_compsheet.handle_compsheet_dump_command, json.dumps({"name": "sheet", "full": "yes"}))

        self.assertEqual(
            default_result,
            {
                "result": {
                    "name": "sheet",
                    "properties": [
                        {"property_id": "prop-1", "address": first_property["address"]},
                        {"property_id": "prop-2", "address": "456 Oak Ave"},
                    ],
                }
            },
        )
        self.assertEqual(full_result, {"result": {"name": "sheet", "properties": [first_property, second_property]}})
        self.assertEqual(invalid_full_result, {"error": "full must be a boolean"})

    def test_compsheet_report_validates_input_and_surfaces_read_errors(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            invalid_header_path = root / "bad-header" / "compsheet.csv"
            invalid_header_path.parent.mkdir(parents=True)
            invalid_header_path.write_text("bad\n")

            results = [
                self.run_command(handle_compsheet.handle_compsheet_report_command, "{}"),
                self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "   "})),
                self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": 123})),
                self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "unknown"})),
                self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "../outside"})),
                self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "missing"})),
                self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "bad-header"})),
            ]

        self.assertEqual(
            results,
            [
                {"error": "name is required"},
                {"error": "name is required"},
                {"error": "metrics must be a string"},
                {"error": "Unsupported metrics value: unknown"},
                {"error": "Invalid compsheet name"},
                {"error": "Compsheet not found: missing"},
                {"error": f"Compsheet has invalid header: {invalid_header_path}"},
            ],
        )

    def test_compsheet_report_defaults_to_all_metrics(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", [self.report_property("prop-1", "123 Main St", "1000", "200000", "250000")])

            result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet"}))

        self.assertEqual(result["result"]["name"], "sheet")
        self.assertEqual(list(result["result"]["metrics"].keys()), ["sqft", "sale", "list", "price_per_sqft", "map"])

    def test_compsheet_report_calculates_requested_metrics_with_addresses_and_ties(self):
        rows = [
            self.report_property("prop-1", "1 A St", "1000", "200000", "250000"),
            self.report_property("prop-2", "2 B St", "2000", "300000", "350000"),
            self.report_property("prop-3", "3 C St", "1000", "500000", "150000"),
        ]
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", rows)

            sqft_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "sqft"}))
            sale_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "sale"}))
            list_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "list"}))
            price_per_sqft_result = self.run_command(
                handle_compsheet.handle_compsheet_report_command,
                json.dumps({"name": "sheet", "metrics": "price_per_sqft"}),
            )

        self.assertEqual(
            sqft_result["result"]["metrics"],
            {"sqft": {"count": 3, "mean": 1333.33, "min": {"value": 1000, "address": "1 A St"}, "max": {"value": 2000, "address": "2 B St"}, "target": {"value": 1800}}},
        )
        self.assertEqual(
            sale_result["result"]["metrics"],
            {"sale": {"count": 3, "mean": 333333.33, "min": {"value": 200000, "address": "1 A St"}, "max": {"value": 500000, "address": "3 C St"}}},
        )
        self.assertEqual(
            list_result["result"]["metrics"],
            {"list": {"count": 3, "mean": 250000, "min": {"value": 150000, "address": "3 C St"}, "max": {"value": 350000, "address": "2 B St"}, "target": {"value": 400000}}},
        )
        self.assertEqual(
            price_per_sqft_result["result"]["metrics"],
            {"price_per_sqft": {"count": 3, "mean": 283.33, "min": {"value": 150, "address": "2 B St"}, "max": {"value": 500, "address": "3 C St"}, "target": {"value": 222.22}}},
        )

    def test_compsheet_report_ignores_invalid_numeric_values_and_zero_sqft(self):
        rows = [
            self.report_property("prop-1", "1 A St", "1,000", "$200,000", "$250,000"),
            self.report_property("prop-2", "2 B St", "not-a-number", "300000", "also-bad"),
            self.report_property("prop-3", "3 C St", "0", "500000", "150000"),
        ]
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", rows)

            result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "all"}))

        self.assertEqual(result["result"]["metrics"]["sqft"]["count"], 2)
        self.assertEqual(result["result"]["metrics"]["sqft"]["min"], {"value": 0, "address": "3 C St"})
        self.assertEqual(result["result"]["metrics"]["sale"]["count"], 3)
        self.assertEqual(result["result"]["metrics"]["list"]["count"], 2)
        self.assertEqual(
            result["result"]["metrics"]["price_per_sqft"],
            {"count": 1, "mean": 200, "min": {"value": 200, "address": "1 A St"}, "max": {"value": 200, "address": "1 A St"}, "target": {"value": 222.22}},
        )

    def test_compsheet_report_returns_null_stats_for_empty_or_no_valid_values(self):
        rows = [self.report_property("prop-1", "1 A St", "", "not-a-number", "")]
        empty_metric = {"count": 0, "mean": None, "min": None, "max": None}
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "empty" / "compsheet.csv")
            self.write_compsheet(root / "no-valid-values" / "compsheet.csv", rows)

            empty_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "empty", "metrics": "all"}))
            no_valid_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "no-valid-values", "metrics": "price_per_sqft"}))

        self.assertEqual(empty_result["result"]["metrics"]["sqft"], {**empty_metric, "target": {"value": 1800}})
        self.assertEqual(empty_result["result"]["metrics"]["sale"], empty_metric)
        self.assertEqual(empty_result["result"]["metrics"]["list"], {**empty_metric, "target": {"value": 400000}})
        self.assertEqual(empty_result["result"]["metrics"]["price_per_sqft"], {**empty_metric, "target": {"value": 222.22}})
        self.assertEqual(empty_result["result"]["metrics"]["map"]["count"], 0)
        self.assertEqual(empty_result["result"]["metrics"]["map"]["target"], {"plotted": True})
        self.assertEqual(no_valid_result["result"]["metrics"], {"price_per_sqft": {**empty_metric, "target": {"value": 222.22}}})

    def test_compsheet_report_target_values_and_sale_omits_target(self):
        rows = [self.report_property("prop-1", "1 A St", "1000", "200000", "250000")]
        target_summary = {"sqft": "2,000", "list_price": "$500,000", "latitude": "30.2672", "longitude": "-97.7431"}
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", rows, target_summary)

            result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "all"}))

        metrics = result["result"]["metrics"]
        self.assertEqual(metrics["sqft"]["target"], {"value": 2000})
        self.assertEqual(metrics["list"]["target"], {"value": 500000})
        self.assertEqual(metrics["price_per_sqft"]["target"], {"value": 250})
        self.assertNotIn("target", metrics["sale"])

    def test_compsheet_report_returns_null_target_for_invalid_target_values(self):
        rows = [self.report_property("prop-1", "1 A St", "1000", "200000", "250000")]
        target_summary = {"sqft": "0", "list_price": "not-a-number", "latitude": "30.2672", "longitude": "-97.7431"}
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", rows, target_summary)

            result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "all"}))

        metrics = result["result"]["metrics"]
        self.assertEqual(metrics["sqft"]["target"], {"value": 0})
        self.assertIsNone(metrics["list"]["target"])
        self.assertIsNone(metrics["price_per_sqft"]["target"])

    def test_compsheet_report_map_metric_returns_stable_path_and_metadata(self):
        rows = [self.report_property("prop-1", "1 A St", "1000", "200000", "250000")]
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", rows)
            expected_path = root / "sheet" / "report-map.png"
            render_result = compsheet_map.MapRenderResult(expected_path, "fallback", 800, 600, 1, True)

            with patch.object(compsheet_report, "render_compsheet_map", return_value=render_result) as render_mock:
                result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "map"}))

        self.assertEqual(
            result,
            {
                "result": {
                    "name": "sheet",
                    "metrics": {
                        "map": {
                            "path": str(expected_path),
                            "mime_type": "image/png",
                            "width": 800,
                            "height": 600,
                            "count": 1,
                            "target": {"plotted": True},
                            "renderer": "fallback",
                        }
                    },
                }
            },
        )
        render_mock.assert_called_once()

    def test_compsheet_report_all_includes_map_in_deterministic_order(self):
        rows = [self.report_property("prop-1", "1 A St", "1000", "200000", "250000")]
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", rows)
            render_result = compsheet_map.MapRenderResult(root / "sheet" / "report-map.png", "staticmap", 800, 600, 1, True)

            with patch.object(compsheet_report, "render_compsheet_map", return_value=render_result):
                result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "all"}))

        self.assertEqual(list(result["result"]["metrics"].keys()), ["sqft", "sale", "list", "price_per_sqft", "map"])
        self.assertEqual(result["result"]["metrics"]["map"]["renderer"], "staticmap")

    def test_compsheet_report_errors_for_missing_target_coordinates(self):
        rows = [self.report_property("prop-1", "1 A St", "1000", "200000", "250000")]
        target_summary = {"address": "Target", "longitude": "-97.7431"}
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", rows, target_summary)

            result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "map"}))

        self.assertEqual(result, {"error": "Missing target latitude"})

    def test_compsheet_report_errors_for_unparsable_comp_coordinates(self):
        row = self.report_property("prop-1", "1 A St", "1000", "200000", "250000")
        row["longitude"] = "not-a-coordinate"
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            self.write_compsheet(root / "sheet" / "compsheet.csv", [row])

            result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "sheet", "metrics": "map"}))

        self.assertEqual(result, {"error": "Unparsable comp 1 longitude (1 A St): not-a-coordinate"})

    def test_compsheet_map_tile_renderer_uses_downloaded_backdrop(self):
        from PIL import Image

        rows = [self.report_property("prop-1", "1 A St", "1000", "200000", "250000")]
        target_summary = {"address": "Target", "latitude": "30.2672", "longitude": "-97.7431"}
        target_point, comp_points = compsheet_map.build_map_points(target_summary, rows)
        tile_image = Image.new("RGB", (compsheet_map.TILE_SIZE, compsheet_map.TILE_SIZE), "#cbd5e1")

        with patch.object(compsheet_map, "fetch_tile_image", return_value=tile_image) as fetch_mock:
            png_bytes = compsheet_map.render_staticmap_png(target_point, comp_points, 800, 600)

        rendered_image = Image.open(io.BytesIO(png_bytes)).convert("RGB")
        self.assertGreater(fetch_mock.call_count, 0)
        self.assertEqual(rendered_image.getpixel((20, 20)), (203, 213, 225))
        self.assertEqual(rendered_image.getpixel((775, 28)), (255, 255, 255))

    def test_compsheet_map_truncates_long_addresses_for_address_key(self):
        address = "12345 Very Long Street Name That Should Not Consume The Whole Map"

        self.assertEqual(compsheet_map.truncate_address(address, 24), "12345 Very Long Stree...")

    def test_compsheet_map_fallback_creates_png_without_network(self):
        rows = [self.report_property("prop-1", "1 A St", "1000", "200000", "250000")]
        target_summary = {"address": "Target", "latitude": "30.2672", "longitude": "-97.7431"}
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            with patch.object(compsheet_map, "render_staticmap_png", side_effect=RuntimeError("network unavailable")):
                result = compsheet_map.render_compsheet_map(target_summary, rows, "sheet")

            png_bytes = result.path.read_bytes()

        self.assertEqual(result.renderer, "fallback")
        self.assertEqual(result.width, 800)
        self.assertEqual(result.height, 600)
        self.assertEqual(result.comp_count, 1)
        self.assertTrue(result.target_plotted)
        self.assertTrue(png_bytes.startswith(b"\x89PNG\r\n\x1a\n"))

    def test_compsheet_report_errors_for_missing_or_invalid_target_json(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            missing_path = root / "missing-target" / "compsheet.csv"
            invalid_path = root / "invalid-target" / "compsheet.csv"
            object_path = root / "non-object-target" / "compsheet.csv"
            self.write_compsheet(missing_path)
            missing_path.with_name("target.json").unlink()
            self.write_compsheet(invalid_path)
            invalid_path.with_name("target.json").write_text("not-json")
            self.write_compsheet(object_path)
            object_path.with_name("target.json").write_text("[]")

            missing_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "missing-target"}))
            invalid_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "invalid-target"}))
            non_object_result = self.run_command(handle_compsheet.handle_compsheet_report_command, json.dumps({"name": "non-object-target"}))

        self.assertEqual(missing_result, {"error": "Target property not found for compsheet: missing-target"})
        self.assertEqual(invalid_result, {"error": f"Invalid target property file: {invalid_path.with_name('target.json')}"})
        self.assertEqual(non_object_result, {"error": f"Invalid target property file: {object_path.with_name('target.json')}"})

    def test_compsheet_remove_deletes_matching_rows_and_errors_for_missing_id(self):
        first_property = self.sample_property_summary("prop-1")
        second_property = self.sample_property_summary("prop-2")
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            compsheet_path = root / "sheet" / "compsheet.csv"
            self.write_compsheet(compsheet_path, [first_property, second_property])

            result = self.run_command(
                handle_compsheet.handle_compsheet_remove_command,
                json.dumps({"name": "sheet", "property_id": "prop-1"}),
            )
            missing_result = self.run_command(
                handle_compsheet.handle_compsheet_remove_command,
                json.dumps({"name": "sheet", "property_id": "missing"}),
            )
            rows = self.read_compsheet_rows(compsheet_path)

        self.assertEqual(result, {"result": {"name": "sheet", "property_id": "prop-1", "removed": 1}})
        self.assertEqual(missing_result, {"error": "Property not found in compsheet: missing"})
        self.assertEqual(rows, [second_property])

    def test_compsheet_delete_removes_directory_and_errors_for_missing_name(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            root = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets"
            compsheet_directory = root / "sheet"
            self.write_compsheet(compsheet_directory / "compsheet.csv")

            result = self.run_command(handle_compsheet.handle_compsheet_delete_command, json.dumps({"name": "sheet"}))
            is_deleted = not compsheet_directory.exists()
            missing_result = self.run_command(handle_compsheet.handle_compsheet_delete_command, json.dumps({"name": "sheet"}))

        self.assertEqual(result, {"result": {"name": "sheet", "deleted": True}})
        self.assertTrue(is_deleted)
        self.assertEqual(missing_result, {"error": "Compsheet not found: sheet"})

    def test_compsheet_new_cli_argparse_route(self):
        target_summary = self.report_property("target-1", "123 Main St", "1800", "", "400000")
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            output = io.StringIO()
            with patch.object(real_estate.sys, "argv", ["main.py", "compsheet", "new", '{"address":"CLI Sheet","city":"Austin","state":"TX","zipcode":"78701"}']), \
                 patch.object(handle_compsheet, "query_realtor_api", return_value={}), \
                 patch.object(handle_compsheet, "extract_first_property_summary", return_value=target_summary), \
                 redirect_stdout(output):
                real_estate.main()

            result = json.loads(output.getvalue())
            self.assertEqual(result["result"]["name"], "cli-sheet")
            self.assertTrue(Path(result["result"]["path"]).exists())
            self.assertTrue(Path(result["result"]["target_path"]).exists())

    def test_new_compsheet_cli_argparse_routes_call_expected_handlers(self):
        route_cases = [
            ("list", "handle_compsheet_list_command", "{}"),
            ("add", "handle_compsheet_add_command", '{"name":"sheet","address":"123 Main St","city":"Austin","state":"TX","zipcode":"78701"}'),
            ("dump", "handle_compsheet_dump_command", '{"name":"sheet","full":true}'),
            ("report", "handle_compsheet_report_command", '{"name":"sheet","metrics":"all"}'),
            ("remove", "handle_compsheet_remove_command", '{"name":"sheet","property_id":"prop-1"}'),
            ("delete", "handle_compsheet_delete_command", '{"name":"sheet"}'),
        ]

        for subcommand, handler_name, json_input in route_cases:
            with self.subTest(subcommand=subcommand):
                with patch.object(real_estate, handler_name) as handler_mock, \
                     patch.object(real_estate.sys, "argv", ["main.py", "compsheet", subcommand, json_input]):
                    real_estate.main()

                handler_mock.assert_called_once_with(json_input)

    def test_config_declares_new_compsheet_tools_and_commands(self):
        import yaml

        config_path = MODULE_PATH.with_name("config.yml")
        with config_path.open() as config_file:
            config = yaml.safe_load(config_file)

        self.assertEqual(config["module"], "real-estate")
        tools_by_name = {tool["name"]: tool for tool in config["tools"]}
        expected_tools = {
            "compsheet_new": ["compsheet", "new"],
            "compsheet_list": ["compsheet", "list"],
            "compsheet_add": ["compsheet", "add"],
            "compsheet_dump": ["compsheet", "dump"],
            "compsheet_report": ["compsheet", "report"],
            "compsheet_remove": ["compsheet", "remove"],
            "compsheet_delete": ["compsheet", "delete"],
        }
        for tool_name, expected_argv in expected_tools.items():
            with self.subTest(tool_name=tool_name):
                self.assertIn(tool_name, tools_by_name)
                self.assertEqual(tools_by_name[tool_name]["argv"], expected_argv)
                self.assertFalse(tools_by_name[tool_name]["input_schema"].get("additionalProperties", True))

        compsheet_command = next(command for command in config["commands"] if command["name"] == "compsheet")
        subcommands_by_name = {subcommand["name"]: subcommand for subcommand in compsheet_command["subcommands"]}
        new_tool_schema = tools_by_name["compsheet_new"]["input_schema"]
        self.assertEqual(new_tool_schema["required"], ["address", "city", "state", "zipcode"])
        self.assertEqual(set(new_tool_schema["properties"].keys()), {"address", "city", "state", "zipcode"})
        self.assertNotIn("name", new_tool_schema["properties"])

        report_tool_schema = tools_by_name["compsheet_report"]["input_schema"]
        self.assertEqual(report_tool_schema["required"], ["name"])
        self.assertEqual(report_tool_schema["properties"]["metrics"]["enum"], ["all", "sqft", "sale", "list", "price_per_sqft", "map"])

        for subcommand_name in ["new", "list", "add", "dump", "report", "remove", "delete"]:
            with self.subTest(subcommand_name=subcommand_name):
                self.assertIn(subcommand_name, subcommands_by_name)
                self.assertEqual(subcommands_by_name[subcommand_name]["argv"], ["compsheet", subcommand_name])
                self.assertIn("Usage: /compsheet", subcommands_by_name[subcommand_name]["usage"])

        self.assertEqual(
            subcommands_by_name["new"]["usage"],
            'Usage: /compsheet new --address "123 Main St" --city Austin --state TX --zipcode 78701',
        )
        self.assertEqual(
            subcommands_by_name["report"]["usage"],
            'Usage: /compsheet report --name "stored-name" --metrics all',
        )

    def write_compsheet(self, compsheet_path, rows=None, target_summary=None):
        compsheet_path.parent.mkdir(parents=True, exist_ok=True)
        with compsheet_path.open("w", newline="") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=compsheet.COMPSHEET_HEADER, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows or [])
        self.write_target_summary(compsheet_path.with_name("target.json"), target_summary)

    def write_target_summary(self, target_path, target_summary=None):
        target_path.write_text(json.dumps(target_summary or {"sqft": "1800", "list_price": "400000", "latitude": "30.2672", "longitude": "-97.7431"}))

    def read_compsheet_rows(self, compsheet_path):
        with compsheet_path.open(newline="") as csv_file:
            return list(csv.DictReader(csv_file))

    def sample_property_summary(self, property_id):
        property_summary = {field_name: f"{field_name}-value" for field_name in compsheet.COMPSHEET_HEADER}
        property_summary["property_id"] = property_id
        property_summary["address"] = "123 Main St"
        property_summary["latitude"] = "30.2672"
        property_summary["longitude"] = "-97.7431"
        return property_summary

    def report_property(self, property_id, address, sqft, sold_price, list_price):
        property_summary = self.sample_property_summary(property_id)
        property_summary["address"] = address
        property_summary["sqft"] = sqft
        property_summary["sold_price"] = sold_price
        property_summary["list_price"] = list_price
        return property_summary


if __name__ == "__main__":
    unittest.main()
