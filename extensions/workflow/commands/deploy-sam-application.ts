import { spawn, execSync, execFileSync } from "node:child_process";
import { registerStepCommand } from "./registry.js";
import type { CommandContext } from "./registry.js";

const POLL_INTERVAL_MS = 10_000;

const TERMINAL_STATES = new Set([
	"CREATE_COMPLETE",
	"CREATE_FAILED",
	"UPDATE_COMPLETE",
	"UPDATE_FAILED",
	"DELETE_COMPLETE",
	"DELETE_FAILED",
	"ROLLBACK_COMPLETE",
	"ROLLBACK_FAILED",
	"UPDATE_ROLLBACK_COMPLETE",
	"UPDATE_ROLLBACK_FAILED",
	"IMPORT_COMPLETE",
	"IMPORT_ROLLBACK_COMPLETE",
	"IMPORT_ROLLBACK_FAILED",
]);

export const SUCCESS_STATES = new Set([
	"CREATE_COMPLETE",
	"UPDATE_COMPLETE",
	"IMPORT_COMPLETE",
]);

export async function handleDeploySamApplication(
	ctx: CommandContext,
	args?: Record<string, string>,
): Promise<void> {
	const deployCommand = args?.deployCommand;
	const stackNameCommand = args?.stackNameCommand;

	if (!deployCommand || !stackNameCommand) {
		throw new Error("deploy-sam-application requires 'deployCommand' and 'stackNameCommand' args");
	}

	const notify = ctx.ui?.notify ?? (() => {});

	// Phase 1: Deploy
	notify("[deploy] Starting deployment...");
	const exitCode = await runDeploy(deployCommand, ctx.cwd, notify);
	if (exitCode !== 0) {
		notify(`[deploy] Command exited with code ${exitCode}`, "warning");
	} else {
		notify("[deploy] Command completed successfully");
	}

	// Phase 2: Get stack name and monitor
	let stackName: string;
	try {
		stackName = getStackName(stackNameCommand, ctx.cwd);
	} catch (err) {
		throw new Error(`Failed to get stack name: ${(err as Error).message}`);
	}

	notify(`☁️ Monitoring stack: ${stackName}`);
	await pollStack(stackName, notify);
}

registerStepCommand("deploy-sam-application", handleDeploySamApplication);

export function runDeploy(
	command: string,
	cwd: string,
	notify: (msg: string, type?: "info" | "warning" | "error") => void,
): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, { shell: true, cwd, stdio: ["ignore", "pipe", "pipe"] });

		const handleData = (data: Buffer) => {
			const lines = data.toString().split("\n");
			for (const line of lines) {
				const trimmed = line.trimEnd();
				if (trimmed) notify(`[deploy] ${trimmed}`);
			}
		};

		child.stdout.on("data", handleData);
		child.stderr.on("data", handleData);

		child.on("error", (err) => reject(err));
		child.on("close", (code) => resolve(code ?? 1));
	});
}

export function getStackName(command: string, cwd: string): string {
	const output = execSync(command, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
	const name = output.trim();
	if (!name) {
		throw new Error("Stack name command returned empty output");
	}
	return name;
}

export async function pollStack(
	stackName: string,
	notify: (msg: string, type?: "info" | "warning" | "error") => void,
	execFn: (stackName: string) => string = defaultDescribeStacks,
	pollIntervalMs: number = POLL_INTERVAL_MS,
): Promise<string> {
	let lastStatus = "";

	while (true) {
		let status: string;
		try {
			const output = execFn(stackName);
			const parsed = JSON.parse(output);
			status = parsed.Stacks?.[0]?.StackStatus ?? "UNKNOWN";
		} catch {
			notify(`☁️ ${stackName}: failed to query stack status`, "warning");
			await sleep(pollIntervalMs);
			continue;
		}

		if (status !== lastStatus) {
			lastStatus = status;
			if (TERMINAL_STATES.has(status)) {
				const marker = SUCCESS_STATES.has(status) ? "✓" : "✗";
				notify(`☁️ ${stackName}: ${status} ${marker}`);
				return status;
			}
			notify(`☁️ ${stackName}: ${status}`);
		}

		await sleep(pollIntervalMs);
	}
}

function defaultDescribeStacks(stackName: string): string {
	return execFileSync("aws", [
		"cloudformation", "describe-stacks",
		"--stack-name", stackName,
		"--output", "json",
	], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
