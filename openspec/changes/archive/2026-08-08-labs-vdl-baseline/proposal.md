## Why

Labs has shipped a coherent `vdl`-prefixed baseline (naming, LiteRT-first chat, Neptune semantic preload, chat UX, Vanduo Labs system context, and retained guardrails) without an OpenSpec record. Specs are empty; this change captures that working-tree behavior as the first delta-first baseline so future work has a clear contract.

## What Changes

- Establish **labs-owned `vdl` / `Vdl` / `vdl-` naming** for Labs UI, CSS, and product ids; keep `@vanduo-oss/vd3` (`Vd*` / `--vd-*` / `.vd-*`) unchanged.
- Document **vdl-ai-chat** behavior: LiteRT Gemma as default with real multi-turn; community WebLLM/MLC Gemma as experimental; Enter-to-send + stick-to-bottom scroll in Labs UI.
- Document **vdl-neptune-search** behavior: semantic engine preload on mount so Enter feels instant.
- Document **vdl-guardrails**: retained LLM/search/core policy modules; system prompt includes Vanduo Labs / vanduo-oss / vd3 / vd3-cbun context.
- No new product features beyond what the working tree already implements; this is a brownfield baseline archive.

## Capabilities

### New Capabilities
- `vdl-naming`: Labs vs design-system naming boundary (`vdl*` vs `Vd*` / vd3).
- `vdl-ai-chat`: In-browser chat defaults (LiteRT Gemma, multi-turn, MLC experimental, composer UX).
- `vdl-neptune-search`: Hybrid search UI preload of semantic path on mount.
- `vdl-guardrails`: Shared deterministic guardrails + Vanduo Labs system prompt composition.

### Modified Capabilities
- (none — `openspec/specs/` is empty; this is the first delta)

## Impact

- Touches **labs `vdl` surface** only for naming/docs/specs; does **not** change `@vanduo-oss/vd3` APIs.
- Specs will land under `openspec/specs/{vdl-naming,vdl-ai-chat,vdl-neptune-search,vdl-guardrails}/` on archive sync.
- Implementation already present in working tree (`ai-chat.js`, `neptune-search.js`, `guardrails/`, `src/components/Vdl*.vue`, docs). Apply marks tasks done against that tree; no large code rewrite expected.
