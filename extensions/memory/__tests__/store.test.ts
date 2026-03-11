import { describe, it, expect, afterEach } from "vitest";
import { makeStoreName, purgeStore } from "../../testutils/index.js";
import {
  validateStore,
  validateKey,
  createStore,
  addEntry,
  getEntry,
  listKeys,
  deleteEntry,
  listStoreNames,
  readKey,
  writeKey,
  ensureStore,
  readStore,
  registerReservedStore,
  isReservedStore,
  clearReservedStores,
} from "../store.js";

const cwd = process.cwd();
const stores: string[] = [];

function freshStore(): string {
  const name = makeStoreName("test-mem-");
  stores.push(name);
  return name;
}

afterEach(() => {
  for (const s of stores) purgeStore(cwd, s);
  stores.length = 0;
  clearReservedStores();
});

// ── validateStore ──────────────────────────────────────────────────

describe("validateStore", () => {
  it("returns null for valid names", () => {
    expect(validateStore("my-store_1")).toBeNull();
  });

  it("returns error for invalid characters", () => {
    expect(validateStore("bad store!")).toContain("must match");
  });

  it("returns error for empty string", () => {
    expect(validateStore("")).toContain("must match");
  });
});

// ── validateKey ────────────────────────────────────────────────────

describe("validateKey", () => {
  it("returns null for valid keys", () => {
    expect(validateKey("my-key")).toBeNull();
  });

  it("returns error for 'metadata'", () => {
    expect(validateKey("metadata")).toContain("reserved");
  });

  it("returns error for empty string", () => {
    expect(validateKey("")).toContain("empty");
  });
});

// ── createStore ────────────────────────────────────────────────────

describe("createStore", () => {
  it("creates a new store and returns confirmation", () => {
    const name = freshStore();
    const result = createStore(cwd, name);

    expect(result).toContain("Created");
    expect(readStore(cwd, name)).not.toBeNull();
  });

  it("returns error for duplicate store", () => {
    const name = freshStore();
    createStore(cwd, name);
    const result = createStore(cwd, name);

    expect(result).toContain("Error");
    expect(result).toContain("already exists");
  });

  it("returns error for invalid name", () => {
    const result = createStore(cwd, "bad name!");

    expect(result).toContain("Error");
  });
});

// ── addEntry ───────────────────────────────────────────────────────

describe("addEntry", () => {
  it("adds a base64-encoded value and updates last_updated", async () => {
    const name = freshStore();
    createStore(cwd, name);
    const before = readStore(cwd, name)!.metadata.last_updated;

    // Ensure at least 1ms passes so the timestamp differs
    await new Promise((r) => setTimeout(r, 5));

    const result = addEntry(cwd, name, "key1", "hello world");

    expect(result).toContain("Added");
    const data = readStore(cwd, name)!;
    expect(Buffer.from(data.entries["key1"], "base64").toString()).toBe("hello world");
    expect(data.metadata.last_updated).not.toBe(before);
  });

  it("returns error for missing store", () => {
    expect(addEntry(cwd, "nonexistent", "k", "v")).toContain("does not exist");
  });

  it("returns error for reserved key 'metadata'", () => {
    const name = freshStore();
    createStore(cwd, name);

    expect(addEntry(cwd, name, "metadata", "v")).toContain("reserved");
  });

  it("returns error for invalid store name", () => {
    expect(addEntry(cwd, "bad name", "k", "v")).toContain("Error");
  });
});

// ── getEntry ───────────────────────────────────────────────────────

describe("getEntry", () => {
  it("returns decoded value and updates last_visited", () => {
    const name = freshStore();
    createStore(cwd, name);
    addEntry(cwd, name, "k", "secret");

    const result = getEntry(cwd, name, "k");

    expect(result).toBe("secret");
  });

  it("returns error for missing key", () => {
    const name = freshStore();
    createStore(cwd, name);

    expect(getEntry(cwd, name, "nope")).toContain("not found");
  });

  it("returns error for missing store", () => {
    expect(getEntry(cwd, "nonexistent", "k")).toContain("does not exist");
  });
});

// ── listKeys ───────────────────────────────────────────────────────

