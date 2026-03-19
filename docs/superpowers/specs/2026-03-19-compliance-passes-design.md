# Deep Code Review: SOC 2 & GDPR Compliance Passes

## Problem

The deep-code-review skill covers code quality, security, performance, tests, design, and SEO — but has no compliance perspective. Code changes that introduce regulatory violations (SOC 2 control gaps, GDPR data protection failures) pass review undetected.

## Solution

Add two new passes (Pass 7: SOC 2, Pass 8: GDPR) with dedicated fetch agents that pull current requirements from official sources before each review. Both passes run when their trigger conditions are met. Built-in baseline checklists ensure the passes work even when external sources are unreachable.

**Built-in checklist last verified: 2026-03-19.** If fetch agents consistently return guidance that conflicts with the built-in checklist, flag the discrepancy to the user.

---

## 1. Step 0 Change: Compliance Research Fetch

### When it runs

After Step 0 sub-step 1 (Identify target code), evaluate the Pass 7 and Pass 8 trigger conditions against the diff. For each triggered pass, launch its fetch agent in parallel with sub-steps 2-4. Add a new sub-step 5: "Await compliance fetch results (if triggered)" — this is where fetch results are collected before passes launch.

### How it fetches

Fetch agents use `WebSearch` and `WebFetch` tools. Source fetches run **in parallel** with a total wall-clock timeout of 15 seconds. Sources are prioritized:
- **SOC 2**: AICPA freely available guidance first, then ISACA, then cloud-specific guides
- **GDPR**: EUR-Lex first, then EDPB, then national DPAs as secondary

### Fetch agents

**SOC 2 Fetch Agent** — searches and reads from:
- AICPA Trust Services Criteria guidance (freely available summaries and readiness checklists — the full TSC document is behind a paywall, so target freely available guidance)
- SOC 2 Type II control requirement summaries
- Recent AICPA updates or guidance changes
- Major auditor guidance and interpretations
- ISACA SOC 2 control guidance
- NIST SP 800-53 mapping to TSC (AICPA provides this mapping)
- Cloud-specific SOC 2 mapping guides (AWS, Azure, GCP shared responsibility)
- CSA (Cloud Security Alliance) STAR registry

**GDPR Fetch Agent** — searches and reads from:
- EUR-Lex: Regulation (EU) 2016/679 full text (freely available)
- EDPB guidelines and opinions
- Article 29 Working Party opinions (predecessor to EDPB, still cited in enforcement)
- ICO (UK) technical guidance
- CNIL (France) technical guidance
- Other major DPAs: BfDI (Germany, federal), Hamburg DPA (Germany), AEPD (Spain), Garante (Italy), AP (Netherlands)
- ePrivacy Directive (2002/58/EC) — for cookie and electronic communications requirements
- CJEU case law (Schrems II for transfers, Planet49 for consent)
- Recent enforcement actions and rulings setting new precedents

### Output format

Each fetch agent produces a structured context block containing:
- List of criteria/articles relevant to the diff, each with official identifier, short title, and key requirements
- Recent enforcement actions or guidance changes relevant to the code patterns observed
- Per-item source attribution: `[source, date accessed]`

### Fetch token budget

Fetch summary output must not exceed 3000 tokens per agent. The fetch agent's working context (for reading and processing source material) is unconstrained — only the final output passed to the review pass is budgeted.

### Fallback on failure

Both passes have **built-in baseline checklists** (the tables in Pass 7 and Pass 8 below). These are the primary reference. Fetch agents **augment** this baseline with current guidance when available.

- If fetch fails, times out, or returns no useful content, the pass proceeds using the built-in checklist
- Per-finding source attribution: each finding states its own basis — `Based on: [source, date accessed]` or `Based on: built-in checklist`
- Partial fetch success is fine — some findings may cite live sources while others use the built-in checklist

### Subagent rule

