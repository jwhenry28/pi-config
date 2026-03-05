import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { registerConditionCommand } from "./registry.js";
import { readKey } from "../../memory/store.js";

registerConditionCommand("check-todos-complete", async (ctx, args) => {
	const memoryKey = args?.memoryKey;
	const todoFilepath = args?.todoFilepath;

	if (memoryKey && todoFilepath) {
		throw new Error("check-todos-complete: 'memoryKey' and 'todoFilepath' are mutually exclusive");
	}
	if (!memoryKey && !todoFilepath) {
		throw new Error("check-todos-complete requires either 'memoryKey' or 'todoFilepath' arg");
	}

	let todoPath: string;
	if (memoryKey) {
		const value = readKey(ctx.cwd, ctx.workflowId, memoryKey);
		if (!value) {
			throw new Error(`Memory key "${memoryKey}" not found in workflow "${ctx.workflowId}"`);
		}
		todoPath = value;
	} else {
		todoPath = todoFilepath!;
	}

	const fullPath = resolve(ctx.cwd, todoPath);
	if (!existsSync(fullPath)) {
		throw new Error(`Todo file not found: ${todoPath}`);
	}

	const content = readFileSync(fullPath, "utf-8");
	const lines = content.split("\n");

	const unchecked = lines.filter((l) => /- \[ \]/.test(l)).length;
	const checked = lines.filter((l) => /- \[x\]/i.test(l)).length;
	const total = unchecked + checked;

	if (unchecked > 0) {
		return {
			result: "yes",
			explanation: `${unchecked} of ${total} tasks remaining`,
		};
	}

	return {
		result: "no",
		explanation: `All ${total} tasks complete`,
	};
});
