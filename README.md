# ClawHelm

ClawHelm is an **OpenClaw-native model routing plugin**.

It classifies each request into a task tier (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) and then selects a model chain for that tier from your OpenClaw-configured models.

## What ClawHelm does

- Routes requests by tier using local rule-based classification.
- Supports optional routing profiles (`eco`, `premium`, `auto`) for cost/quality preference.
- Uses only models already configured in OpenClaw (`models.providers.clawhelm.models`).
- Supports an optional `routing.modelPool` allowlist to limit which configured models routing may choose.

## Install

```bash
openclaw plugins install @moonieclawdbot/clawhelm
```

## Configure

Example (`openclaw.plugin.json` / plugin config):

```json
{
  "routing": {
    "modelPool": ["openai/gpt-4o-mini", "openai/gpt-5.3-codex", "anthropic/claude-sonnet-4.6"],
    "tiers": {
      "SIMPLE": { "primary": "openai/gpt-4o-mini", "fallback": [] },
      "MEDIUM": { "primary": "anthropic/claude-sonnet-4.6", "fallback": ["openai/gpt-4o-mini"] },
      "COMPLEX": { "primary": "openai/gpt-5.3-codex", "fallback": ["anthropic/claude-sonnet-4.6"] },
      "REASONING": { "primary": "openai/gpt-5.3-codex", "fallback": ["anthropic/claude-sonnet-4.6"] }
    }
  }
}
```

`routing.modelPool` is optional. When set, ClawHelm treats it as the allowed set of model IDs and constrains tier primary/fallback chains to models that are both:

1. configured in OpenClaw
2. present in `routing.modelPool`

If `modelPool` is omitted, all configured ClawHelm provider models are eligible.

## Validate plugin behavior

```bash
npm run test
npm run typecheck
npm run build
```

Key validations covered in tests:

- local LLM classifier parsing/fallback/cache behavior
- tier-to-model routing flow (default tier, profile tiers, agentic tiers)
- `modelPool` constraints against configured model availability

## Development

```bash
npm run build
npm run typecheck
npm test
```
