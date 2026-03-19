# Code Improvement Orchestrator: Guards & Tests Pass

## Problem

The orchestrator drifts from its own rules during execution:

1. **Reviewer count**: Dispatches 2 review agents instead of 3 in Phase 2
2. **TODO staleness**: Falls behind on updating TODO.md — both at phase boundaries and during execution as streams complete
3. **No test adequacy verification**: Phase 4 requires tests for new code, but nothing verifies that requirement was actually followed

## Solution

Combine two enforcement mechanisms (verification steps for critical invariants, checklists for routine discipline) and add a new Phase 4.5 for test adequacy review.

---

## Definitions

- **Review target**: A package identified during Phase 1 project structure detection. A single-package project has 1 review target. A monorepo has N review targets (one per package).
- **Phase-boundary status print**: The status table printed once at the end of a phase, after all work in that phase is complete. Distinct from per-stream prints during Phase 4.
- **Test-fix cycle**: (1) Dispatch subagents to address all actionable test findings, (2) wait for all subagents to complete and merge, (3) re-review. The initial Phase 4.5 review is not a cycle — cycles count only fix-then-re-review iterations.

---

## 1. Verification Steps (Gates)

Three verification steps inserted into the workflow as explicit numbered procedural steps. Each requires the orchestrator to produce observable output (write a count, quote a status) before proceeding. These are not XML tags with special runtime behavior — they are concrete instructions that force self-verification.

### Gate 1: Reviewer Count (Phase 2)

Insert as a new numbered step in Phase 2, after the step where agents search the web and before the consolidation step. The orchestrator must write the count before proceeding.

> **2.5. Count review results** — write the number of completed review results per review target. If any review target has fewer than 3 results, STOP and dispatch the missing agents. Wait for completion. Do NOT consolidate with fewer than 3 results per target.

**Why this gate:** The orchestrator consistently dispatched 2 instead of 3, partially following the instruction but not enforcing it. Writing the count forces explicit verification.

### Gate 2: TODO Freshness (Phase-Boundary Status Prints)

Insert before the phase-boundary "Print status table" instruction at the end of each phase (Phases 1, 2, 3, 4, 4.5, 5). This gate covers **phase-boundary** prints only — for intra-Phase-4 per-stream prints, Gate 3 handles the TODO update.

> **Verify TODO before status table** — read TODO.md. For each item in the current phase: completed work must be `[x]`, blocked/deferred work must be `[!]`, pending future-phase work must be `[ ]`. No current-phase item should still be `[-]` at a phase boundary — if it is, update it to reflect actual status. Do NOT print the status table until TODO.md is current. For Phase 1, this is trivially satisfied if TODO.md was just created (no items to verify). For resume scenarios where TODO.md already exists, full verification applies.

**Why this gate:** TODO updates were skipped at both early (Review, Plan) and late (Execute) phase boundaries. Tying the gate to the status table ensures it fires every time.

### Gate 3: TODO After Stream Completion (Phase 4)

Insert in Phase 4 execution, triggered when a subagent reports back. The existing Phase 4 instruction "Update TODO and print status table after each stream completes" must be split into two distinct instructions:
- **Per-stream** (Gate 3): Update TODO immediately when a stream completes
- **Phase-boundary** (Gate 2): Verify full TODO before the final Phase 4 status table

> **Update TODO on stream completion** — when a subagent reports a stream complete, update TODO.md for that stream FIRST, before merging, dispatching, or any other action. If multiple streams complete simultaneously, update TODO.md for ALL completed streams before performing any merges or dispatches. Process completions in batch: all TODO updates first, then all merges, then all new dispatches.

**Why this gate:** During Phase 4, the orchestrator would move on to merging and dispatching the next stream without updating TODO, causing it to fall further behind.

**Gate 2 + Gate 3 in Phase 4:** Both gates fire during Phase 4. Per-stream completions trigger Gate 3 (update TODO for that stream). At the end of Phase 4, Gate 2 fires (verify full TODO before phase-boundary status table). This is intentional — Gate 3 keeps TODO current during execution, Gate 2 catches anything that slipped through.

