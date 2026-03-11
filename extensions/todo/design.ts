import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import { ensureStore, addEntry, getEntry } from "../memory/store.js";
import { NAME_RE, type TodoExecutionContext } from "./constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const designPromptTemplate = readFileSync(join(__dirname, "design-prompt.md"), "utf-8");

export type Skills = ReturnType<typeof loadSkills>["skills"];

export async function handleDesign(
  parts: string[],
  tex: TodoExecutionContext,
  pi: ExtensionAPI,
  allSkills: Skills,
): Promise<void> {
  const name = parts[1];
  if (!name) {
    tex.ui.notify("Usage: /todo design <name>", "warning");
    return;
  }
  if (!NAME_RE.test(name)) {
    tex.ui.notify(`Invalid name "${name}". Names must match [a-zA-Z0-9_-]+.`, "error");
    return;
  }
  ensureStore(tex.cwd, tex.storeName);
  const raw = getEntry(tex.cwd, tex.storeName, name);
  if (raw.startsWith("Error")) {
    tex.ui.notify(`Todo "${name}" not found.`, "error");
    return;
  }
  let todo: { name: string; description: string; design: string };
  try {
    todo = JSON.parse(raw);
  } catch {
    tex.ui.notify(`Todo "${name}" has invalid data.`, "error");
    return;
  }

  // Check for existing design
  if (todo.design) {
    const confirmed = await tex.ui.confirm(
      "Overwrite design?",
      `Todo "${name}" already has a design at ${todo.design}. Overwrite?`,
    );
    if (!confirmed) {
      return;
    }
    // Delete old design file
    const absDesignPath = resolve(tex.cwd, todo.design);
    if (existsSync(absDesignPath)) {
      unlinkSync(absDesignPath);
    }
  }

  // Create empty design file
  const designDir = join(tex.cwd, "todos");
  const designPath = join(designDir, `${name}.md`);
  mkdirSync(designDir, { recursive: true });
  writeFileSync(designPath, "", "utf-8");

  // Update todo with design path (relative for portability)
  todo.design = `./todos/${name}.md`;
  addEntry(tex.cwd, tex.storeName, name, JSON.stringify(todo));

  // Find brainstorming skill
  const skill = allSkills.find((s) => s.name === "brainstorming");
  if (!skill) {
    tex.ui.notify("Brainstorming skill not found. Cannot generate design.", "error");
    return;
  }

  // Inject the skill
  const skillContent = readFileSync(skill.filePath, "utf-8");
  pi.sendMessage({
    customType: "todo:skill",
    content: `<skill name="${skill.name}" location="${skill.filePath}">\n${skillContent}\n</skill>`,
    display: true,
    details: { skillName: skill.name, location: skill.filePath },
  });

  // Build and send the user message from template
  const userMessage = designPromptTemplate
    .replaceAll("%NAME%", todo.name)
    .replaceAll("%DESCRIPTION%", todo.description)
    .replaceAll("%DESIGN_PATH%", designPath);
  pi.sendUserMessage(userMessage);
}
