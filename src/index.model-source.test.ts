import { describe, expect, it, vi } from "vitest";

import plugin from "./index.js";
import type { OpenClawPluginApi } from "./types.js";

describe("plugin register model source", () => {
  it("keeps OpenClaw-configured blockrun models unchanged", async () => {
    const configuredModels = [
      {
        id: "custom/configured-model",
        name: "Configured",
        reasoning: false,
        input: ["text"],
        cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
    ];

    const api: OpenClawPluginApi = {
      id: "clawhelm",
      name: "clawhelm",
      source: "local",
      config: {
        models: {
          providers: {
            clawhelm: {
              baseUrl: "http://127.0.0.1:8402/v1",
              api: "openai-completions",
              models: configuredModels,
            },
          },
        },
      },
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

    await plugin.register?.(api);

    const models = api.config.models?.providers?.clawhelm?.models;
    expect(models).toBe(configuredModels);
    expect(models?.[0]?.id).toBe("custom/configured-model");
  });
});
