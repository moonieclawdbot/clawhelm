import { describe, expect, it, vi } from "vitest";

import { buildRuntimeState, createBeforeModelResolveHandler } from "./runtime.js";
import type { OpenClawPluginApi } from "./types.js";

function makeApi(config: OpenClawPluginApi["config"], pluginConfig?: Record<string, unknown>) {
  return {
    id: "clawhelm",
    name: "clawhelm",
    source: "local",
    config,
    pluginConfig,
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
    registerProvider: vi.fn(),
    registerTool: vi.fn(),
    registerHook: vi.fn(),
    registerHttpRoute: vi.fn(),
    registerService: vi.fn(),
    registerCommand: vi.fn(),
    resolvePath: vi.fn((x: string) => x),
    on: vi.fn(),
  } satisfies OpenClawPluginApi;
}

function makeBaseConfig() {
  return {
    models: {
      providers: {
        openai: {
          baseUrl: "https://api.openai.com",
          apiKey: "test-key",
          models: [
            {
              id: "openai/gpt-4o-mini",
              name: "GPT-4o mini",
              reasoning: false,
              input: ["text" as const],
              cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 4096,
            },
            {
              id: "openai/gpt-5.3-codex",
              name: "GPT-5.3",
              reasoning: true,
              input: ["text" as const],
              cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
              contextWindow: 128000,
              maxTokens: 4096,
            },
          ],
        },
      },
    },
  };
}

describe("runtime routing", () => {
  it("applies model override from before_model_resolve hook", async () => {
    const api = makeApi(makeBaseConfig(), {
      routing: {
        tiers: {
          SIMPLE: { primary: "openai/gpt-4o-mini", fallback: [] },
          MEDIUM: { primary: "openai/gpt-4o-mini", fallback: [] },
          COMPLEX: { primary: "openai/gpt-5.3-codex", fallback: [] },
          REASONING: { primary: "openai/gpt-5.3-codex", fallback: [] },
        },
        scoring: {
          confidenceThreshold: 0.99,
          simpleKeywords: [],
          technicalKeywords: [],
          creativeKeywords: [],
          codeKeywords: [],
          reasoningKeywords: ["prove", "theorem"],
          imperativeVerbs: [],
          constraintIndicators: [],
          outputFormatKeywords: [],
          referenceKeywords: [],
          negationKeywords: [],
          domainSpecificKeywords: [],
          agenticTaskKeywords: [],
        },
      },
    });

    const state = buildRuntimeState(api);
    const handler = createBeforeModelResolveHandler(state, api);

    const result = await handler({ prompt: "Prove the theorem" }, { trigger: "user" });

    expect(result?.modelOverride).toBe("openai/gpt-5.3-codex");
  });

  it("uses LLM fallback when local classifier is ambiguous", async () => {
    const api = makeApi(makeBaseConfig(), {
      routing: {
        classifier: { llmModel: "openai/gpt-4o-mini", llmMaxTokens: 10, llmTemperature: 0 },
        tiers: {
          SIMPLE: { primary: "openai/gpt-4o-mini", fallback: [] },
          MEDIUM: { primary: "openai/gpt-4o-mini", fallback: [] },
          COMPLEX: { primary: "openai/gpt-5.3-codex", fallback: [] },
          REASONING: { primary: "openai/gpt-5.3-codex", fallback: [] },
        },
        scoring: {
          confidenceThreshold: 0.999999,
        },
      },
    });

    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ choices: [{ message: { content: "COMPLEX" } }] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    vi.stubGlobal("fetch", fetchMock);
    const state = buildRuntimeState(api);
    const handler = createBeforeModelResolveHandler(state, api);

    const result = await handler({ prompt: "neutral prompt" }, { trigger: "heartbeat" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result?.modelOverride).toBe("openai/gpt-5.3-codex");
    vi.unstubAllGlobals();
  });

  it("fails closed when configured allowlist is empty", () => {
    const api = makeApi(makeBaseConfig(), {
      routing: {
        allowedModels: ["   "],
      },
    });

    expect(() => buildRuntimeState(api)).toThrow(
      "plugins.clawhelm.routing.allowedModels is configured but empty after normalization.",
    );
  });

  it("never returns model override outside allowlist (including heartbeat trigger)", async () => {
    const api = makeApi(makeBaseConfig(), {
      routing: {
        allowedModels: ["openai/gpt-4o-mini"],
        tiers: {
          SIMPLE: { primary: "openai/gpt-5.3-codex", fallback: [] },
          MEDIUM: { primary: "openai/gpt-5.3-codex", fallback: [] },
          COMPLEX: { primary: "openai/gpt-5.3-codex", fallback: [] },
          REASONING: { primary: "openai/gpt-5.3-codex", fallback: [] },
        },
      },
    });

    const state = buildRuntimeState(api);
    const handler = createBeforeModelResolveHandler(state, api);

    const result = await handler({ prompt: "Prove theorem" }, { trigger: "heartbeat" });

    expect(result).toBeUndefined();
    expect(api.logger.error).toHaveBeenCalled();
  });
});
