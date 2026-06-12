import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

type PiPathHelpers = {
  getPackageDir?: () => string;
  getReadmePath?: () => string;
  getDocsPath?: () => string;
  getExamplesPath?: () => string;
  getAgentDir?: () => string;
};

type PiPaths = {
  packageDir: string;
  readmePath: string;
  docsPath: string;
  examplesPath: string;
  agentDir: string;
};

async function loadPiPathHelpers(): Promise<PiPathHelpers | null> {
  try {
    const packageName = "@earendil-works/pi-coding-agent";
    return (await import(packageName)) as PiPathHelpers;
  } catch {
    return null;
  }
}

function fallbackPackageDir(): string {
  const resolved = import.meta.resolve("@mariozechner/pi-coding-agent");
  const indexPath = fileURLToPath(resolved);
  return dirname(dirname(indexPath));
}

async function resolvePiPaths(): Promise<PiPaths> {
  const helpers = await loadPiPathHelpers();
  const packageDir = helpers?.getPackageDir?.() ?? fallbackPackageDir();

  return {
    packageDir,
    readmePath: helpers?.getReadmePath?.() ?? join(packageDir, "README.md"),
    docsPath: helpers?.getDocsPath?.() ?? join(packageDir, "docs"),
    examplesPath: helpers?.getExamplesPath?.() ?? join(packageDir, "examples"),
    agentDir:
      helpers?.getAgentDir?.() ??
      process.env.PI_CODING_AGENT_DIR ??
      join(homedir(), ".pi", "agent"),
  };
}

async function readOptional(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

export default async function systemPromptExtension(pi: ExtensionAPI) {
  const customPrompt = await readOptional(".pi/CUSTOM_SYSTEM.md");
  const paths = await resolvePiPaths();

  const chunks: string[] = [];

  if (customPrompt?.trim()) {
    chunks.push(`# Project Custom System Prompt\n\n${customPrompt.trim()}`);
  }

  const readme = await readOptional(paths.readmePath);
  if (readme?.trim()) {
    chunks.push(`## Pi README\n\n${readme.trim()}`);
  }

  for (const fileName of ["extensions.md", "packages.md"]) {
    const contents = await readOptional(join(paths.docsPath, fileName));
    if (contents?.trim()) {
      chunks.push(`## Pi ${fileName}\n\n${contents.trim()}`);
    }
  }

  chunks.push(
    [
      "## Pi Local Paths",
      "",
      `package: ${paths.packageDir}`,
      `README: ${paths.readmePath}`,
      `docs: ${paths.docsPath}`,
      `examples: ${paths.examplesPath}`,
      `agent config: ${paths.agentDir}`,
    ].join("\n"),
  );

  const appended = chunks.join("\n\n---\n\n");

  pi.on("before_agent_start", async (event) => ({
    systemPrompt: `${event.systemPrompt}\n\n---\n\n# Pi Config Customization\n\n${appended}`,
  }));
}
