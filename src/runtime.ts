import { mkdirSync, appendFileSync } from "node:fs";
import path from "node:path";
import { DEFAULT_ROUTING_CONFIG } from "./router/config.js";
import { classifyByLLM } from "./router/llm-classifier.js";
import { classifyByRules } from "./router/rules.js";
import { selectModel } from "./router/selector.js";
import type { RoutingConfig, Tier, TierConfig } from "./router/types.js";
import type { ModelProviderConfig, OpenClawPluginApi } from "./types.js";

type BeforeModelResolveEvent = { prompt: string };
type AgentContext = { trigger?: string; channelId?: string; sessionKey?: string; agentId?: string };
type BeforeModelResolveResult = {
  providerOverride?: string;
  modelOverride?: string;
};

type RuntimeState = {
  config: RoutingConfig;
  allowedModels: Set<string>;
  providerByModel: Map<string, ModelProviderConfig>;
  debugLogPath: string;
};

function normalizeModelRef(modelRef: string): string {
  return modelRef.trim().toLowerCase();
}

function dedupeNormalized(values: string[]): string[] {
  return Array.from(new Set(values.map(normalizeModelRef).filter(Boolean)));
}

function resolveDebugLogPath(api: OpenClawPluginApi, config: RoutingConfig): string {
  const configuredPath = config.debug?.logPath?.trim() || ".openclaw/logs/clawhelm-debug.jsonl";
  return path.isAbsolute(configuredPath) ? configuredPath : api.resolvePath(configuredPath);
}

