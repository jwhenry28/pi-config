import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { readKey } from "../memory/store.js";
import { applyProfile } from "./apply.js";
import { listProfileFiles, readProfileYaml } from "./loader.js";
import { parseAndValidateProfile } from "./schema.js";
import { completeNames } from "../shared/yaml-files.js";

const ACTIVE_PROFILE_DOMAIN = "pi-config";
const ACTIVE_PROFILE_KEY = "active-profile";

const SUBCOMMANDS: AutocompleteItem[] = [
  { value: "list", label: "list — List profiles from .pi/profiles" },
  { value: "set", label: "set <name> — Apply a profile" },
  { value: "show", label: "show <name> — Show profile YAML" },
  { value: "help", label: "help — Show help message" },
];

function formatApplySummary(profileName: string, updatedKeys: string[], warnings: string[]): string {
  const updatedSummary = updatedKeys.length > 0
    ? `Updated ${updatedKeys.length} workflow model key(s): ${updatedKeys.join(", ")}`
    : "Updated 0 workflow model keys.";

  if (warnings.length === 0) {
    return [`Applied profile: ${profileName}`, updatedSummary].join("\n");
  }

  const warningLines = warnings.map((warning) => `- ${warning}`);
  return [
    `Applied profile: ${profileName}`,
    updatedSummary,
    `Warnings (${warnings.length}):`,
    ...warningLines,
  ].join("\n");
}

function parseSubcommand(args: string): { subcommand: string; value: string } {
  const trimmed = args.trim();
  if (!trimmed) {
    return { subcommand: "", value: "" };
  }

  const parts = trimmed.split(/\s+/);
  const subcommand = parts[0] ?? "";
  const value = parts.slice(1).join(" ");
  return { subcommand, value };
}

export default function profilesExtension(pi: ExtensionAPI) {
  let cwd = "";

  pi.on("session_start", async (_event, ctx) => {
    cwd = ctx.cwd;
  });

  pi.registerCommand("profile", {
    description: "Manage model profiles in .pi/profiles",
    getArgumentCompletions: (prefix) => {
      const hasTrailingSpace = prefix.endsWith(" ");
      const trimmed = prefix.trim();

      if (!trimmed) {
        return SUBCOMMANDS;
      }

      const parts = trimmed.split(/\s+/);
      const subcommand = parts[0] ?? "";
      const subcommandPrefix = hasTrailingSpace ? "" : subcommand;

      if (parts.length === 1 && !hasTrailingSpace) {
        const matches = SUBCOMMANDS.filter((item) => item.value.startsWith(subcommandPrefix));
        return matches.length > 0 ? matches : null;
      }

      const supportsProfileName = subcommand === "set" || subcommand === "show";
      if (!supportsProfileName) {
        return null;
      }

      const namePrefix = hasTrailingSpace ? "" : (parts[1] ?? "");
      const profileNames = listProfileFiles(cwd).map((file) => file.basename);
      const nameMatches = completeNames(namePrefix, profileNames);
      if (!nameMatches) {
        return null;
      }

      return nameMatches.map((item) => ({
        value: `${subcommand} ${item.value}`,
        label: item.label,
      }));
    },
    handler: async (args, ctx) => {
      const { subcommand, value } = parseSubcommand(args);

      if (!subcommand || subcommand === "help") {
        ctx.ui.notify(
          [
            "Usage: /profile <subcommand> [args...]",
            "",
            "  list                 List profiles from .pi/profiles",
            "  set <name>           Apply a profile to workflow_models memory",
            "  show <name>          Show raw YAML for a profile",
            "  help                 Show this help message",
          ].join("\n"),
          "info",
        );
        return;
      }

      if (subcommand === "list") {
        const activeProfile = readKey(ctx.cwd, ACTIVE_PROFILE_DOMAIN, ACTIVE_PROFILE_KEY);
        const files = listProfileFiles(ctx.cwd);
        if (files.length === 0) {
          ctx.ui.notify("No profiles found in .pi/profiles", "info");
          return;
        }

        const lines = files.map((file) => {
          try {
            const loaded = readProfileYaml(ctx.cwd, file.basename);
            const parsed = parseAndValidateProfile(loaded.content);
            const isActive = activeProfile === parsed.profile.name;
            const activeSuffix = isActive ? " (active)" : "";
            const warningSuffix = parsed.warnings.length > 0 ? ` (warnings: ${parsed.warnings.length})` : "";
            return `- ${file.basename}${activeSuffix}${warningSuffix}`;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return `- ${file.basename} (invalid: ${message})`;
          }
        });

        ctx.ui.notify(lines.join("\n"), "info");
        return;
      }

      if (subcommand === "show") {
        if (!value) {
          ctx.ui.notify("Usage: /profile show <name>", "warning");
          return;
        }

        try {
          const loaded = readProfileYaml(ctx.cwd, value);
          ctx.ui.notify(loaded.content, "info");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify(message, "error");
        }
        return;
      }

      if (subcommand === "set") {
        if (!value) {
          ctx.ui.notify("Usage: /profile set <name>", "warning");
          return;
        }

        try {
          const loaded = readProfileYaml(ctx.cwd, value);
          const { profile, warnings } = parseAndValidateProfile(loaded.content);
          const result = applyProfile(profile, ctx, warnings);
          const summary = formatApplySummary(profile.name, result.updatedKeys, result.warnings);
          ctx.ui.notify(summary, "info");
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          ctx.ui.notify(message, "error");
        }
        return;
      }

      ctx.ui.notify(`Unknown subcommand: ${subcommand}. Use list, set, show, or help.`, "warning");
    },
  });
}
