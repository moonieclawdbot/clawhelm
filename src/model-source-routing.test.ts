import { describe, expect, it } from "vitest";

import { buildModelPricing } from "./proxy.js";
import { route, DEFAULT_ROUTING_CONFIG } from "./router/index.js";
import type { ModelDefinitionConfig } from "./types.js";

describe("configured model source routing", () => {
  it("keeps local rule classification while using configured model pricing", () => {
    const configuredModels: ModelDefinitionConfig[] = [
      {
        id: "custom/simple",
        name: "Custom Simple",
        reasoning: false,
        input: ["text"],
        cost: { input: 2, output: 4, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
      {
        id: "anthropic/claude-opus-4-5",
        name: "Baseline",
        reasoning: true,
        input: ["text"],
        cost: { input: 10, output: 20, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 200000,
        maxTokens: 8192,
      },
    ];

    const modelPricing = buildModelPricing(configuredModels);

    const config = {
      ...DEFAULT_ROUTING_CONFIG,
      tiers: {
        ...DEFAULT_ROUTING_CONFIG.tiers,
        SIMPLE: { primary: "custom/simple", fallback: [] },
      },
    };

    const decision = route("What is 2+2?", undefined, 100, {
      config,
      modelPricing,
      routingProfile: "auto",
    });

    expect(decision.method).toBe("rules");
    expect(decision.tier).toBe("SIMPLE");
    expect(decision.model).toBe("custom/simple");
    expect(decision.costEstimate).toBeGreaterThan(0);
    expect(decision.baselineCost).toBeGreaterThan(decision.costEstimate);
  });

  it("normalizes blockrun/ prefix from configured model IDs", () => {
    const modelPricing = buildModelPricing([
      {
        id: "blockrun/custom/reasoner",
        name: "Custom Reasoner",
        reasoning: true,
        input: ["text"],
        cost: { input: 1, output: 1, cacheRead: 0, cacheWrite: 0 },
        contextWindow: 32000,
        maxTokens: 4096,
      },
    ]);

    expect(modelPricing.has("custom/reasoner")).toBe(true);
  });

  it("uses OpenClaw fallback model pricing when configured model source is missing", () => {
    const modelPricing = buildModelPricing(undefined, "openai/gpt-4o-mini");
    expect(modelPricing.has("openai/gpt-4o-mini")).toBe(true);
  });

  it("throws when neither configured models nor OpenClaw fallback model exist", () => {
    expect(() => buildModelPricing()).toThrow(
      "No configured models available for ClawHelm and no OpenClaw fallback model is configured",
    );
  });
});
