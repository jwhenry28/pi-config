import { describe, it, expect } from "vitest";
import { normalizeGitUrl, extractRepoName } from "../git.js";

describe("normalizeGitUrl", () => {
  it("passes through full HTTPS URL", () => {
    expect(normalizeGitUrl("https://github.com/org/repo")).toBe("https://github.com/org/repo.git");
  });

  it("passes through HTTPS URL with .git suffix", () => {
    expect(normalizeGitUrl("https://github.com/org/repo.git")).toBe("https://github.com/org/repo.git");
  });

  it("converts org/repo shorthand", () => {
    expect(normalizeGitUrl("org/repo")).toBe("https://github.com/org/repo.git");
  });

  it("converts SSH URL", () => {
    expect(normalizeGitUrl("git@github.com:org/repo.git")).toBe("https://github.com/org/repo.git");
  });

  it("throws on invalid format", () => {
    expect(() => normalizeGitUrl("just-a-word")).toThrow();
  });
});

describe("extractRepoName", () => {
  it("extracts repo name from HTTPS URL", () => {
    expect(extractRepoName("https://github.com/org/repo.git")).toBe("repo");
  });

  it("extracts from shorthand", () => {
    expect(extractRepoName("org/my-repo")).toBe("my-repo");
  });
});
