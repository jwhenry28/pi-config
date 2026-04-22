import { registerConditionCommand } from "./registry.js";
import { readKey, writeKey } from "../../memory/store.js";
import { getCwd } from "../../shared/cwd.js";

registerConditionCommand("memory_key_not_exists", async (ctx, args) => {
	const memoryKey = args?.memoryKey;
	if (!memoryKey) {
		throw new Error("memory_key_not_exists requires 'memoryKey' arg");
	}

	const cwd = getCwd(ctx);
	const value = readKey(cwd, ctx.workflowId, memoryKey);
	const exists = value !== null;
	const explanation = exists
		? `Memory key "${memoryKey}" exists`
		: `Memory key "${memoryKey}" does not exist`;

	writeKey(
		cwd,
		ctx.workflowId,
		"workflow-condition-result",
		JSON.stringify({ result: exists ? "false" : "true", explanation }),
	);
});
