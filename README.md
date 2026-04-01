# claude-skills

Custom skills for Claude Code.

## Quick Start

```bash
# 1. Build
node scripts/build.js

# 2. Install
cp -r dist/claude-code/skills/* ~/.claude/skills/

# 3. Use
/improve
```

## Available Skills

| Skill | Description |
|-------|-------------|
| `improve` | Smart entry point — auto-detects scope (diff vs whole project) and routes to the right skill |
| `deep-code-review` | 12-pass code review with CVSS-inspired scoring, ReACT investigation method, anti-pattern detection |
| `code-improvement-orchestrator` | Autonomous quality workflow with structured handoffs, 3-attempt retry with root cause, regression verification, dev-QA continuous loop |
| `project-context` | Project onboarding — auto-detects stack, compliance requirements, and architecture |
| `red-team-review` | Adversarial security review with attack scenarios and proof-of-concept |
| `review-regression` | Targeted verification that specific findings from previous reviews are fixed |

## Scoring Model

Reviews use a 3-layer scoring system:

| Layer | What It Is |
|-------|-----------|
| **Layer 1 — Per-finding severity** | CVSS-inspired score (0–10) derived from Impact + Exploitability + Human Factor + Complexity |
| **Layer 2 — Dimension scores** | Named dimensions: Quality, Security, Performance, Tests, Design |
| **Layer 3 — Overall score** | Weighted aggregate of dimension scores; **95/100 is the pass threshold** |

Work is not complete until the overall score reaches 95+. Findings below threshold trigger another fix-and-review cycle.

## How Skills Connect

```
/improve
  |
  +-- small diff or specific files
  |     -> deep-code-review
  |          |
  |          +-- security-relevant? -> red-team-review (parallel)
  |
  +-- large scope or whole project
        -> code-improvement-orchestrator
             |
             +-- deep-code-review (per package, 5 agents)
             +-- red-team-review  (parallel)
             +-- review-regression (after each fix cycle)
```

`/improve` is the only entry point you need to remember. The other skills are also directly invocable when you want explicit control.

## Installation

Build first, then choose an install option.

### Build

```bash
node scripts/build.js
# or
bun run build
```

To validate skill sources without writing output:

```bash
node scripts/build.js --validate-only
# or
bun run validate
```

Built output lands in `dist/claude-code/skills/`.

### Option A: Personal (all projects)

```bash
mkdir -p ~/.claude/skills
cp -r dist/claude-code/skills/* ~/.claude/skills/
```

### Option B: Project-level (one project)

```bash
# From your project root
mkdir -p .claude/skills
cp -r /path/to/claude-skills/dist/claude-code/skills/* .claude/skills/

# Commit so your team gets it too
git add .claude/skills
git commit -m "Add claude-skills"
```

### Option C: External directory

```bash
claude --add-dir /path/to/claude-skills/dist/claude-code/skills
```

### Verify

Open Claude Code and type `/` — you should see `improve`, `deep-code-review`, and the other skills in the list.

## Customization

- **Edit skills** — source files live in `source/skills/<skill-name>/SKILL.md`. Run `node scripts/build.js` after editing.
- **Add anti-patterns** — append entries to `source/skills/deep-code-review/anti-patterns.md`. The build inlines this file into the skill.
- **Adjust scoring weights** — scoring configuration is in the frontmatter and body of each `SKILL.md`. Edit the weight values and rebuild.

## Review Passes

`deep-code-review` runs up to 12 passes in parallel, then merges findings into a single severity-ranked report. Pass selection is automatic based on what files are in scope. The scoring model (Layer 1–3 above) applies across all passes.

