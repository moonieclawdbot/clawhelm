# ClawHelm

ClawHelm is an **OpenClaw-native model routing plugin**.

It classifies each request into one of four tiers (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) and routes to the configured model chain for that tier.

## Prerequisites

- **Node.js 20+**
- **OpenClaw** installed and working
- At least one configured model provider in OpenClaw
- ClawHelm provider entries configured under:
  - `models.providers.clawhelm.models`

## Installation

```bash
openclaw plugins install @moonieclawdbot/clawhelm
```

## Required OpenClaw model/provider config

ClawHelm routes only to model IDs that exist in your OpenClaw config.

Example provider config (OpenClaw config):

```json
{
  "models": {
    "providers": {
      "clawhelm": {
        "models": [
          { "id": "openai/gpt-4o-mini" },
          { "id": "anthropic/claude-sonnet-4.6" },
          { "id": "openai/gpt-5.3-codex" }
        ]
      }
    }
  }
}
```

> Use your real provider/model IDs from your OpenClaw setup.

## Routing config

Configure ClawHelm in plugin config (`openclaw.plugin.json` or equivalent):

```json
{
  "routing": {
    "tiers": {
      "SIMPLE": { "primary": "openai/gpt-4o-mini", "fallback": [] },
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
```

### Profile behavior (`auto`, `eco`, `premium`)

Routing profiles are unchanged:

- `auto` (default): normal tier routing + agentic detection behavior
- `eco`: uses `ecoTiers` when configured
- `premium`: uses `premiumTiers` when configured

If `ecoTiers` / `premiumTiers` are not provided, ClawHelm falls back to base `tiers` behavior.

## Practical usage examples

### Example 1: normal routing

- Prompt: "Summarize this short paragraph"
- Likely tier: `SIMPLE`
- Model selected: `tiers.SIMPLE.primary`

### Example 2: profile override

- Profile: `eco`
- Prompt: "Generate a deployment checklist"
- Model selected from `ecoTiers` chain for the chosen tier

### Example 3: fallback behavior

If a tier primary model is unavailable, ClawHelm uses the first available fallback in the same tier chain.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## Troubleshooting (basics)

- **Routing chooses an unexpected model**
  - Check your `routing.tiers` / `ecoTiers` / `premiumTiers` values.
- **Model not selected**
  - Ensure the model ID exists in `models.providers.clawhelm.models`.
- **Plugin loads but no models route**
  - Verify OpenClaw provider/model config is present and valid JSON.

## Development

```bash
npm run build
npm run typecheck
npm test
```

## Next task note

Profile quality tuning (especially `eco` and `premium` tier calibration) should be improved in a follow-up task. This PR intentionally keeps profile behavior as-is.
