import { describe, expect, it } from "vitest";

import { classifyByRules } from "./rules.js";
import type { ScoringConfig } from "./types.js";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function makeScoringConfig(): ScoringConfig {
  return {
    tokenCountThresholds: { simple: 10, complex: 120 },
    codeKeywords: ["function", "class", "import", "const"],
    reasoningKeywords: ["prove", "theorem", "derive", "step by step"],
    simpleKeywords: ["hello", "what is", "translate"],
    technicalKeywords: ["kubernetes", "architecture", "database", "algorithm"],
    creativeKeywords: ["story", "poem", "brainstorm"],
    imperativeVerbs: ["build", "design", "implement"],
    constraintIndicators: ["at most", "within", "maximum"],
    outputFormatKeywords: ["json", "yaml", "table"],
    referenceKeywords: ["above", "below", "the code", "attached"],
    negationKeywords: ["do not", "avoid", "without"],
    domainSpecificKeywords: ["quantum", "fpga", "zero-knowledge"],
    agenticTaskKeywords: ["read file", "edit", "verify", "fix", "debug"],
    dimensionWeights: {
      tokenCount: 0.08,
      codePresence: 0.15,
      reasoningMarkers: 0.18,
      technicalTerms: 0.1,
      creativeMarkers: 0.05,
      simpleIndicators: 0.12,
      multiStepPatterns: 0.12,
      questionComplexity: 0.05,
      imperativeVerbs: 0.03,
      constraintCount: 0.04,
      outputFormat: 0.03,
      referenceComplexity: 0.02,
      negationComplexity: 0.01,
      domainSpecificity: 0.02,
      agenticTask: 0.04,
    },
    tierBoundaries: {
      simpleMedium: -0.05,
      mediumComplex: 0.18,
      complexReasoning: 0.42,
    },
    confidenceSteepness: 12,
    confidenceThreshold: 0.65,
  };
}

describe("classifyByRules", () => {
  it("classifies a simple factual prompt as SIMPLE", () => {
    const prompt = "What is recursion?";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), makeScoringConfig());

    expect(result.tier).toBe("SIMPLE");
    expect(result.confidence).toBeGreaterThanOrEqual(0.65);
    expect(result.signals).toContain("simple (what is)");
  });

  it("classifies a complex implementation prompt as COMPLEX", () => {
    const prompt =
      "Build a kubernetes architecture for a database-backed service. First design the deployment, then implement the config in JSON using const values and import statements, reference the attached code, and keep it within the maximum latency budget without downtime.";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), makeScoringConfig());

    expect(result.tier).toBe("COMPLEX");
    expect(result.confidence).toBeGreaterThanOrEqual(0.65);
    expect(result.signals.some((signal) => signal.startsWith("technical"))).toBe(true);
    expect(result.signals).toContain("multi-step");
  });

  it("classifies reasoning-heavy prompts as REASONING", () => {
    const prompt = "Prove the theorem and derive the result step by step.";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), makeScoringConfig());

    expect(result.tier).toBe("REASONING");
    expect(result.confidence).toBeGreaterThanOrEqual(0.85);
    expect(result.signals.some((signal) => signal.startsWith("reasoning"))).toBe(true);
  });

  it("does not let system prompt reasoning text force REASONING for a simple user prompt", () => {
    const prompt = "hello";
    const systemPrompt = "Think step by step and derive the answer formally.";
    const result = classifyByRules(prompt, systemPrompt, estimateTokens(`${systemPrompt} ${prompt}`), makeScoringConfig());

    expect(result.tier).not.toBe("REASONING");
    expect(result.tier).toBe("SIMPLE");
  });

  it("reports agentic score when the prompt contains agentic task signals", () => {
    const prompt = "Read file, edit the config, debug the failure, then verify the fix.";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), makeScoringConfig());

    expect(result.agenticScore).toBeGreaterThanOrEqual(0.6);
    expect(result.signals.some((signal) => signal.startsWith("agentic"))).toBe(true);
  });

  it("returns null tier for low-confidence ambiguous prompts", () => {
    const config = makeScoringConfig();
    config.confidenceThreshold = 0.99;

    const prompt = "Neutral prompt with no strong routing signals.";
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), config);

    expect(result.tier).toBeNull();
    expect(result.confidence).toBeLessThan(0.99);
  });
});
