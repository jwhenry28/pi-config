import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isPluginSkillRef, resolvePluginSkillPath, parseSkillName } from "../plugin-skills.js";
import { join } from "node:path";
import { mkdirSync, rmSync, existsSync } from "node:fs";
import { setHomeDirOverride, clearHomeDirOverride, getPluginsDir } from "../../shared/home.js";

const cwd = process.cwd();
let tmpHome: string;

describe("isPluginSkillRef", () => {
	it("returns true for path refs", () => {
		expect(isPluginSkillRef("my-repo/skills/some-skill")).toBe(true);
		expect(isPluginSkillRef("repo/skill")).toBe(true);
	});

	it("returns false for name refs", () => {
		expect(isPluginSkillRef("my-skill")).toBe(false);
		expect(isPluginSkillRef("brainstorming")).toBe(false);
	});
});

describe("resolvePluginSkillPath", () => {
	beforeEach(() => {
		tmpHome = join(cwd, ".test-home-" + Date.now());
		mkdirSync(tmpHome, { recursive: true });
		setHomeDirOverride(tmpHome);
	});

	afterEach(() => {
		clearHomeDirOverride();
		if (existsSync(tmpHome)) rmSync(tmpHome, { recursive: true, force: true });
	});

	it("resolves to plugins dir with SKILL.md", () => {
		const result = resolvePluginSkillPath("my-repo/skills/some-skill");
		expect(result).toBe(join(getPluginsDir(), "my-repo", "skills", "some-skill", "SKILL.md"));
	});

	it("handles two-segment refs", () => {
		const result = resolvePluginSkillPath("repo/skill");
		expect(result).toBe(join(getPluginsDir(), "repo", "skill", "SKILL.md"));
	});
});

describe("parseSkillName", () => {
	it("extracts name from frontmatter", () => {
		const content = "---\nname: cool-skill\ndescription: test\n---\n# Cool Skill";
		expect(parseSkillName(content)).toBe("cool-skill");
	});

	it("returns null when no frontmatter", () => {
		expect(parseSkillName("# Just a skill")).toBeNull();
	});

	it("returns null when frontmatter has no name", () => {
		expect(parseSkillName("---\ndescription: test\n---\n# Skill")).toBeNull();
	});
});
