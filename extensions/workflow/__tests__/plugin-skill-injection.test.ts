import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";
import { writeGlobalPluginDir } from "../../testutils/fixtures.js";
import { injectSkills } from "../runner.js";
import type { PromptStep, WorkflowState } from "../types.js";
import type { Skill } from "@mariozechner/pi-coding-agent";

const cwd = process.cwd();
let tmpHome: string;

function makeMockPi() {
	const messages: any[] = [];
	return {
		pi: {
			sendMessage: (msg: any) => messages.push(msg),
		},
		messages,
	};
}

describe("injectSkills — plugin path refs", () => {
	beforeEach(() => {
		tmpHome = join(cwd, ".test-home-" + Date.now());
		mkdirSync(tmpHome, { recursive: true });
		setHomeDirOverride(tmpHome);
	});

	afterEach(() => {
		clearHomeDirOverride();
		if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
	});

	it("injects plugin skill with name from frontmatter", () => {
		writeGlobalPluginDir("my-repo", {
			skills: [{ name: "cool-skill", content: "---\nname: cool-skill\ndescription: A cool skill\n---\n# Cool Skill\nDo cool things." }],
		});

		const { pi, messages } = makeMockPi();
		const step: PromptStep = {
			name: "test",
			prompt: "do stuff",
			model: "anthropic/claude-sonnet-4-20250514",
			skills: ["my-repo/skills/cool-skill"],
			maxExecutions: 10,
		};
		const state = { allSkills: [] as Skill[] } as WorkflowState;

		injectSkills(pi as any, step, state);

		expect(messages).toHaveLength(1);
		expect(messages[0].customType).toBe("workflow:skill");
		expect(messages[0].content).toContain('skill name="cool-skill"');
		expect(messages[0].content).toContain("Do cool things.");
		expect(messages[0].details.skillName).toBe("cool-skill");
	});

	it("falls back to ref string when no frontmatter name", () => {
		writeGlobalPluginDir("my-repo", {
			skills: [{ name: "no-name", content: "# Just a skill\nNo frontmatter here." }],
		});

		const { pi, messages } = makeMockPi();
		const step: PromptStep = {
			name: "test",
			prompt: "do stuff",
			model: "anthropic/claude-sonnet-4-20250514",
			skills: ["my-repo/skills/no-name"],
			maxExecutions: 10,
		};
		const state = { allSkills: [] as Skill[] } as WorkflowState;

		injectSkills(pi as any, step, state);

		expect(messages).toHaveLength(1);
		expect(messages[0].content).toContain('skill name="my-repo/skills/no-name"');
	});

	it("injects both named and plugin skills in same step", () => {
		writeGlobalPluginDir("repo", {
			files: [{ path: "sk/SKILL.md", content: "---\nname: sk\n---\n# SK" }],
		});
		const skillMdPath = join(getPluginsDir(), "repo", "sk", "SKILL.md");

		const { pi, messages } = makeMockPi();
		const namedSkill: Skill = {
			name: "local-skill",
			filePath: skillMdPath,
			description: "test",
		} as Skill;

		const step: PromptStep = {
			name: "test",
			prompt: "do stuff",
			model: "anthropic/claude-sonnet-4-20250514",
			skills: ["local-skill", "repo/sk"],
			maxExecutions: 10,
		};
		const state = { allSkills: [namedSkill] as Skill[] } as WorkflowState;

		injectSkills(pi as any, step, state);

		expect(messages).toHaveLength(2);
		expect(messages[0].details.skillName).toBe("local-skill");
		expect(messages[1].details.skillName).toBe("sk");
	});
});
