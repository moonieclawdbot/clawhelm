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
  it("splits provider and model overrides for configured codex refs", async () => {
    const api = makeApi(
      {
        models: {
          providers: {
            "openai-codex": {
              baseUrl: "https://api.openai.com/v1",
              apiKey: "test-key",
              models: [
                {
                  id: "openai-codex/gpt-5.4",
                  name: "GPT-5.4",
                  reasoning: true,
                  input: ["text" as const],
                  cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
                {
                  id: "openai-codex/gpt-5.3-codex",
                  name: "GPT-5.3 Codex",
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
      },
      {
        routing: {
          tiers: {
            SIMPLE: { primary: "openai-codex/gpt-5.4", fallback: [] },
            MEDIUM: { primary: "openai-codex/gpt-5.4", fallback: [] },
            COMPLEX: { primary: "openai-codex/gpt-5.4", fallback: [] },
            REASONING: { primary: "openai-codex/gpt-5.4", fallback: ["openai-codex/gpt-5.3-codex"] },
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
      },
    );

    const state = buildRuntimeState(api);
    const handler = createBeforeModelResolveHandler(state, api);

    const result = await handler({ prompt: "Prove the theorem" }, { trigger: "user" });

    expect(result).toEqual({
      providerOverride: "openai-codex",
      modelOverride: "gpt-5.4",
    });
  });

  it("preserves multi-segment model IDs for providers like openrouter", async () => {
    const api = makeApi(
      {
        models: {
          providers: {
            openrouter: {
              baseUrl: "https://openrouter.ai/api/v1",
              apiKey: "test-key",
              models: [
                {
                  id: "openrouter/openai/gpt-oss-120b:free",
                  name: "GPT OSS 120B Free",
                  reasoning: false,
                  input: ["text" as const],
                  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      },
      {
        routing: {
          tiers: {
            SIMPLE: { primary: "openrouter/openai/gpt-oss-120b:free", fallback: [] },
            MEDIUM: { primary: "openrouter/openai/gpt-oss-120b:free", fallback: [] },
            COMPLEX: { primary: "openrouter/openai/gpt-oss-120b:free", fallback: [] },
            REASONING: { primary: "openrouter/openai/gpt-oss-120b:free", fallback: [] },
          },
          scoring: {
            confidenceThreshold: 0.1,
          },
        },
      },
    );

    const state = buildRuntimeState(api);
    const handler = createBeforeModelResolveHandler(state, api);

    const result = await handler({ prompt: "hello" }, { trigger: "user" });

    expect(result).toEqual({
      providerOverride: "openrouter",
      modelOverride: "openai/gpt-oss-120b:free",
    });
  });

  it("keeps OpenClaw agent defaults unchanged while routing request-scoped overrides", async () => {
    const api = makeApi(
      {
        agents: {
          defaults: {
            model: {
              primary: "openai/gpt-4o-mini",
              fallbacks: ["openai/gpt-4o"],
            },
          },
        },
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
                  name: "GPT-5.3 Codex",
                  reasoning: true,
                  input: ["text" as const],
                  cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
                {
                  id: "openai/gpt-4o",
                  name: "GPT-4o",
                  reasoning: false,
                  input: ["text" as const],
                  cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
                  contextWindow: 128000,
                  maxTokens: 4096,
                },
              ],
            },
          },
        },
      },
      {
        routing: {
          tiers: {
            SIMPLE: { primary: "openai/gpt-4o-mini", fallback: [] },
            MEDIUM: { primary: "openai/gpt-4o-mini", fallback: [] },
            COMPLEX: { primary: "openai/gpt-4o-mini", fallback: [] },
            REASONING: {
              primary: "openai/gpt-5.3-codex",
              fallback: ["openai/gpt-4o", "openai/not-configured"],
            },
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
      },
    );

    const state = buildRuntimeState(api);
    const handler = createBeforeModelResolveHandler(state, api);

    const result = await handler({ prompt: "Prove the theorem" }, { trigger: "user" });

    expect(result).toEqual({
      providerOverride: "openai",
      modelOverride: "gpt-5.3-codex",
    });
    expect((api.config.agents as { defaults?: { model?: unknown } } | undefined)?.defaults?.model).toEqual({
      primary: "openai/gpt-4o-mini",
      fallbacks: ["openai/gpt-4o"],
    });
    expect(api.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("note=request-scoped-overrides-only"),
    );
    expect(api.logger.debug).toHaveBeenCalledWith(expect.stringContaining("why="));
  });
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

    expect(result?.providerOverride).toBe("openai");
    expect(result?.modelOverride).toBe("gpt-5.3-codex");
  });

  it("classifies using the extracted user prompt instead of metadata wrapper text", async () => {
    const api = makeApi(makeBaseConfig(), {
      routing: {
        tiers: {
          SIMPLE: { primary: "openai/gpt-4o-mini", fallback: [] },
          MEDIUM: { primary: "openai/gpt-5.3-codex", fallback: [] },
          COMPLEX: { primary: "openai/gpt-5.3-codex", fallback: [] },
          REASONING: { primary: "openai/gpt-5.3-codex", fallback: [] },
        },
      },
    });

    const state = buildRuntimeState(api);
    const handler = createBeforeModelResolveHandler(state, api);
    const wrappedPrompt = `Conversation info (untrusted metadata):
\`\`\`json
{"message_id":"2176"}
\`\`\`

Sender (untrusted metadata):
\`\`\`json
{"name":"Alessandro"}
\`\`\`

What is the capital of Italy? Answer with one word.`;

    const result = await handler({ prompt: wrappedPrompt }, { trigger: "user" });

    expect(result?.providerOverride).toBe("openai");
    expect(result?.modelOverride).toBe("gpt-4o-mini");
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
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe("gpt-4o-mini");
    expect(result?.providerOverride).toBe("openai");
    expect(result?.modelOverride).toBe("gpt-5.3-codex");
    vi.unstubAllGlobals();
  });

  it("falls back to an allowed configured classifier model when the preferred classifier is unavailable", async () => {
    const api = makeApi(makeBaseConfig(), {
      routing: {
        classifier: { llmModel: "openai/not-configured", llmMaxTokens: 10, llmTemperature: 0 },
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

    const result = await handler(
      { prompt: "neutral prompt fallback classifier" },
      { trigger: "heartbeat" },
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(String(url)).toBe("https://api.openai.com/v1/chat/completions");
    const body = JSON.parse(String(init.body)) as { model: string };
    expect(body.model).toBe("gpt-4o-mini");
    expect(result?.providerOverride).toBe("openai");
    expect(result?.modelOverride).toBe("gpt-5.3-codex");
    expect(api.logger.debug).toHaveBeenCalledWith(
      expect.stringContaining("LLM fallback classification via openai/gpt-4o-mini (SIMPLE tier primary)"),
    );
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
