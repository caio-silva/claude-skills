# Design: code-improvement-orchestrator

## Summary

A reusable Claude Code skill that acts as an autonomous supervisor — reviewing, planning, and fixing code quality issues across a project. It never writes code itself; it dispatches subagents for all work, tracks progress in TODO, and keeps the main conversation free for human questions.

**Location:** `skills/code-improvement-orchestrator/SKILL.md`

**Trigger:** When asked to review and improve a codebase, run a comprehensive quality pass, or fix issues across a project.

## Design Constraints

- The orchestrator is a **conductor** — it delegates to existing skills and subagents via the Agent tool. It never writes code directly.
- Works on **TypeScript/Kotlin web apps** primarily, but the workflow is language-agnostic.
- Supports **monorepos** with multiple packages (detected automatically).
- **One PR per repo** at the end — no intermediate PRs. PR targets the repo's default branch (auto-detected via `git remote show origin`).
- **TODO always updated** — `[ ]` pending, `[-]` in progress, `[x]` done. No excuses.
- **Status table** printed after every phase transition, stream completion, stream error, or stream blocked event.
- **Maximize parallel work** — subagents run concurrently wherever possible. Max concurrency: 6 subagents at a time. Batch if more are needed.
- **Human never blocks work** — deferred items get sensible assumptions logged in `decisions.md`. When human is present, review assumptions and adjust.
- Agents **search the web** when needed — to verify CVEs, check API/framework docs, or validate best practices before implementing a fix. Cite sources in findings.
- Agents use **any available skill** when relevant. Skills are soft dependencies — if a skill is unavailable, the agent skips that step and notes it.
- **All new code must have tests.** Issues that were found must have regression tests to prevent recurrence where appropriate.
- **Fix branch naming:** `fix/orchestrator-YYYY-MM-DD` (e.g., `fix/orchestrator-2026-03-18`).

## Phases

### Phase 1: Scan & Triage

1. **Detect project structure** — identify repos/packages, tech stack, existing TODO files, CLAUDE.md files.
2. **Identify human blockers** — scan for things that need human input (missing env vars, unclear architecture decisions, access issues). Present all questions upfront in a batch.
3. **Create decisions log** — `decisions.md` at the project root. Format per entry:
   ```
   ### [Phase] Assumption — [short title]
   **Date:** YYYY-MM-DD
   **Context:** What prompted this decision
   **Assumed:** What we decided to do
   **Alternatives:** What else we could have done
   **Risk:** LOW / MEDIUM / HIGH — what could go wrong
   ```
4. **Categorize work** — split into "can proceed" and "needs human input." Start working on unblocked items immediately. Deferred items stay queued — when human answers arrive, they get picked up. If no human is present, make sensible assumptions, log them in `decisions.md`, and continue.
5. **Detect TODO** — look for existing TODO file (`TODO.md`, `todo.md`, `TODO`, or similar) at project root and in each package. If none exists, create `TODO.md` at project root.

### Phase 2: Review (3 Parallel Passes)

1. **Dispatch 3 independent subagents in parallel** — each runs a full `/deep-code-review` on the same codebase concurrently. Each agent is a fresh perspective — natural variation between agents catches different things.
2. **Per package, in parallel** — for monorepos, each package gets its own 3-pass review. All dispatched concurrently, respecting the max concurrency cap of 6. Batch remaining if needed.
3. **Web search** — agents search the web when they need to verify CVEs, check API docs, validate best practices.
4. **Use any relevant skill** — agents invoke any available skill if relevant during review.
5. **Consolidate** — once all agents finish, a consolidation agent merges findings:
   - **Deduplication:** findings are duplicates if they reference the same file+line range AND the same category of issue. Similar descriptions across different files are separate findings.
   - **Severity conflicts:** take the higher severity.
   - **Fix conflicts:** when agents suggest different fixes for the same issue, include both as alternatives and note the disagreement.
   - **Quorum:** all findings survive consolidation regardless of how many agents flagged them. A finding from 1-of-3 agents is valid — it means the other 2 missed it.
6. **Update TODO** — write all findings to the project's TODO file with `[ ]` for pending items.

### Phase 3: Plan & Chunk

1. **Group findings into work streams** — cluster related findings that should be fixed together (e.g., all auth-related issues, all SEO issues, all performance issues). Each stream becomes an independent unit of work.
2. **Maximize parallelism** — streams that touch different files/packages can run concurrently. Streams that touch the same files get sequenced. The orchestrator builds a dependency graph.
3. **Create a plan per stream** — each plan gets reviewed by 3 different subagents before execution. Plans that fail review get revised and re-reviewed (max 3 review cycles, then surface to human).
4. **Assign priority** — CRITICAL/HIGH findings first, then MEDIUM, then LOW. Human-blocked items deferred with assumptions logged in `decisions.md`.
5. **Branch setup** — orchestrator creates one fix branch per repo (`fix/orchestrator-YYYY-MM-DD`). Subagents get worktrees off that branch for isolation. Their work merges back into the fix branch.
6. **Update TODO** — each stream's tasks appear as sub-items under the relevant finding. `[ ]` pending, `[-]` in progress, `[x]` done.

