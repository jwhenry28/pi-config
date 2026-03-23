import { describe, it, expect, afterEach } from "vitest";
import { runDeploy, getStackName, pollStack, handleDeploySamApplication } from "../commands/deploy-sam-application.js";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";

const tempDirs: string[] = [];

function makeTempDir(): string {
	const dir = mkdtempSync(join(tmpdir(), "deploy-sam-test-"));
	tempDirs.push(dir);
	return dir;
}

afterEach(() => {
	for (const dir of tempDirs) {
		rmSync(dir, { recursive: true, force: true });
	}
	tempDirs.length = 0;
});

describe("runDeploy", () => {
	it("streams stdout lines to notify and returns exit code 0", async () => {
		const messages: string[] = [];
		const notify = (msg: string) => messages.push(msg);
		const dir = makeTempDir();

		const exitCode = await runDeploy('echo "line1" && echo "line2"', dir, notify);

		expect(exitCode).toBe(0);
		expect(messages).toContain("[deploy] line1");
		expect(messages).toContain("[deploy] line2");
	});

	it("returns non-zero exit code on failure", async () => {
		const messages: string[] = [];
		const notify = (msg: string) => messages.push(msg);
		const dir = makeTempDir();

		const exitCode = await runDeploy("exit 42", dir, notify);

		expect(exitCode).toBe(42);
	});

	it("streams stderr lines to notify", async () => {
		const messages: string[] = [];
		const notify = (msg: string) => messages.push(msg);
		const dir = makeTempDir();

		const exitCode = await runDeploy('echo "err-output" >&2', dir, notify);

		expect(exitCode).toBe(0);
		expect(messages).toContain("[deploy] err-output");
	});
});

describe("getStackName", () => {
	it("returns trimmed output of the command", () => {
		const dir = makeTempDir();
		const name = getStackName('echo "  my-stack  "', dir);
		expect(name).toBe("my-stack");
	});

	it("throws when command returns empty output", () => {
		const dir = makeTempDir();
		expect(() => getStackName('echo ""', dir)).toThrow("Stack name command returned empty output");
	});

	it("throws when command fails", () => {
		const dir = makeTempDir();
		expect(() => getStackName("exit 1", dir)).toThrow();
	});
});

describe("pollStack", () => {
	it("returns immediately when stack is already in a terminal state", async () => {
		const messages: Array<{ msg: string; type?: string }> = [];
		const notify = (msg: string, type?: "info" | "warning" | "error") => messages.push({ msg, type });

		const execFn = () => JSON.stringify({ Stacks: [{ StackStatus: "CREATE_COMPLETE" }] });

		const result = await pollStack("my-stack", notify, execFn, 0);

		expect(result).toBe("CREATE_COMPLETE");
		expect(messages.some((m) => m.msg.includes("CREATE_COMPLETE") && m.msg.includes("✓"))).toBe(true);
	});

	it("polls until a terminal state is reached", async () => {
		const messages: Array<{ msg: string; type?: string }> = [];
		const notify = (msg: string, type?: "info" | "warning" | "error") => messages.push({ msg, type });

		let callCount = 0;
		const execFn = () => {
			callCount++;
			if (callCount < 3) {
				return JSON.stringify({ Stacks: [{ StackStatus: "UPDATE_IN_PROGRESS" }] });
			}
			return JSON.stringify({ Stacks: [{ StackStatus: "UPDATE_COMPLETE" }] });
		};

		const result = await pollStack("test-stack", notify, execFn, 0);

		expect(result).toBe("UPDATE_COMPLETE");
		expect(callCount).toBe(3);
		expect(messages.some((m) => m.msg.includes("UPDATE_IN_PROGRESS"))).toBe(true);
		expect(messages.some((m) => m.msg.includes("UPDATE_COMPLETE") && m.msg.includes("✓"))).toBe(true);
	});

	it("marks failure states with ✗", async () => {
		const messages: Array<{ msg: string; type?: string }> = [];
		const notify = (msg: string, type?: "info" | "warning" | "error") => messages.push({ msg, type });

		const execFn = () => JSON.stringify({ Stacks: [{ StackStatus: "UPDATE_FAILED" }] });

		const result = await pollStack("fail-stack", notify, execFn, 0);

		expect(result).toBe("UPDATE_FAILED");
		expect(messages.some((m) => m.msg.includes("UPDATE_FAILED") && m.msg.includes("✗"))).toBe(true);
	});

	it("handles query errors gracefully and retries", async () => {
		const messages: Array<{ msg: string; type?: string }> = [];
		const notify = (msg: string, type?: "info" | "warning" | "error") => messages.push({ msg, type });

		let callCount = 0;
		const execFn = () => {
			callCount++;
			if (callCount === 1) throw new Error("network error");
			return JSON.stringify({ Stacks: [{ StackStatus: "CREATE_COMPLETE" }] });
		};

		const result = await pollStack("err-stack", notify, execFn, 0);

		expect(result).toBe("CREATE_COMPLETE");
		expect(messages.some((m) => m.msg.includes("failed to query") && m.type === "warning")).toBe(true);
	});
});

describe("handleDeploySamApplication", () => {
	it("throws when deployCommand is missing", async () => {
		const ctx = { cwd: makeTempDir(), workflowId: "test-wf" };
		await expect(
			handleDeploySamApplication(ctx, { stackNameCommand: "echo stack" }),
		).rejects.toThrow("requires 'deployCommand' and 'stackNameCommand'");
	});

	it("throws when stackNameCommand is missing", async () => {
		const ctx = { cwd: makeTempDir(), workflowId: "test-wf" };
		await expect(
			handleDeploySamApplication(ctx, { deployCommand: "echo hi" }),
		).rejects.toThrow("requires 'deployCommand' and 'stackNameCommand'");
	});

	it("works without ui (ui is optional)", async () => {
		const ctx = { cwd: makeTempDir(), workflowId: "test-wf" };
		await expect(
			handleDeploySamApplication(ctx, {
				deployCommand: "echo deploying",
				stackNameCommand: "echo ''",
			}),
		).rejects.toThrow("Failed to get stack name");
	});
});
