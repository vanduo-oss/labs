## Context

LiteRT-LM JS documents native function calling (`Preface.tools`, structured `tool_calls`). Labs currently creates conversations with a system preface only. Product hosts need a stable executor API regardless of whether the pinned `@litert-lm/core` exposes native tools yet.

## Goals / Non-Goals

**Goals**
- Stable `AiChat` tool API for product hosts
- Deterministic validation before any host `execute`
- Injectable product context without forking FOSS base prompt
- Unit-testable without WebGPU

**Non-Goals**
- Shipping model weights
- Changing Labs Vue demo chrome beyond optional docs
- Server-side tool brokers

## Decisions

1. **Native-first, XML fallback** — Detect runtime tool support at conversation create time. If `preface.tools` is accepted and responses expose `tool_calls`, use native. Else parse `<tool_call name="…">{…}</tool_call>` from assistant text with the same executor.
2. **Host owns side effects** — `execute(name, args)` is provided by the caller; Labs never mutates DOM.
3. **LiteRT-only tools** — `generateWithTools` throws if backend is not LiteRT web-official Gemma.
4. **maxRounds default 4** — Prevent infinite tool loops.
5. **Prompt builder** — `buildChatSystemPrompt({ product, extra, toolsEnabled })` extends existing guardrails helper.

## Risks / Mitigations

| Risk | Mitigation |
|------|------------|
| LiteRT CDN lacks tools | XML fallback + unit tests |
| Model invents tool names | Allowlist check before execute |
| Huge tool payloads | Max JSON size in guardrails |

## Migration

No breaking change to `generate()`. New APIs are additive.
