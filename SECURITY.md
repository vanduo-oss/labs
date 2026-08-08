# Security Policy

## Reporting a vulnerability

If you believe you have found a security issue in **vanduo-oss/labs**, please report it privately.

Preferred: use [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) on this repository — open a security advisory for [vanduo-oss/labs](https://github.com/vanduo-oss/labs).

Do not open a public issue for sensitive reports.

## Scope

This is an **experimental** Labs repo of browser-local demos and ES modules:

- Demos run in the browser (WebGPU / WASM); there is **no Labs backend** that holds production secrets by design.
- Models and heavy deps are typically loaded from CDNs / Hugging Face (or optional local `.models/` mirrors for development).
- Shared `guardrails/*` helpers are best-effort, deterministic checks — not a complete security product.

## Out of scope / expectations

- No production SLA, guaranteed response time, or enterprise support commitment.
- Experimental AI behavior (hallucinations, model bugs, incomplete guardrails) is expected risk for demos.
- Issues in upstream packages (vd3, LiteRT, WebLLM, Transformers.js, Fuse.js, model hosts, CDNs) should be reported to those projects when appropriate.
- Dependency supply-chain hardening (exact CDN pins, SRI everywhere) is evolving; see component docs for the current pinning recommendation.

We appreciate responsible disclosure. Maintainers will triage private reports when capacity allows.
