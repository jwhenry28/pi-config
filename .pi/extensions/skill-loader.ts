import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { getWrapperSkillPaths } from "./shared/skill-wrappers.js";
import { getCwd } from "./shared/cwd.js";

export default function skillLoaderExtension(pi: ExtensionAPI) {
  pi.on("resources_discover", async (_event, ctx) => {
    const skillPaths = getWrapperSkillPaths(getCwd(ctx));
    if (skillPaths.length === 0) return;
    return { skillPaths };
  });
}
