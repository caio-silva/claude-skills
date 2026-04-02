# Handoff Templates

All agent communication with the orchestrator MUST use one of these templates. Free-form reports are not accepted. The orchestrator parses these structured handoffs to update TODO.md, make routing decisions, and track metrics.

## STANDARD — Normal Task Completion

Use when a stream completes successfully.

```
TYPE: STANDARD
STREAM: <stream name>
STATUS: COMPLETE
FILES_CHANGED: <comma-separated list of file paths>
BRANCH: <worktree branch name>
FINDINGS_RESOLVED: <count of findings fixed>
TESTS_ADDED: <count of new test cases>
TESTS_PASSING: <YES or NO>
SUMMARY: <1-2 sentence description of what was done>
```

## QA_PASS — Review Passes Quality Gate

Use when a review scores >= 95/100 overall.

```
TYPE: QA_PASS
STREAM: <stream name>
OVERALL_SCORE: <0-100 weighted score>
DIMENSIONS: Quality:<n> Security:<n> Performance:<n> Tests:<n> Design:<n>
FINDINGS_COUNT: <total findings across all dimensions>
CRITICAL: <count> HIGH: <count> MEDIUM: <count> LOW: <count>
EVIDENCE: <top 3 findings with ID, file:line, and one-line description>
VERDICT: APPROVE | APPROVE_WITH_NOTES
```

## QA_FAIL — Review Fails Quality Gate

Use when a review scores < 95/100 overall.

```
TYPE: QA_FAIL
STREAM: <stream name>
OVERALL_SCORE: <0-100 weighted score>
DIMENSIONS: Quality:<n> Security:<n> Performance:<n> Tests:<n> Design:<n>
FAILING_DIMENSIONS: <list of dimensions scoring below 95>
TOP_FINDINGS: <top 5 findings to fix, each with ID, severity, file:line, title>
SUGGESTED_APPROACH: <1-3 sentences on how to address the top findings>
VERDICT: NEEDS_CHANGES | BLOCK
```

## ESCALATION — Agent Is Stuck or Blocked

Use when an agent cannot complete its task. Triggers the retry policy.

```
TYPE: ESCALATION
STREAM: <stream name>
ATTEMPT: <1, 2, or 3>
WHAT_WAS_TRIED: <specific actions taken, with file paths and commands>
WHY_IT_FAILED: <specific error message, test failure, or blocker>
ROOT_CAUSE: <hypothesis for why this approach failed>
RECOMMENDED_RESOLUTION: <retry_different_approach | decompose | human_input_needed | skip_with_reason>
FAILURE_HISTORY: <summary of all previous attempts, if attempt > 1>
```

## Parsing Rules

The orchestrator processes handoffs as follows:

1. Read the `TYPE` field first to determine the template.
2. All fields are required — reject handoffs with missing fields.
3. `TESTS_PASSING: NO` in a STANDARD handoff triggers immediate investigation (do not merge).
4. `VERDICT: BLOCK` in a QA_FAIL means the stream has a CRITICAL finding that prevents merge.
5. `ATTEMPT: 3` in an ESCALATION means the retry policy is exhausted — mark the stream `[!]`.