---

## 2. Phase Completion Checklists

At the end of each phase, the orchestrator prints a checklist and verifies each item by producing evidence (writing a count, naming a file, quoting a status). Items marked `(GATE)` reference the verification steps from Section 1. If a `(GATE)` item fails verification, fix the issue immediately and re-verify that specific item before continuing to the next item.

### Phase 1: Scan & Triage

```
## Phase 1 Completion
- [ ] Project structure detected — write: [number] packages, [tech stack]
- [ ] Human questions batched and presented (or none needed)
- [ ] decisions.md created at project root
- [ ] TODO.md detected or created — write: [path]
- [ ] Work categorized into "can proceed" and "needs human"
- [ ] TODO verified current (GATE) — trivially satisfied if just created
- [ ] Status table printed
```

### Phase 2: Review

```
## Phase 2 Completion
- [ ] 3 review results received per review target (GATE) — write: [count] results for [target]
- [ ] Findings consolidated (deduped, conflicts noted)
- [ ] TODO.md updated with all findings by severity (GATE)
- [ ] Status table printed
```

### Phase 3: Plan & Chunk

```
## Phase 3 Completion
- [ ] Findings grouped into work streams
- [ ] Dependency graph built (parallel vs sequential)
- [ ] Plans created and reviewed (3 subagents per plan, max 3 review cycles)
- [ ] Priority assigned (CRITICAL/HIGH first)
- [ ] Fix branch created — write: [branch name]
- [ ] TODO.md updated with stream sub-items (GATE)
- [ ] Status table printed
```

### Phase 4: Execute

```
## Phase 4 Completion
- [ ] All streams dispatched and completed (or deferred)
- [ ] TODO.md updated after each stream (GATE)
- [ ] All worktree branches merged to fix branch
- [ ] Blocked/failed streams logged in decisions.md
- [ ] TODO verified current (GATE)
- [ ] Status table printed
```

### Phase 4.5: Test Adequacy Review (NEW)

```
## Phase 4.5 Completion
- [ ] Test adequacy review dispatched on fix branch (1 subagent)
- [ ] Findings addressed or logged (tests written/fixed — remaining gaps after 2 cycles logged for PR description)
- [ ] Test-fix cycles complete (max 2)
- [ ] TODO.md updated (GATE)
- [ ] Status table printed
```

### Phase 5: Verify & Ship

```
## Phase 5 Completion
- [ ] Final deep-code-review on fix branch (covers all changes including Phase 4.5 tests)
- [ ] CRITICAL/HIGH findings fixed (max 3 cycles)
- [ ] decisions.md presented to human (if present)
- [ ] One PR per repo created
- [ ] Worktrees cleaned up
- [ ] TODO.md fully resolved — all items [x] (GATE)
- [ ] Final status table printed
```

---

## 3. Phase 4.5: Test Adequacy Review

A new phase between Execute and Verify & Ship. Verifies that Phase 4 actually followed the "all new code must have tests" rule.

### Short-circuit rule

If Phase 4 produced no code changes (all streams deferred/blocked/documentation-only), Phase 4.5 notes this in TODO.md and proceeds directly to Phase 5. The review subagent is not dispatched.

### What it does

1. **Review:** Dispatch 1 subagent to review test code on the fix branch. The subagent reviews the diff between the fix branch and the branch point (`git diff main...fix/orchestrator-YYYY-MM-DD`). All modified or added files in this diff are in scope. Pre-existing untouched files are out of scope. A single reviewer is sufficient — unlike Phase 2 where variation catches different issues in unfamiliar code, Phase 4.5 reviews tests against known fix specifications, making the task more constrained. The tradeoff is speed over exhaustiveness; the goal is catching obvious gaps, not comprehensive test audit.

2. The subagent receives the test adequacy review table below as its instructions, along with the diff output:

