---
name: review-regression
description: Verifies that specific findings from a previous review have been resolved. Checks each finding by ID against the current code state. Fast and targeted — not a full re-review.
---

# Review Regression

## Overview

Verifies that specific findings from a previous review have actually been resolved. Instead of running a full re-review, it checks each finding by ID: is the problematic code pattern gone? Did the fix introduce new issues? This is fast, targeted verification — not a replacement for `deep-code-review`.

## When to Use

- After applying fixes from a `deep-code-review` or `red-team-review`
- During `code-improvement-orchestrator` Phase 4.25 (called automatically)
- When the user runs `/improve verify` or `/improve --verify`
- Before creating a PR, to confirm all review findings were addressed

**When NOT to use:**
- As a substitute for a full review (use `deep-code-review` for that)
- On code that hasn't been reviewed yet (nothing to verify against)

## Input

The skill accepts findings to verify in three ways:

1. **Automatic (default):** Search the current directory for the most recent findings. Look for:
   - `TODO.md` with finding IDs (from orchestrator runs)
   - Files matching `*findings*`, `*review*` with structured finding blocks
   - Git log for recent `deep-code-review` or `red-team-review` output

2. **By ID:** `/review-regression SEC-003 QUAL-012 RT-001`
   Verify only the specified finding IDs. Search the codebase and recent review output for the original finding details.

3. **By file:** `/review-regression --findings path/to/findings.md`
   Read findings from the specified file. Expects findings in the structured format (with ID, File, Evidence fields).

## Verification Process

For each finding ID:

### Step 1: Locate
Find the file and line referenced in the original finding. If the file has been renamed or the line has shifted, use the finding title and evidence to locate the relevant code.

### Step 2: Check Pattern
Is the problematic code pattern still present?
- Grep for the specific anti-pattern, vulnerable pattern, or code snippet from the original finding's evidence
- Read 10 lines above and below the original location
- Check if the suggested fix (or a functionally equivalent fix) was applied
- If the file was deleted: check if the functionality moved elsewhere or was intentionally removed

### Step 3: Check for Regression
Did the fix introduce new issues in the same area?
- Read the fix and look for common fix-induced problems:
  - Off-by-one in bounds checks
  - Null check that catches too broadly (swallowing legitimate errors)
  - Performance regression (e.g., adding validation in a hot loop)
  - Fix that addresses the symptom but not the root cause
  - New code that duplicates existing functionality

### Step 4: Classify

| Status | Meaning | Evidence Required |
|--------|---------|-------------------|
| `CONFIRMED_FIXED` | Problematic pattern is gone, fix is sound | Show the new code that replaces the old pattern |
| `STILL_PRESENT` | Original issue remains | Show the code that still contains the pattern |
| `REGRESSED` | Fix introduced a new problem | Show the fix AND the new problem it created |
| `INCONCLUSIVE` | Can't determine from static analysis | Explain what additional testing is needed (runtime, manual) |

## Output Format

```markdown
## Regression Verification Report

**Branch:** <branch name>
**Verified:** <total> findings | **Fixed:** <count> | **Still present:** <count> | **Regressed:** <count> | **Inconclusive:** <count>

### STILL_PRESENT

**<ID>** <title>
- **File:** <path>:<line>
- **Evidence:** <code showing the pattern is still there>
- **Original finding:** <brief recap>

### REGRESSED

**<ID>** <title> (FIXED but introduced new issue)
- **File:** <path>:<line>
- **Original fix:** <what was changed>
- **New issue:** <what the fix broke>
- **Severity:** <0-10 CVSS score of the new issue>
- **Suggested fix:** <how to address the regression>

### INCONCLUSIVE

**<ID>** <title>
- **File:** <path>:<line>
- **Reason:** <why static analysis can't determine status>
- **Suggested verification:** <what manual testing would confirm>

### CONFIRMED_FIXED (<count>)

<comma-separated list of IDs>
```

## Integration with Other Skills

**With `code-improvement-orchestrator` (Phase 4.25):**
- The orchestrator passes the full list of Phase 2 finding IDs
- `STILL_PRESENT` findings are grouped into new fix streams and re-dispatched
- `REGRESSED` findings are treated as new CRITICAL findings
- `INCONCLUSIVE` findings are logged in `decisions.md`

**With `improve --verify`:**
- The router calls this skill with auto-detection mode
- Output is presented directly to the user
- If findings are `STILL_PRESENT`, offers to run the orchestrator scoped to those findings

## Scoring

This skill does not produce its own dimension score. It produces a verification report. The scores come from the original review that generated the findings.

However, it does track a **fix rate** metric:
```
Fix Rate: 9/12 (75%) — 2 still present, 1 regressed
```

A fix rate below 80% suggests the fix approach needs re-evaluation, not just more patches.
