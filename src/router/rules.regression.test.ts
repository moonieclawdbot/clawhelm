import { describe, expect, it } from "vitest";

import { classifyByRules } from "./rules.js";
import type { ScoringConfig, Tier } from "./types.js";

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function makeScoringConfig(): ScoringConfig {
  return {
    tokenCountThresholds: { simple: 10, complex: 120 },
    codeKeywords: ["function", "class", "import", "const", "async", "return"],
    reasoningKeywords: ["prove", "theorem", "derive", "step by step", "logically"],
    simpleKeywords: ["hello", "what is", "translate", "who is", "capital of"],
    technicalKeywords: [
      "kubernetes",
      "architecture",
      "database",
      "algorithm",
      "distributed",
      "infrastructure",
    ],
    creativeKeywords: ["story", "poem", "brainstorm", "creative", "imagine", "write a"],
    imperativeVerbs: ["build", "design", "implement", "create", "optimize"],
    constraintIndicators: ["at most", "within", "maximum", "minimum", "limit"],
    outputFormatKeywords: ["json", "yaml", "table", "markdown"],
    referenceKeywords: ["above", "below", "the code", "attached", "earlier"],
    negationKeywords: ["do not", "avoid", "without", "never"],
    domainSpecificKeywords: ["quantum", "fpga", "zero-knowledge", "genomics"],
    agenticTaskKeywords: ["read file", "edit", "verify", "fix", "debug", "check the", "update the"],
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

type Case = {
  name: string;
  prompt: string;
  expectedTier: Tier | null;
  expectedSignals?: string[];
  minAgenticScore?: number;
};

const CASES: Case[] = [
  {
    name: "simple definition",
    prompt: "What is dependency injection?",
    expectedTier: "SIMPLE",
    expectedSignals: ["simple"],
  },
  {
    name: "simple translation",
    prompt: "Translate 'good morning' to Italian.",
    expectedTier: "SIMPLE",
    expectedSignals: ["simple"],
  },
  {
    name: "technical explanation can remain ambiguous",
    prompt: "Explain how database indexing works with a short practical example.",
    expectedTier: null,
  },
  {
    name: "medium structured response",
    prompt: "Summarize the tradeoffs of REST vs GraphQL in a markdown table.",
    expectedTier: "MEDIUM",
    expectedSignals: ["format"],
  },
  {
    name: "technical implementation can remain ambiguous near the boundary",
    prompt:
      "Build a distributed database migration plan. First analyze the architecture, then design the rollout steps, reference the attached code, and output the final plan in JSON within the latency limit.",
    expectedTier: null,
    expectedSignals: ["technical", "multi-step", "references"],
  },
  {
    name: "borderline creative brief remains ambiguous",
    prompt:
      "Write a creative story about a quantum archivist. First outline the plot, then write the story, then add a worldbuilding appendix in markdown, avoid cliches, and reference the attached lore notes.",
    expectedTier: null,
    expectedSignals: ["creative", "domain-specific", "multi-step", "references"],
  },
  {
    name: "reasoning proof",
    prompt: "Prove the theorem and derive the result step by step, logically.",
    expectedTier: "REASONING",
    expectedSignals: ["reasoning"],
  },
  {
    name: "reasoning with code constraints",
    prompt:
      "Derive the algorithm formally, prove correctness, and explain step by step why the runtime is at most O(n log n).",
    expectedTier: "REASONING",
    expectedSignals: ["reasoning", "constraints"],
  },
  {
    name: "agentic debugging task stays MEDIUM but shows strong agentic score",
    prompt:
      "Read file app.ts, debug the failure, edit the config, verify the fix, then update the deployment settings without breaking the attached integration flow.",
    expectedTier: "MEDIUM",
    expectedSignals: ["agentic", "references"],
    minAgenticScore: 0.6,
  },
  {
    name: "code-heavy implementation",
    prompt:
      "Implement an async function using import and const. First design the architecture, then write the code, return structured JSON, reference the attached API contract, and keep the solution within the maximum response size limit.",
    expectedTier: "COMPLEX",
    expectedSignals: ["code", "format", "multi-step", "references"],
  },
];

describe("classifyByRules regression coverage", () => {
  it.each(CASES)("classifies $name", ({ prompt, expectedTier, expectedSignals, minAgenticScore }) => {
    const result = classifyByRules(prompt, undefined, estimateTokens(prompt), makeScoringConfig());

    expect(result.tier).toBe(expectedTier);

    for (const expectedSignal of expectedSignals ?? []) {
      expect(result.signals.some((signal) => signal.startsWith(expectedSignal))).toBe(true);
    }

    if (minAgenticScore != null) {
      expect(result.agenticScore).toBeGreaterThanOrEqual(minAgenticScore);
    }
  });
});
