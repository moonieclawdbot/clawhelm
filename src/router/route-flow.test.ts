import { describe, expect, it } from "vitest";

import { route } from "./index.js";
import type { RoutingConfig } from "./types.js";

const modelPricing = new Map([
  ["simple/model", { inputPrice: 1, outputPrice: 1 }],
  ["medium/model", { inputPrice: 1, outputPrice: 1 }],
  ["complex/model", { inputPrice: 1, outputPrice: 1 }],
  ["reason/model", { inputPrice: 1, outputPrice: 1 }],
  ["agentic/model", { inputPrice: 1, outputPrice: 1 }],
  ["eco/model", { inputPrice: 1, outputPrice: 1 }],
  ["premium/model", { inputPrice: 1, outputPrice: 1 }],
  ["fallback/model", { inputPrice: 1, outputPrice: 1 }],
]);

function makeConfig(): RoutingConfig {
  return {
    version: "test",
    classifier: {
      llmModel: "simple/model",
      llmMaxTokens: 10,
      llmTemperature: 0,
      promptTruncationChars: 500,
      cacheTtlMs: 1000,
    },
    scoring: {
      tokenCountThresholds: { simple: 10, complex: 300 },
      codeKeywords: ["function", "class"],
      reasoningKeywords: ["prove", "theorem"],
      simpleKeywords: ["hello", "what is"],
      technicalKeywords: ["kubernetes"],
      creativeKeywords: ["story"],
      imperativeVerbs: ["build"],
      constraintIndicators: ["at most"],
      outputFormatKeywords: ["json"],
      referenceKeywords: ["above"],
      negationKeywords: ["do not"],
      domainSpecificKeywords: ["quantum"],
      agenticTaskKeywords: ["read file", "edit", "verify"],
      dimensionWeights: {
        tokenCount: 0,
        codePresence: 0,
        reasoningMarkers: 0,
        technicalTerms: 0,
        creativeMarkers: 0,
        simpleIndicators: 1,
        multiStepPatterns: 0,
        questionComplexity: 0,
        imperativeVerbs: 0,
        constraintCount: 0,
        outputFormat: 0,
        referenceComplexity: 0,
        negationComplexity: 0,
        domainSpecificity: 0,
        agenticTask: 0,
      },
      tierBoundaries: {
        simpleMedium: -0.5,
        mediumComplex: 0.1,
        complexReasoning: 0.5,
      },
      confidenceSteepness: 12,
      confidenceThreshold: 0.7,
    },
    modelPool: ["simple/model", "medium/model", "reason/model", "fallback/model"],
    tiers: {
      SIMPLE: { primary: "simple/model", fallback: [] },
      MEDIUM: { primary: "medium/model", fallback: ["fallback/model"] },
      COMPLEX: { primary: "complex/model", fallback: ["fallback/model"] },
      REASONING: { primary: "reason/model", fallback: [] },
    },
    agenticTiers: {
      SIMPLE: { primary: "agentic/model", fallback: [] },
      MEDIUM: { primary: "agentic/model", fallback: [] },
      COMPLEX: { primary: "agentic/model", fallback: [] },
      REASONING: { primary: "agentic/model", fallback: [] },
    },
    ecoTiers: {
      SIMPLE: { primary: "eco/model", fallback: [] },
      MEDIUM: { primary: "eco/model", fallback: [] },
      COMPLEX: { primary: "eco/model", fallback: [] },
      REASONING: { primary: "eco/model", fallback: [] },
    },
    premiumTiers: {
      SIMPLE: { primary: "premium/model", fallback: [] },
      MEDIUM: { primary: "premium/model", fallback: [] },
      COMPLEX: { primary: "premium/model", fallback: [] },
      REASONING: { primary: "premium/model", fallback: [] },
    },
    overrides: {
      maxTokensForceComplex: 999999,
      structuredOutputMinTier: "MEDIUM",
      ambiguousDefaultTier: "MEDIUM",
      agenticMode: false,
    },
  };
}

describe("route tier selection flow", () => {
  it("selects MEDIUM tier model from the modelPool-constrained chain", () => {
    const config = makeConfig();
    const decision = route("neutral prompt", undefined, 200, { config, modelPricing });

    expect(decision.tier).toBe("MEDIUM");
    expect(decision.model).toBe("medium/model");
  });

  it("upgrades to structured-output minimum tier", () => {
    const config = makeConfig();
    const decision = route("hello", "Respond as JSON", 200, { config, modelPricing });

    expect(decision.tier).toBe("MEDIUM");
    expect(decision.reasoning).toContain("upgraded to MEDIUM (structured output)");
  });

  it("uses agentic tier chain when agentic task is detected", () => {
    const config = makeConfig();
    config.modelPool = ["agentic/model", "fallback/model"];

    const decision = route("read file and edit then verify", undefined, 200, {
      config,
      modelPricing,
    });

    expect(decision.model).toBe("agentic/model");
    expect(decision.reasoning).toContain("| agentic");
  });

  it("uses eco and premium profile tier sets", () => {
    const baseConfig = makeConfig();
    baseConfig.modelPool = ["eco/model", "premium/model", "fallback/model"];

    const ecoDecision = route("neutral prompt", undefined, 200, {
      config: baseConfig,
      modelPricing,
      routingProfile: "eco",
    });
    expect(ecoDecision.model).toBe("eco/model");

    const premiumDecision = route("neutral prompt", undefined, 200, {
      config: baseConfig,
      modelPricing,
      routingProfile: "premium",
    });
    expect(premiumDecision.model).toBe("premium/model");
  });
});
