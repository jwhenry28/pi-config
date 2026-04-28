import { describe, it, expect, afterEach, vi } from "vitest";
import { EventEmitter } from "node:events";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import modulesExtension from "../index.js";
import { writeSkill } from "../../testutils/fixtures.js";

const SKILL_CONTENT = [
  "---",
  "name: early-module-skill",
  "description: Skill discovered from an early module:get-state query",
  "module: early-module",
  "---",
  "# Early Module Skill",
].join("\n");

describe("modules extension early state queries", () => {
  let tempDir: string | undefined;

  afterEach(() => {
    if (tempDir) rmSync(tempDir, { recursive: true, force: true });
    tempDir = undefined;
  });

  it("includes skill-backed modules when module:get-state runs before session_start", () => {
    tempDir = mkdtempSync(join(tmpdir(), "pi-modules-early-"));
    writeSkill(tempDir, "early-module-skill", SKILL_CONTENT);

    const pi: any = {
      events: new EventEmitter(),
      on: vi.fn(),
      registerCommand: vi.fn(),
      getAllTools: vi.fn(() => []),
      setActiveTools: vi.fn(),
    };
    modulesExtension(pi);

    let moduleNames: string[] = [];
    pi.events.emit("module:get-state", {
      cwd: tempDir,
      callback: (info: { modules: Map<string, unknown> }) => {
        moduleNames = Array.from(info.modules.keys());
      },
    });

    expect(moduleNames).toContain("early-module");
  });
});
