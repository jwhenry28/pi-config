import { beforeEach, describe, expect, it, vi } from "vitest";

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

import { executePythonTool, parsePythonToolOutput } from "../runtime.js";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executePythonTool", () => {
  it("passes empty input as an empty JSON object string", async () => {
    execFileMock.mockImplementation((_cmd, _args, callback) => {
      callback(null, { stdout: '{"result":"Hello from Python!"}', stderr: "" });
    });

    const result = await executePythonTool("/tmp/main.py", undefined);

    expect(result).toBe("Hello from Python!");
    expect(execFileMock.mock.calls[0][0]).toBe("python3");
    expect(execFileMock.mock.calls[0][1]).toEqual(["/tmp/main.py", "{}"]);
  });

  it("serializes named input as one JSON argument", async () => {
    execFileMock.mockImplementation((_cmd, _args, callback) => {
      callback(null, { stdout: '{"result":"Hello from Python, Joseph!"}', stderr: "" });
    });

    const result = await executePythonTool("/tmp/main.py", { name: "Joseph" });

    expect(result).toBe("Hello from Python, Joseph!");
    expect(execFileMock.mock.calls[0][1]).toEqual(["/tmp/main.py", '{"name":"Joseph"}']);
  });

  it("inserts configured argv before the serialized JSON argument", async () => {
    execFileMock.mockImplementation((_cmd, _args, callback) => {
      callback(null, { stdout: '{"result":"created"}', stderr: "" });
    });

    const result = await executePythonTool("/tmp/main.py", { name: "My Sheet" }, ["compsheet", "new"]);

    expect(result).toBe("created");
    expect(execFileMock.mock.calls[0][1]).toEqual(["/tmp/main.py", "compsheet", "new", '{"name":"My Sheet"}']);
  });

  it("includes exit code, message, stderr, and stdout for non-zero exits", async () => {
    execFileMock.mockImplementation((_cmd, _args, callback) => {
      const error: any = new Error("failed");
      error.code = 2;
      error.stderr = "traceback here";
      error.stdout = "partial stdout";
      callback(error, { stdout: "partial stdout", stderr: "traceback here" });
    });

    await expect(executePythonTool("/tmp/main.py", {})).rejects.toThrow(
      "Rosetta Python tool failed with exit code 2. message: failed stderr: traceback here stdout: partial stdout",
    );
  });

  it("does not wrap Python JSON error output as an unknown process exit", async () => {
    execFileMock.mockImplementation((_cmd, _args, callback) => {
      callback(null, { stdout: '{"error":"address not found"}', stderr: "" });
    });

    await expect(executePythonTool("/tmp/main.py", {})).rejects.toThrow(
      "Rosetta Python tool error: address not found",
    );
  });

  it("can return Python JSON errors as tool output", async () => {
    execFileMock.mockImplementation((_cmd, _args, callback) => {
      callback(null, { stdout: '{"error":"address not found"}', stderr: "" });
    });

    const result = await executePythonTool("/tmp/main.py", {}, [], { throwOnJsonError: false });

    expect(result).toBe('{"error":"address not found"}');
  });
});

describe("parsePythonToolOutput", () => {
  it("throws useful errors for python-level failures", () => {
    expect(() => parsePythonToolOutput('{"error":"descriptive error"}')).toThrow(
      "Rosetta Python tool error: descriptive error",
    );
  });

  it("returns JSON errors when throwing is disabled", () => {
    expect(parsePythonToolOutput('{"error":"descriptive error"}', undefined, { throwOnJsonError: false })).toBe(
      '{"error":"descriptive error"}',
    );
  });

  it("fails clearly for invalid JSON", () => {
    expect(() => parsePythonToolOutput("not-json", "stderr text")).toThrow(
      "Rosetta Python tool returned invalid JSON. stderr: stderr text",
    );
  });

  it("fails clearly when result and error are both missing", () => {
    expect(() => parsePythonToolOutput('{"ok":true}')).toThrow(
      'Rosetta Python tool output must contain either "result" or "error"',
    );
  });
});
