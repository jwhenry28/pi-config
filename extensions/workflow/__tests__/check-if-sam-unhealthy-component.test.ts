import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, writeWorkflow } from "../../testutils/component/index.js";
import type { ComponentTestSession } from "../../testutils/component/index.js";
import { registerMockModel } from "./helpers.js";

describe("check-if-sam-unhealthy component", () => {
	let test: ComponentTestSession;

	afterEach(() => {
		test?.dispose();
	});

	it("condition triggers jump when stack name command fails", async () => {
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "sam-unhealthy-jump", {
			name: "sam-unhealthy-jump",
			steps: [
				{
					name: "Deploy",
					model: "mock-model",
					prompt: "Deploy the application",
					maxExecutions: 2,
					conditions: [
						{
							command: "check-if-sam-unhealthy",
							args: { stackNameCommand: "exit 1" },
							jump: "Deploy",
						},
					],
				},
				{
					name: "Done",
					model: "mock-model",
					prompt: "Summarize",
				},
			],
		});

		test.sendUserMessage("/workflow sam-unhealthy-jump Test unhealthy jump");

		// Execution 1 → stack name fails → condition true → jump back
		await test.mockAgentResponse({ text: "First deploy attempt" });
		await new Promise(r => setTimeout(r, 200));

		// Execution 2 → stack name still fails → condition true → maxExecutions reached → advance
		await test.mockAgentResponse({ text: "Second deploy attempt" });
		await new Promise(r => setTimeout(r, 200));

		// Done step
		await test.mockAgentResponse({ text: "Summary" });
		await test.waitForIdle();
		await new Promise(r => setTimeout(r, 200));

		// Verify step markers: Deploy ran twice, then Done
		const markers = test.events.customMessages("workflow:step-marker");
		expect(markers).toHaveLength(3);
		expect(markers[0].details.stepName).toBe("Deploy");
		expect(markers[0].details.execution).toBe(1);
		expect(markers[1].details.stepName).toBe("Deploy");
		expect(markers[1].details.execution).toBe(2);
		expect(markers[2].details.stepName).toBe("Done");

		// Verify condition results were "true" (unhealthy)
		const condResults = test.events.customMessages("workflow:condition-result");
		expect(condResults.length).toBeGreaterThanOrEqual(2);

		// Verify maxExecutions warning appeared
		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("maxExecutions"),
			}),
		);

		// Verify workflow completed
		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("complete!"),
			}),
		);
	}, 30000);

	it("condition triggers jump when stack name command returns empty", async () => {
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "sam-empty-name", {
			name: "sam-empty-name",
			steps: [
				{
					name: "Deploy",
					model: "mock-model",
					prompt: "Deploy the application",
					maxExecutions: 1,
					conditions: [
						{
							command: "check-if-sam-unhealthy",
							args: { stackNameCommand: "echo ''" },
							jump: "Deploy",
						},
					],
				},
				{
					name: "Done",
					model: "mock-model",
					prompt: "Summarize",
				},
			],
		});

		test.sendUserMessage("/workflow sam-empty-name Test empty name");

		// Execution 1 → empty stack name → condition true → maxExecutions(1) reached → advance
		await test.mockAgentResponse({ text: "Deploy attempt" });
		await new Promise(r => setTimeout(r, 200));

		// Done step
		await test.mockAgentResponse({ text: "Summary" });
		await test.waitForIdle();
		await new Promise(r => setTimeout(r, 200));

		const markers = test.events.customMessages("workflow:step-marker");
		expect(markers).toHaveLength(2);
		expect(markers[0].details.stepName).toBe("Deploy");
		expect(markers[1].details.stepName).toBe("Done");

		// Verify the condition reported unhealthy with empty stack name explanation
		const condResults = test.events.customMessages("workflow:condition-result");
		expect(condResults).toHaveLength(1);
		expect(condResults[0].details.result).toBe("true");
		expect(condResults[0].content).toContain("Failed to determine stack name");
	}, 15000);

	it("condition reports unhealthy when aws CLI is not available", async () => {
		// When stackNameCommand succeeds but the aws CLI is not available,
		// the describe-stacks call fails → condition returns "true" (unhealthy).
		// The unit tests (Task 4) cover all execFn paths via injection.
		// This component test verifies the "unhealthy → jump → maxExecutions → advance" path
		// when the aws CLI call itself fails.
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "sam-no-aws", {
			name: "sam-no-aws",
			steps: [
				{
					name: "Deploy",
					model: "mock-model",
					prompt: "Deploy the application",
					maxExecutions: 1,
					conditions: [
						{
							command: "check-if-sam-unhealthy",
							args: { stackNameCommand: "echo my-stack" },
							jump: "Deploy",
						},
					],
				},
				{
					name: "Done",
					model: "mock-model",
					prompt: "Summarize",
				},
			],
		});

		test.sendUserMessage("/workflow sam-no-aws No AWS");

		// Deploy step runs
		await test.mockAgentResponse({ text: "Deployed" });
		await new Promise(r => setTimeout(r, 200));

		// Condition fires (unhealthy because aws CLI not available) → maxExecutions(1) → advance
		// Done step
		await test.mockAgentResponse({ text: "Summary" });
		await test.waitForIdle();
		await new Promise(r => setTimeout(r, 200));

		// Verify workflow completed
		const markers = test.events.customMessages("workflow:step-marker");
		expect(markers).toHaveLength(2);
		expect(markers[0].details.stepName).toBe("Deploy");
		expect(markers[1].details.stepName).toBe("Done");

		// Verify condition reported unhealthy (stack not found because aws fails)
		const condResults = test.events.customMessages("workflow:condition-result");
		expect(condResults).toHaveLength(1);
		expect(condResults[0].details.result).toBe("true");

		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("complete!"),
			}),
		);
	}, 15000);

	it("workflow pauses when stackNameCommand arg is missing", async () => {
		// When the required arg is missing, the condition command throws.
		// evaluateCommandCondition catches the error and notifies, but does NOT
		// write a result to workflow memory. The runner sees no result and pauses
		// the workflow for manual evaluation.
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "sam-missing-arg", {
			name: "sam-missing-arg",
			steps: [
				{
					name: "Deploy",
					model: "mock-model",
					prompt: "Deploy",
					maxExecutions: 1,
					conditions: [
						{
							command: "check-if-sam-unhealthy",
							args: {},
							jump: "Deploy",
						},
					],
				},
				{
					name: "Done",
					model: "mock-model",
					prompt: "Summarize",
				},
			],
		});

		test.sendUserMessage("/workflow sam-missing-arg Test missing arg");
		await test.mockAgentResponse({ text: "Deployed" });
		await test.waitForIdle();
		await new Promise(r => setTimeout(r, 200));

		// Verify the error notification from evaluateCommandCondition
		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("requires 'stackNameCommand'"),
			}),
		);

		// Verify the workflow paused (no result written → manual evaluation needed)
		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("did not produce a result"),
			}),
		);

		// Done step should NOT have run — workflow is paused
		const markers = test.events.customMessages("workflow:step-marker");
		const doneMarkers = markers.filter((m: any) => m.details.stepName === "Done");
		expect(doneMarkers).toHaveLength(0);
	}, 15000);
});
