/**
 * LLM Classifier (Fallback)
 *
 * Triggered only when the local rules classifier is ambiguous/unavailable.
 */

import type { Tier } from "./types.js";

const CLASSIFIER_PROMPT = `You are a query complexity classifier. Classify the user's query into exactly one category.

Categories:
- SIMPLE: Factual Q&A, definitions, translations, short answers
- MEDIUM: Summaries, explanations, moderate code generation
- COMPLEX: Multi-step code, system design, creative writing, analysis
- REASONING: Mathematical proofs, formal logic, step-by-step problem solving

Respond with ONLY one word: SIMPLE, MEDIUM, COMPLEX, or REASONING.`;

// In-memory cache: hash → { tier, expires }
const cache = new Map<string, { tier: Tier; expires: number }>();

export type LLMClassifierConfig = {
  model: string;
  providerModel?: string;
  maxTokens: number;
  temperature: number;
  truncationChars: number;
  cacheTtlMs: number;
};

type PayFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function resolveChatCompletionsUrl(apiBase: string): string {
  const base = apiBase.replace(/\/+$/, "");
  // If the provider baseUrl already includes /v1, don't double-append.
  if (/\/v1$/i.test(base)) return `${base}/chat/completions`;
  return `${base}/v1/chat/completions`;
}

/**
 * Classify a prompt using the configured classifier LLM.
 * Returns null tier when unavailable/invalid so callers can apply explicit fallback policy.
 */
export async function classifyByLLM(
  prompt: string,
  config: LLMClassifierConfig,
  payFetch: PayFetch,
  apiBase: string,
): Promise<{ tier: Tier | null; confidence: number }> {
  const truncated = prompt.slice(0, config.truncationChars);

  // Check cache
  const cacheKey = simpleHash(truncated);
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return { tier: cached.tier, confidence: 0.75 };
  }

  try {
    const response = await payFetch(resolveChatCompletionsUrl(apiBase), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.providerModel ?? config.model,
        messages: [
          { role: "system", content: CLASSIFIER_PROMPT },
          { role: "user", content: truncated },
        ],
        max_tokens: config.maxTokens,
        temperature: config.temperature,
        stream: false,
      }),
    });

    if (!response.ok) {
      return { tier: null, confidence: 0 };
    }

    const data = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = data.choices?.[0]?.message?.content?.trim().toUpperCase() ?? "";
    const tier = parseTier(content);
    if (tier === null) {
      return { tier: null, confidence: 0 };
    }

    cache.set(cacheKey, { tier, expires: Date.now() + config.cacheTtlMs });

    if (cache.size > 1000) {
      pruneCache();
    }

    return { tier, confidence: 0.75 };
  } catch {
    return { tier: null, confidence: 0 };
  }
}

/**
 * Parse tier from LLM response. Handles "SIMPLE", "The query is SIMPLE", etc.
 */
function parseTier(text: string): Tier | null {
  if (/\bREASONING\b/.test(text)) return "REASONING";
  if (/\bCOMPLEX\b/.test(text)) return "COMPLEX";
  if (/\bMEDIUM\b/.test(text)) return "MEDIUM";
  if (/\bSIMPLE\b/.test(text)) return "SIMPLE";
  return null;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return hash.toString(36);
}

function pruneCache(): void {
  const now = Date.now();
  for (const [key, value] of cache) {
    if (value.expires <= now) {
      cache.delete(key);
    }
  }
}
