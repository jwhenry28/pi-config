import { describe, it, expect, vi, beforeEach } from "vitest";

const { loadSkillsMock, getPluginSkillPathsMock, parseFrontmatterMock } = vi.hoisted(() => ({
  loadSkillsMock: vi.fn(),
  getPluginSkillPathsMock: vi.fn(),
  parseFrontmatterMock: vi.fn(),
}));

vi.mock("@mariozechner/pi-coding-agent", () => ({
  loadSkills: loadSkillsMock,
}));

vi.mock("../../skill-loader.js", () => ({
  getPluginSkillPaths: getPluginSkillPathsMock,
}));

vi.mock("../types.js", () => ({
  parseFrontmatter: parseFrontmatterMock,
}));

import { loadAllSkills } from "../skill-loader.js";

describe("loadAllSkills", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPluginSkillPathsMock.mockReturnValue(["/plugins/repo/skills/custom"]);
    parseFrontmatterMock.mockReturnValue({ module: "development" });
  });

  it("loads default discovered skills in addition to plugin skill directories", () => {
    loadSkillsMock.mockReturnValue({
      skills: [
        {
          name: "brainstorming",
          filePath: "/project/.pi/skills/brainstorming/SKILL.md",
          description: "Brainstorm",
        },
      ],
    });

    const skills = loadAllSkills("/project");

    expect(loadSkillsMock).toHaveBeenCalledWith({
      cwd: "/project",
      skillPaths: ["/plugins/repo/skills/custom"],
      includeDefaults: true,
    });
    expect(skills).toEqual([
      expect.objectContaining({
        name: "brainstorming",
        frontmatter: { module: "development" },
      }),
    ]);
    expect(parseFrontmatterMock).toHaveBeenCalledWith(
      "/project/.pi/skills/brainstorming/SKILL.md",
    );
  });
});
