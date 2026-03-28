# TODOS

## Performance

### Re-evaluate DOM parsing ceiling after Phase 1 and Phase 2

**What:** Re-profile `DOMParser` / `parseFromString` after EPUB and MOBI/KF8 pre-DOM acceleration lands, and decide whether browser-side document construction has become the new dominant bottleneck.

**Why:** The current perf program intentionally leaves DOM parsing in JS for Phase 1. If pre-DOM work gets faster, DOM construction may become the new wall, and the program needs an explicit checkpoint to avoid optimizing the wrong layer.

**Context:** The approved WASM-first performance plan on branch `performance` starts with EPUB pre-DOM work, then MOBI/KF8, and only later extracts shared patterns. Review concluded that this is the right order, but it also flagged a risk: once binary/archive work improves, the remaining ceiling may move to browser DOM parsing. This item is the forced checkpoint after both prototype phases. Use the phase timing harness and profiler traces produced by the perf program. Compare total open time, per-phase timing, and any new memory/copy signals before deciding whether to continue investing below the DOM boundary or change direction.

**Effort:** M
**Priority:** P1
**Depends on:** Stable Phase 1 EPUB benchmarks and stable Phase 2 MOBI/KF8 benchmarks

### Keep worker baselines alive throughout the perf program

**What:** Continuously benchmark single-thread JS, current worker-capable archive/decompression paths, and WASM prototypes as named comparison lanes in the perf program.

**Why:** The engineering review accepted a requirement that worker-enabled baselines must remain a formal comparison group. Without that, the program can misattribute concurrency wins to WASM and make the wrong backend decision.

**Context:** `view.js` currently configures `zip.js` with `useWebWorkers: false`, which means the repository already contains an unrealized concurrency baseline. The approved perf program is intentionally exploratory and multi-phase. This item keeps the comparison honest across phases instead of running one worker experiment early and then forgetting it. Every phase report should show which backend ran, what thread model it used, and how its total open time, per-phase timing, and memory/copy indicators compared.

**Effort:** S
**Priority:** P1
**Depends on:** Phase 0 benchmark harness with backend attribution and stable phase timing output

## Completed
