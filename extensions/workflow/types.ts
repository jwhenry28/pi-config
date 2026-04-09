import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";

// --- Conditions ---

export interface PromptCondition {
	prompt: string;
	model: string;
	jump: string;
}

export interface CommandCondition {
	command: string;
	args?: Record<string, string>;
	jump: string;
}

export type StepCondition = PromptCondition | CommandCondition;

// --- Steps ---

export interface PromptStep {
	name: string;
	model: string;
	prompt: string;
	skills?: string[];
	modules?: string[];
	approval?: boolean;
	maxExecutions: number;
	conditions?: StepCondition[];
}

export interface CommandStep {
	name: string;
	command: string;
	args?: Record<string, string>;
	maxExecutions: number;
	conditions?: StepCondition[];
}

export type WorkflowStep = PromptStep | CommandStep;

// --- Type guards ---

export function isPromptCondition(c: StepCondition): c is PromptCondition {
	return "prompt" in c;
}

export function isCommandCondition(c: StepCondition): c is CommandCondition {
	return "command" in c;
}

export function isPromptStep(s: WorkflowStep): s is PromptStep {
	return "prompt" in s;
}

export function isCommandStep(s: WorkflowStep): s is CommandStep {
	return "command" in s && !("prompt" in s);
}

// --- Workflow config ---

export interface WorkflowConfig {
	name: string;
	modules?: string[];
	steps: WorkflowStep[];
}

export interface ActiveWorkflow {
	id: string;
	config: WorkflowConfig;
	userPrompt: string;
	currentStepIndex: number;
	executionCounts: Record<string, number>;
}

export interface WorkflowState {
	active: ActiveWorkflow | null;
	allSkills: Skill[];
	cwd: string;
	advancing: boolean;
	savedCommandCtx: ExtensionCommandContext | null;
	originalModelId: string | null;
	originalModules: string[] | null;
	pendingConditionIndex: number | null;
	errorPaused: boolean;
}
