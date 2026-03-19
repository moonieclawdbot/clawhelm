# ClawHelm

ClawHelm is an **OpenClaw routing plugin**.

It classifies each request into one of four tiers (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) and routes to the tier's configured model chain.

Runtime behavior:

- `before_model_resolve` hook applies request-scoped provider/model overrides to live OpenClaw requests.
- ClawHelm does not rewrite persisted OpenClaw config or `agents.defaults.model` when routing a request.
- Local rules classifier runs first.
- If local confidence is ambiguous (`tier = null`), ClawHelm falls back to the configured LLM classifier.
- If both are unavailable, ClawHelm uses `overrides.ambiguousDefaultTier`.

> ClawHelm is **not** a model provider. It routes among model IDs that OpenClaw already knows (built-in pi-ai catalog and/or custom `models.providers` entries).

## Prerequisites

- Node.js 20+
- OpenClaw installed
- Model IDs available to OpenClaw (either built-in catalog models or custom models under `models.providers.<providerId>.models`)

## Installation

```bash
openclaw plugins install @moonieclawdbot/clawhelm
```

## Configuration (exact locations)

### 1) Ensure model IDs are available to OpenClaw

You can use either:

- built-in OpenClaw provider/catalog model refs (no `models.providers` block required), or
- custom providers defined under `models.providers.<providerId>.models`.

### 2) Configure ClawHelm plugin settings in `openclaw.json`

ClawHelm plugin config lives under:

- `plugins.clawhelm`
- routing options under: `plugins.clawhelm.routing`

## Minimal working `openclaw.json` example

```json
{
  "models": {
    "providers": {
      "openai": {
        "baseUrl": "https://api.openai.com/v1",
        "api": "openai-responses",
        "models": [
          {
            "id": "openai/gpt-4o-mini",
            "name": "GPT-4o mini",
            "reasoning": false,
            "input": ["text"],
            "cost": { "input": 0.15, "output": 0.6, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 128000,
            "maxTokens": 16384
          },
          {
            "id": "openai/gpt-5.3-codex",
            "name": "GPT-5.3 Codex",
            "reasoning": true,
            "input": ["text"],
            "cost": { "input": 1, "output": 4, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 200000,
            "maxTokens": 32768
          }
        ]
      },
      "anthropic": {
        "baseUrl": "https://api.anthropic.com/v1",
        "api": "anthropic-messages",
        "models": [
          {
            "id": "anthropic/claude-sonnet-4.6",
            "name": "Claude Sonnet 4.6",
            "reasoning": true,
            "input": ["text"],
            "cost": { "input": 3, "output": 15, "cacheRead": 0, "cacheWrite": 0 },
            "contextWindow": 200000,
            "maxTokens": 8192
          }
        ]
      }
    }
  },
  "plugins": {
    "clawhelm": {
      "routing": {
        "tiers": {
          "SIMPLE": {
            "primary": "openai/gpt-4o-mini",
            "fallback": []
          },
          "MEDIUM": {
            "primary": "anthropic/claude-sonnet-4.6",
            "fallback": ["openai/gpt-4o-mini"]
          },
          "COMPLEX": {
            "primary": "openai/gpt-5.3-codex",
            "fallback": ["anthropic/claude-sonnet-4.6"]
          },
          "REASONING": {
            "primary": "openai/gpt-5.3-codex",
            "fallback": ["anthropic/claude-sonnet-4.6"]
          }
        }
      }
    }
  }
}
```

## Notes

- Every model used in `plugins.clawhelm.routing.*` must be available to OpenClaw (built-in catalog model or custom `models.providers.<providerId>.models`).
- Optional: set `plugins.clawhelm.routing.agenticTiers` for agentic workflows.
- Optional: set `plugins.clawhelm.routing.allowedModels` to enforce a strict explicit allowlist.
- Tier fallbacks remain part of ClawHelm's routing metadata/logging; they are not written back into persisted OpenClaw defaults.
- ClawHelm normalizes model refs (`trim + lowercase`) for allowlist checks.
- In custom provider model entries, `cost` is optional in OpenClaw. It is shown explicitly in the example for usage/cost observability.

## Validate

```bash
npm test
npm run typecheck
npm run build
```
