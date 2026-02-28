# ClawHelm

ClawHelm is an **OpenClaw-native routing plugin**.

It classifies each prompt locally and routes by tier (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`) to the cheapest/best model inside your configured model pool.

## Architecture (final)

- No wallet/x402/payment flow
- No proxy runtime
- No provider-owned model catalog
- Uses only models already configured in OpenClaw (`models.providers.clawhelm.models`)
- Local classifier + rule-based selection

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

`routing.modelPool` constrains all candidate models; tier chains are filtered to this pool and to available OpenClaw models.

## Development

```bash
npm run build
npm run typecheck
npm test
```
