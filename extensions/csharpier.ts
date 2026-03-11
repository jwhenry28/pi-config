/**
 * CSharpier Extension
 *
 * Automatically runs CSharpier on .cs files after they are written or edited.
 * Similar to VS Code's editor.formatOnSave functionality.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.on("tool_result", async (event, ctx) => {
		// Only care about write and edit tools
		if (event.toolName !== "write" && event.toolName !== "edit") {
			return undefined;
		}

		// Get the path from the input
		const path = event.input.path as string;

		// Only process .cs files
		if (!path.endsWith(".cs")) {
			return undefined;
		}

		// Skip if the write/edit failed
		if (event.isError) {
			return undefined;
		}

		// Run CSharpier on the file
		const { code, stderr } = await pi.exec("dotnet", ["csharpier", "format", path], {
			cwd: ctx.cwd,
		});

		if (code !== 0 && ctx.hasUI) {
			// Show error but don't block - CSharpier failure shouldn't break the workflow
			ctx.ui.notify(`CSharpier failed for ${path}: ${stderr}`, "warning");
		}

		return undefined;
	});

	// Also provide a command to run CSharpier on the entire project
	pi.registerCommand("format", {
		description: "Run CSharpier on the entire project",
		handler: async (_args, ctx) => {
			ctx.ui.notify("Running CSharpier on project...", "info");

			const { code, stdout, stderr } = await pi.exec("dotnet", ["csharpier", "format", "."], {
				cwd: ctx.cwd,
			});

			if (code === 0) {
				ctx.ui.notify("CSharpier completed successfully", "success");
			} else {
				ctx.ui.notify(`CSharpier failed: ${stderr || stdout}`, "error");
			}
		},
	});
}
