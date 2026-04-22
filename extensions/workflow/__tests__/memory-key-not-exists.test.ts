import { afterEach, describe, expect, it } from "vitest";
import { getConditionCommand } from "../commands/registry.js";
import { readKey, writeKey } from "../../memory/store.js";
import { makeStoreName, purgeStore } from "../../testutils/index.js";
import type { CommandContext } from "../commands/registry.js";

import "../commands/memory-key-not-exists.js";

const cwd = process.cwd();

function makeCommandCtx(storeName: string): CommandContext {
	return {
		cwd,
		workflowId: storeName,
		ctx: {
			ui: {},
		} as any,
	};
}

describe("memory_key_not_exists condition command", () => {
	const stores: string[] = [];

	afterEach(() => {
		for (const store of stores) purgeStore(cwd, store);
		stores.length = 0;
	});

	it("is registered as a condition command", () => {
		const fn = getConditionCommand("memory_key_not_exists");
		expect(fn).toBeDefined();
	});

	it("returns true when the memory key is absent", async () => {
		const store = makeStoreName("test-workflow-memory-key-not-exists-");
		stores.push(store);
		const fn = getConditionCommand("memory_key_not_exists")!;

		await fn(makeCommandCtx(store), { memoryKey: "design-doc" });

		expect(readKey(cwd, store, "workflow-condition-result")).toBe(
			JSON.stringify({ result: "true", explanation: 'Memory key "design-doc" does not exist' }),
		);
	});

	it("returns false when the memory key exists", async () => {
		const store = makeStoreName("test-workflow-memory-key-not-exists-");
		stores.push(store);
		const fn = getConditionCommand("memory_key_not_exists")!;
		writeKey(cwd, store, "design-doc", "plans/feature/design.md");

		await fn(makeCommandCtx(store), { memoryKey: "design-doc" });

		expect(readKey(cwd, store, "workflow-condition-result")).toBe(
			JSON.stringify({ result: "false", explanation: 'Memory key "design-doc" exists' }),
		);
	});

	it("returns false when the memory key exists with an empty string value", async () => {
		const store = makeStoreName("test-workflow-memory-key-not-exists-");
		stores.push(store);
		const fn = getConditionCommand("memory_key_not_exists")!;
		writeKey(cwd, store, "design-doc", "");

		await fn(makeCommandCtx(store), { memoryKey: "design-doc" });

		expect(readKey(cwd, store, "workflow-condition-result")).toBe(
			JSON.stringify({ result: "false", explanation: 'Memory key "design-doc" exists' }),
		);
	});

	it("throws when memoryKey is missing", async () => {
		const store = makeStoreName("test-workflow-memory-key-not-exists-");
		stores.push(store);
		const fn = getConditionCommand("memory_key_not_exists")!;

		await expect(fn(makeCommandCtx(store), {})).rejects.toThrow(
			"memory_key_not_exists requires 'memoryKey' arg",
		);
	});
});
