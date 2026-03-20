import type { OpenClawPluginApi, OpenClawPluginDefinition } from "./types.js";
import { clawhelmProvider } from "./provider.js";
import { VERSION } from "./version.js";
import { buildRuntimeState, createBeforeModelResolveHandler } from "./runtime.js";

function isCompletionMode(): boolean {
  return process.argv.some((arg, i) => arg === "completion" && i >= 1 && i <= 3);
}

const plugin: OpenClawPluginDefinition = {
  id: "clawhelm",
  name: "ClawHelm",
  description: "OpenClaw-native local routing/classification plugin",
  version: VERSION,

  register(api: OpenClawPluginApi) {
    api.registerProvider(clawhelmProvider);

    if (isCompletionMode()) {
      return;
    }

    const providers = api.config.models?.providers ?? {};
    const customConfiguredModelCount = Object.values(providers).reduce((count, provider) => {
      const models = provider?.models;
      return count + (Array.isArray(models) ? models.length : 0);
    }, 0);

    try {
      const runtimeState = buildRuntimeState(api);
      api.on("before_model_resolve", createBeforeModelResolveHandler(runtimeState, api), {
        priority: 50,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      api.logger.error(`[clawhelm] routing disabled: ${message}`);
      api.logger.warn(
        "ClawHelm provider remains registered, but runtime model overrides are disabled until config is fixed.",
      );
    }

    if (customConfiguredModelCount === 0) {
      api.logger.warn(
        "No custom models detected under models.providers.*.models. ClawHelm routing requires configured model IDs to enforce allowlist constraints.",
      );
    }
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
