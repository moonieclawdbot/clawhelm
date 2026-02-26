import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("plugin command surface", () => {
  it("does not register wallet/stats commands in plugin register path", () => {
    const indexSource = readFileSync(join(process.cwd(), "src", "index.ts"), "utf8");

    expect(indexSource).not.toContain('name: "wallet"');
    expect(indexSource).not.toContain('name: "stats"');
    expect(indexSource).not.toContain("api.registerCommand(");
  });
});
