import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadAllSkills } from "../skill-loader.js";
import { writeFile } from "../../testutils/fixtures.js";
import { WRAPPER_SKILLS_DIR } from "../paths.js";

function createTestProject(opts: {
  wrapperFrontmatter: Record<string, string>;
  skillFrontmatter: Record<string, string>;
  skillBody: string;
}) {
  const tmpDir = mkdtempSync(join(tmpdir(), "skill-loader-test-"));

  // Write WRAPPER.md
  const wrapperYaml = Object.entries(opts.wrapperFrontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFile(tmpDir, `${WRAPPER_SKILLS_DIR}/test-wrapper/WRAPPER.md`, `---\n${wrapperYaml}\n---\n\nWrapper file.\n`);

  // Write SKILL.md at the symlink target path
  const skillYaml = Object.entries(opts.skillFrontmatter)
    .map(([k, v]) => `${k}: ${v}`)
    .join("\n");
  writeFile(tmpDir, "test-real-skill/SKILL.md", `---\n${skillYaml}\n---\n\n${opts.skillBody}\n`);

  return {
    tmpDir,
    cleanup: () => rmSync(tmpDir, { recursive: true, force: true }),
  };
}

describe("loadAllSkills", () => {
  let cleanup: (() => void) | undefined;

  afterEach(() => {
    cleanup?.();
    cleanup = undefined;
  });

  it("resolves WRAPPER.md to real SKILL.md content", () => {
    const { tmpDir, cleanup: c } = createTestProject({
      wrapperFrontmatter: { symlink: "@/test-real-skill" },
      skillFrontmatter: { name: "test-skill", description: "A test skill" },
      skillBody: "This is the real skill content.",
    });
    cleanup = c;

    const skills = loadAllSkills(tmpDir);

    const skill = skills.find((s) => s.name === "test-skill");
    expect(skill).toBeDefined();
    expect(skill!.frontmatter.name).toBe("test-skill");
    expect(skill!.frontmatter.description).toBe("A test skill");
  });

  it("merges WRAPPER.md module frontmatter into SKILL.md frontmatter", () => {
    const { tmpDir, cleanup: c } = createTestProject({
      wrapperFrontmatter: { symlink: "@/test-real-skill", module: "my-module" },
      skillFrontmatter: { name: "test-skill", description: "A test skill" },
      skillBody: "Skill body.",
    });
    cleanup = c;

    const skills = loadAllSkills(tmpDir);

    const skill = skills.find((s) => s.name === "test-skill");
    expect(skill).toBeDefined();
    expect(skill!.frontmatter.module).toBe("my-module");
    expect(skill!.frontmatter.name).toBe("test-skill");
    expect(skill!.frontmatter.description).toBe("A test skill");
  });

  it("preserves extra SKILL.md frontmatter", () => {
    const { tmpDir, cleanup: c } = createTestProject({
      wrapperFrontmatter: { symlink: "@/test-real-skill" },
      skillFrontmatter: {
        name: "test-skill",
        description: "A test skill",
        priority: "5",
      },
      skillBody: "Skill with priority.",
    });
    cleanup = c;

    const skills = loadAllSkills(tmpDir);

    const skill = skills.find((s) => s.name === "test-skill");
    expect(skill).toBeDefined();
    expect(skill!.frontmatter.priority).toBe(5);
    expect(skill!.frontmatter.name).toBe("test-skill");
  });

  it("prefers WRAPPER.md frontmatter over SKILL.md on clashes", () => {
    const { tmpDir, cleanup: c } = createTestProject({
      wrapperFrontmatter: {
        symlink: "@/test-real-skill",
        module: "wrapper-module",
      },
      skillFrontmatter: {
        name: "test-skill",
        description: "A test skill",
        module: "skill-module",
      },
      skillBody: "Clashing modules.",
    });
    cleanup = c;

    const skills = loadAllSkills(tmpDir);

    const skill = skills.find((s) => s.name === "test-skill");
    expect(skill).toBeDefined();
    expect(skill!.frontmatter.module).toBe("wrapper-module");
    expect(skill!.frontmatter.name).toBe("test-skill");
  });
});
