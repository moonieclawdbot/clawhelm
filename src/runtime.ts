import { DEFAULT_ROUTING_CONFIG } from "./router/config.js";
import { classifyByLLM } from "./router/llm-classifier.js";
import { classifyByRules } from "./router/rules.js";
import { selectModel } from "./router/selector.js";
import type { RoutingConfig, Tier, TierConfig } from "./router/types.js";
import type { ModelProviderConfig, OpenClawPluginApi } from "./types.js";

type BeforeModelResolveEvent = { prompt: string };
type AgentContext = { trigger?: string; channelId?: string; sessionKey?: string; agentId?: string };
type BeforeModelResolveResult = { modelOverride?: string };

type RuntimeState = {
  config: RoutingConfig;
  allowedModels: Set<string>;
  providerByModel: Map<string, ModelProviderConfig>;
};

function normalizeModelRef(modelRef: string): string {
  return modelRef.trim().toLowerCase();
}

function dedupeNormalized(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeModelRef).filter(Boolean)));
}

function mergeRoutingConfig(base: RoutingConfig, override: unknown): RoutingConfig {
  const o = (override ?? {}) as Partial<RoutingConfig>;
  return {
    ...base,
    ...o,
    classifier: { ...base.classifier, ...(o.classifier ?? {}) },
    scoring: { ...base.scoring, ...(o.scoring ?? {}) },
    overrides: { ...base.overrides, ...(o.overrides ?? {}) },
    tiers: {
      SIMPLE: { ...base.tiers.SIMPLE, ...(o.tiers?.SIMPLE ?? {}) },
      MEDIUM: { ...base.tiers.MEDIUM, ...(o.tiers?.MEDIUM ?? {}) },
      COMPLEX: { ...base.tiers.COMPLEX, ...(o.tiers?.COMPLEX ?? {}) },
      REASONING: { ...base.tiers.REASONING, ...(o.tiers?.REASONING ?? {}) },
    },
    agenticTiers: o.agenticTiers
      ? {
          SIMPLE: { ...(base.agenticTiers?.SIMPLE ?? base.tiers.SIMPLE), ...o.agenticTiers.SIMPLE },
          MEDIUM: { ...(base.agenticTiers?.MEDIUM ?? base.tiers.MEDIUM), ...o.agenticTiers.MEDIUM },
          COMPLEX: {
            ...(base.agenticTiers?.COMPLEX ?? base.tiers.COMPLEX),
            ...o.agenticTiers.COMPLEX,
          },
          REASONING: {
            ...(base.agenticTiers?.REASONING ?? base.tiers.REASONING),
            ...o.agenticTiers.REASONING,
          },
        }
      : base.agenticTiers,
    allowedModels: Array.isArray(o.allowedModels) ? o.allowedModels : base.allowedModels,
  };
}

function getRoutingOverride(api: OpenClawPluginApi): unknown {
  const rootConfig = api.config as Record<string, unknown>;
  const plugins = rootConfig.plugins as Record<string, unknown> | undefined;
  const clawhelm = plugins?.clawhelm as Record<string, unknown> | undefined;
  return clawhelm?.routing ?? api.pluginConfig?.routing;
}

function collectConfiguredModels(api: OpenClawPluginApi): {
  normalizedModelIds: string[];
  providerByModel: Map<string, ModelProviderConfig>;
} {
  const providerByModel = new Map<string, ModelProviderConfig>();
  const normalizedModelIds: string[] = [];
  const providers = api.config.models?.providers ?? {};

  for (const provider of Object.values(providers)) {
    if (!provider || !Array.isArray(provider.models)) continue;
    for (const model of provider.models) {
      const normalized = normalizeModelRef(model.id);
      if (!normalized) continue;
      normalizedModelIds.push(normalized);
      providerByModel.set(normalized, provider);
    }
  }

  return { normalizedModelIds: dedupeNormalized(normalizedModelIds), providerByModel };
}

function validateAndResolveAllowlist(
  routingConfig: RoutingConfig,
  configuredModels: string[],
): { allowedModels: Set<string>; errors: string[]; warnings: string[] } {
  const warnings: string[] = [];
  const errors: string[] = [];
  const configured = new Set(configuredModels);

  if (configured.size === 0) {
    errors.push(
      "No models found under models.providers.*.models; cannot enforce ClawHelm routing safely.",
    );
    return { allowedModels: new Set(), errors, warnings };
  }

  const configuredAllowlist = routingConfig.allowedModels;
  if (configuredAllowlist == null) {
    return { allowedModels: configured, errors, warnings };
  }

  const normalizedAllowlist = dedupeNormalized(configuredAllowlist);
  if (normalizedAllowlist.length === 0) {
    errors.push(
      "plugins.clawhelm.routing.allowedModels is configured but empty after normalization.",
    );
    return { allowedModels: new Set(), errors, warnings };
  }

  const allowed = normalizedAllowlist.filter((modelId) => configured.has(modelId));
  const unknown = normalizedAllowlist.filter((modelId) => !configured.has(modelId));
  if (unknown.length > 0) {
    warnings.push(
      `Ignoring ${unknown.length} allowlist model(s) not found in models.providers.*.models.`,
    );
  }

  if (allowed.length === 0) {
    errors.push(
      "plugins.clawhelm.routing.allowedModels has no valid entries in models.providers.*.models (fail-closed).",
    );
    return { allowedModels: new Set(), errors, warnings };
  }

  return { allowedModels: new Set(allowed), errors, warnings };
}