### Phase 4: Execute

1. **Dispatch subagents per stream, in parallel** — each subagent gets a worktree, a plan, and executes it. The orchestrator only coordinates, never writes code itself.
2. **Testing requirements** — all new code must have tests. Issues that were bugs must include regression tests to prevent recurrence. Subagents use TDD (write failing test first, then fix) where appropriate.
3. **TODO always updated** — subagents mark tasks `[-]` when starting, `[x]` when done. No excuses — every state change updates the TODO.
4. **Status table printed after every event** — stream started, completed, errored, blocked. The orchestrator prints an updated table showing all streams, their status, and which agent is working on them.
5. **Blocked work** — if a subagent hits a blocker, it logs the issue, makes a sensible assumption in `decisions.md`, and continues. If the assumption is too risky, it marks the task as deferred and moves on.
6. **Merge to fix branch** — as each subagent completes its stream, its worktree changes merge into the repo's fix branch. Merge strategy: rebase the worktree branch onto the fix branch. If conflicts arise, dispatch a subagent to resolve them — it reads both changes, understands intent, and produces a clean merge.
7. **Skill usage** — subagents use TDD, systematic-debugging, simplify, webapp-testing, or any other relevant skill as the work demands.

### Phase 5: Verify & Ship

1. **Final review pass** — once all streams are complete, dispatch a fresh subagent to run one more full `/deep-code-review` on each repo's fix branch. This catches anything the fixes may have introduced or that was missed.
2. **New findings** — if the final pass finds issues, they go through the same cycle: plan (reviewed by 3 agents), execute, verify. Max 3 verify-fix cycles. If issues remain after 3 cycles, include them in the PR description as known items and flag for human review.
3. **Decisions review** — if human is present, present `decisions.md` for review. Any rejected assumptions get fixed before the PR.
4. **One PR per repo** — create a single PR per repo from the fix branch targeting the repo's default branch. PR description includes: summary of all changes, findings addressed by severity, test coverage added, any remaining items, and a link to `decisions.md` if assumptions were made.
5. **Cleanup** — delete worktrees, update TODO with final state (all `[x]`), commit the TODO.

### Abort Procedure

If the human stops the orchestrator mid-execution:

1. All in-progress subagents are allowed to finish their current step (not killed mid-edit).
2. Worktrees are preserved (not deleted) so work is not lost.
3. The fix branch retains all merged work so far.
4. TODO is updated with current state — completed items marked `[x]`, in-progress items reverted to `[ ]`.
5. A summary of what was completed and what remains is printed.

### Failure & Retry

- **Subagent failure:** if a subagent fails (crash, timeout, garbage output), retry once with a fresh agent. If it fails again, mark the stream as `[!] Failed`, log the error in `decisions.md`, and continue with other streams.
- **Merge conflict unresolvable:** if the conflict-resolution subagent cannot produce a clean merge, mark the stream as `[!] Conflict`, preserve both versions in the worktree, and defer to human.

## Status Table Format

Printed after every phase transition, stream completion, stream error, or stream blocked event:

```
| # | Stream | Repo/Package | Status | Agent | Findings |
|---|--------|-------------|--------|-------|----------|
| 1 | Auth fixes | service | [x] Done | agent-3 | 4/4 fixed |
| 2 | SEO metadata | app | [-] In progress | agent-1 | 2/5 fixed |
| 3 | Performance | app | [ ] Queued | — | 3 pending |
| 4 | Infra cleanup | infra | [!] Blocked | — | Needs human |
```

## Files Created/Modified

During execution, the orchestrator creates or modifies:

- **`decisions.md`** (project root) — assumptions log for human review
- **`TODO.md`** (project root or existing location) — updated with findings and progress
- **Fix branch** (one per repo, named `fix/orchestrator-YYYY-MM-DD`) — all changes accumulated here
- **Worktrees** (temporary) — one per active subagent stream, cleaned up after merge

## Integration with Existing Skills

The orchestrator delegates to these skills as needed. All are **soft dependencies** — if unavailable, the step is skipped and noted:

| Skill | When Used |
|-------|-----------|
| `deep-code-review` | Phase 2: 3 parallel review passes per package |
| `simplify` | Phase 4: after implementing fixes, review for reuse/quality |
| `webapp-testing` | Phase 4: when frontend changes need Playwright verification |
| `superpowers:test-driven-development` | Phase 4: when implementing fixes (TDD — test first, then code) |
| `superpowers:systematic-debugging` | Phase 4: when a fix introduces test failures |
| `superpowers:writing-plans` | Phase 3: creating plans per stream |
| `superpowers:dispatching-parallel-agents` | Phase 2, 4: parallel subagent dispatch |
| `superpowers:using-git-worktrees` | Phase 4: isolating subagent work |
| `superpowers:verification-before-completion` | Phase 5: final verification |
| `commit-commands:commit-push-pr` | Phase 5: creating the final PR |
| Web search | Any phase: CVEs, API docs, best practices, framework patterns |
