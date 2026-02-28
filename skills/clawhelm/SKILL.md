---
name: clawhelm
summary: OpenClaw-native model routing via local classifier + tier config
homepage: https://github.com/moonieclawdbot/clawhelm
metadata: { "openclaw": { "emoji": "🧭", "requires": { "config": ["models.providers.clawhelm"] } } }
---

# ClawHelm

Routes each request to the best/cheapest model inside your OpenClaw-configured model pool.

- Local classifier
- Tiered routing (`SIMPLE`, `MEDIUM`, `COMPLEX`, `REASONING`)
- No wallet/proxy/payment runtime
