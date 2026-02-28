---
name: clawhelm
summary: OpenClaw-native tiered routing plugin that classifies prompts locally and selects configured models
homepage: https://github.com/moonieclawdbot/clawhelm
metadata: { "openclaw": { "emoji": "🧭", "requires": { "config": ["models.providers.clawhelm"] } } }
---

# ClawHelm

ClawHelm classifies each request into a routing tier (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) and selects a model chain for that tier from OpenClaw-configured models.

## Prerequisites

- OpenClaw installed
- Provider models configured at `models.providers.clawhelm.models`
- Plugin installed

## Install

```bash
openclaw plugins install @moonieclawdbot/clawhelm
```

## Configure

Set provider models in OpenClaw config, then define optional plugin `routing` overrides:

- `routing.tiers`: per-tier `primary` and `fallback` model chains
- `routing.classifier`: local fallback classifier tuning options
- `routing.agenticTiers`: optional agentic-specific tier chains

## Use

After installation and configuration, run OpenClaw normally. ClawHelm will:

1. classify request complexity locally
2. choose a tier model chain
3. select the first available model (fallbacks if needed)

## Validate

```bash
npm run test
npm run typecheck
npm run build
```

## Troubleshooting

- If routing fails, confirm model IDs in tier chains exist in `models.providers.clawhelm.models`.
- If agentic behavior seems wrong, verify `routing.agenticTiers` and `routing.overrides.agenticMode`.
