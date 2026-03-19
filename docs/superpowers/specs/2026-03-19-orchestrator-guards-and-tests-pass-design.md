# Code Improvement Orchestrator: Guards & Tests Pass

## Problem

The orchestrator drifts from its own rules during execution:

1. **Reviewer count**: Dispatches 2 review agents instead of 3 in Phase 2
2. **TODO staleness**: Falls behind on updating TODO.md — both at phase boundaries and during execution as streams complete
3. **No test adequacy verification**: Phase 4 requires tests for new code, but nothing verifies that requirement was actually followed

## Solution

Combine two enforcement mechanisms (hard gates for critical invariants, checklists for routine discipline) and add a new Phase 4.5 for test adequacy review.

---

## 1. Hard Gates

Three `<HARD-GATE>` blocks inserted into the skill. These are non-negotiable stop points — the orchestrator cannot proceed until the condition is verified.

### Gate 1: Reviewer Count (Phase 2)

Insert between current Phase 2 step 2 ("Agents search the web") and step 3 ("Consolidate findings").

```
<HARD-GATE>
You MUST have exactly 3 completed review results per review target before
consolidating. For a single-repo project, that means 3 results for the
codebase. For a monorepo, that means 3 results per package.
Count the results. If fewer than 3, STOP and dispatch the missing agents.
Do NOT proceed with 2.
</HARD-GATE>
```

**Why this gate:** The orchestrator consistently dispatched 2 instead of 3, partially following the instruction but not enforcing it. This gate creates an explicit count-and-verify checkpoint.

### Gate 2: TODO Freshness (Phase Boundary Status Prints)

Placed before the "Print status table" instruction at the end of each phase (Phases 1, 2, 3, 4, 4.5, 5). This gate covers **phase-boundary** prints only — for intra-Phase-4 stream-completion prints, Gate 3 handles the TODO update.

```
<HARD-GATE>
Before printing the phase-boundary status table: read TODO.md. Verify every
completed item is [x], every in-progress item is [-], and every pending
item is [ ]. If any item is stale, update it NOW. Do NOT print the status
table until TODO.md is current.
</HARD-GATE>
```

**Why this gate:** TODO updates were skipped at both early (Review, Plan) and late (Execute) phase boundaries. Tying the gate to the status table (which already exists at every boundary) ensures it fires every time.

### Gate 3: TODO After Stream Completion (Phase 4)

Placed in Phase 4 execution, triggered when a subagent reports back.

```
<HARD-GATE>
When a subagent reports a stream complete: update TODO.md for that stream
FIRST, before merging, dispatching, or any other action.
</HARD-GATE>
```

**Why this gate:** During Phase 4, the orchestrator would move on to merging and dispatching the next stream without updating TODO, causing it to fall further behind.

**Gate 2 + Gate 3 in Phase 4:** Both gates fire during Phase 4. When a stream completes: Gate 3 fires first (update TODO for that stream), then when the phase ends, Gate 2 fires (verify full TODO before the phase-boundary status table). This is intentional — Gate 3 keeps TODO current during execution, Gate 2 catches anything that slipped through.

---

## 2. Phase Completion Checklists

At the end of each phase, the orchestrator prints a checklist and confirms each item. Items marked `(HARD GATE)` reference the hard gates above — they cannot be skipped.

### Phase 1: Scan & Triage

```
## Phase 1 Completion
- [ ] Project structure detected (packages, tech stack, CLAUDE.md)
- [ ] Human questions batched and presented (or none needed)
- [ ] decisions.md created at project root
- [ ] TODO.md detected or created
- [ ] Work categorized into "can proceed" and "needs human"
- [ ] Status table printed
```

### Phase 2: Review

```
## Phase 2 Completion
- [ ] 3 review agents dispatched per review target (codebase or package)
- [ ] 3 review results received per review target (HARD GATE)
- [ ] Findings consolidated (deduped, conflicts noted)
- [ ] TODO.md updated with all findings by severity (HARD GATE)
- [ ] Status table printed
```

