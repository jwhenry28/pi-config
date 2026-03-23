import { describe, it, expect, afterEach } from "vitest";
import { createComponentTest, writeWorkflow } from "../../testutils/component/index.js";
import type { ComponentTestSession } from "../../testutils/component/index.js";
import { registerMockModel } from "./helpers.js";

describe("deploy-sam-application component", () => {
	let test: ComponentTestSession;

	afterEach(() => {
		test?.dispose();
	});

	it("aborts workflow when deployCommand arg is missing", async () => {
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "missing-args", {
			name: "missing-args",
			steps: [
				{
					name: "Deploy",
					command: "deploy-sam-application",
					args: { stackNameCommand: "echo my-stack" },
					maxExecutions: 1,
				},
			],
		});

		await test.runCommand("/workflow missing-args Test missing args");
		await test.waitForIdle();

		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("requires 'deployCommand' and 'stackNameCommand'"),
			}),
		);
	}, 15000);

	it("streams deploy output then aborts when stack name is empty", async () => {
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "empty-stack", {
			name: "empty-stack",
			steps: [
				{
					name: "Deploy",
					command: "deploy-sam-application",
					args: {
						deployCommand: "echo 'Building application...' && echo 'Upload complete.'",
						stackNameCommand: "echo ''",
					},
					maxExecutions: 1,
				},
			],
		});

		await test.runCommand("/workflow empty-stack Test empty stack");
		await test.waitForIdle();

		// Deploy output was streamed
		const deployNotifs = test.notifications.filter(
			(n) => n.message.includes("[deploy]"),
		);
		expect(deployNotifs.length).toBeGreaterThan(0);
		expect(deployNotifs.some((n) => n.message.includes("Building application..."))).toBe(true);

		// Stack name error caused abort
		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("Failed to get stack name"),
			}),
		);
	}, 15000);

	it("warns on non-zero deploy exit then aborts when stack name command fails", async () => {
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "deploy-fail", {
			name: "deploy-fail",
			steps: [
				{
					name: "Deploy",
					command: "deploy-sam-application",
					args: {
						deployCommand: "echo 'Starting...' && exit 1",
						stackNameCommand: "exit 1",
					},
					maxExecutions: 1,
				},
			],
		});

		await test.runCommand("/workflow deploy-fail Test deploy failure");
		await test.waitForIdle();

		// Deploy command ran and streamed output
		expect(test.notifications.some(
			(n) => n.message.includes("[deploy]") && n.message.includes("Starting..."),
		)).toBe(true);

		// Non-zero exit produced a warning
		expect(test.notifications.some(
			(n) => n.message.includes("exited with code 1"),
		)).toBe(true);

		// Stack name command failure caused abort
		expect(test.notifications).toContainEqual(
			expect.objectContaining({
				message: expect.stringContaining("Failed to get stack name"),
			}),
		);
	}, 15000);

	it("command step failure prevents subsequent steps from running", async () => {
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "multi-step", {
			name: "multi-step",
			steps: [
				{
					name: "Deploy",
					command: "deploy-sam-application",
					args: {
						deployCommand: "echo 'deployed'",
						stackNameCommand: "echo ''",
					},
					maxExecutions: 1,
				},
				{
					name: "Verify",
					model: "mock-model",
					prompt: "Verify deployment",
				},
			],
		});

		await test.runCommand("/workflow multi-step Deploy and verify");
		await test.waitForIdle();

		// Only the Deploy step marker should exist (Verify never ran)
		const markers = test.events.customMessages("workflow:step-marker");
		const deployMarkers = markers.filter((m: any) => m.details.stepName === "Deploy");
		const verifyMarkers = markers.filter((m: any) => m.details.stepName === "Verify");
		expect(deployMarkers).toHaveLength(1);
		expect(verifyMarkers).toHaveLength(0);
	}, 15000);

	it("streams multi-line deploy output as separate notifications", async () => {
		test = await createComponentTest();
		registerMockModel(test);

		writeWorkflow(test.cwd, "multiline", {
			name: "multiline",
			steps: [
				{
					name: "Deploy",
					command: "deploy-sam-application",
					args: {
						deployCommand: "printf 'line1\\nline2\\nline3\\n'",
						stackNameCommand: "echo ''",
					},
					maxExecutions: 1,
				},
			],
		});

		await test.runCommand("/workflow multiline Test multiline");
		await test.waitForIdle();

		const deployLines = test.notifications.filter(
			(n) => n.message.startsWith("[deploy] line"),
		);
		expect(deployLines.length).toBe(3);
		expect(deployLines.map((n) => n.message)).toEqual(
			expect.arrayContaining([
				"[deploy] line1",
				"[deploy] line2",
				"[deploy] line3",
			]),
		);
	}, 15000);
});
