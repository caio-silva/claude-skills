---
name: improve
description: Smart entry point for code quality — routes to the right skill based on scope and context. Handles review, fix, verify, and onboarding workflows automatically.
---

# Improve

## Overview

The primary entry point for all code quality work. Instead of choosing between `deep-code-review`, `red-team-review`, `code-improvement-orchestrator`, `review-regression`, or `project-context`, just run `/improve` and it routes to the right skill based on what you're working on.

## Routing Logic

```
/improve          → auto-detect scope, route accordingly
/improve file.ts  → review specific files
/improve verify   → verify previous findings are fixed
/improve context  → run project-context onboarding
```

### Decision Flow

1. **Check for `/improve verify` or `/improve --verify`**
   → Run `review-regression` with auto-detection. Skip all other steps.

2. **Check for `/improve context`**
   → Run `project-context`. Skip all other steps.

3. **Check for `.project-context.md`**
   → If missing, run `project-context` first. Then continue.

4. **Detect scope:**

   | Condition | Scope | Route |
   |-----------|-------|-------|
   | User passed file arguments (`/improve src/auth.ts src/db.ts`) | Specific files | → Step 5 (Small Scope) |
   | `git diff` or `git diff --cached` has output AND total lines < 500 | Small diff | → Step 5 (Small Scope) |
   | `git diff` or `git diff --cached` has output AND total lines >= 500 | Large diff | → Step 6 (Large Scope) |
   | No arguments AND no uncommitted changes | Whole project | → Step 6 (Large Scope) |

5. **Small Scope: Review**

   a. Run `deep-code-review` on the target files/diff.

   b. Check if any changed files are security-relevant (see Security Detection below). If yes, also run `red-team-review` in parallel.

   c. When review completes:
      - If findings exist: present the report, then ask:
        > "Found <N> findings (<critical> critical, <high> high, <medium> medium, <low> low). Want me to fix these?"
        - If yes: run `code-improvement-orchestrator` scoped to these findings (skip Phase 1-2, feed findings directly into Phase 3 as pre-collected findings).
        - If no: done. Report only.
      - If no findings: done. Report "clean."

6. **Large Scope: Full Orchestrator**

   Run `code-improvement-orchestrator` (which internally calls `deep-code-review`, `red-team-review`, and `review-regression` at the appropriate phases).

## Security-Relevant Code Detection

Check if any target files match these patterns to decide whether to also run `red-team-review`:

**By directory:**
- `auth/`, `authentication/`, `authorization/`
- `security/`, `crypto/`, `encryption/`
- `middleware/`, `interceptors/`, `guards/`
- `api/`, `routes/`, `endpoints/`, `controllers/`

**By filename:**
- `*auth*`, `*login*`, `*logout*`, `*signup*`, `*register*`
- `*session*`, `*token*`, `*jwt*`, `*oauth*`
- `*password*`, `*credential*`, `*secret*`
- `*permission*`, `*rbac*`, `*acl*`, `*role*`
- `*sanitize*`, `*validate*`, `*escape*`

**By content** (grep the changed files):
- `bcrypt`, `argon2`, `scrypt`, `pbkdf2`
- `jwt`, `jsonwebtoken`, `jose`
- `oauth`, `openid`, `saml`
- `cors`, `csrf`, `csp`, `helmet`
- `encrypt`, `decrypt`, `cipher`, `hash`
- Raw SQL strings (`SELECT`, `INSERT`, `UPDATE`, `DELETE` with string interpolation)
- `process.env`, `os.environ`, `env.`, secrets references
- `exec(`, `spawn(`, `system(`, `eval(`, `Function(`

**By config files:**
- `.env`, `.env.*` files being modified
- Certificate files (`*.pem`, `*.key`, `*.crt`)
- Auth config files (`auth.config.*`, `next-auth.*`, `passport.*`)

**When uncertain, include `red-team-review`.** A pass that finds nothing is better than a skipped pass that would have found a vulnerability.

## Project Context Integration

When `.project-context.md` exists:
- Read the Compliance section — if SOC 2 or GDPR is declared, always include `red-team-review` regardless of file patterns
- Read the Stack section — use framework knowledge to improve security-relevant detection (e.g., in Django, `views.py` and `urls.py` are always security-relevant)
- Read the Known Concerns section — if security concerns are listed, always include `red-team-review`

## Output

The router itself produces no findings or reports. It delegates to the appropriate skill(s) and presents their output directly. The only output from the router is:

1. **Routing decision:** Brief message explaining what it's doing and why:
   > "Detected 127 lines of changes touching `src/auth/`. Running deep-code-review + red-team-review."

2. **Skill output:** The full output from whichever skill(s) run.

3. **Post-review offer** (small scope only): The "want me to fix these?" prompt described above.
