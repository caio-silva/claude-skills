# Deep Code Review: SOC 2 & GDPR Compliance Passes

## Problem

The deep-code-review skill covers code quality, security, performance, tests, design, and SEO — but has no compliance perspective. Code changes that introduce regulatory violations (SOC 2 control gaps, GDPR data protection failures) pass review undetected.

## Solution

Add two new conditional passes (Pass 7: SOC 2, Pass 8: GDPR) with dedicated fetch agents that pull current requirements from official sources before each review. Both passes follow the existing conditional pattern established by Pass 6 (SEO).

---

## 1. Step 0 Change: Compliance Research Fetch

### When it runs

After Step 0 sub-step 1 (Identify target code), evaluate the Pass 7 and Pass 8 trigger conditions against the diff. For each triggered pass, launch its fetch agent in parallel with sub-steps 2-4.

### Fetch agents

**SOC 2 Fetch Agent** — searches and reads from:
- AICPA Trust Services Criteria guidance (freely available summaries and readiness checklists — note: the full TSC document is behind a paywall, so target freely available guidance)
- SOC 2 Type II control requirement summaries
- Recent AICPA updates or guidance changes
- Major auditor guidance and interpretations
- ISACA SOC 2 control guidance
- Cloud-specific SOC 2 mapping guides (AWS, Azure, GCP shared responsibility)

**GDPR Fetch Agent** — searches and reads from:
- EUR-Lex: Regulation (EU) 2016/679 full text (freely available)
- EDPB guidelines and opinions
- Article 29 Working Party opinions (predecessor to EDPB, still cited in enforcement)
- ICO (UK) technical guidance
- CNIL (France) technical guidance
- Other major DPAs: Hamburg DPA (Germany), AEPD (Spain), Garante (Italy), AP (Netherlands)
- ePrivacy Directive (2002/58/EC) — for cookie and electronic communications requirements
- CJEU case law (Schrems II for transfers, Planet49 for consent)
- Recent enforcement actions and rulings setting new precedents

### Output format

Each fetch agent produces a structured context block containing:
- List of criteria/articles relevant to the diff, each with official identifier, short title, and key requirements
- Recent enforcement actions or guidance changes relevant to the code patterns observed
- Source attribution: `[source, date accessed]` for each item

### Fetch token budget

Fetch summary must not exceed 3000 tokens per agent to prevent crowding out the actual code review.

### Fallback on failure

Both passes have built-in baseline checklists (the tables in Pass 7 and Pass 8 below). Fetch agents **augment** this baseline with current guidance.

- If fetch fails or times out (10-second timeout per source), the pass proceeds using the built-in checklist
- Note in finding output: `Based on: built-in checklist; live compliance data unavailable`
- When fetch succeeds, findings include: `Based on: [source, date accessed]`

### Subagent rule

Fetch agents **always run as subagents** when their respective pass is triggered, regardless of diff size. The `< 200 lines = no subagents` rule does not apply to fetch agents. For the review passes themselves: when compliance passes are triggered, always use subagents for those passes even below the 200-line threshold.

---

## 2. Pass 7: SOC 2 Compliance (Conditional)

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

**Project-level opt-in:** If the project contains a `.compliance` config, SOC 2 annotations in `CLAUDE.md`, or files in directories named `compliance/`, `soc2/`, `audit/`, `security/` — always run this pass regardless of file-level triggers.

**When uncertain:** Err on the side of running the pass. A pass that produces zero findings is preferable to a skipped pass that would have found a CRITICAL issue.

Silently skipped when no triggers match.

### Perspective

Review as a SOC 2 auditor preparing for a Type II audit. Most code review findings will be design deficiencies (Type I) — note this when relevant.

### Check for

