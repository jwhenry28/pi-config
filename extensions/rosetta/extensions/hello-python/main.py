#!/usr/bin/env python3
import json
import sys


def main() -> None:
    raw = sys.argv[1] if len(sys.argv) > 1 else "{}"

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        print(json.dumps({"error": "Input must be valid JSON"}))
        return

    name = data.get("name")
    if isinstance(name, str) and name:
        print(json.dumps({"result": f"Hello from Python, {name}!"}))
        return

    print(json.dumps({"result": "Hello from Python!"}))


if __name__ == "__main__":
    main()
