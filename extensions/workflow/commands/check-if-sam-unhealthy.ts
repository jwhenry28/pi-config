import { execSync, execFileSync } from "node:child_process";
import { registerConditionCommand } from "./registry.js";
import { writeKey } from "../../memory/store.js";
import { SUCCESS_STATES } from "./deploy-sam-application.js";

export type ExecFn = (stackName: string) => string;

function defaultDescribeStacks(stackName: string): string {
	return execFileSync("aws", [
		"cloudformation", "describe-stacks",
		"--stack-name", stackName,
		"--output", "json",
	], { encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
}

export function checkIfSamUnhealthy(
	cwd: string,
	stackNameCommand: string,
	execFn: ExecFn = defaultDescribeStacks,
): { result: string; explanation: string } {
	// Step 1: Get the stack name
	let stackName: string;
	try {
		const output = execSync(stackNameCommand, { cwd, encoding: "utf-8", stdio: ["ignore", "pipe", "pipe"] });
		stackName = output.trim();
		if (!stackName) {
			return { result: "true", explanation: "Failed to determine stack name: command returned empty output" };
		}
	} catch {
		return { result: "true", explanation: "Failed to determine stack name: command failed" };
	}

	// Step 2: Describe the stack
	let status: string;
	try {
		const output = execFn(stackName);
		const parsed = JSON.parse(output);
		status = parsed.Stacks?.[0]?.StackStatus;
		if (!status) {
			return { result: "true", explanation: `Stack ${stackName} returned no status` };
		}
	} catch {
		return { result: "true", explanation: `Stack ${stackName} not found` };
	}

	// Step 3: Classify
	if (SUCCESS_STATES.has(status)) {
		return { result: "false", explanation: `Stack ${stackName} is in state ${status}` };
	}

	return { result: "true", explanation: `Stack ${stackName} is in state ${status}` };
}

registerConditionCommand("check-if-sam-unhealthy", async (ctx, args) => {
	const stackNameCommand = args?.stackNameCommand;
	if (!stackNameCommand) {
		throw new Error("check-if-sam-unhealthy requires 'stackNameCommand' arg");
	}

	const { result, explanation } = checkIfSamUnhealthy(
		ctx.cwd,
		stackNameCommand,
	);

	const notify = ctx.ui?.notify ?? (() => {});
	const marker = result === "true" ? "✗" : "✓";
	notify(`[check-if-sam-unhealthy] ${explanation} ${marker}`, result === "true" ? "warning" : "info");

	writeKey(ctx.cwd, ctx.workflowId, "workflow-condition-result",
		JSON.stringify({ result, explanation }));
});
