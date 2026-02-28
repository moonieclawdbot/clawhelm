/**
 * ClawHelm ProviderPlugin for OpenClaw
 *
 * Phase 1+2 migration behavior:
 * - keep provider id `clawhelm`
 * - do not bootstrap or depend on wallet/x402/proxy runtime in active plugin path
 * - rely on OpenClaw model/provider config as the sole source of model + credential data
 */

import type { ProviderPlugin } from "./types.js";

/**
 * ClawHelm provider plugin definition.
 *
 * Intentionally minimal: OpenClaw config owns models/baseUrl/credentials.
 * We only register provider identity and docs metadata here.
 */
export const clawhelmProvider: ProviderPlugin = {
  id: "clawhelm",
  label: "ClawHelm",
  docsPath: "https://blockrun.ai/docs",
  aliases: ["br"],

  // Auth and credentials are sourced from OpenClaw model provider config.
  auth: [],
};

// Backward compatibility alias during migration
export const blockrunProvider = clawhelmProvider;
