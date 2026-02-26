import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("runtime bootstrap surface", () => {
  it("does not bootstrap wallet/proxy runtime from plugin register", () => {
    const indexSource = readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");

    expect(indexSource).not.toContain("resolveOrGenerateWalletKey(");
    expect(indexSource).not.toContain("startProxyInBackground(");
    expect(indexSource).not.toContain("api.registerService(");
  });
});