| Category | TSC Reference | Look For |
|----------|--------------|----------|
| **Logical & Physical Access** | CC6 (CC6.1-CC6.8) | Missing auth checks, overly broad permissions, hardcoded roles, missing RBAC/ABAC, shared accounts, missing MFA enforcement, missing session expiration, no account lockout, missing provisioning/deprovisioning, excessive token lifetimes, system boundary security gaps, unencrypted data in transit, missing input validation for malware prevention |
| **Control Activities** | CC5 | Missing segregation of duties (same service creates and approves), no dual-control for sensitive operations, missing approval workflows in code |
| **System Operations** | CC7 (CC7.1-CC7.5) | Missing detection mechanisms (CC7.1), missing monitoring for anomalies (CC7.2), no incident evaluation logic (CC7.3), missing incident response procedures (CC7.4), no recovery procedures (CC7.5), audit logs missing timestamps/user context/action details, mutable or deletable logs |
| **Change Management** | CC8 | Missing change tracking, deployments without approval gates, no rollback capability, missing version control of configs, CI/CD without review gates |
| **Risk Mitigation** | CC9 | Missing input validation, unencrypted data at rest or in transit, weak encryption algorithms, missing key rotation, no error handling that could leak internal state |
| **Monitoring Activities** | CC4 | Missing ongoing monitoring of controls (CC4.1), no evaluation/communication of deficiencies (CC4.2) |
| **Risk Assessment** | CC3 | Missing risk identification for new features, no threat modeling signals, unassessed third-party integrations |
| **Availability** | A1 (A1.1-A1.3) | Missing health checks, no circuit breakers, missing timeout configurations, no retry with backoff, single points of failure, missing graceful degradation, no capacity planning, missing backup/recovery, untested recovery procedures |
| **Confidentiality** | C1 (C1.1-C1.2) | Secrets in code/logs/configs, PII in URLs or query strings, missing data classification, overly verbose error messages exposing internals, no disposal procedures for confidential data |
| **Processing Integrity** | PI1 (PI1.1-PI1.5) | Missing input validation for completeness/accuracy, data transformation errors, missing output validation, no processing completeness checks, data corruption without detection |

**Scope note:** This pass covers the Security (CC), Availability (A1), Confidentiality (C1), and Processing Integrity (PI1) trust services categories. Privacy (P1) is delegated to Pass 8 (GDPR) — findings relevant to both are cross-referenced.

### Per-finding fields

- **TSC Reference**: Specific criterion (e.g., CC6.1, CC7.2, A1.2)
- **Control gap**: What specific control is missing or deficient
- **Audit risk**: How an auditor would classify this — design deficiency vs. operating effectiveness concern
- **Evidence recommendation**: What evidence should exist to demonstrate the control
- **Cross-ref** (optional): Other pass this overlaps with

### Severity calibration

| Severity | SOC 2 Example |
|----------|---------------|
| **CRITICAL** | Disabled auth on an endpoint; logging plaintext passwords; hardcoded encryption keys in source; audit logs modifiable by application code |
| **HIGH** | Missing access control on admin endpoint; no audit logging for data modification; encryption at rest disabled; secrets in env vars without vault |
| **MEDIUM** | Overly broad IAM permissions; missing rate limiting on auth endpoints; log entries missing correlation IDs; backup not tested |
| **LOW** | Inconsistent log format; missing comments on security-relevant config; alert threshold could be tighter |

---

## 3. Pass 8: GDPR Compliance (Conditional)

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

**Project-level opt-in:** If the project contains privacy policy files, DPA templates, GDPR annotations in `CLAUDE.md`, or files in directories named `gdpr/`, `privacy/`, `compliance/` — always run this pass regardless of file-level triggers.

**When uncertain:** Err on the side of running the pass.

Silently skipped when no triggers match.

### Perspective

Review as a data protection officer preparing for a supervisory authority audit.

### Check for

| Category | GDPR Reference | Fine Tier | Look For |
|----------|---------------|-----------|----------|
| **Lawful Basis** | Art. 6 | Tier 2 (4%) | Processing personal data without documented legal basis, missing consent collection before processing, consent not freely given/specific/informed/unambiguous, pre-ticked consent boxes |
| **Data Minimization** | Art. 5(1)(c) | Tier 2 (4%) | Collecting more data than necessary, storing fields with no clear purpose, `SELECT *` on user tables, logging full request bodies containing PII |
| **Purpose Limitation** | Art. 5(1)(b) | Tier 2 (4%) | Data collected for one purpose used for another without consent, analytics data repurposed for marketing, shared user data across services without basis |
| **Storage Limitation** | Art. 5(1)(e) | Tier 2 (4%) | No TTL or retention policy on personal data, missing automated deletion/anonymization, soft-deletes that retain full PII indefinitely |
| **Integrity & Confidentiality** | Art. 5(1)(f) | Tier 2 (4%) | PII not encrypted at rest or in transit, missing access controls on personal data, no pseudonymization where feasible |
| **Accountability** | Art. 5(2) | Tier 2 (4%) | Missing audit trails for data processing decisions, no logging of PII operations, no evidence of compliance measures |
| **Consent Management** | Art. 7 | Tier 2 (4%) | No consent record stored, no way to withdraw consent, consent not granular (all-or-nothing), missing consent versioning, cookie banners without reject option |
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
| **Children's Data** | Art. 8 | Tier 2 (4%) | No age verification when service may be used by minors, missing parental consent mechanism |
| **Cross-border Transfers** | Art. 44-49 | Tier 2 (4%) | Personal data sent to third-country services without adequacy decision or SCCs, CDN/analytics providers in non-adequate countries without safeguards |
| **Cookie & eComms Consent** | ePrivacy Directive Art. 5(3) | National law | Non-essential cookies set before consent, analytics firing before consent granted, no mechanism to reject non-essential cookies, missing cookie categorization |

