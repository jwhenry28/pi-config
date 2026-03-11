/**
 * Centralized cwd resolution for extensions.
 *
 * Uses globalThis to share state across module systems (vitest vs jiti).
 * Extensions are loaded via jiti.import() which creates separate module
 * instances from vitest's module system, so a plain module-level variable
 * would not be visible to extensions when set from test code.
 */

const CWD_OVERRIDE_KEY = "__pi_cwd_override__";

/**
 * Set a cwd override. All subsequent getCwd() calls return this value.
 * Used by createComponentTest to redirect extension data I/O to a temp dir.
 */
export function setCwdOverride(cwd: string): void {
  (globalThis as any)[CWD_OVERRIDE_KEY] = cwd;
}

/**
 * Clear the cwd override. getCwd() reverts to using ctx.cwd.
 */
export function clearCwdOverride(): void {
  delete (globalThis as any)[CWD_OVERRIDE_KEY];
}

/**
 * Resolve the current working directory for extension data operations.
 * Returns the override if set, otherwise ctx.cwd. Throws if neither is available.
 */
export function getCwd(ctx: { cwd?: string }): string {
  const override = (globalThis as any)[CWD_OVERRIDE_KEY];
  if (override) return override;
  if (ctx.cwd) return ctx.cwd;
  throw new Error("No cwd available: no override set and ctx.cwd is empty/missing");
}
