# TODOS

## Direction Ownership

### Complete C11B horizontal drag and animation cancellation

**What:** After C11A's instant direction/coordinate work, implement horizontal
drag-follow, commit/settle and two-phase presentation for animated vertical books.

**Boundary:** Preserve the local animation duration and background owner. Cancel
old timers, touch-end rAF and navigation completion tails on replacement,
layout/flow invalidation, touchcancel and destroy. A generation counter only in
the animation helper does not protect later navigation or event callbacks.
Settle cancelled promises without allowing an old operation to mutate new state.
Do not treat this as full pending-open cancellation or navigation rollback.

### Keep adjacent chapter layout from replacing the primary direction

**What:** Audit mixed LTR/RTL and horizontal/vertical chapter transitions before
claiming mixed-direction rendering support.

**Why:** `#loadAdjacentSection` uses the shared `#beforeRender` callback, which
overwrites paginator `#rtl`/`#vertical` and container layout for a non-primary
chapter. The three C10 upstream patches do not change that ownership.

**Context:** C10 acceptance is limited to same-direction reflowable books,
including mismatched book metadata. Host current-document selection is a
separate guarantee. Freeze primary/preload direction ownership before fixing
this lifecycle issue; C11's vertical gesture redesign does not close it.

## Resource Ownership

### Audit fixed-layout section cache disposal

**What:** Trace settled spread/scroll cache eviction and final section release in
`fixed-layout.js` before claiming fixed-layout resource-lifetime parity.

**Why:** Its spread and scroll loaders acquire sections, but current teardown
does not pair them with section unload calls. The C9 EPUB loader fix counts
holders correctly; it does not supply a missing renderer cache/disposal policy.

**Context:** Keep this separate from paginator holder-survival/final-release
proof and from cancellation of unfinished loads. Audit both layout modes and
shared-book ownership before changing release points; a blanket book destroy
could invalidate another live view. The br1 fixed-layout alignment line must
not infer release correctness from its reflowable C9 tests.

## Navigation Failures

### Preserve the prior display when a destination section fails to load

**What:** Audit transactional destination admission in the paginator separately
from C9 resource-reference accounting.

**Why:** The existing far-navigation path clears old views before loading the
destination. Its catch returns an empty display result, so a rejected destination
can leave that navigating view without its prior display/state.

**Context:** This path predates the C9 port. C9 must keep another live holder's
resources valid and release references correctly even on failure; it does not
claim to retain or restore the failing view's display, history or position.
Do not conflate this with cancellation of an unfinished book open.

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
