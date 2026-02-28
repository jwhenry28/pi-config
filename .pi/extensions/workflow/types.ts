import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { Skill } from "@mariozechner/pi-coding-agent";

export interface StepCondition {
	prompt: string;
	model: string;
	jump: string;
}

export interface WorkflowStep {
	name: string;
	model: string;
	prompt: string;
	skills?: string[];
	approval?: boolean;
	conditions?: StepCondition[];
}

export interface WorkflowConfig {
	name: string;
	steps: WorkflowStep[];
}

export interface ActiveWorkflow {
	id: string;
	config: WorkflowConfig;
	userPrompt: string;
	currentStepIndex: number;
}

export interface WorkflowState {
	active: ActiveWorkflow | null;
	allSkills: Skill[];
	cwd: string;
	advancing: boolean;
	savedCommandCtx: ExtensionCommandContext | null;
	originalModelId: string | null;
}
