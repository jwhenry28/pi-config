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

    def test_query_realtor_api_wraps_network_errors(self):
        with patch.object(realtor_api.requests, "post", side_effect=realtor_api.requests.Timeout):
            with self.assertRaises(realtor_api.RealtorApiError):
                realtor_api.query_realtor_api("123 Main St", "Austin", "TX", "78701", "sold")

    def test_query_command_prints_realtor_api_errors(self):
        with patch.object(handle_query, "query_realtor_api", side_effect=realtor_api.RealtorApiError):
            result = self.run_command(
                handle_query.handle_query_command,
                json.dumps({"address": "123 Main St", "city": "Austin", "state": "TX", "zipcode": "78701"}),
            )

        self.assertEqual(result, {"error": "Failed to query realtor.com API"})

    def test_compsheet_new_normalizes_creates_directory_and_writes_header(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            result = self.run_command(
                handle_compsheet.handle_compsheet_new_command,
                json.dumps({"name": "  Downtown   Flip Comps  "}),
            )

            expected_path = (
                Path(home_dir)
                / ".pi"
                / "rosetta"
                / "real_estate"
                / "compsheets"
                / "downtown-flip-comps"
                / "compsheet.csv"
            )
            self.assertEqual(result, {"result": {"name": "downtown-flip-comps", "path": str(expected_path)}})
            self.assertTrue(expected_path.exists())
            with expected_path.open(newline="") as csv_file:
                rows = list(csv.reader(csv_file))
            self.assertEqual(rows, [compsheet.COMPSHEET_HEADER])

    def test_compsheet_new_rejects_missing_blank_and_malformed_names(self):
        missing_result = self.run_command(handle_compsheet.handle_compsheet_new_command, "{}")
        blank_result = self.run_command(handle_compsheet.handle_compsheet_new_command, json.dumps({"name": "   "}))
        non_string_result = self.run_command(handle_compsheet.handle_compsheet_new_command, json.dumps({"name": 123}))
        malformed_result = self.run_command(handle_compsheet.handle_compsheet_new_command, "not-json")

        self.assertEqual(missing_result, {"error": "name is required"})
        self.assertEqual(blank_result, {"error": "name is required"})
        self.assertEqual(non_string_result, {"error": "name is required"})
        self.assertEqual(malformed_result, {"error": "Input must be valid JSON"})

    def test_compsheet_new_existing_file_errors_without_overwriting(self):
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            compsheet_dir = Path(home_dir) / ".pi" / "rosetta" / "real_estate" / "compsheets" / "existing-sheet"
            compsheet_dir.mkdir(parents=True)
            existing_path = compsheet_dir / "compsheet.csv"
            existing_path.write_text("do-not-change\n")

            result = self.run_command(
                handle_compsheet.handle_compsheet_new_command,
                json.dumps({"name": "Existing Sheet"}),
            )

            self.assertEqual(result, {"error": f"Compsheet already exists: {existing_path}"})
            self.assertEqual(existing_path.read_text(), "do-not-change\n")

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
        with tempfile.TemporaryDirectory() as home_dir, patch.dict(os.environ, {"HOME": home_dir}):
            output = io.StringIO()
            with patch.object(real_estate.sys, "argv", ["main.py", "compsheet", "new", '{"name":"CLI Sheet"}']), \
                 redirect_stdout(output):
                real_estate.main()

            result = json.loads(output.getvalue())
            self.assertEqual(result["result"]["name"], "cli-sheet")
            self.assertTrue(Path(result["result"]["path"]).exists())

    def test_new_compsheet_cli_argparse_routes_call_expected_handlers(self):
        route_cases = [
            ("list", "handle_compsheet_list_command", "{}"),
            ("add", "handle_compsheet_add_command", '{"name":"sheet","address":"123 Main St","city":"Austin","state":"TX","zipcode":"78701"}'),
            ("dump", "handle_compsheet_dump_command", '{"name":"sheet","full":true}'),
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

        tools_by_name = {tool["name"]: tool for tool in config["tools"]}
        expected_tools = {
            "compsheet_list": ["compsheet", "list"],
            "compsheet_add": ["compsheet", "add"],
            "compsheet_dump": ["compsheet", "dump"],
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
        for subcommand_name in ["list", "add", "dump", "remove", "delete"]:
            with self.subTest(subcommand_name=subcommand_name):
                self.assertIn(subcommand_name, subcommands_by_name)
                self.assertEqual(subcommands_by_name[subcommand_name]["argv"], ["compsheet", subcommand_name])
                self.assertIn("Usage: /compsheet", subcommands_by_name[subcommand_name]["usage"])

    def write_compsheet(self, compsheet_path, rows=None):
        compsheet_path.parent.mkdir(parents=True, exist_ok=True)
        with compsheet_path.open("w", newline="") as csv_file:
            writer = csv.DictWriter(csv_file, fieldnames=compsheet.COMPSHEET_HEADER, lineterminator="\n")
            writer.writeheader()
            writer.writerows(rows or [])

    def read_compsheet_rows(self, compsheet_path):
        with compsheet_path.open(newline="") as csv_file:
            return list(csv.DictReader(csv_file))

    def sample_property_summary(self, property_id):
        property_summary = {field_name: f"{field_name}-value" for field_name in compsheet.COMPSHEET_HEADER}
        property_summary["property_id"] = property_id
        property_summary["address"] = "123 Main St"
        return property_summary


if __name__ == "__main__":
    unittest.main()
