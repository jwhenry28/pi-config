import { describe, it, expect, afterEach, vi } from "vitest";
import { getStepCommand } from "../commands/registry.js";
import { readKey } from "../../memory/store.js";
import { makeStoreName, purgeStore } from "../../testutils/index.js";
import type { CommandContext } from "../commands/registry.js";

// Import to trigger self-registration
import "../commands/ask-user.js";

const cwd = process.cwd();

function makeCommandCtx(storeName: string, customAnswers: string[] | null): CommandContext {
	return {
		cwd,
		workflowId: storeName,
		ctx: {
			ui: {
				custom: vi.fn().mockResolvedValue(customAnswers),
			},
		} as any,
	};
}

describe("ask-user step command", () => {
	const stores: string[] = [];

	afterEach(() => {
		for (const store of stores) purgeStore(cwd, store);
		stores.length = 0;
	});

	it("is registered as a step command", () => {
		const fn = getStepCommand("ask-user");
		expect(fn).toBeDefined();
	});

	it("shows QnA UI and writes answers to memory", async () => {
		const store = makeStoreName("test-ask-user-");
		stores.push(store);
		const fn = getStepCommand("ask-user")!;

		const ctx = makeCommandCtx(store, ["Alice", "Backend"]);
		await fn(ctx, { name: "What is your name?", role: "What is your role?" });

		expect(ctx.ctx.ui.custom).toHaveBeenCalledOnce();
		expect(readKey(cwd, store, "name")).toBe("Alice");
		expect(readKey(cwd, store, "role")).toBe("Backend");
	});

	it("throws when user dismisses questions", async () => {
		const store = makeStoreName("test-ask-user-");
		stores.push(store);
		const fn = getStepCommand("ask-user")!;

		const ctx = makeCommandCtx(store, null);
		await expect(fn(ctx, { q: "Question?" })).rejects.toThrow("dismissed");
	});

	it("throws when no args provided", async () => {
		const store = makeStoreName("test-ask-user-");
		stores.push(store);
		const fn = getStepCommand("ask-user")!;

		const ctx = makeCommandCtx(store, []);
		await expect(fn(ctx, undefined)).rejects.toThrow("no questions");
	});

	it("throws when args is empty object", async () => {
		const store = makeStoreName("test-ask-user-");
		stores.push(store);
		const fn = getStepCommand("ask-user")!;

		const ctx = makeCommandCtx(store, []);
		await expect(fn(ctx, {})).rejects.toThrow("no questions");
	});

	it("stores empty string for empty answers", async () => {
		const store = makeStoreName("test-ask-user-");
		stores.push(store);
		const fn = getStepCommand("ask-user")!;

		const ctx = makeCommandCtx(store, [""]);
		await fn(ctx, { q: "Question?" });

		expect(readKey(cwd, store, "q")).toBe("");
	});
});