Compliance passes always use subagents because their fetch agents require independent tool-use loops for web retrieval. This applies regardless of diff size. The existing rule becomes: "If the codebase is small (< 200 lines changed), run Passes 1-6 yourself without subagents. Exception: when Pass 7 or Pass 8 is triggered, always use subagents for those passes and their fetch agents, regardless of diff size."

---

## 2. Pass 7: SOC 2 Compliance

### Trigger condition

Runs when the diff contains code touching any of:
- Authentication, authorization, access control, RBAC/ABAC
- Logging, audit trails, observability
- Encryption, key management, certificate handling
- Monitoring, alerting, anomaly detection
- Backup, recovery, failover, disaster recovery
- Change management, deployment pipelines
- Infrastructure configuration (Terraform, CloudFormation, Ansible, Kubernetes, Dockerfiles)
- CI/CD pipeline definitions (`.github/workflows`, `Jenkinsfile`, `.gitlab-ci.yml`)
- Database schema changes, migrations
- API definitions, OpenAPI specs
- Dependency management files (`package.json`, `requirements.txt`, `go.mod`, etc.)
- Environment/secrets configuration (vault configs, secret manager integrations)
- Health checks, circuit breakers, retry/timeout logic
- Network/firewall configuration, security groups, WAF rules
- Vendor/third-party service integrations (OAuth, webhooks, SaaS SDKs)
- User/role provisioning, lifecycle management
- Incident response, escalation, on-call routing
- Error handling, retry logic in data processing

**Project-level opt-in:** If the project contains a `.compliance` config, SOC 2 annotations in `CLAUDE.md`, or files in directories named `compliance/`, `soc2/`, `audit/`, `security/` — run this pass if the diff touches any code file (not just the trigger categories above).

**When uncertain:** Err on the side of running the pass. A pass that produces zero findings is preferable to a skipped pass that would have found a CRITICAL issue.

Silently skipped when no triggers match and no project-level opt-in.

### Scope

Focus findings on code changed in the diff. Flag pre-existing compliance gaps only when they are CRITICAL or when the diff makes them actively worse (e.g., adding a new endpoint to a service with no audit logging).

### Perspective

Review as a SOC 2 auditor preparing for a Type II audit. Most code review findings will be design deficiencies (Type I) — note this when relevant.

### Check for

| Category | TSC Reference | Look For |
|----------|--------------|----------|
| **Logical & Physical Access** | CC6 | Missing auth checks (CC6.1), missing user registration/authorization (CC6.2), missing access removal/deprovisioning (CC6.3), overly broad permissions, hardcoded roles, shared accounts, missing MFA enforcement, missing session expiration, no account lockout, excessive token lifetimes, system boundary security gaps (CC6.6), unencrypted data in transit (CC6.7), missing input validation for malware prevention (CC6.8) |
| **Control Activities** | CC5 (also CC6.1) | Missing segregation of duties (same service creates and approves), no dual-control for sensitive operations, missing approval workflows in code |
| **System Operations** | CC7 | Missing detection mechanisms (CC7.1), missing monitoring for anomalies (CC7.2), no incident evaluation logic (CC7.3), missing incident response procedures (CC7.4), no recovery procedures (CC7.5), audit logs missing timestamps/user context/action details, mutable or deletable logs |
| **Change Management** | CC8 | Missing change tracking, deployments without approval gates, no rollback capability, missing version control of configs, CI/CD without review gates |
| **Vendor & Business Risk** | CC9 | Unassessed third-party service integrations (CC9.2), missing vendor risk evaluation, no sub-processor controls, business continuity gaps (CC9.1) |
| **Monitoring Activities** | CC4 | Missing ongoing monitoring of controls (CC4.1), no evaluation/communication of deficiencies (CC4.2) |
| **Risk Assessment** | CC3 | Missing risk identification for new features, no threat modeling signals, unassessed third-party integrations |
| **Availability** | A1 | Missing capacity planning/scaling (A1.1), missing backup/recovery mechanisms (A1.2), untested recovery procedures/failover (A1.3), no circuit breakers, missing timeout configurations, single points of failure |
| **Confidentiality** | C1 | Secrets in code/logs/configs, PII in URLs or query strings, missing data classification, overly verbose error messages exposing internals (C1.1), no disposal procedures for confidential data (C1.2) |
| **Processing Integrity** | PI1 | Missing input validation for completeness/accuracy (PI1.2), data transformation errors (PI1.3), missing output validation (PI1.4), no processing completeness checks, data corruption without detection (PI1.5) |

