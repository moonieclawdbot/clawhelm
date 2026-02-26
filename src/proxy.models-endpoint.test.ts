import { describe, expect, it } from "vitest";

import { buildProxyModelList } from "./proxy.js";
import type { ModelDefinitionConfig } from "./types.js";

describe("buildProxyModelList", () => {
  it("includes alias models used by /model commands", () => {
    const list = buildProxyModelList(1234567890);
    const ids = new Set(list.map((model) => model.id));

    expect(ids.has("flash")).toBe(true);
    expect(ids.has("kimi")).toBe(true);
    expect(ids.has("free")).toBe(true);
    expect(ids.has("google/gemini-2.5-flash")).toBe(true);
    expect(ids.has("moonshot/kimi-k2.5")).toBe(true);
  });

  it("returns unique model IDs", () => {
    const list = buildProxyModelList(1234567890);
    const ids = list.map((model) => model.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses configured model source when provided", () => {
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
        id: "mini",
        name: "mini alias",
        reasoning: false,
        input: ["text"],
        cost: { input: 0.1, output: 0.2, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
    ];

    const list = buildProxyModelList(1234567890, configured);
    expect(list.map((m) => m.id)).toEqual(["custom/mini", "mini"]);
  });
});
