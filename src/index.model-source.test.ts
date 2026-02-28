import { describe, expect, it, vi } from "vitest";

import plugin from "./index.js";
import type { ModelDefinitionConfig, OpenClawPluginApi } from "./types.js";

describe("plugin register model source", () => {
  it("keeps OpenClaw models unchanged across providers", async () => {
    const openaiModels: ModelDefinitionConfig[] = [
      {
        id: "openai/gpt-4o-mini",
        name: "GPT-4o mini",
        reasoning: false,
        input: ["text"],
        cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
    ];

    const anthropicModels: ModelDefinitionConfig[] = [
      {
        id: "anthropic/claude-sonnet-4.6",
        name: "Claude Sonnet 4.6",
        reasoning: true,
        input: ["text"],
        cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 8192,
      },
    ];

    const api: OpenClawPluginApi = {
      id: "clawhelm",
      name: "clawhelm",
      source: "local",
      config: {
        models: {
          providers: {
            openai: {
              baseUrl: "https://api.openai.com/v1",
              api: "openai-responses",
              models: openaiModels,
            },
            anthropic: {
              baseUrl: "https://api.anthropic.com/v1",
              api: "anthropic-messages",
              models: anthropicModels,
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

    expect(api.config.models?.providers?.openai?.models).toBe(openaiModels);
    expect(api.config.models?.providers?.anthropic?.models).toBe(anthropicModels);
  });
});
