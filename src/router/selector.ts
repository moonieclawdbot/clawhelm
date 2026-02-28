/**
 * Tier → Model Selection
 *
 * Maps a classification tier to the configured model chain.
 */

import type { Tier, TierConfig, RoutingDecision } from "./types.js";

/**
 * Select the primary model for a tier and build the RoutingDecision.
 */
export function selectModel(
  tier: Tier,
  confidence: number,
  method: "rules" | "llm",
  reasoning: string,
  tierConfigs: Record<Tier, TierConfig>,
): RoutingDecision {
  const tierConfig = tierConfigs[tier];
  const model = tierConfig.primary;

  return {
    model,
    tier,
    confidence,
    method,
    reasoning,
  };
}

/**
 * Get the ordered fallback chain for a tier: [primary, ...fallbacks].
 */
export function getFallbackChain(tier: Tier, tierConfigs: Record<Tier, TierConfig>): string[] {
  const config = tierConfigs[tier];
  return [config.primary, ...config.fallback];
}

/**
 * Get the fallback chain filtered by context length.
 * Only returns models that can handle the estimated total context.
 *
 * @param tier - The tier to get fallback chain for
 * @param tierConfigs - Tier configurations
 * @param estimatedTotalTokens - Estimated total context (input + output)
 * @param getContextWindow - Function to get context window for a model ID
 * @returns Filtered list of models that can handle the context
 */
export function getFallbackChainFiltered(
  tier: Tier,
  tierConfigs: Record<Tier, TierConfig>,
  estimatedTotalTokens: number,
  getContextWindow: (modelId: string) => number | undefined,
): string[] {
  const fullChain = getFallbackChain(tier, tierConfigs);

  // Filter to models that can handle the context
  const filtered = fullChain.filter((modelId) => {
    const contextWindow = getContextWindow(modelId);
    if (contextWindow === undefined) {
      // Unknown model - include it (let API reject if needed)
      return true;
    }
    // Add 10% buffer for safety
    return contextWindow >= estimatedTotalTokens * 1.1;
  });

  // If all models filtered out, return the original chain
  // (let the API error out - better than no options)
  if (filtered.length === 0) {
    return fullChain;
  }

  return filtered;
}