**Scope note:** This pass covers the Security (CC3-CC9), Availability (A1), Confidentiality (C1), and Processing Integrity (PI1) trust services categories. CC1 (Control Environment) and CC2 (Communication and Information) are organizational controls not observable in code diffs and are excluded. Privacy (P1) is delegated to Pass 8 (GDPR) — findings relevant to both are cross-referenced.

### Per-finding fields

- **TSC Reference**: Specific criterion (e.g., CC6.1, CC7.2, A1.2)
- **Control gap**: What specific control is missing or deficient
- **Audit risk**: How an auditor would classify this — design deficiency vs. operating effectiveness concern
- **Evidence recommendation**: What evidence should exist to demonstrate the control
- **Cross-ref** (optional): Other pass this overlaps with
- **Based on**: Source and date accessed (from fetch agent, or "built-in checklist")

### Severity calibration

| Severity | SOC 2 Example |
|----------|---------------|
| **CRITICAL** | Disabled auth on an endpoint; logging plaintext passwords; hardcoded encryption keys in source; audit logs modifiable by application code |
| **HIGH** | Missing access control on admin endpoint; no audit logging for data modification; encryption at rest disabled; secrets in env vars without vault (context-dependent — acceptable in 12-factor apps with runtime injection from a secrets manager) |
| **MEDIUM** | Overly broad IAM permissions; missing rate limiting on auth endpoints; log entries missing correlation IDs; backup not tested |
| **LOW** | Inconsistent log format; missing comments on security-relevant config; alert threshold could be tighter |

---

## 3. Pass 8: GDPR Compliance

### Trigger condition

Runs when the diff contains code touching any of:
- User data, personal information, PII fields
- Consent mechanisms, cookie banners, consent records
- Analytics, tracking, telemetry, third-party tracking scripts
- Data storage, databases with user data
- Email collection, notification systems, marketing automation
- User accounts, profiles, registration
- Data exports, data portability endpoints
- Deletion endpoints, data erasure, soft-delete logic
- Privacy configuration, privacy policies
- Data retention, TTL logic, scheduled cleanup/archival
- Third-party SDK/service integrations (analytics, CRM, payment, etc.)
- Forms, input fields collecting user data
- Profiling, recommendation engines, scoring, ML/model training on user data
- Logging/telemetry that may contain PII (IP addresses, user agents, user IDs)
- Geolocation, IP-based features
- Age gating, date-of-birth fields
- Data breach detection/notification code
- Cross-border data transfer logic, storage region selection
- Data processing agreements, sub-processor configuration

**Project-level opt-in:** If the project contains privacy policy files, DPA templates, GDPR annotations in `CLAUDE.md`, or files in directories named `gdpr/`, `privacy/`, `compliance/` — run this pass if the diff touches any code file.

**When uncertain:** Err on the side of running the pass.

Silently skipped when no triggers match and no project-level opt-in.

### Scope

Focus findings on code changed in the diff. Flag pre-existing compliance gaps only when they are CRITICAL or when the diff makes them actively worse.

### Perspective

Review as a data protection officer preparing for a supervisory authority audit.

### Check for