| Category | What to Look For |
|----------|-----------------|
| Coverage gaps | New/modified code paths without corresponding tests |
| Weak assertions | Tests that pass but don't verify meaningful behavior (no assertions, asserting on mocks, tautological checks) |
| Missing edge cases | Only happy path tested — no empty input, null, boundary, error, concurrent scenarios |
| Regression gaps | Bug fixes from Phase 4 without regression tests proving the bug is caught |
| Test isolation | Shared mutable state, order-dependent tests, tests hitting real services |
| False confidence | High line coverage but low behavioral coverage — tests exercise code without verifying outcomes |

3. Findings are written back to the orchestrator
4. Orchestrator updates TODO.md with test findings
5. **Fix:** If findings exist, dispatch subagents to write/fix the tests. Each test-fix subagent gets its own worktree off the fix branch. Test-fix streams for different packages run in parallel; streams touching the same package run sequentially. No separate dependency graph is needed — the parallelism rule is applied directly. Merge-to-fix-branch procedure, retry policy, and failure handling are identical to Phase 4.
6. Each test-fix cycle must fully complete (all streams merged to fix branch) before the next cycle's review begins. This ensures the re-review sees the previous cycle's fixes.
7. Max 2 test-fix cycles. After cycle 2, any remaining findings from re-review are logged in the PR description as known test gaps without further fix attempts.

### No test infrastructure

If the project has no existing test infrastructure, the Phase 4.5 review subagent should note this. The orchestrator should treat test framework setup as a single prerequisite stream dispatched before test-writing streams. If setup alone exhausts the 2-cycle limit, log remaining test gaps to the PR description.

### Scope constraint

This phase only reviews tests related to Phase 4 changes (the fix branch diff). It does not audit the entire project's test suite.

### Relationship to existing rules

The existing Phase 4 rule "All new code must have tests; bugs must have regression tests" remains. Phase 4.5 is the verification that Phase 4 actually followed through.

---

## Changes to SKILL.md

### Structural changes

- Update workflow diagram to:
  ```dot
  digraph orchestrator {
      rankdir=LR;
      "Phase 1:\nScan & Triage" -> "Phase 2:\nReview (3x)" -> "Phase 3:\nPlan & Chunk" -> "Phase 4:\nExecute" -> "Phase 4.5:\nTest Review" -> "Phase 5:\nVerify & Ship";
  }
  ```
- Add Phase 4.5 as a new `### Phase 4.5: Test Adequacy Review` section between Phase 4 and Phase 5, following the same heading/formatting conventions as Phases 1–5
- Insert 3 verification steps at their respective locations:
  - Gate 1: Phase 2, as new step 2.5 (after agents search the web, before consolidation)
  - Gate 2: Before every phase-boundary "Print status table" instruction
  - Gate 3: Phase 4 — split the existing "Update TODO and print status table after each stream completes" into per-stream (Gate 3) and phase-boundary (Gate 2) instructions
- Add phase completion checklists after each phase section
- Update Status Table section: Phase 4.5 test-fix streams appear in the same table with a `(test)` prefix to distinguish them from Phase 4 execution streams
- Update Common Mistakes table with new entries
- Resume Procedure: no change needed — the existing rule ("resume from the earliest incomplete phase") covers Phase 4.5 implicitly since it will appear in TODO.md as a distinct phase

### New Common Mistakes entries

| Mistake | Fix |
|---------|-----|
| Having fewer than 3 review results before consolidating | GATE: Write the count per review target. Must be exactly 3. Re-dispatch if short. |
| Proceeding with stale TODO.md | GATE: Read and verify TODO.md before every phase-boundary status table print. |
| Moving to next stream without updating TODO | GATE: Update TODO for completed stream before any other action. Batch if multiple complete simultaneously. |
| Skipping Phase 4.5 test review | Phase 4.5 is mandatory unless Phase 4 produced no code changes. |
| Reviewing entire test suite in Phase 4.5 | Scope to fix branch diff only. Don't audit pre-existing test debt. |
| Running unbounded test-fix cycles in Phase 4.5 | Max 2 cycles. Remaining gaps go to PR description. |
