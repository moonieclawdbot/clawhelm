---
name: clawhelm
summary: OpenClaw-native tiered routing plugin that classifies prompts locally and selects configured models
homepage: https://github.com/moonieclawdbot/clawhelm
metadata: { "openclaw": { "emoji": "🧭", "requires": { "config": ["models.providers.clawhelm"] } } }
---

# ClawHelm

ClawHelm classifies each request into a routing tier (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) and selects a model chain for that tier from OpenClaw-configured models.

## Install

```bash
openclaw plugins install @moonieclawdbot/clawhelm
```

## Configure

In your OpenClaw config, define provider models under `models.providers.clawhelm.models`, then optionally set plugin `routing` overrides:

- `routing.tiers`: per-tier `primary` and `fallback` model chains
- `routing.modelPool` (optional): allowlist that constrains model selection to specific model IDs
- `routing.classifier`: local fallback classifier tuning options

## Use

After installation and configuration, run OpenClaw normally. ClawHelm will:

1. classify each request locally
2. map the tier to configured tier model chains
3. select the first eligible model (with fallbacks available)

## Validate

```bash
npm run test
npm run typecheck
npm run build
```
