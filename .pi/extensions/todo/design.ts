import { existsSync, unlinkSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { loadSkills } from "@mariozechner/pi-coding-agent";
import { ensureDomain, addEntry, getEntry } from "../memory/store.js";
import { TODO_DOMAIN, NAME_RE } from "./constants.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const designPromptTemplate = readFileSync(join(__dirname, "design-prompt.md"), "utf-8");

export type Skills = ReturnType<typeof loadSkills>["skills"];

export async function handleDesign(
  parts: string[],
  ctx: ExtensionCommandContext,
  pi: ExtensionAPI,
  allSkills: Skills,
): Promise<void> {
  const name = parts[1];
  if (!name) {
    ctx.ui.notify("Usage: /todo design <name>", "warning");
    return;
  }
  if (!NAME_RE.test(name)) {
    ctx.ui.notify(`Invalid name "${name}". Names must match [a-zA-Z0-9_-]+.`, "error");
    return;
  }
  ensureDomain(ctx.cwd, TODO_DOMAIN);
  const raw = getEntry(ctx.cwd, TODO_DOMAIN, name);
  if (raw.startsWith("Error")) {
    ctx.ui.notify(`Todo "${name}" not found.`, "error");
    return;
  }
  let todo: { name: string; description: string; design: string };
  try {
    todo = JSON.parse(raw);
  } catch {
    ctx.ui.notify(`Todo "${name}" has invalid data.`, "error");
    return;
  }

  // Check for existing design
  if (todo.design) {
    const confirmed = await ctx.ui.confirm(
      "Overwrite design?",
      `Todo "${name}" already has a design at ${todo.design}. Overwrite?`,
    );
    if (!confirmed) {
      return;
    }
    // Delete old design file
    if (existsSync(todo.design)) {
      unlinkSync(todo.design);
    }
  }

  // Create empty design file
  const designPath = `./todos/${name}.md`;
  mkdirSync("./todos", { recursive: true });
  writeFileSync(designPath, "", "utf-8");

  // Update todo with design path
  todo.design = designPath;
  addEntry(ctx.cwd, TODO_DOMAIN, name, JSON.stringify(todo));

  // Find brainstorming skill
  const skill = allSkills.find((s) => s.name === "brainstorming");
  if (!skill) {
    ctx.ui.notify("Brainstorming skill not found. Cannot generate design.", "error");
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
