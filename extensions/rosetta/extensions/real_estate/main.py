#!/usr/bin/env python3
import argparse
import sys

from handlers.compsheet import (
    handle_compsheet_add_command,
    handle_compsheet_delete_command,
    handle_compsheet_dump_command,
    handle_compsheet_list_command,
    handle_compsheet_new_command,
    handle_compsheet_offer_command,
    handle_compsheet_remove_command,
    handle_compsheet_report_command,
)
from handlers.query import handle_query_command
from utils.parsing import print_error


def main() -> None:
    parser = build_argument_parser()
    try:
        args = parser.parse_args(sys.argv[1:])
    except SystemExit:
        print_error("Invalid command arguments")
        return

    handler = getattr(args, "handler", None)
    if handler is None:
        print_error("Invalid command arguments")
        return

    handler(args.json_input)


def build_argument_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Real estate Rosetta extension")
    subparsers = parser.add_subparsers(dest="command")

    query_parser = subparsers.add_parser("query", help="Query realtor.com property details")
    query_parser.add_argument("json_input")
    query_parser.set_defaults(handler=handle_query_command)

    compsheet_parser = subparsers.add_parser("compsheet", help="Manage compsheets")
    compsheet_subparsers = compsheet_parser.add_subparsers(dest="compsheet_command")
    add_compsheet_subcommands(compsheet_subparsers)

    return parser


def add_compsheet_subcommands(compsheet_subparsers: argparse._SubParsersAction) -> None:
    add_json_subcommand(compsheet_subparsers, "new", "Create a compsheet", handle_compsheet_new_command)
    add_json_subcommand(compsheet_subparsers, "list", "List compsheets", handle_compsheet_list_command)
    add_json_subcommand(compsheet_subparsers, "add", "Add a sold property to a compsheet", handle_compsheet_add_command)
    add_json_subcommand(compsheet_subparsers, "dump", "Dump compsheet rows", handle_compsheet_dump_command)
    add_json_subcommand(compsheet_subparsers, "report", "Report summary metrics for a compsheet", handle_compsheet_report_command)
    add_json_subcommand(compsheet_subparsers, "offer", "Update or inspect offer details for a compsheet", handle_compsheet_offer_command)
    add_json_subcommand(compsheet_subparsers, "remove", "Remove a property from a compsheet", handle_compsheet_remove_command)
    add_json_subcommand(compsheet_subparsers, "delete", "Delete a compsheet", handle_compsheet_delete_command)


def add_json_subcommand(
    subparsers: argparse._SubParsersAction,
    name: str,
    help_text: str,
    handler,
) -> None:
    subcommand_parser = subparsers.add_parser(name, help=help_text)
    subcommand_parser.add_argument("json_input")
    subcommand_parser.set_defaults(handler=handler)


if __name__ == "__main__":
    main()
