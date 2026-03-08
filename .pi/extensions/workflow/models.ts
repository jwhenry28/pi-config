import { readKey } from "../memory/store.js";

// Domain for workflow model overrides
const WORKFLOW_MODELS_DOMAIN = "pi-config";

// Default model mappings for general aliases
const DEFAULT_MODELS: Record<string, string> = {
	smart: "claude-opus-4-6",
	general: "claude-sonnet-4-6",
	fast: "claude-haiku-4-5",
};

/**
 * Parsed model reference that may include a provider prefix
 */
export interface ParsedModelRef {
	/** The provider ID (if specified with provider/model format) */
	provider?: string;
	/** The model ID */
	modelId: string;
}

/**
 * Check if a model identifier is a general alias (smart, general, fast)
 */
export function isModelAlias(model: string): boolean {
	return model in DEFAULT_MODELS;
}

/**
 * Parse a model reference that may be in "provider/model-id" format.
 * Returns { provider, modelId } where provider is undefined if not specified.
 */
export function parseModelRef(modelRef: string): ParsedModelRef {
	const slashIndex = modelRef.indexOf("/");
	if (slashIndex > 0) {
		return {
			provider: modelRef.slice(0, slashIndex),
			modelId: modelRef.slice(slashIndex + 1),
		};
	}
	return { modelId: modelRef };
}

/**
 * Resolve a model identifier to its actual model ID.
 * - If it's a general alias (smart, general, fast), check memory store for override,
 *   otherwise use default mapping
 * - If it's not an alias, return as-is
 * 
 * Supports "provider/model-id" format in the memory store override.
 */
export function resolveModelAlias(model: string, cwd: string): string {
	if (!isModelAlias(model)) {
		return model;
	}

	// Check memory store for override
	const override = readKey(cwd, WORKFLOW_MODELS_DOMAIN, model);
	if (override) {
		return override;
	}

	// Fall back to default
	return DEFAULT_MODELS[model];
}

/**
 * Get all available general model aliases and their current mappings
 */
export function getModelAliases(cwd: string): Record<string, { default: string; current: string }> {
	return {
		smart: {
			default: DEFAULT_MODELS.smart,
			current: resolveModelAlias("smart", cwd),
		},
		general: {
			default: DEFAULT_MODELS.general,
			current: resolveModelAlias("general", cwd),
		},
		fast: {
			default: DEFAULT_MODELS.fast,
			current: resolveModelAlias("fast", cwd),
		},
	};
}
