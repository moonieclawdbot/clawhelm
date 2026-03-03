---
name: clawhelm
summary: OpenClaw-native tiered routing plugin that classifies prompts locally and selects configured models
homepage: https://github.com/moonieclawdbot/clawhelm
metadata: { "openclaw": { "emoji": "🧭", "requires": { "config": ["plugins.clawhelm.routing"] } } }
---

# ClawHelm

ClawHelm classifies each request into a routing tier (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) and selects a model chain for that tier.

ClawHelm is a router plugin, not a model provider.

## Prerequisites

- OpenClaw installed
- Model IDs available to OpenClaw (built-in catalog and/or custom `models.providers.<providerId>.models`)
- Plugin installed

## Install

```bash
openclaw plugins install @moonieclawdbot/clawhelm
```

## Configure

In `openclaw.json`:

- Ensure model IDs used by ClawHelm are available to OpenClaw:
  - built-in catalog model refs, and/or
  - custom entries under `models.providers.<providerId>.models`
- Define ClawHelm routing under `plugins.clawhelm.routing`
  - `routing.tiers`: per-tier `primary` and `fallback`
  - `routing.classifier`: local fallback classifier tuning
  - `routing.agenticTiers`: optional agentic tier chains

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

- If routing fails, confirm model IDs in `plugins.clawhelm.routing` are valid OpenClaw model refs (built-in or custom provider).
- If agentic behavior seems wrong, verify `routing.agenticTiers` and `routing.overrides.agenticMode`.
