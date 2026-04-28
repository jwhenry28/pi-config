import { promises as fs } from "node:fs";
import path from "node:path";
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "typebox";
import { moduleTag } from "./modules/api.js";

const MIME_TYPES_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export default function tuiUtilsExtension(pi: ExtensionAPI) {
  pi.registerTool(
    moduleTag(pi, "tui-utils", {
      name: "render_image",
      label: "Render Image",
      description:
        "Display an existing local PNG, JPEG, GIF, or WebP image file when the runtime supports image tool content.",
      parameters: Type.Object({
        filepath: Type.String({
          description: "Path to an existing local image file (PNG, JPEG, GIF, or WebP).",
        }),
      }),
      async execute(_toolCallId, params) {
        return renderImage(params as { filepath?: unknown });
      },
    }),
  );
}

export async function renderImage(params: { filepath?: unknown }) {
  const imageFile = await readImageFile(params.filepath);
  const text = [
    `Rendered image: ${imageFile.filepath}`,
    `MIME type: ${imageFile.mime_type}`,
    `Size: ${imageFile.size_bytes} bytes`,
  ].join("\n");

  return {
    content: [
      { type: "text" as const, text },
      {
        type: "image" as const,
        data: imageFile.base64,
        mimeType: imageFile.mime_type,
      } as any,
    ],
    details: {
      filepath: imageFile.filepath,
      mime_type: imageFile.mime_type,
      size_bytes: imageFile.size_bytes,
    },
  };
}

async function readImageFile(filepath: unknown) {
  const resolvedPath = validateFilepath(filepath);
  const mimeType = getSupportedMimeType(resolvedPath);
  const stats = await statRegularFile(resolvedPath);
  const fileBuffer = await readFileBuffer(resolvedPath);

  return {
    filepath: resolvedPath,
    mime_type: mimeType,
    size_bytes: stats.size,
    base64: fileBuffer.toString("base64"),
  };
}

function validateFilepath(filepath: unknown): string {
  if (typeof filepath !== "string" || filepath.trim().length === 0) {
    throw new Error("filepath is required");
  }

  return path.resolve(filepath);
}

function getSupportedMimeType(filepath: string): string {
  const extension = path.extname(filepath).toLowerCase();
  const mimeType = MIME_TYPES_BY_EXTENSION[extension];
  if (!mimeType) {
    throw new Error("Unsupported image type; expected PNG, JPEG, GIF, or WebP");
  }

  return mimeType;
}

async function statRegularFile(filepath: string) {
  let stats;
  try {
    stats = await fs.stat(filepath);
  } catch (error) {
    throw new Error(`Image file not found: ${filepath}`);
  }

  if (!stats.isFile()) {
    throw new Error(`Image path is not a regular file: ${filepath}`);
  }

  return stats;
}

async function readFileBuffer(filepath: string): Promise<Buffer> {
  try {
    return await fs.readFile(filepath);
  } catch (error) {
    throw new Error(`Image file is not readable: ${filepath}`);
  }
}