**Fine tier reference:**
- **Tier 1 (Art. 83(4))**: Up to EUR 10 million / 2% of global annual turnover — controller/processor obligations (Art. 8, 11, 25-39, 42-43)
- **Tier 2 (Art. 83(5))**: Up to EUR 20 million / 4% of global annual turnover — basic principles (Art. 5-7, 9), data subject rights (Art. 12-22), transfers (Art. 44-49)

### Security cross-references

| Check | Cross-ref |
|-------|-----------|
| PII in logs or error messages | Pass 2: Data exposure |
| Missing encryption at rest | Pass 2: Cryptography, Pass 7: CC9 |
| No access controls on personal data | Pass 2: Auth/AuthZ, Pass 7: CC6 |
| Missing audit logging on PII operations | Pass 7: CC7 |
| Missing encryption in transit for PII | Pass 2: Cryptography, Pass 7: CC6.7 |
| User input stored without sanitization as PII | Pass 2: Injection, Pass 8: Art. 5(1)(d) |

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

### Primary finding rule

When a finding from Pass 2 (Security) directly maps to a SOC 2 control or GDPR article, do NOT create a separate Pass 7/8 finding. Instead, add a `Compliance-ref` field to the Pass 2 finding listing the relevant TSC criterion and/or GDPR article.

Only create a standalone Pass 7/8 finding when the compliance concern has no corresponding Pass 2 finding — e.g., missing audit log retention (SOC 2) or missing consent mechanism (GDPR) are compliance-specific, not general security issues.

### Cross-pass merging

When a finding spans Pass 7 and Pass 8 (e.g., unencrypted PII storage is both CC9 and Art. 32), merge into one finding and include all per-finding fields from each contributing pass.

### Finding format update

The finding format `Pass` field becomes: `Quality | Security | Performance | Tests | Design | SEO & AI Discoverability | SOC 2 Compliance | GDPR Compliance`

---

## 5. Structural Changes to SKILL.md

### Updates needed

- Overview: "up to six expert perspectives" → "up to eight expert perspectives"
- Overview list: add SOC 2 Compliance and GDPR Compliance entries
- Flow diagram: add two new conditional branches (same dashed-line pattern as Pass 6)
- Step 0: add sub-step 5 for compliance fetch agents
- Execution section: "Launch up to six parallel subagents" → "up to eight"
- Execution section: add compliance subagent rule (always use subagents when compliance passes trigger, even below 200-line threshold)
- Finding format: update Pass field to include new passes
- Common Mistakes table: add compliance-specific entries

### New Common Mistakes entries

| Mistake | Fix |
|---------|-----|
| Flagging all auth code as SOC 2 non-compliant | SOC 2 is about controls, not specific implementations. Check if the control objective is met. |
| Treating SOC 2 as a checklist of code patterns | SOC 2 evaluates organizational controls. Code review verifies control implementation only. Scope to what's visible in the diff. |
| Flagging GDPR violations without knowing the lawful basis | Different bases (consent, contract, legitimate interest) have different requirements. Ask about basis before flagging consent issues. |
| Assuming all PII requires consent | Contractual necessity (Art. 6(1)(b)) and legitimate interest (Art. 6(1)(f)) don't require consent. |
| Confusing GDPR with national implementations | Flag against the regulation. Reference national DPA guidance as additional context only. |
| Flagging compliance issues on internal-only tools | Scope depends on what data is processed. Internal admin tools have different requirements. Ask about data classification. |
| Reporting Pass 2 and Pass 7/8 findings for the same issue separately | Pass 2 finding is primary. Add compliance metadata as `Compliance-ref` field. |
| Citing outdated TSC criteria or GDPR interpretations | Use fetch agent output. Include `Based on: [source, date]` in findings. |
| Flagging cookie consent under GDPR Art. 6 | Cookie consent is governed by the ePrivacy Directive (Art. 5(3)), not GDPR Art. 6. |

### Compliance disclaimer

Add to output structure: "Compliance findings are automated heuristics, not legal advice. Findings should be reviewed by qualified legal counsel or a certified auditor before being used for compliance decisions."
