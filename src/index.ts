import type { OpenClawPluginApi, OpenClawPluginDefinition } from "./types.js";
import { clawhelmProvider } from "./provider.js";
import { VERSION } from "./version.js";

function isCompletionMode(): boolean {
  return process.argv.some((arg, i) => arg === "completion" && i >= 1 && i <= 3);
}

const plugin: OpenClawPluginDefinition = {
  id: "clawhelm",
  name: "ClawHelm",
  description: "OpenClaw-native local routing/classification plugin",
  version: VERSION,

  async register(api: OpenClawPluginApi) {
    if (isCompletionMode()) {
      api.registerProvider(clawhelmProvider);
      return;
    }

    api.registerProvider(clawhelmProvider);

    const configuredModels = api.config.models?.providers?.clawhelm?.models;
    const configuredModelCount = Array.isArray(configuredModels) ? configuredModels.length : 0;

    api.logger.info(
      configuredModelCount > 0
        ? `ClawHelm provider registered (using ${configuredModelCount} OpenClaw-configured models)`
        : "ClawHelm provider registered (no OpenClaw-configured models detected)",
    );
  },
};

export default plugin;

export { clawhelmProvider } from "./provider.js";
export {
  route,
  constrainRoutingConfig,
  DEFAULT_ROUTING_CONFIG,
  getFallbackChain,
  getFallbackChainFiltered,
} from "./router/index.js";
export type { RoutingDecision, RoutingConfig, Tier } from "./router/index.js";
