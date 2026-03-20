import { describe, expect, it } from "vitest";

import { classifyByRules } from "./rules.js";
import type { ScoringConfig } from "./types.js";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function makeBoundaryConfig(): ScoringConfig {
  return {
    tokenCountThresholds: { simple: 10, complex: 200 },
    codeKeywords: ["function"],
    reasoningKeywords: ["prove", "theorem"],
    simpleKeywords: ["hello"],
    technicalKeywords: ["algorithm"],
    creativeKeywords: ["story"],
    imperativeVerbs: ["build"],
    constraintIndicators: ["within"],
    outputFormatKeywords: ["json"],
    referenceKeywords: ["attached"],
    negationKeywords: ["without"],
    domainSpecificKeywords: ["quantum"],
    agenticTaskKeywords: ["read file", "edit", "verify"],
    dimensionWeights: {
      tokenCount: 0,
      codePresence: 0,
      reasoningMarkers: 0,
      technicalTerms: 1,
      creativeMarkers: 0,
      simpleIndicators: 0,
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
      simpleMedium: -0.2,
      mediumComplex: 0.3,
      complexReasoning: 0.6,
    },
    confidenceSteepness: 12,
    confidenceThreshold: 0.7,
  };
}

describe("classifyByRules boundaries", () => {
  it("maps scores below simpleMedium to SIMPLE", () => {
    const config = makeBoundaryConfig();
    config.dimensionWeights.simpleIndicators = 1;
    config.dimensionWeights.technicalTerms = 0;

    const prompt = "hello";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), config);

    expect(result.score).toBeLessThan(config.tierBoundaries.simpleMedium);
    expect(result.tier).toBe("SIMPLE");
  });

  it("maps scores between simpleMedium and mediumComplex to MEDIUM", () => {
    const config = makeBoundaryConfig();

    const prompt = "algorithm";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), config);

    expect(result.score).toBeGreaterThanOrEqual(config.tierBoundaries.simpleMedium);
    expect(result.score).toBeLessThan(config.tierBoundaries.mediumComplex);
    expect(result.tier).toBe("MEDIUM");
  });

  it("maps scores between mediumComplex and complexReasoning to COMPLEX", () => {
    const config = makeBoundaryConfig();
    config.technicalKeywords = ["algorithm", "database"];
    config.dimensionWeights.technicalTerms = 0.5;
    config.dimensionWeights.outputFormat = 0.3;
    config.dimensionWeights.imperativeVerbs = 0.3;

    const prompt = "build algorithm database json";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), config);

    expect(result.score).toBeGreaterThanOrEqual(config.tierBoundaries.mediumComplex);
    expect(result.score).toBeLessThan(config.tierBoundaries.complexReasoning);
    expect(result.tier).toBe("COMPLEX");
  });

  it("maps scores above complexReasoning to REASONING", () => {
    const config = makeBoundaryConfig();
    config.dimensionWeights.reasoningMarkers = 1;

    const prompt = "prove theorem";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), config);

    expect(result.tier).toBe("REASONING");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
  });

  it("returns null when the score is too close to a boundary for the confidence threshold", () => {
    const config = makeBoundaryConfig();
    config.technicalKeywords = ["algorithm", "database"];
    config.dimensionWeights.technicalTerms = 0.62;
    config.confidenceThreshold = 0.8;

    const prompt = "algorithm database";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), config);

    expect(result.score).toBeGreaterThan(config.tierBoundaries.mediumComplex);
    expect(result.tier).toBeNull();
    expect(result.confidence).toBeLessThan(0.8);
  });

  it("ignores system prompt keywords for local scoring", () => {
    const config = makeBoundaryConfig();
    config.dimensionWeights.reasoningMarkers = 1;

    const prompt = "hello";
    const systemPrompt = "prove theorem step by step";
    const result = classifyByRules(prompt, systemPrompt, estimateTokens(`${systemPrompt} ${prompt}`), config);

    expect(result.tier).not.toBe("REASONING");
    expect(result.signals.some((signal) => signal.startsWith("reasoning"))).toBe(false);
  });
});