| Category | GDPR Reference | Fine Tier | Look For |
|----------|---------------|-----------|----------|
| **Lawful Basis** | Art. 6 | Tier 2 (4%) | Processing personal data without documented legal basis, missing consent collection before processing, consent not freely given/specific/informed/unambiguous, pre-ticked consent boxes |
| **Data Minimization** | Art. 5(1)(c) | Tier 2 (4%) | Collecting more data than necessary, storing fields with no clear purpose, `SELECT *` on user tables, logging full request bodies containing PII |
| **Purpose Limitation** | Art. 5(1)(b) | Tier 2 (4%) | Data collected for one purpose used for another without consent, analytics data repurposed for marketing, shared user data across services without basis |
| **Accuracy** | Art. 5(1)(d) | Tier 2 (4%) | No mechanism to keep personal data up to date, stale PII without review/correction triggers, no link between rectification endpoint and downstream data stores |
| **Storage Limitation** | Art. 5(1)(e) | Tier 2 (4%) | No TTL or retention policy on personal data, missing automated deletion/anonymization, soft-deletes that retain full PII indefinitely |
| **Integrity & Confidentiality** | Art. 5(1)(f) | Tier 2 (4%) | PII not encrypted at rest or in transit, missing access controls on personal data, no pseudonymization where feasible |
| **Accountability** | Art. 5(2) | Tier 2 (4%) | Missing audit trails for data processing decisions, no logging of PII operations, no evidence of compliance measures |
| **Consent Management** | Art. 7 | Tier 2 (4%) | No consent record stored, no way to withdraw consent, consent not granular (all-or-nothing), missing consent versioning, cookie banners without reject option |
| **Special Category Data** | Art. 9 | Tier 2 (4%) | Processing health/biometric/genetic/racial/political data without explicit consent or Art. 9(2) exception, no technical safeguards distinguishing special category data from regular PII |
| **Transparency** | Art. 13-14 | Tier 2 (4%) | Data collection points without privacy information, missing transparency notices for direct (Art. 13) and indirect (Art. 14) collection |
| **Right of Access** | Art. 15 | Tier 2 (4%) | No endpoint for data subjects to obtain a copy of their data, missing query capabilities for user data export |
| **Right to Rectification** | Art. 16 | Tier 2 (4%) | No mechanism to correct inaccurate personal data, user profiles without edit capability |
| **Right to Erasure** | Art. 17 | Tier 2 (4%) | No deletion endpoint, incomplete deletion (data left in backups/caches/logs/analytics), cascading deletes not covering all stores, no mechanism to propagate deletion to processors |
| **Right to Object** | Art. 21 | Tier 2 (4%) | No mechanism to opt out of direct marketing, missing objection handling for legitimate interest processing, no profiling opt-out |
| **Right to Portability** | Art. 20 | Tier 2 (4%) | No data export endpoint, export missing key data categories, non-machine-readable export format |
| **Automated Decision-Making** | Art. 22 | Tier 2 (4%) | ML inference, scoring, or automated eligibility without human review option, no explanation capability for automated decisions, profiling with legal/significant effects |
| **Data Protection by Design** | Art. 25 | Tier 1 (2%) | PII not encrypted at rest, no pseudonymization where feasible, missing access controls on personal data, no data classification in schema |
| **Processor Obligations** | Art. 28 | Tier 1 (2%) | Third-party data processing integrations without contractual safeguards, missing DPA requirements at integration points |
| **Security of Processing** | Art. 32 | Tier 1 (2%) | Missing appropriate technical measures — pseudonymization, encryption, system resilience, restoration capability, regular security testing |
| **Breach Notification** | Art. 33-34 | Tier 1 (2%) | No logging of data access for breach investigation, missing audit trail on PII operations, no mechanism to detect unauthorized access, no notification pipeline |
| **DPIA Signals** | Art. 35 | Tier 1 (2%) | Large-scale profiling, automated decision-making, systematic monitoring, large-scale processing of special category data — flag as needing DPIA if not documented |
| **Children's Data** | Art. 8 | Tier 1 (2%) | No age verification when service may be used by minors, missing parental consent mechanism |
| **Cross-border Transfers** | Art. 44-49 | Tier 2 (4%) | Personal data sent to third-country services without adequacy decision or SCCs, CDN/analytics providers in non-adequate countries without safeguards |
| **Cookie & eComms Consent** | ePrivacy Dir. Art. 5(3) | National law | Non-essential cookies set before consent, analytics firing before consent granted, no mechanism to reject non-essential cookies, missing cookie categorization |
| **Unsolicited Communications** | ePrivacy Dir. Art. 13 | National law | Email marketing without opt-in consent (opt-in required in most EU member states), no unsubscribe mechanism, marketing to non-customers without prior consent |