describe("listKeys", () => {
  it("returns newline-separated keys", () => {
    const name = freshStore();
    createStore(cwd, name);
    addEntry(cwd, name, "a", "1");
    addEntry(cwd, name, "b", "2");

    expect(listKeys(cwd, name)).toBe("a\nb");
  });

  it("returns 'no entries' for empty store", () => {
    const name = freshStore();
    createStore(cwd, name);

    expect(listKeys(cwd, name)).toContain("no entries");
  });

  it("returns error for missing store", () => {
    expect(listKeys(cwd, "nonexistent")).toContain("does not exist");
  });
});

// ── deleteEntry ────────────────────────────────────────────────────

describe("deleteEntry", () => {
  it("removes a key and updates last_updated", () => {
    const name = freshStore();
    createStore(cwd, name);
    addEntry(cwd, name, "k", "v");

    const result = deleteEntry(cwd, name, "k");

    expect(result).toContain("Deleted");
    expect(readStore(cwd, name)!.entries["k"]).toBeUndefined();
  });

  it("returns error for missing key", () => {
    const name = freshStore();
    createStore(cwd, name);

    expect(deleteEntry(cwd, name, "nope")).toContain("not found");
  });

  it("returns error for missing store", () => {
    expect(deleteEntry(cwd, "nonexistent", "k")).toContain("does not exist");
  });

  it("returns error for reserved key 'metadata'", () => {
    const name = freshStore();
    createStore(cwd, name);

    expect(deleteEntry(cwd, name, "metadata")).toContain("reserved");
  });
});

// ── listStoreNames ─────────────────────────────────────────────────

describe("listStoreNames", () => {
  it("returns all store names", () => {
    const a = freshStore();
    const b = freshStore();
    createStore(cwd, a);
    createStore(cwd, b);

    const names = listStoreNames(cwd);

    expect(names).toContain(a);
    expect(names).toContain(b);
  });
});

// ── readKey / writeKey ─────────────────────────────────────────────

describe("readKey / writeKey", () => {
  it("writeKey auto-creates store and round-trips value", () => {
    const name = freshStore();

    writeKey(cwd, name, "mykey", "myvalue");

    expect(readKey(cwd, name, "mykey")).toBe("myvalue");
  });

  it("readKey returns null for missing store", () => {
    expect(readKey(cwd, "nonexistent-xyz", "k")).toBeNull();
  });

  it("readKey returns null for missing key", () => {
    const name = freshStore();
    createStore(cwd, name);

    expect(readKey(cwd, name, "nope")).toBeNull();
  });
});

// ── ensureStore ────────────────────────────────────────────────────

describe("ensureStore", () => {
  it("creates store if missing", () => {
    const name = freshStore();

    ensureStore(cwd, name);

    expect(readStore(cwd, name)).not.toBeNull();
  });

  it("is idempotent — does not overwrite existing data", () => {
    const name = freshStore();
    createStore(cwd, name);
    addEntry(cwd, name, "k", "v");

    ensureStore(cwd, name);

    expect(readStore(cwd, name)!.entries["k"]).toBeDefined();
  });
});

// ── reserved stores ────────────────────────────────────────────────

describe("reserved stores", () => {
  it("isReservedStore returns null for non-reserved store", () => {
    expect(isReservedStore("some-random-store")).toBeNull();
  });

  it("registerReservedStore registers and auto-creates store", () => {
    const store = freshStore();
    expect(readStore(cwd, store)).toBeNull();
    registerReservedStore(cwd, store, "test-extension");
    expect(isReservedStore(store)).toBe("test-extension");
    expect(readStore(cwd, store)).not.toBeNull();
  });

  it("registerReservedStore is idempotent", () => {
    const store = freshStore();
    registerReservedStore(cwd, store, "ext-a");
    registerReservedStore(cwd, store, "ext-b");
    expect(isReservedStore(store)).toBe("ext-b");
  });

  it("registerReservedStore throws on invalid store name", () => {
    expect(() => registerReservedStore(cwd, "bad name!", "ext")).toThrow();
  });

  it("createStore returns error for reserved store", () => {
    const store = freshStore();
    registerReservedStore(cwd, store, "test-ext");
    const result = createStore(cwd, store);
    expect(result).toBe(`Error: Store "${store}" is reserved by test-ext and cannot be created manually`);
  });
});
