import { existsSync, mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import plugin from "./index.js";
import type { OpenClawPluginApi } from "./types.js";

function makeApi(config: OpenClawPluginApi["config"]): OpenClawPluginApi {
  return {
    id: "clawhelm",
    name: "clawhelm",
    source: "local",
    config,
    pluginConfig: {},
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
    registerProvider: vi.fn(),
    registerTool: vi.fn(),
    registerHook: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerService: vi.fn(),
    registerCommand: vi.fn(),
    resolvePath: vi.fn((x: string) => x),
    on: vi.fn(),
  };
}

describe("plugin register behavior", () => {
  const tempHomes: string[] = [];
  const originalHome = process.env.HOME;

  afterEach(() => {
    process.env.HOME = originalHome;
    for (const dir of tempHomes.splice(0)) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("does not create or mutate OpenClaw config/auth files during register", async () => {
    const home = mkdtempSync(join(tmpdir(), "clawhelm-home-"));
    tempHomes.push(home);
    process.env.HOME = home;

    const openclawDir = join(home, ".openclaw");
    mkdirSync(openclawDir, { recursive: true });
    writeFileSync(join(openclawDir, "openclaw.json"), JSON.stringify({ existing: true }));

    const api = makeApi({
      models: { providers: { clawhelm: { baseUrl: "http://127.0.0.1:8402/v1", models: [] } } },
    });

    await plugin.register?.(api);

    expect(api.registerProvider).toHaveBeenCalledTimes(1);
    expect(existsSync(join(openclawDir, "agents"))).toBe(false);
    expect(readdirSync(openclawDir).sort()).toEqual(["openclaw.json"]);
  });

  it("uses configured models from clawhelm provider for routing visibility logs", async () => {
    const clawhelmApi = makeApi({
      models: {
        providers: {
          clawhelm: {
            baseUrl: "http://127.0.0.1:8402/v1",
            models: [
              {
                id: "custom/model",
                name: "Custom",
                reasoning: false,
                input: ["text"],
                cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
                contextWindow: 32000,
                maxTokens: 4096,
              },
            ],
          },
        },
      },
    });
    await plugin.register?.(clawhelmApi);
    expect(clawhelmApi.logger.info).toHaveBeenCalledWith(
      "ClawHelm provider registered (using 1 OpenClaw-configured models)",
    );
  });
});
