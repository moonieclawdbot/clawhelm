import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("ClawHelm identity metadata", () => {
  const repoRoot = process.cwd();

  it("uses ClawHelm package identity", () => {
    const packageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
      name: string;
      repository: { url: string };
    };

    expect(packageJson.name).toBe("@moonieclawdbot/clawhelm");
    expect(packageJson.repository.url).toContain("moonieclawdbot/clawhelm");
  });

  it("uses ClawHelm plugin identity", () => {
    const pluginJson = JSON.parse(
      readFileSync(join(repoRoot, "openclaw.plugin.json"), "utf8"),
    ) as { id: string; name: string };

    expect(pluginJson.id).toBe("clawhelm");
    expect(pluginJson.name).toBe("ClawHelm");
  });

  it("uses ClawHelm runtime plugin id", () => {
    const indexSource = readFileSync(join(repoRoot, "src", "index.ts"), "utf8");

    expect(indexSource).toContain('id: "clawhelm"');
    expect(indexSource).toContain('name: "ClawHelm"');
  });
});