### Phase 3: Plan & Chunk

```
## Phase 3 Completion
- [ ] Findings grouped into work streams
- [ ] Dependency graph built (parallel vs sequential)
- [ ] Plans created and reviewed (3 reviewers per plan)
- [ ] Priority assigned (CRITICAL/HIGH first)
- [ ] Fix branch created
- [ ] TODO.md updated with stream sub-items (HARD GATE)
- [ ] Status table printed
```

### Phase 4: Execute

```
## Phase 4 Completion
- [ ] All streams dispatched and completed (or deferred)
- [ ] TODO.md updated after each stream (HARD GATE)
- [ ] All worktree branches merged to fix branch
- [ ] Blocked/failed streams logged in decisions.md
- [ ] Status table printed
```

### Phase 4.5: Test Adequacy Review (NEW)

```
## Phase 4.5 Completion
- [ ] Test adequacy review dispatched on fix branch (1 subagent)
- [ ] Findings addressed (missing tests written, weak assertions fixed)
- [ ] Test-fix cycles complete (max 2 — remaining gaps logged for PR description)
- [ ] TODO.md updated (HARD GATE)
- [ ] Status table printed
```

### Phase 5: Verify & Ship

```
## Phase 5 Completion
- [ ] Final deep-code-review on fix branch (covers all changes: Phase 4 fixes + Phase 4.5 tests)
- [ ] CRITICAL/HIGH findings fixed (max 3 cycles)
- [ ] decisions.md presented to human (if present)
- [ ] One PR per repo created
- [ ] Worktrees cleaned up
- [ ] TODO.md fully resolved — all items [x] (HARD GATE)
- [ ] Final status table printed
```

---

## 3. Phase 4.5: Test Adequacy Review

A new phase between Execute and Verify & Ship. Verifies that Phase 4 actually followed the "all new code must have tests" rule.

### What it does

1. **Review:** Dispatch 1 subagent to review all test code on the fix branch, scoped to changes made during Phase 4. A single reviewer is sufficient here — unlike Phase 2 where variation across reviewers catches different issues in unfamiliar code, Phase 4.5 reviews tests against known fix specifications, so the task is more deterministic.
2. The subagent checks for:

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
5. **Fix:** If findings exist, dispatch subagents to write/fix the tests. Each test-fix subagent gets its own worktree off the fix branch (same as Phase 4). Test-fix streams for different packages run in parallel; streams touching the same package run sequentially. Merge-to-fix-branch procedure, retry policy, and failure handling are identical to Phase 4.
6. Max 2 test-fix cycles — after that, remaining items go into the PR description as known gaps

### Scope constraint

This phase only reviews tests related to Phase 4 changes. It does not audit the entire project's test suite.

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
- Add Phase 4.5 section with full description
- Insert 3 `<HARD-GATE>` blocks at their respective locations:
  - Gate 1: Phase 2, between step 2 and step 3
  - Gate 2: Before every phase-boundary "Print status table" instruction
  - Gate 3: Phase 4, at the stream-completion handling point
- Add phase completion checklists after each phase section
- Update Common Mistakes table with new entries
- Resume Procedure: no change needed — the existing rule ("resume from the earliest incomplete phase") covers Phase 4.5 implicitly since it will appear in TODO.md as a distinct phase

### New Common Mistakes entries

| Mistake | Fix |
|---------|-----|
| Dispatching fewer than 3 review agents | HARD GATE: Count results before consolidating. Must be exactly 3 per review target (codebase or package). |
| Proceeding with stale TODO.md | HARD GATE: Read and verify TODO.md before every status table print. |
| Moving to next stream without updating TODO | HARD GATE: Update TODO for completed stream before any other action. |
| Skipping Phase 4.5 test review | Phase 4.5 is mandatory. Test adequacy review runs on every orchestrator execution. |
| Reviewing entire test suite in Phase 4.5 | Scope to Phase 4 changes only. Don't audit pre-existing test debt. |
