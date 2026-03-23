import { describe, it, expect, afterEach } from "vitest";
import { checkIfSamUnhealthy } from "../commands/check-if-sam-unhealthy.js";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "check-sam-test-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

function mockDescribeStacks(status: string) {
	return (_stackName: string) =>
		JSON.stringify({ Stacks: [{ StackStatus: status }] });
}

function mockDescribeStacksThrows() {
	return (_stackName: string): string => {
		throw new Error("Stack not found");
	};
}

describe("checkIfSamUnhealthy", () => {
	describe("stack name resolution", () => {
		it("returns unhealthy when stack name command returns empty output", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo ''", mockDescribeStacks("CREATE_COMPLETE"));

			expect(result.result).toBe("true");
			expect(result.explanation).toContain("Failed to determine stack name");
		});

		it("returns unhealthy when stack name command fails", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "exit 1", mockDescribeStacks("CREATE_COMPLETE"));

			expect(result.result).toBe("true");
			expect(result.explanation).toContain("Failed to determine stack name");
		});
	});

	describe("describe-stacks failures", () => {
		it("returns unhealthy when describe-stacks throws (stack not found)", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacksThrows());

			expect(result.result).toBe("true");
			expect(result.explanation).toContain("my-stack");
			expect(result.explanation).toContain("not found");
		});
	});

	describe("healthy states", () => {
		it("returns healthy for CREATE_COMPLETE", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacks("CREATE_COMPLETE"));

			expect(result.result).toBe("false");
			expect(result.explanation).toContain("my-stack");
			expect(result.explanation).toContain("CREATE_COMPLETE");
		});

		it("returns healthy for UPDATE_COMPLETE", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacks("UPDATE_COMPLETE"));

			expect(result.result).toBe("false");
			expect(result.explanation).toContain("UPDATE_COMPLETE");
		});

		it("returns healthy for IMPORT_COMPLETE", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacks("IMPORT_COMPLETE"));

			expect(result.result).toBe("false");
			expect(result.explanation).toContain("IMPORT_COMPLETE");
		});
	});

	describe("unhealthy states", () => {
		it("returns unhealthy for UPDATE_FAILED", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacks("UPDATE_FAILED"));

			expect(result.result).toBe("true");
			expect(result.explanation).toContain("my-stack");
			expect(result.explanation).toContain("UPDATE_FAILED");
		});

		it("returns unhealthy for ROLLBACK_COMPLETE", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacks("ROLLBACK_COMPLETE"));

			expect(result.result).toBe("true");
			expect(result.explanation).toContain("ROLLBACK_COMPLETE");
		});

		it("returns unhealthy for UPDATE_ROLLBACK_COMPLETE", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacks("UPDATE_ROLLBACK_COMPLETE"));

			expect(result.result).toBe("true");
			expect(result.explanation).toContain("UPDATE_ROLLBACK_COMPLETE");
		});

		it("returns unhealthy for UPDATE_IN_PROGRESS", () => {
			const dir = makeTempDir();
			const result = checkIfSamUnhealthy(dir, "echo my-stack", mockDescribeStacks("UPDATE_IN_PROGRESS"));

			expect(result.result).toBe("true");
			expect(result.explanation).toContain("UPDATE_IN_PROGRESS");
		});
	});

	describe("edge cases", () => {
		it("passes the correct stack name to execFn", () => {
			const dir = makeTempDir();
			let capturedName = "";
			const execFn = (name: string) => {
				capturedName = name;
				return JSON.stringify({ Stacks: [{ StackStatus: "CREATE_COMPLETE" }] });
			};

			checkIfSamUnhealthy(dir, "echo my-cool-stack", execFn);
			expect(capturedName).toBe("my-cool-stack");
		});
	});
});
