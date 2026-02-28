import { describe, expect, it } from "vitest";

import { getFallbackChain, selectModel } from "./selector.js";
import type { TierConfig } from "./types.js";

const TIER_CONFIGS: Record<"SIMPLE" | "MEDIUM" | "COMPLEX" | "REASONING", TierConfig> = {
  SIMPLE: { primary: "moonshot/kimi-k2.5", fallback: ["openai/gpt-4o-mini"] },
  MEDIUM: { primary: "moonshot/kimi-k2.5", fallback: [] },
  COMPLEX: { primary: "moonshot/kimi-k2.5", fallback: [] },
  REASONING: { primary: "moonshot/kimi-k2.5", fallback: [] },
};

describe("selectModel", () => {
  it("selects primary model from the configured tier chain", () => {
    const decision = selectModel("SIMPLE", 0.95, "rules", "test", TIER_CONFIGS);

    expect(decision.model).toBe("moonshot/kimi-k2.5");
    expect(decision.tier).toBe("SIMPLE");
    expect(decision.confidence).toBe(0.95);
  });
});

describe("getFallbackChain", () => {
  it("returns ordered model chain for the tier", () => {
    expect(getFallbackChain("SIMPLE", TIER_CONFIGS)).toEqual([
      "moonshot/kimi-k2.5",
      "openai/gpt-4o-mini",
    ]);
  });
});
