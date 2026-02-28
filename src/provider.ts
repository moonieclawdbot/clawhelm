/**
 * ClawHelm ProviderPlugin for OpenClaw.
 *
 * ClawHelm is configured as its own provider (`clawhelm`) and relies on
 * OpenClaw model/provider configuration as the source of model + credential data.
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
