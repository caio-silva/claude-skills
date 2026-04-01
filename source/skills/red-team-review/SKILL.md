---
name: red-team-review
description: Adversarial security review that actively tries to break code. Goes beyond passive security scanning — constructs attack scenarios with exploitation paths and proof of concept.
---

# Red Team Review

## Overview

An adversarial security review that thinks like an attacker, not a checklist auditor. Where `deep-code-review` Pass 2 (Security) asks "is this secure?", red-team-review asks "how do I break this?" It constructs multi-step attack chains, traces data flow across components, and produces exploitation scenarios with proof-of-concept payloads.

| Aspect | Pass 2 (Security) in deep-code-review | red-team-review |
|--------|---------------------------------------|-----------------|
| Posture | Defensive — "is this secure?" | Offensive — "how do I break this?" |
| Output | Findings with OWASP/CWE references | Attack scenarios with exploitation paths |
| Depth | Pattern-matching against checklist | Multi-step attack chains across components |
| Scope | Changed files in the diff | Changed files + their callers, consumers, and data flow |

## When to Use

- When the `improve` router detects security-relevant code changes
- When explicitly requested (`/red-team-review`)
- As part of `code-improvement-orchestrator` Phase 2 (alongside `deep-code-review`)
- Before deploying auth, payment, or access control changes

**When NOT to use:**
- CSS/styling changes only
- Documentation-only changes
- Dependency version bumps with no code changes (use `deep-code-review` Pass 2 for CVE checks)

## Review Posture

You are an attacker with full knowledge of the stack. Your goal is to find a way in.

- Assume every input is malicious until proven sanitized.
- Trace data flow from entry point to storage/output — every transformation is a potential exploit point.
- Don't stop at the first vulnerability. Chain them: SQL injection alone is HIGH, but SQL injection → privilege escalation → data exfiltration is CRITICAL.
- Look beyond the diff: the changed code interacts with existing code. Read callers, consumers, and adjacent modules.
- Use web search for CVEs on any new dependencies.

## Review Method

Follow the ReACT method for each attack category:

### Step 1: PLAN
Identify attack surface in the diff:
- New endpoints or routes
- Input handling changes
- Auth/authz modifications
- Database queries
- File operations
- External service calls
- Dependency additions

### Step 2: INVESTIGATE
For each attack surface area, use tools:
- Read the full function, not just the diff
- Grep for the input variable — trace it from entry to use
- Read auth middleware applied to the route
- Check if similar patterns exist elsewhere (indicates systemic issue)
- Search for CVEs on new dependencies

### Step 3: SYNTHESIZE
Produce attack scenarios backed by investigation evidence.

## Attack Categories

Investigate each category independently.

### 1. Injection Chains

Trace user input from entry point through all transformations to output/storage.

**Look for:**
- SQL injection → command injection escalation
- Template injection → RCE
- XSS → session hijacking → account takeover
- NoSQL injection (MongoDB operator injection, prototype pollution)
- Header injection (CRLF, host header manipulation)
- Path traversal → arbitrary file read/write

**Produce:** Full input-to-impact chain with example payloads.

### 2. Auth & Access Bypass

Map all auth checks in the changed code and adjacent code.

**Look for:**
- Missing auth checks on new endpoints
- JWT algorithm confusion (RS256 → HS256 using public key as secret)
- JWT claim tampering (changing role/userId in payload)
- Session fixation (session ID not rotated after login)
- Privilege escalation via parameter manipulation
- IDOR (changing IDs in URLs/params to access other users' data)
- Race conditions in auth state transitions
- OAuth redirect URI manipulation
- Token not invalidated on password change/logout

**Produce:** Step-by-step bypass scenario.

### 3. Data Exfiltration Paths

Map what data an attacker can access from each entry point.

**Look for:**
- IDOR in API endpoints (changing resource IDs)
- Verbose error messages leaking stack traces, SQL queries, internal paths
- API responses returning more fields than the UI displays
- Timing attacks (different response times for valid vs invalid users)
- Enumeration (sequential IDs, predictable tokens)
- Debug endpoints left enabled
- GraphQL introspection enabled in production
- Logging PII/secrets to stdout/files

**Produce:** What data is extractable, how, and by whom (unauthenticated, authenticated user, admin).

### 4. Business Logic Abuse

Analyze business rules for exploitation.

**Look for:**
- Race conditions in financial operations (double-spend, double-redeem)
- Bypassing rate limits (different endpoints for same action, header manipulation)
- Free tier abuse (creating multiple accounts, exploiting trial logic)
- Coupon/discount stacking
- State machine violations (skipping steps in a checkout flow)
- Negative quantity/amount inputs
- Integer overflow in pricing calculations
- Time-of-check-to-time-of-use (TOCTOU) bugs

**Produce:** Abuse scenario with business impact.

### 5. Dependency & Supply Chain

Check new or changed dependencies for known vulnerabilities.

**Look for:**
- Known CVEs in direct dependencies (search web for `<package> CVE`)
- Typosquatting (package name similar to popular package)
- Unmaintained packages (no commits in 2+ years, open security issues)
- Transitive dependency risks (vulnerability in a dependency's dependency)
- Postinstall scripts that execute arbitrary code
- Lock file integrity (does the lock file match the manifest?)

**Produce:** Dependency risk assessment with specific CVE references and remediation.

## Project Context

If `.project-context.md` exists, read it to:
- Understand the auth mechanism (JWT? sessions? OAuth?) to focus auth bypass scenarios
- Know the deployment target (cloud? on-prem?) to calibrate attack feasibility
- Identify the database (SQL? NoSQL?) to focus injection techniques
- Check compliance requirements to prioritize findings that have regulatory impact

## Output Format

Each attack scenario uses this structure:

```
SCENARIO: <descriptive title>
CATEGORY: <Injection | Auth | Exfiltration | BusinessLogic | SupplyChain>
SEVERITY: <0-10 CVSS-inspired score>
  Impact: <0-4>
  Exploitability: <0-4>
  Human Factor: <0-1.5>
  Complexity Penalty: <0-0.5>
ENTRY_POINT: <file:line — where the attack begins>
ATTACK_VECTOR:
  1. <step 1 — what the attacker does>
  2. <step 2 — what happens in the code>
  3. <step 3 — what the attacker gains>
IMPACT: <what the attacker gains — data, access, money, disruption>
PROOF_OF_CONCEPT: <example HTTP request, payload, or script>
REMEDIATION: <specific code fix with file:line>
REGRESSION_ID: <RT-NNN, for verification by review-regression>
```

## Scoring

Findings use the same CVSS-inspired severity model as `deep-code-review`. The overall red-team dimension score is calculated the same way (starts at 100, deducts per finding severity).

Red-team findings are reported as a separate dimension in the review output:

```
Quality: 88 | Security: 72 | Red-Team: 65 | Performance: 95 | Tests: 64 | Design: 91
```

## Deduplication with deep-code-review

If running alongside `deep-code-review`:
- Findings that overlap with Pass 2 (Security) are deduplicated. Red-team version takes precedence since it includes attack chains.
- Keep the deeper analysis. If Pass 2 found "missing input validation" and red-team found "missing input validation → SQL injection → privilege escalation", keep the red-team finding.
- Cross-reference: both findings get the same Regression-ID for verification.
