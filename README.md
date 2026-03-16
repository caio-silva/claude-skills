# claude-skills

Custom skills for [Claude Code](https://claude.com/claude-code) — Anthropic's CLI for Claude.

## Available Skills

### `deep-code-review`

A three-pass code review that runs **quality**, **security**, and **performance** analysis in parallel, then merges findings into a single severity-ranked report.

| Pass | Perspective | What It Catches |
|------|-------------|-----------------|
| **Quality** | Senior developer rejecting a PR | Bugs, logic errors, null handling, race conditions, edge cases, maintainability issues |
| **Security** | Attacker with knowledge of your stack | Injection, auth/authz flaws, data exposure, input validation gaps, crypto weaknesses (with OWASP/CWE refs) |
| **Performance** | Scalability engineer at 100x load | O(n^2) operations, N+1 queries, memory leaks, I/O bottlenecks, quick wins |

Findings are deduplicated across passes, rated by severity (CRITICAL / HIGH / MEDIUM / LOW), and include actionable code fixes.

## Installation

### Option A: Personal skill (all your projects)

```bash
# Clone this repo
git clone https://github.com/caio-silva/claude-skills.git ~/claude-skills

# Copy the skill to your personal skills directory
mkdir -p ~/.claude/skills
cp -r ~/claude-skills/skills/deep-code-review ~/.claude/skills/
```

### Option B: Project-level skill (one project)

```bash
# From your project root
mkdir -p .claude/skills
cp -r /path/to/claude-skills/skills/deep-code-review .claude/skills/

# Commit it so your team gets it too
git add .claude/skills/deep-code-review
git commit -m "Add deep-code-review skill"
```

### Option C: Load from external directory

```bash
# Clone once
git clone https://github.com/caio-silva/claude-skills.git ~/claude-skills

# Launch Claude Code with the skills directory
claude --add-dir ~/claude-skills/skills
```

### Verify installation

Open Claude Code and type `/` — you should see `deep-code-review` in the skill list.

## Usage

### Slash command (explicit)

```
/deep-code-review
```

Claude will identify the current diff/staged changes and run the full three-pass review.

You can also pass arguments:

```
/deep-code-review src/auth/login.ts src/auth/session.ts
```

### Auto-invocation

Claude automatically invokes the skill when you ask it to review code:

```
Review my changes before I create a PR
```
```
Audit this file for security issues
```
```
Check this code for performance problems
```

### What you get

A structured report with:

1. **Summary** — overall assessment + finding counts by severity
2. **Critical & High findings** — full detail with suggested fixes
3. **Medium findings** — grouped, briefer
4. **Low findings** — bullet list
5. **What's good** — positive patterns worth keeping

## Customization

Edit the `SKILL.md` frontmatter or content to adapt:

- **Adjust severity thresholds** — e.g., treat all security findings as HIGH minimum
- **Add project-specific checks** — e.g., "ensure all DB queries use the query builder"
- **Remove a pass** — if you only care about security, strip the other two
- **Change the output format** — e.g., output as GitHub PR review comments

## Credits

Inspired by techniques from [You're Using AI to Write Code. You're Not Using It to Review Code](https://medium.com/data-science-collective/youre-using-ai-to-write-code-you-re-not-using-it-to-review-code-728e5ec2576e) — specifically The Code Review Partner, The Security Auditor, and The Performance Profiler — with additional improvements for structured output, severity framework, deduplication, and parallel execution.

## License

MIT
