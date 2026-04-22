import { ensureStore, addEntry, getEntry, listKeys } from "../memory/store.js";
import { NAME_RE, type TodoExecutionContext } from "./constants.js";
import { formatTodoList } from "./list.js";

interface NumericPrefixParts {
  rawNumber: string;
  normalizedNumber: string;
  suffix: string;
}

function parseNumericPrefix(name: string): NumericPrefixParts | null {
  const match = name.match(/^(\d+)-(.*)$/);
  if (!match) return null;

  const [, rawNumber, suffix] = match;
  const normalizedNumber = /^0+$/.test(rawNumber)
    ? "0"
    : String(Number.parseInt(rawNumber, 10));

  return { rawNumber, normalizedNumber, suffix };
}

function normalizeManualNumberedName(name: string): string {
  const parsed = parseNumericPrefix(name);
  if (!parsed) return name;

  return `${parsed.normalizedNumber}-${parsed.suffix}`;
}

function collectUsedPositiveNumbers(cwd: string, storeName: string): Set<number> {
  const used = new Set<number>();
  const keysResult = listKeys(cwd, storeName);
  const storeMissing = keysResult.startsWith("Error") || keysResult.startsWith("Domain");
  if (storeMissing) return used;

  for (const key of keysResult.split("\n")) {
    if (!key) continue;

    const parsed = parseNumericPrefix(key);
    if (!parsed) continue;

    const value = Number.parseInt(parsed.normalizedNumber, 10);
    const isPositiveNumber = Number.isInteger(value) && value > 0;
    if (!isPositiveNumber) continue;

    used.add(value);
  }

  return used;
}

function resolveFinalTodoName(rawName: string, cwd: string, storeName: string): string {
  const parsed = parseNumericPrefix(rawName);
  if (parsed) return normalizeManualNumberedName(rawName);

  const used = collectUsedPositiveNumbers(cwd, storeName);
  let candidate = 1;

  while (true) {
    const finalName = `${candidate}-${rawName}`;
    const existing = getEntry(cwd, storeName, finalName);
    const numberAvailable = !used.has(candidate);
    const finalNameMissing = existing.startsWith("Error");
    if (numberAvailable && finalNameMissing) return finalName;

    candidate += 1;
  }
}

export async function handleAdd(
  parts: string[],
  tex: TodoExecutionContext,
): Promise<void> {
  const rawName = parts[1];
  const description = parts.slice(2).join(" ");
  if (!rawName || !description) {
    tex.ui.notify("Usage: /todo add <name> <description>", "warning");
    return;
  }

  ensureStore(tex.cwd, tex.storeName);
  const name = resolveFinalTodoName(rawName, tex.cwd, tex.storeName);

  if (!NAME_RE.test(name)) {
    tex.ui.notify(`Invalid name "${name}". Names must match [a-zA-Z0-9_-]+.`, "error");
    return;
  }

  const existing = getEntry(tex.cwd, tex.storeName, name);
  if (!existing.startsWith("Error")) {
    tex.ui.notify(`Todo "${name}" already exists. Use /todo complete to complete it first.`, "warning");
    return;
  }

  const todo = JSON.stringify({ name, description, design: "" });
  addEntry(tex.cwd, tex.storeName, name, todo);

  const listText = formatTodoList(tex.cwd, tex.storeName) ?? "No open todos";
  tex.ui.notify(`Added todo "${name}"\n\n${listText}`, "info");
}