**Fine tier reference:**
- **Tier 1 (Art. 83(4))**: Up to EUR 10 million / 2% of global annual turnover — controller/processor obligations (Art. 8, 11, 25-39, 42-43)
- **Tier 2 (Art. 83(5))**: Up to EUR 20 million / 4% of global annual turnover — basic principles (Art. 5-7, 9), data subject rights (Art. 12-22), transfers (Art. 44-49)

### Cross-references

| Check | Cross-ref |
|-------|-----------|
| PII in logs or error messages | Pass 2: Data exposure |
| Missing encryption at rest | Pass 2: Cryptography, Pass 7: C1 |
| No access controls on personal data | Pass 2: Auth/AuthZ, Pass 7: CC6 |
| Missing audit logging on PII operations | Pass 7: CC7 |
| Missing encryption in transit for PII | Pass 2: Cryptography, Pass 7: CC6.7 |
| Unsanitized user input stored as PII | Pass 2: Injection |
| Cookie banner implementation issues | Pass 6: SEO (implementation), Pass 8: GDPR (compliance) |

### Per-finding fields

- **GDPR Article**: Specific article reference (e.g., Art. 17(1), Art. 25(2))
- **Regulatory risk**: `[Tier 1: up to 10M/2% | Tier 2: up to 20M/4%] — [Low | Medium | High] likelihood based on enforcement precedent`
- **Cross-ref** (optional): Other pass this overlaps with
- **Based on**: Source and date accessed (from fetch agent, or "built-in checklist")

### Severity calibration

| Severity | GDPR Example |
|----------|--------------|
| **CRITICAL** | Processing PII without any lawful basis check; no mechanism for data deletion; transmitting PII over unencrypted channel; collecting children's data without age verification |
| **HIGH** | Consent checkbox pre-ticked; analytics firing before consent granted; PII in application logs without retention policy; missing data export endpoint for subject access requests |
| **MEDIUM** | Privacy policy link missing from data collection form; cookie banner not blocking non-essential cookies until consent; missing data portability export format |
| **LOW** | Data retention period not documented in code comments; consent record lacks granularity; privacy impact assessment suggested but not blocking |

---

## 4. Deduplication Rules for Compliance Passes

### Merged finding rule

Follow the existing general dedup rule: when the same code triggers findings in multiple passes, merge into one finding and tag all applicable passes. Use the higher severity. **Include all per-finding fields from every contributing pass** — the Pass 2 fields (attack scenario, OWASP/CWE) AND the compliance fields (TSC Reference, Control gap, GDPR Article, Regulatory risk, etc.).

No pass is privileged over another. The merged finding carries the union of all metadata.

### Compliance-specific findings

Create standalone Pass 7/8 findings only when the compliance concern has no corresponding finding in another pass — e.g., missing consent mechanism (GDPR), missing vendor risk assessment (SOC 2), DPIA signals. These are compliance-specific, not security issues.

### Finding format update

The finding format `Pass` field becomes: `Quality | Security | Performance | Tests | Design | SEO & AI Discoverability | SOC 2 Compliance | GDPR Compliance`

Add `Compliance-ref` as an optional field in the finding format template (alongside the existing `Cross-ref`), used when a finding from any pass has compliance implications: `Compliance-ref: CC6.1, Art. 32`

---

## 5. Structural Changes to SKILL.md

### Updates needed