| Pass | Perspective | What It Catches |
|------|-------------|-----------------|
| **Quality** | Senior developer rejecting a PR | Bugs, logic errors, null handling, race conditions, edge cases, concurrency issues, silent error handling |
| **Security** | Attacker with knowledge of your stack | Injection, auth/authz flaws, data exposure, input validation gaps, crypto weaknesses (OWASP/CWE refs + attack scenarios) |
| **Performance** | Scalability engineer at 100x load | O(n^2) operations, N+1 queries, memory leaks, I/O bottlenecks, quick wins (with improvement estimates) |
| **Tests** | QA lead who doesn't trust green checkmarks | Coverage gaps, brittle tests, false confidence, missing scenarios, test isolation issues |
| **Design** | Staff engineer reviewing architecture | System fit, abstraction level, breaking changes, coupling, separation of concerns, API design |
| **SEO & AI** *(conditional)* | Search strategist for crawlers and AI | Missing meta/OG tags, structured data, crawlability, AI discoverability, heading hierarchy, link quality |
| **SOC 2** *(conditional)* | SOC 2 auditor preparing for Type II | Access control (CC6), audit logging (CC7), change management (CC8), vendor risk (CC9), availability (A1), confidentiality (C1), processing integrity (PI1) — with TSC references |
| **GDPR** *(conditional)* | Data protection officer for DPA audit | Lawful basis, data minimization, consent, data subject rights, cross-border transfers, DPIA signals — with GDPR article refs |
| **Docs & Content** *(conditional)* | Technical writer verifying reality | Feature claims vs code, pricing vs enforcement, API doc drift, runbook accuracy, env var drift |
| **Accessibility** *(conditional)* | WCAG 2.2 AA auditor | Keyboard traps, missing labels, contrast, alt text, focus management, ARIA, target sizes — with WCAG references |
| **i18n** *(conditional)* | Localization engineer | Hardcoded strings, currency/number/date formatting, pluralization, BiDi text, encoding, locale fallback |
| **Marketing** *(conditional)* | Growth strategist for conversion | Value prop clarity, CTA placement, social proof, friction points, content-code consistency, mobile conversion |

Conditional passes run only when the diff contains relevant file types (frontend files for SEO/Accessibility/i18n/Marketing, compliance-relevant files for SOC 2/GDPR, documentation files for Docs).

Compliance passes (SOC 2, GDPR) fetch current requirements from official sources before each review.

## Orchestrator Phases

`code-improvement-orchestrator` (and by extension `/improve` on large scope) runs these phases:

| Phase | What It Does |
|-------|-------------|
| **Scan & Triage** | Detects project structure, identifies human blockers, creates decisions log |
| **Review** | Dispatches 5 independent deep-code-review passes in parallel per package, consolidates findings |
| **Plan & Chunk** | Groups findings into work streams, builds dependency graph, reviews plans with 5 agents |
| **Execute** | Dispatches subagents per stream in parallel with worktrees, TDD, structured handoffs, dev-QA continuous loop |
| **Regression Verification** | Runs review-regression on each fix to confirm the original findings are resolved without new regressions |
| **Test Review** | Reviews test adequacy on fix branch — coverage gaps, weak assertions, missing edge cases |
| **Verify & Ship** | Final review pass, resolves remaining CRITICAL/HIGH issues, creates one PR per repo |

The improve-until-95 loop runs between Execute and Verify & Ship with a hard cap of 5 cycles. After 5 cycles, the orchestrator reports remaining findings and stops.

## Credits

Inspired by techniques from [You're Using AI to Write Code. You're Not Using It to Review Code](https://medium.com/data-science-collective/youre-using-ai-to-write-code-you-re-not-using-it-to-review-code-728e5ec2576e). Enhanced with practices from [Google's Engineering Practices](https://google.github.io/eng-practices/review/), [Graphite's prompt engineering guide](https://graphite.com/guides/effective-prompt-engineering-ai-code-reviews), and patterns from [CodeRabbit](https://www.coderabbit.ai/) and [Awesome Reviewers](https://github.com/baz-scm/awesome-reviewers).

v2 research references:

- [agency-agents](https://github.com/msitarzewski/agency-agents) — structured handoffs, evidence-based quality gates
- [promptfoo](https://github.com/promptfoo/promptfoo) — CVSS-inspired scoring, regression testing
- [MiroFish-Offline](https://github.com/nikmcfly/MiroFish-Offline) — ReACT review methodology
- [impeccable](https://github.com/pbakaus/impeccable) — anti-pattern checklists, build system architecture
- [OpenViking](https://github.com/volcengine/OpenViking) — tiered context model

## License

MIT
