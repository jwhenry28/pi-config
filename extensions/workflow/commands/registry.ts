// Command registry for code-only workflow steps and conditions.

import type { ExtensionContext } from "@mariozechner/pi-coding-agent";

export interface CommandContext {
	cwd: string;
	workflowId: string;
	ctx: ExtensionContext;
}

export type ConditionCommandFn = (
	ctx: CommandContext,
	args?: Record<string, string>,
) => Promise<void>;

export type StepCommandFn = (
	ctx: CommandContext,
	args?: Record<string, string>,
) => Promise<void>;

const conditionCommands = new Map<string, ConditionCommandFn>();
const stepCommands = new Map<string, StepCommandFn>();

export function registerConditionCommand(name: string, fn: ConditionCommandFn): void {
	conditionCommands.set(name, fn);
}

export function registerStepCommand(name: string, fn: StepCommandFn): void {
	stepCommands.set(name, fn);
}

export function getConditionCommand(name: string): ConditionCommandFn | undefined {
	return conditionCommands.get(name);
}

export function getStepCommand(name: string): StepCommandFn | undefined {
	return stepCommands.get(name);
}

export function hasCommand(name: string): boolean {
	return conditionCommands.has(name) || stepCommands.has(name);
}
