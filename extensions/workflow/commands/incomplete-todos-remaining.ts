import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { registerConditionCommand } from "./registry.js";
import { readKey, writeKey } from "../../memory/store.js";
import { getCwd } from "../../shared/cwd.js";

registerConditionCommand("incomplete-todos-remaining", async (ctx, args) => {
  const memoryKey = args?.memoryKey;
  const todoFilepath = args?.todoFilepath;

  if (memoryKey && todoFilepath) {
    throw new Error(
      "incomplete-todos-remaining: 'memoryKey' and 'todoFilepath' are mutually exclusive",
    );
  }
  if (!memoryKey && !todoFilepath) {
    throw new Error(
      "incomplete-todos-remaining requires either 'memoryKey' or 'todoFilepath' arg",
    );
  }

  let todoPath: string;
  if (memoryKey) {
    const value = readKey(getCwd(ctx), ctx.workflowId, memoryKey);
    if (!value) {
      throw new Error(
        `Memory key "${memoryKey}" not found in workflow "${ctx.workflowId}"`,
      );
    }
    todoPath = value;
  } else {
    todoPath = todoFilepath!;
  }

  const fullPath = resolve(getCwd(ctx), todoPath);
  if (!existsSync(fullPath)) {
    throw new Error(`Todo file not found: ${todoPath}`);
  }

  const content = readFileSync(fullPath, "utf-8");
  const lines = content.split("\n");

  const unchecked = lines.filter((l) => /- \[ \]/.test(l)).length;
  const checked = lines.filter((l) => /- \[x\]/i.test(l)).length;
  const total = unchecked + checked;

  if (unchecked > 0) {
    writeKey(
      getCwd(ctx),
      ctx.workflowId,
      "workflow-condition-result",
      JSON.stringify({
        result: "true",
        explanation: `${unchecked} of ${total} tasks remaining`,
      }),
    );
  } else {
    writeKey(
      getCwd(ctx),
      ctx.workflowId,
      "workflow-condition-result",
      JSON.stringify({
        result: "false",
        explanation: `All ${total} tasks complete`,
      }),
    );
  }
});
