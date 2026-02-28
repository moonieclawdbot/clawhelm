/**
 * @blockrun/clawrouter
 *
 * Smart LLM router for OpenClaw — 30+ models, x402 micropayments, 78% cost savings.
 * Routes each request to the cheapest model that can handle it.
 *
 * Usage:
 *   # Install the plugin
 *   openclaw plugins install @blockrun/clawrouter
 *
 *   # Fund your wallet with USDC on Base (address printed on install)
 *
 *   # Use smart routing (auto-picks cheapest model)
 *   openclaw models set blockrun/auto
 *
 *   # Or use any specific BlockRun model
 *   openclaw models set openai/gpt-5.2
 */

import type { OpenClawPluginDefinition, OpenClawPluginApi } from "./types.js";
import { clawhelmProvider } from "./provider.js";
import type { RoutingConfig } from "./router/index.js";
import { VERSION } from "./version.js";

/**
 * Detect if we're running in shell completion mode.
 * When `openclaw completion --shell zsh` runs, it loads plugins but only needs
 * the completion script output - any stdout logging pollutes the script and
 * causes zsh to interpret colored text like `[plugins]` as glob patterns.
 */
function isCompletionMode(): boolean {
  const args = process.argv;
  // Check for: openclaw completion --shell <shell>
  // argv[0] = node/bun, argv[1] = openclaw, argv[2] = completion
  return args.some((arg, i) => arg === "completion" && i >= 1 && i <= 3);
}

const plugin: OpenClawPluginDefinition = {
  id: "clawhelm",
  name: "ClawHelm",
  description: "Task-aware routing for OpenClaw using local classification and configured models",
  version: VERSION,

  async register(api: OpenClawPluginApi) {
    // Check if ClawRouter is disabled via environment variable
    // Usage: CLAWROUTER_DISABLED=true openclaw gateway start
    const isDisabled =
      process["env"].CLAWROUTER_DISABLED === "true" || process["env"].CLAWROUTER_DISABLED === "1";
    if (isDisabled) {
      api.logger.info("ClawRouter disabled (CLAWROUTER_DISABLED=true). Using default routing.");
      return;
    }

    // Skip heavy initialization in completion mode — only completion script is needed
    // Logging to stdout during completion pollutes the script and causes zsh errors
    if (isCompletionMode()) {
      api.registerProvider(clawhelmProvider);
      return;
    }

    // Register ClawHelm provider (sync — available immediately)
    api.registerProvider(clawhelmProvider);

    const configuredProviders = api.config.models?.providers;
    const configuredModels = configuredProviders?.clawhelm?.models;
    const configuredModelCount = Array.isArray(configuredModels) ? configuredModels.length : 0;

    api.logger.info(
      configuredModelCount > 0
        ? `ClawHelm provider registered (using ${configuredModelCount} OpenClaw-configured models)`
        : "ClawHelm provider registered (no OpenClaw-configured models detected)",
    );

    // Runtime wallet/proxy bootstrap removed from ClawHelm.
    // Next subtasks will complete full BlockRun/x402 transport decoupling.
    api.logger.info("ClawHelm loaded without wallet/proxy runtime bootstrap");
  },
};

export default plugin;

// Re-export for programmatic use
export { startProxy, getProxyPort } from "./proxy.js";
export type { ProxyOptions, ProxyHandle, LowBalanceInfo, InsufficientFundsInfo } from "./proxy.js";
export { clawhelmProvider } from "./provider.js";
export {
  OPENCLAW_MODELS,
  BLOCKRUN_MODELS,
  buildProviderModels,
  MODEL_ALIASES,
  resolveModelAlias,
  isAgenticModel,
  getAgenticModels,
  getModelContextWindow,
} from "./models.js";
export {
  route,
  DEFAULT_ROUTING_CONFIG,
  getFallbackChain,
  getFallbackChainFiltered,
  calculateModelCost,
} from "./router/index.js";
export type { RoutingDecision, RoutingConfig, Tier } from "./router/index.js";
export { logUsage } from "./logger.js";
export type { UsageEntry } from "./logger.js";
export { RequestDeduplicator } from "./dedup.js";
export type { CachedResponse } from "./dedup.js";
export { PaymentCache } from "./payment-cache.js";
export type { CachedPaymentParams } from "./payment-cache.js";
export { createPaymentFetch } from "./x402.js";
export type { PreAuthParams, PaymentFetchResult } from "./x402.js";
export { BalanceMonitor, BALANCE_THRESHOLDS } from "./balance.js";
export type { BalanceInfo, SufficiencyResult } from "./balance.js";
export {
  InsufficientFundsError,
  EmptyWalletError,
  RpcError,
  isInsufficientFundsError,
  isEmptyWalletError,
  isBalanceError,
  isRpcError,
} from "./errors.js";
export { fetchWithRetry, isRetryable, DEFAULT_RETRY_CONFIG } from "./retry.js";
export type { RetryConfig } from "./retry.js";
export { getStats, formatStatsAscii } from "./stats.js";
export type { DailyStats, AggregatedStats } from "./stats.js";
export { SessionStore, getSessionId, DEFAULT_SESSION_CONFIG } from "./session.js";
export type { SessionEntry, SessionConfig } from "./session.js";
export { ResponseCache } from "./response-cache.js";
export type { CachedLLMResponse, ResponseCacheConfig } from "./response-cache.js";