- Overview: "up to six expert perspectives" → "up to eight expert perspectives"
- Overview list: add **SOC 2 Compliance** and **GDPR Compliance** entries
- Flow diagram update:
  ```dot
  digraph review_flow {
      rankdir=LR;
      "Gather Context" -> "Pass 1: Quality" -> "Merge & Deduplicate";
      "Gather Context" -> "Pass 2: Security" -> "Merge & Deduplicate";
      "Gather Context" -> "Pass 3: Performance" -> "Merge & Deduplicate";
      "Gather Context" -> "Pass 4: Tests" -> "Merge & Deduplicate";
      "Gather Context" -> "Pass 5: Design" -> "Merge & Deduplicate";
      "Gather Context" -> "Frontend files?" [style=dashed];
      "Frontend files?" -> "Pass 6: SEO" [label="yes"];
      "Frontend files?" -> "Skip" [label="no"];
      "Pass 6: SEO" -> "Merge & Deduplicate";
      "Gather Context" -> "SOC 2 triggers?" [style=dashed];
      "SOC 2 triggers?" -> "Fetch SOC 2" [label="yes"];
      "SOC 2 triggers?" -> "Skip" [label="no"];
      "Fetch SOC 2" -> "Pass 7: SOC 2" -> "Merge & Deduplicate";
      "Gather Context" -> "GDPR triggers?" [style=dashed];
      "GDPR triggers?" -> "Fetch GDPR" [label="yes"];
      "GDPR triggers?" -> "Skip" [label="no"];
      "Fetch GDPR" -> "Pass 8: GDPR" -> "Merge & Deduplicate";
      "Merge & Deduplicate" -> "Verdict + Report";
  }
  ```
- Step 0: add sub-step 5 "Await compliance fetch results (if triggered)"
- Execution section: "Launch up to six parallel subagents" → "up to eight"
- Execution section: add compliance subagent exception: "If the codebase is small (< 200 lines changed), run Passes 1-6 yourself without subagents. Exception: when Pass 7 or Pass 8 is triggered, always use subagents for those passes and their fetch agents, regardless of diff size."
- Finding format template: add `Compliance-ref` as optional field
- Output structure: add Section 7 footer (only when Pass 7 or 8 produced findings): *"Compliance findings are automated heuristics, not legal advice. Findings should be reviewed by qualified legal counsel or a certified auditor before being used for compliance decisions."*
- Common Mistakes table: add compliance-specific entries

### New Common Mistakes entries

| Mistake | Fix |
|---------|-----|
| Flagging all auth code as SOC 2 non-compliant | A custom RBAC implementation is not non-compliant simply because it exists. Check whether the control objective (restricting access based on role) is met, not whether the specific implementation matches a particular framework. |
| Treating SOC 2 as a checklist of code patterns | SOC 2 evaluates organizational controls. Code review verifies control implementation only. Scope to what's visible in the diff. |
| Flagging GDPR violations without knowing the lawful basis | Different bases (consent, contract, legitimate interest) have different requirements. Ask about basis before flagging consent issues. |
| Assuming all PII requires consent | Contractual necessity (Art. 6(1)(b)) and legitimate interest (Art. 6(1)(f)) don't require consent. Don't flag missing consent flows without checking. |
| Confusing GDPR with national implementations | Flag against the regulation. Reference national DPA guidance as additional context only. |
| Flagging compliance issues on internal-only tools | SOC 2 and GDPR scope depend on what data is processed. Internal admin tools processing employee data have different requirements. Ask about data classification. |
| Citing outdated TSC criteria or GDPR interpretations | Use fetch agent output. Include `Based on: [source, date]` in findings. |
| Flagging cookie consent under GDPR Art. 6 | Cookie consent is governed by the ePrivacy Directive (Art. 5(3)), not GDPR Art. 6. |
| Flagging every data field as PII | Only flag fields that identify or can be used to identify a natural person (Art. 4(1)). IP addresses, cookie IDs, and device fingerprints are PII under GDPR. |