function resolveTierConfigs(config: RoutingConfig, agenticScore: number): Record<Tier, TierConfig> {
  const useAgentic = (config.overrides.agenticMode || agenticScore >= 0.5) && config.agenticTiers;
  return useAgentic ? config.agenticTiers! : config.tiers;
}

async function llmFallbackClassify(
  prompt: string,
  config: RoutingConfig,
  state: RuntimeState,
): Promise<{ tier: Tier | null; method: "llm"; confidence: number; note: string }> {
  const classifierModel = normalizeModelRef(config.classifier.llmModel);
  if (!state.allowedModels.has(classifierModel)) {
    return {
      tier: null,
      method: "llm",
      confidence: 0,
      note: "LLM fallback skipped (classifier model blocked by allowlist)",
    };
  }

  const provider = state.providerByModel.get(classifierModel);
  if (!provider?.baseUrl || !provider.apiKey) {
    return {
      tier: null,
      method: "llm",
      confidence: 0,
      note: "LLM fallback unavailable (classifier provider baseUrl/apiKey missing)",
    };
  }

  const result = await classifyByLLM(
    prompt,
    {
      model: classifierModel,
      maxTokens: config.classifier.llmMaxTokens,
      temperature: config.classifier.llmTemperature,
      truncationChars: config.classifier.promptTruncationChars,
      cacheTtlMs: config.classifier.cacheTtlMs,
    },
    (input, init) => {
      const headers = new Headers(init?.headers ?? {});
      headers.set("Authorization", `Bearer ${provider.apiKey}`);
      if (provider.headers) {
        for (const [name, value] of Object.entries(provider.headers)) {
          headers.set(name, value);
        }
      }
      return fetch(input, { ...init, headers });
    },
    provider.baseUrl,
  );

  return {
    tier: result.tier,
    method: "llm",
    confidence: result.confidence,
    note: result.tier ? "LLM fallback classification" : "LLM fallback unavailable",
  };
}

function estimateTokens(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.length / 4));
}

export function buildRuntimeState(api: OpenClawPluginApi): RuntimeState {
  const routingConfig = mergeRoutingConfig(DEFAULT_ROUTING_CONFIG, getRoutingOverride(api));
  const { normalizedModelIds, providerByModel } = collectConfiguredModels(api);
  const allowlistValidation = validateAndResolveAllowlist(routingConfig, normalizedModelIds);

  for (const warning of allowlistValidation.warnings) {
    api.logger.warn(`[clawhelm] ${warning}`);
  }
  if (allowlistValidation.errors.length > 0) {
    const message = allowlistValidation.errors.join(" ");
    throw new Error(message);
  }

  return {
    config: routingConfig,
    allowedModels: allowlistValidation.allowedModels,
    providerByModel,
  };
}

export function createBeforeModelResolveHandler(state: RuntimeState, api: OpenClawPluginApi) {
  return async (
    event: BeforeModelResolveEvent,
    _ctx: AgentContext,
  ): Promise<BeforeModelResolveResult | void> => {
    void _ctx;
    const prompt = event.prompt ?? "";
    const tokens = estimateTokens(prompt);

    const rules = classifyByRules(prompt, undefined, tokens, state.config.scoring);
    const tierConfigs = resolveTierConfigs(state.config, rules.agenticScore ?? 0);

    let tier = rules.tier;
    let confidence = rules.confidence;
    let method: "rules" | "llm" = "rules";
    const notes: string[] = [`rules-score=${rules.score.toFixed(2)}`];

    if (tier === null) {
      const llm = await llmFallbackClassify(prompt, state.config, state);
      notes.push(llm.note);
      if (llm.tier) {
        tier = llm.tier;
        confidence = llm.confidence;
        method = "llm";
      } else {
        tier = state.config.overrides.ambiguousDefaultTier;
        confidence = Math.max(confidence, 0.5);
        notes.push(`fallback default tier=${tier}`);
      }
    }

    const decision = selectModel(tier, confidence, method, notes.join(" | "), tierConfigs);
    const selected = normalizeModelRef(decision.model);

    if (!state.allowedModels.has(selected)) {
      api.logger.error(
        `[clawhelm] Selected model "${decision.model}" is outside allowlist; suppressing override (trigger fail-closed).`,
      );
      return;
    }

    api.logger.debug?.(
      `[clawhelm] route tier=${decision.tier} method=${decision.method} model=${decision.model} confidence=${decision.confidence.toFixed(2)}`,
    );

    return { modelOverride: decision.model };
  };
}
