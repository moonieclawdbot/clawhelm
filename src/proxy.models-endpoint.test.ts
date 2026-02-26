import { describe, expect, it } from "vitest";

import { buildProxyModelList } from "./proxy.js";
import type { ModelDefinitionConfig } from "./types.js";

describe("buildProxyModelList", () => {
  it("returns unique model IDs from configured model source", () => {
    const configured: ModelDefinitionConfig[] = [
      {
        id: "custom/mini",
        name: "Custom Mini",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
      {
        id: "custom/mini",
        name: "Custom Mini Duplicate",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
      {
        id: "custom/reasoner",
        name: "Custom Reasoner",
        reasoning: true,
        input: ["text"],
        cost: { input: 0.3, output: 0.6, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 128000,
        maxTokens: 8192,
      },
    ];

    const list = buildProxyModelList(1234567890, configured);
    expect(list.map((m) => m.id)).toEqual(["custom/mini", "custom/reasoner"]);
  });

  it("uses OpenClaw fallback model when configured model source is missing", () => {
    const list = buildProxyModelList(1234567890, undefined, "openai/gpt-4o-mini");
    expect(list.map((m) => m.id)).toEqual(["openai/gpt-4o-mini"]);
  });

  it("throws when neither configured models nor OpenClaw fallback model exist", () => {
    expect(() => buildProxyModelList(1234567890)).toThrow(
      "No configured models available for ClawHelm and no OpenClaw fallback model is configured",
    );
  });
});
