import { execSync, spawn } from "node:child_process";

/**
 * Normalize various GitHub URL formats to HTTPS.
 * Accepts: org/repo, https://github.com/org/repo[.git], git@github.com:org/repo.git
 */
export function normalizeGitUrl(input: string): string {
  // SSH format: git@github.com:org/repo.git
  const sshMatch = input.match(/^git@github\.com:(.+?)(?:\.git)?$/);
  if (sshMatch) return `https://github.com/${sshMatch[1]}.git`;

  // HTTPS format
  if (input.startsWith("https://")) {
    return input.endsWith(".git") ? input : `${input}.git`;
  }

  // Shorthand: org/repo (exactly one slash, no dots or colons)
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(input)) {
    return `https://github.com/${input}.git`;
  }

  throw new Error(`Invalid git URL format: "${input}". Use org/repo, HTTPS URL, or SSH URL.`);
}

/**
 * Extract repository name (last path segment, minus .git) from any accepted format.
 */
export function extractRepoName(input: string): string {
  // Remove .git suffix and trailing slashes
  const cleaned = input.replace(/\.git$/, "").replace(/\/+$/, "");
  const lastSlash = cleaned.lastIndexOf("/");
  const lastColon = cleaned.lastIndexOf(":");
  const sep = Math.max(lastSlash, lastColon);
  if (sep === -1) throw new Error(`Cannot extract repo name from: "${input}"`);
  return cleaned.slice(sep + 1);
}

/**
 * Run a git command in the given directory. Returns stdout on success.
 * Throws with stderr on failure.
 */
export function runGit(args: string[], cwd: string): string {
  try {
    return execSync(`git ${args.join(" ")}`, { cwd, encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch (err: unknown) {
    const msg = (err as { stderr?: string }).stderr?.trim() || String(err);
    throw new Error(msg);
  }
}

/**
 * Run a git command asynchronously. Resolves with stdout, rejects with stderr.
 */
/**
 * Get the current branch name for a repository.
 */
export function getCurrentBranch(cwd: string): string {
  return runGit(["rev-parse", "--abbrev-ref", "HEAD"], cwd);
}

/**
 * Run a git command asynchronously. Resolves with stdout, rejects with stderr.
 */
export function runGitAsync(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn("git", args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d));
    proc.stderr.on("data", (d) => (stderr += d));
    proc.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(stderr.trim() || `git exited with code ${code}`));
    });
  });
}
