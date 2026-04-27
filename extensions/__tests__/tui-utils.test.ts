import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtemp, rm, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import tuiUtilsExtension, { renderImage } from "../tui-utils.js";

const tempDirs: string[] = [];

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

describe("tui-utils render_image tool", () => {
  it("registers the render_image agent tool", () => {
    const registeredTools: any[] = [];
    const pi = {
      events: { emit: vi.fn() },
      registerTool: (tool: any) => registeredTools.push(tool),
    };

    tuiUtilsExtension(pi as any);

    expect(registeredTools).toHaveLength(1);
    expect(registeredTools[0].name).toBe("render_image");
    expect(registeredTools[0].label).toBe("Render Image");
    expect(pi.events.emit).toHaveBeenCalledWith("module:tool-tag", {
      toolName: "render_image",
      moduleName: "tui-utils",
    });
  });

  it("rejects missing, blank, nonexistent, directory, and unsupported filepaths", async () => {
    const dir = await makeTempDir();
    const unsupportedPath = path.join(dir, "image.txt");
    await writeFile(unsupportedPath, "not an image");

    await expect(renderImage({})).rejects.toThrow("filepath is required");
    await expect(renderImage({ filepath: "   " })).rejects.toThrow("filepath is required");
    await expect(renderImage({ filepath: path.join(dir, "missing.png") })).rejects.toThrow("Image file not found");
    await expect(renderImage({ filepath: dir })).rejects.toThrow("Unsupported image type");
    await expect(renderImage({ filepath: unsupportedPath })).rejects.toThrow("Unsupported image type");
  });

  it("rejects directories with supported image extensions", async () => {
    const dir = await makeTempDir();
    const directoryNamedLikeImage = path.join(dir, "folder.png");
    await mkdir(directoryNamedLikeImage);

    await expect(renderImage({ filepath: directoryNamedLikeImage })).rejects.toThrow("Image path is not a regular file");
  });

  it.each([
    ["png", "image/png"],
    ["jpg", "image/jpeg"],
    ["jpeg", "image/jpeg"],
    ["gif", "image/gif"],
    ["webp", "image/webp"],
  ])("accepts .%s files and returns metadata with image content", async (extension, mimeType) => {
    const dir = await makeTempDir();
    const filepath = path.join(dir, `sample.${extension}`);
    const fileBytes = Buffer.from([1, 2, 3, 4]);
    await writeFile(filepath, fileBytes);

    const result = await renderImage({ filepath });

    expect(result.details).toEqual({
      filepath,
      mime_type: mimeType,
      size_bytes: fileBytes.length,
    });
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(result.content[0].text).toContain(filepath);
    expect(result.content[1]).toMatchObject({
      type: "image",
      data: fileBytes.toString("base64"),
      mimeType,
    });
  });
});

async function makeTempDir() {
  const dir = await mkdtemp(path.join(tmpdir(), "pi-tui-utils-"));
  tempDirs.push(dir);
  return dir;
}