function writeDebugLog(
  state: RuntimeState,
  api: OpenClawPluginApi,
  entry: Record<string, unknown>,
): void {
  if (!state.config.debug?.enabled) return;

  try {
    mkdirSync(path.dirname(state.debugLogPath), { recursive: true });
    appendFileSync(
      state.debugLogPath,
      `${JSON.stringify({ ts: new Date().toISOString(), ...entry })}\n`,
      "utf8",
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.logger.warn(`[clawhelm] debug log write failed: ${message}`);
  }
}

function mergeRoutingConfig(base: RoutingConfig, override: unknown): RoutingConfig {
  const o = (override ?? {}) as Partial<RoutingConfig>;
  return {
    ...base,
    ...o,
    classifier: { ...base.classifier, ...(o.classifier ?? {}) },
    scoring: { ...base.scoring, ...(o.scoring ?? {}) },
    debug: { ...(base.debug ?? {}), ...((o.debug as Record<string, unknown> | undefined) ?? {}) },
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

function resolveFallbackClassifierModel(
  config: RoutingConfig,
  state: RuntimeState,
): { model: string; source: string } | null {
  const candidates = [
    { model: normalizeModelRef(config.classifier.llmModel), source: "configured classifier" },
    { model: normalizeModelRef(config.tiers.SIMPLE.primary), source: "SIMPLE tier primary" },
    { model: normalizeModelRef(config.tiers.MEDIUM.primary), source: "MEDIUM tier primary" },
    { model: normalizeModelRef(config.tiers.COMPLEX.primary), source: "COMPLEX tier primary" },
    { model: normalizeModelRef(config.tiers.REASONING.primary), source: "REASONING tier primary" },
  ];

  if (config.agenticTiers) {
    candidates.push(
      {
        model: normalizeModelRef(config.agenticTiers.SIMPLE.primary),
        source: "agentic SIMPLE tier primary",
      },
      {
        model: normalizeModelRef(config.agenticTiers.MEDIUM.primary),
        source: "agentic MEDIUM tier primary",
      },
      {
        model: normalizeModelRef(config.agenticTiers.COMPLEX.primary),
        source: "agentic COMPLEX tier primary",
      },
      {
        model: normalizeModelRef(config.agenticTiers.REASONING.primary),
        source: "agentic REASONING tier primary",
      },
    );
  }

  for (const candidate of candidates) {
    if (!candidate.model || !state.allowedModels.has(candidate.model)) continue;
    const provider = state.providerByModel.get(candidate.model);
    if (provider?.baseUrl && provider.apiKey) {
      return candidate;
    }
  }

  for (const model of state.allowedModels) {
    const provider = state.providerByModel.get(model);
    if (provider?.baseUrl && provider.apiKey) {
      return { model, source: "first allowed model with credentials" };
    }
  }

  return null;
}

async function llmFallbackClassify(
  prompt: string,
  config: RoutingConfig,
  state: RuntimeState,
): Promise<{ tier: Tier | null; method: "llm"; confidence: number; note: string }> {
  const classifier = resolveFallbackClassifierModel(config, state);
  if (!classifier) {
    return {
      tier: null,
      method: "llm",
      confidence: 0,
      note: "LLM fallback unavailable (no allowed classifier model with baseUrl/apiKey)",
    };
  }

  const provider = state.providerByModel.get(classifier.model);
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
      model: classifier.model,
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
    note: result.tier
      ? `LLM fallback classification via ${classifier.model} (${classifier.source})`
      : `LLM fallback unavailable via ${classifier.model} (${classifier.source})`,
  };
}

function estimateTokens(prompt: string): number {
  return Math.max(1, Math.ceil(prompt.length / 4));
}

function resolveConfiguredModelSelection(modelRef: string): { provider: string; model: string } | null {
  const trimmed = modelRef.trim();
  if (!trimmed) return null;

  const slash = trimmed.indexOf("/");
  if (slash === -1) return null;

  const provider = trimmed.slice(0, slash).trim().toLowerCase();
  const model = trimmed.slice(slash + 1).trim();
  if (!provider || !model) return null;

  return { provider, model };
}

function resolveAllowedTierFallbacks(tierConfig: TierConfig, allowedModels: Set<string>): string[] {
  return tierConfig.fallback
    .map(normalizeModelRef)
    .filter((modelId) => allowedModels.has(modelId));
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
    debugLogPath: resolveDebugLogPath(api, routingConfig),
  };
}

export function createBeforeModelResolveHandler(state: RuntimeState, api: OpenClawPluginApi) {
  return async (
    event: BeforeModelResolveEvent,
    ctx: AgentContext,
  ): Promise<BeforeModelResolveResult | void> => {
    const prompt = event.prompt ?? "";
    const tokens = estimateTokens(prompt);
    const logBase = {
      event: "before_model_resolve",
      trigger: ctx.trigger ?? null,
      channelId: ctx.channelId ?? null,
      sessionKey: ctx.sessionKey ?? null,
      agentId: ctx.agentId ?? null,
      promptPreview: prompt.slice(0, 500),
      estimatedTokens: tokens,
    };

    try {
      const rules = classifyByRules(prompt, undefined, tokens, state.config.scoring);
      const tierConfigs = resolveTierConfigs(state.config, rules.agenticScore ?? 0);

      let tier = rules.tier;
      let confidence = rules.confidence;
      let method: "rules" | "llm" = "rules";
      const notes: string[] = [`rules-score=${rules.score.toFixed(2)}`];

      let llmFallback: Record<string, unknown> | null = null;
      if (tier === null) {
        const llm = await llmFallbackClassify(prompt, state.config, state);
        llmFallback = llm;
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
      const tierConfig = tierConfigs[tier];
      const appliedFallbacks = resolveAllowedTierFallbacks(tierConfig, state.allowedModels);
      const resolvedSelection = resolveConfiguredModelSelection(decision.model);

      const debugEntry = {
        ...logBase,
        rules: {
          score: rules.score,
          tier: rules.tier,
          confidence: rules.confidence,
          signals: rules.signals,
          agenticScore: rules.agenticScore ?? null,
          dimensions: rules.dimensions ?? [],
        },
        llmFallback,
        decision,
        selectedModelNormalized: selected,
        allowedModels: Array.from(state.allowedModels),
        appliedFallbacks,
        resolvedSelection,
        debugLogPath: state.debugLogPath,
      };

      if (!state.allowedModels.has(selected)) {
        const message = `[clawhelm] Selected model "${decision.model}" is outside allowlist; suppressing override (trigger fail-closed).`;
        api.logger.error(message);
        writeDebugLog(state, api, { ...debugEntry, outcome: "blocked-allowlist", error: message });
        return;
      }

      if (!resolvedSelection) {
        const message = `[clawhelm] Selected model "${decision.model}" could not be parsed into provider/model overrides; suppressing override.`;
        api.logger.error(message);
        writeDebugLog(state, api, { ...debugEntry, outcome: "blocked-parse", error: message });
        return;
      }

      api.logger.debug?.(
        `[clawhelm] selected model=${decision.model} tier=${decision.tier} method=${decision.method} confidence=${decision.confidence.toFixed(2)} why=${JSON.stringify(decision.reasoning)} provider=${resolvedSelection.provider} modelId=${resolvedSelection.model} fallbacks=${appliedFallbacks.join(",") || "none"} note=request-scoped-overrides-only`,
      );

      writeDebugLog(state, api, {
        ...debugEntry,
        outcome: "override-applied",
        providerOverride: resolvedSelection.provider,
        modelOverride: resolvedSelection.model,
      });

      return {
        providerOverride: resolvedSelection.provider,
        modelOverride: resolvedSelection.model,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      api.logger.error(`[clawhelm] before_model_resolve failed: ${message}`);
      writeDebugLog(state, api, { ...logBase, outcome: "handler-error", error: message });
      return;
    }
  };
}
