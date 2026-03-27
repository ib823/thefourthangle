# UI/UX Execution Plan

## Phase 1: Motion token consistency
- **Goal**: Every animated property in the codebase uses tokens instead of hardcoded values
- **Files**: All .svelte components with inline style durations/easings
- **Risk**: Low — CSS-only changes, no behavior change
- **Acceptance**: Zero hardcoded duration/easing values in active components

## Phase 2: ShareModal motion refinement
- **Goal**: Replace 5-nested setTimeout copy animation with clean state machine. Add velocity-based drag-dismiss.
- **Files**: ShareModal.svelte
- **Risk**: Low — isolated component
- **Acceptance**: Copy animation is interruptible. Drag-dismiss respects velocity.

## Phase 3: InsightReader gesture optimization
- **Goal**: Fix touch-action on card content area. Debounce scroll indicator. Cache card width. Optimize ghost card updates.
- **Files**: InsightReader.svelte
- **Risk**: Medium — core interaction surface
- **Acceptance**: No gesture regression. Reduced per-frame work.

## Phase 4: DesktopCard shadow optimization
- **Goal**: Replace transitioning box-shadow with pseudo-element opacity
- **Files**: DesktopCard.svelte
- **Risk**: Low — visual refinement
- **Acceptance**: Hover lift looks identical, paint cost reduced

## Phase 5: Reader overlay transition improvement
- **Goal**: Use WAAPI for overlay entry/exit for interruptibility
- **Files**: InsightReader.svelte
- **Risk**: Low — entry animation only
- **Acceptance**: Overlay entry can be interrupted by immediate close

## Phase 6: Verification and documentation
- **Goal**: Verify all changes, document browser matrix, capture performance baseline
- **Files**: docs/
- **Risk**: None
- **Acceptance**: All docs complete, build passes, tests pass
