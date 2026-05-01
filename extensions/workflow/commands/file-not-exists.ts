import { existsSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { registerConditionCommand } from "./registry.js";
import { readKey, writeKey } from "../../memory/store.js";
import { getCwd } from "../../shared/cwd.js";

registerConditionCommand("file-not-exists", async (ctx, args) => {
  const memoryKey = args?.memoryKey;
  const filepath = args?.filepath;

  if (memoryKey && filepath) {
    throw new Error(
      "file-not-exists: 'memoryKey' and 'filepath' are mutually exclusive",
    );
  }

  const hasMemoryKey = memoryKey !== undefined;
  const hasFilepath = filepath !== undefined;
  if (!hasMemoryKey && !hasFilepath) {
    throw new Error(
      "file-not-exists requires either 'memoryKey' or 'filepath' arg",
    );
  }

  const cwd = getCwd(ctx);
  let targetPath = filepath;

  if (hasMemoryKey) {
    const value = readKey(cwd, ctx.workflowId, memoryKey!);
    if (value === null) {
      writeKey(
        cwd,
        ctx.workflowId,
        "workflow-condition-result",
        JSON.stringify({
          result: "true",
          explanation: `Memory key \"${memoryKey}\" does not exist`,
        }),
      );
      return;
    }
    targetPath = value;
  }

  const fullPath = resolve(cwd, targetPath!);
  if (!existsSync(fullPath)) {
    writeKey(
      cwd,
      ctx.workflowId,
      "workflow-condition-result",
      JSON.stringify({
        result: "true",
        explanation: `File does not exist: ${targetPath}`,
      }),
    );
    return;
  }

  const pathIsFile = statSync(fullPath).isFile();
  if (!pathIsFile) {
    writeKey(
      cwd,
      ctx.workflowId,
      "workflow-condition-result",
      JSON.stringify({
        result: "true",
        explanation: `Path exists but is not a file: ${targetPath}`,
      }),
    );
    return;
  }

  writeKey(
    cwd,
    ctx.workflowId,
    "workflow-condition-result",
    JSON.stringify({
      result: "false",
      explanation: `File exists: ${targetPath}`,
    }),
  );
});
