# Deep Code Review: Documentation, Accessibility & i18n Passes

## Problem

The deep-code-review skill has no passes for verifying documentation accuracy, accessibility compliance, or internationalization correctness. Docs drift from code, accessibility violations ship undetected, and currency/date formatting issues cause real user impact.

## Solution

Add three new passes (Pass 9: Documentation & Content, Pass 10: Accessibility, Pass 11: i18n & Localization), all with built-in checklists only — no fetch agents. WCAG 2.2 is stable, i18n is pattern-based, and docs verification is project-specific. This keeps them fast and reliable.

---

## 1. Pass 9: Documentation & Content Verification — Conditional

### Trigger condition

Runs when the diff contains or the project has: markdown files (`.md`, `.mdx`), documentation directories (`docs/`, `wiki/`, `guides/`), user-facing content pages (terms, privacy policy, pricing, landing pages, about, FAQ), runbooks/playbooks (`runbook/`, `playbook/`, `operations/`), API documentation (OpenAPI specs, Swagger, `.apidoc`), changelog/release notes, or README files.

Silently skipped when no triggers match.

### Perspective

Review as a technical writer who verifies that documentation matches reality.

### Two-direction mismatch detection

The pass does NOT assume code is the source of truth. It flags mismatches, states which side appears more likely correct (with reasoning), and lets the human decide.

| Mismatch Type | Example | Action |
|--------------|---------|--------|
| **Page wrong, code right** | Page says "unlimited storage" but code enforces 10GB | Flag to fix page content |
| **Code wrong, page right** | Page says "10GB free tier" but code has no enforcement | Flag to fix code |
| **Unclear direction** | Feature listed on landing page, code exists but is behind a flag | Emit as finding with Confidence: Needs investigation, do NOT block |

**Exception for legal content:** For privacy policies, terms of service, and DPAs, the published legal document is presumed authoritative. Flag code mismatches as "Code wrong, page right" unless the document itself is clearly stale (e.g., references a product that no longer exists). See Pass 8 cross-reference for GDPR-specific handling.

### Check for

| Category | Look For |
|----------|----------|
| **Feature claims vs code** | Landing page/marketing claims that don't match implemented functionality, features listed that don't exist or are disabled, capability descriptions that overstate what the code does |
| **Pricing/limits vs enforcement** | Pricing page limits not enforced in code, free tier claims without corresponding checks, quota descriptions that don't match config values |
| **Legal content vs implementation** | Terms of service promises not backed by code (data deletion timelines, data handling claims), privacy policy statements contradicted by actual data flows |
| **API docs vs implementation** | Endpoints documented but not implemented (or vice versa), request/response schemas that don't match actual types, documented error codes not returned by the code |
| **Runbook accuracy** | Runbook procedures referencing renamed/removed scripts, incorrect CLI commands, outdated configuration paths, missing steps for new dependencies |
| **Environment/config docs** | README or setup guide listing env vars that don't match what the code reads (added, removed, renamed vars), default values documented incorrectly, required vs optional mismatch |
| **Dependency/version docs** | Installation guide specifying versions that don't match manifests, setup steps referencing removed dependencies, prerequisite version ranges that are stale |
| **Architecture diagram drift** | Diagrams (mermaid, drawio, embedded markdown) referencing renamed/removed services or modules, data flow arrows that no longer match actual integrations |
| **CLI reference drift** | CLI help text or docs referencing flags/subcommands that have been added, removed, or renamed in code |
| **Staleness signals** | Docs referencing removed features, deprecated APIs still documented as current, version numbers that don't match, screenshots/examples using old UI |
| **Internal consistency** | README contradicting CONTRIBUTING.md, getting-started guide inconsistent with actual setup steps, conflicting instructions across docs |

### Scope

Focus on documentation affected by or related to the diff. Don't audit the entire docs tree — check docs that reference code being changed, and code that is referenced by docs in the diff. Flag pre-existing staleness only at CRITICAL or HIGH severity.

**Discovery strategy:** Search docs for references to changed symbols (function names, endpoint paths, config keys, CLI commands) using grep/search within documentation directories. Limit search to files matching the trigger file patterns. Do not recursively follow cross-references between docs — one hop from the diff only. Cap non-diff file reads at 10 files to stay within token budget.

### Key rules

1. When legal or user-facing content is referenced by URL only (not present in the repo), flag it as "Needs investigation — external content not verifiable from diff" rather than silently skipping. Do not attempt to fetch external URLs.
2. When the diff changes code behavior that a legal document depends on (e.g., data retention logic), flag the legal document for manual review even if the doc itself wasn't changed.

### Out of scope

Auto-generated documentation (Swagger UI, TypeDoc output, JSDoc HTML) where the source of truth is code annotations — flag the annotations, not the generated output. Also out of scope: documentation in external systems (Confluence, Notion, Google Docs) unless referenced by URL in the repo.

### Severity calibration

| Severity | Example |
|----------|---------|
| **CRITICAL** | Terms of service promise contradicted by code (legal exposure); pricing page claims feature that doesn't exist |
| **HIGH** | Runbook procedure will fail (wrong commands/paths); API docs show endpoints that return different schemas; env vars listed in README don't match code |
| **MEDIUM** | README setup steps missing a new dependency; changelog doesn't mention a breaking change; architecture diagram shows removed service |
| **LOW** | Minor version mismatch in docs; formatting inconsistencies; outdated screenshot |

### Per-finding fields

- **Mismatch type**: Page wrong / Code wrong / Unclear — needs human
- **Content source**: Which document/page and which code disagree
- **Suggested direction**: Which side to fix (or "needs human decision")
- **Cross-ref** (optional): Other pass this overlaps with (e.g., Pass 8 for privacy policy vs GDPR)

---

## 2. Pass 10: Accessibility (WCAG 2.2 AA + Easy AAA Wins) — Conditional

### Trigger condition

Runs when the diff contains frontend template/component files: `.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`, `.njk`, `.ejs`, `.hbs`, `.php`, `.erb`. Does not trigger on content-only formats (`.md`, `.mdx`) or SEO-specific files (`robots.txt`, `sitemap.xml`, `llms.txt`, `manifest.json`). Silently skipped otherwise.

### Perspective

Review as an accessibility auditor conducting a WCAG 2.2 AA compliance assessment.

### Scope

Examine only frontend files in the diff. Prefer findings related to lines actually changed. Flag pre-existing issues only at CRITICAL or HIGH severity. Same scope pattern as Pass 6 (SEO).

### Check for

| Category | WCAG Reference | Level | Look For |
|----------|---------------|-------|----------|
| **Text alternatives** | 1.1.1 | A | Missing `alt` on informational images (don't flag `alt=""`), missing text alternatives for icons/SVGs used as buttons, `<canvas>` without fallback |
| **Video/audio** | 1.2.1-1.2.5 | A/AA | Missing captions on video, no audio descriptions, no transcript for audio-only content |
| **Adaptable structure** | 1.3.1-1.3.5 | A/AA | Form inputs without labels (`<label>` or `aria-label`/`aria-labelledby`), using visual-only cues for meaning (color alone), missing landmark regions, tables without headers, incorrect `role` usage |
| **Distinguishable** | 1.4.1-1.4.5, 1.4.10-1.4.13 | A/AA | Color as sole indicator, text contrast below 4.5:1 (normal) or 3:1 (large), non-text contrast below 3:1 on UI components and graphical objects (1.4.11), text in images, no reflow support, content lost at 200% zoom |
| **Keyboard** | 2.1.1-2.1.4 | A/AA | Click handlers without keyboard equivalent, custom components not keyboard-navigable, keyboard traps (focus can't escape), missing `tabindex` management, non-interactive elements with `onClick` but no `role`/`tabIndex` |
| **Timing** | 2.2.1-2.2.2 | A | Auto-advancing content without pause/stop, session timeouts without warning/extension |
| **Seizures** | 2.3.1 | A | Flashing content > 3 times per second |
| **Navigation** | 2.4.1-2.4.11 | A/AA | Missing skip navigation link, unclear page titles, focus order doesn't match visual order, missing focus indicators (`:focus-visible`), heading hierarchy skips, focus obscured by sticky headers/overlays (2.4.11) |
| **Input modalities** | 2.5.1-2.5.8 | A/AA | Gestures without single-pointer alternative, no way to undo accidental activation, visible labels don't match accessible names, drag-and-drop without single-pointer alternative (2.5.7), interactive targets smaller than 24x24 CSS px (2.5.8) |
| **Readable** | 3.1.1-3.1.2 | A/AA | Missing `lang` attribute on `<html>`, language changes not marked with `lang` on containing element |
| **Predictable** | 3.2.1-3.2.6 | A/AA | Focus change triggers unexpected navigation, inconsistent navigation patterns across pages, help mechanisms (contact, chat, FAQ) not in consistent location across pages (3.2.6) |
| **Input assistance** | 3.3.1-3.3.8 | A/AA | Form errors not described in text, missing error suggestions, no confirmation for legal/financial submissions, requiring re-entry of previously provided information in multi-step forms (3.3.7), cognitive function tests in auth (CAPTCHA, puzzles) without accessible alternative (3.3.8) |
| **Compatible** | 4.1.2-4.1.3 | A/AA | Custom components missing ARIA name/role/state, status messages not using `role="status"` or `aria-live` |

### Easy AAA wins (flagged as LOW severity)

| Category | WCAG Reference | Look For |
|----------|---------------|----------|
| **Enhanced contrast** | 1.4.6 (AAA) | Text contrast below 7:1 when a simple CSS change would fix it |
| **Link purpose** | 2.4.9 (AAA) | Generic link text ("click here", "read more") — already caught by Pass 6, cross-ref |
| **Section headings** | 2.4.10 (AAA) | Content sections without headings when adding one is trivial |

### Cross-references

| Check | Cross-ref |
|-------|-----------|
| Missing `alt` on images | Pass 6: SEO (already checks this) |
| Heading hierarchy skips | Pass 6: SEO (already checks this) |
| Generic link text | Pass 6: SEO (already checks this) |
| Missing `lang` attribute | Pass 6: SEO (already checks this) |
| Missing landmark roles | Pass 6: SEO (already checks this, page-level only) |
| Keyboard traps in auth flows | Pass 2: Security (denial of service to keyboard users) |
| Missing labels on consent forms | Pass 8: GDPR (consent management) |

### Key rules

1. Don't flag `alt=""` — empty alt is correct for decorative images.
2. Don't flag ARIA attributes on components using a framework's built-in accessible patterns (e.g., Radix, Headless UI, MUI with proper props).
3. When colors are specified as literal values (hex, rgb, hsl) in the diff, compute the contrast ratio and flag if below threshold. When colors come from CSS variables, theme tokens, or design system abstractions, use "Needs investigation" confidence.
4. When deduping with Pass 6 (SEO), the a11y finding takes precedence since it has the WCAG reference. Retain Pass 6 per-finding fields (`SEO impact`, `Affected signal`) on the merged finding.

### Severity calibration

| Severity | a11y Example |
|----------|-------------|
| **CRITICAL** | Keyboard trap in a modal/dialog; form with no labels on any inputs; interactive elements completely inaccessible to screen readers |
| **HIGH** | Missing skip navigation; button with no accessible name; auto-playing video without pause; focus indicator removed via CSS (`outline: none` without replacement) |
| **MEDIUM** | Contrast ratio slightly below 4.5:1; missing `lang` on language switches; status message without `aria-live`; heading hierarchy skip |
| **LOW** | AAA contrast enhancement opportunity; missing section headings (AAA); decorative element could use `aria-hidden` |

### Per-finding fields

- **WCAG Reference**: Specific criterion (e.g., 2.1.1, 1.4.3)
- **Level**: A / AA / AAA
- **Impact**: Who is affected (screen reader users, keyboard users, low vision, cognitive, etc.)
- **Cross-ref** (optional): Other pass this overlaps with

---

## 3. Pass 11: Internationalization & Localization (i18n/L10n) — Conditional

### Trigger condition

**i18n checks** run when the project has i18n infrastructure: `i18next`, `react-intl`, `vue-i18n`, `next-intl`, `FormatJS`, `.po`/`.pot` files, locale directories (`locales/`, `translations/`, `i18n/`, `messages/`).

**Currency/number/date formatting checks** always run on frontend files in the diff, regardless of i18n infrastructure.

Pass 11 launches as a single subagent whenever either trigger is met. If only frontend files are present (no i18n infrastructure), the subagent runs only the currency/number/date formatting checks and skips the i18n-infrastructure checks.

When currency/number/date checks detect locale-dependent patterns (multiple currency codes, locale-switching UI, `hreflang` attributes) but no i18n infrastructure exists, flag the absence of i18n infrastructure as a HIGH finding.

Silently skipped when no i18n infrastructure and no frontend files in the diff.

### Perspective

Review as a localization engineer ensuring the app works correctly across locales and currencies.

### Check for

| Category | Look For |
|----------|----------|
| **Hardcoded strings** | User-facing text not going through i18n functions (`t()`, `formatMessage()`, `$t()`, etc.), string literals in JSX/templates that should be translated, hardcoded error messages shown to users |
| **Missing translations** | New i18n keys added without corresponding entries in all locale files, translation files with missing keys compared to the default locale |
| **String concatenation** | Building sentences by concatenating translated fragments (breaks in languages with different word order), using string interpolation without named placeholders |
| **Pluralization** | Using simple if/else for plural forms (many languages have more than 2 plural forms — e.g., Arabic has 6), not using ICU MessageFormat or framework equivalent |
| **Currency formatting** | Hardcoded currency symbols (`$`, `€`), manual currency formatting instead of `Intl.NumberFormat`, assuming 2 decimal places (some currencies use 0 or 3), currency displayed without specifying which currency, currency symbol positioning (before/after amount varies by locale), ambiguous currency symbols (`$` used by 20+ currencies), currency-amount spacing (non-breaking space in many European locales) |
| **Number formatting** | Hardcoded decimal separators (`.` vs `,`), hardcoded thousands separators, manual number formatting instead of `Intl.NumberFormat`, non-Western digit grouping (Indian lakh/crore system), percentage formatting (position and spacing of `%`), negative number representation (parentheses vs minus sign) |
| **Date/time formatting** | Hardcoded date formats (`MM/DD/YYYY` — dangerous: `03/04/2026` is March 4 in the US but April 3 in Europe), not using `Intl.DateTimeFormat` or equivalent, timezone-naive date display, assuming 12-hour or 24-hour clock, non-Gregorian calendar systems (Hijri, Buddhist, Japanese Imperial), week start day assumptions (Sunday/Monday/Saturday varies by locale) |
| **Bidirectional (BiDi) text** | Missing `dir` attribute on user-generated or mixed-direction content, missing `<bdi>` for embedded opposite-direction text (usernames, URLs in RTL contexts), use of CSS physical properties (`margin-left`) instead of logical properties (`margin-inline-start`) when RTL locales are supported, UI icons/arrows not mirrored for RTL |
| **Character encoding** | Missing or non-UTF-8 `charset` declaration, database columns using encodings that truncate non-BMP characters (e.g., MySQL `utf8` vs `utf8mb4`), response headers without explicit charset |
| **Unicode-aware string operations** | Using `.length` on strings with emoji or multi-byte characters (counts code units, not graphemes), string truncation that may split surrogate pairs or grapheme clusters, regex without `u` flag on user-facing text, case conversion with `toUpperCase()`/`toLowerCase()` without locale (Turkish dotted/dotless I problem) |
| **Text in assets** | Text baked into images/SVGs/icons that can't be translated, hardcoded placeholder text in components, culturally inappropriate imagery without locale awareness |
| **Layout issues** | Fixed-width containers that will break with longer translations (German ~30% longer, Finnish/Hungarian 50-80% for short strings), no RTL support when locale list includes RTL languages (Arabic, Hebrew), text truncation without `dir` awareness, CJK character width considerations |
| **Locale-dependent logic** | Sorting/collation not locale-aware (`.localeCompare()` without locale parameter), address/phone formats assuming one country's pattern, name fields assuming "first name / last name" structure |
| **Locale fallback & negotiation** | No fallback locale configured for missing translations, incomplete locale identifiers (e.g., `zh` without script subtag `Hans`/`Hant`), missing locale negotiation from browser `Accept-Language` or user preference |
| **ICU/message format** | Invalid ICU message syntax, missing `select`/`selectordinal` for gendered or ordinal text |

### Key rules

1. Only flag hardcoded strings that are **user-facing** — don't flag log messages, error codes, CSS class names, enum values, test fixtures, or internal identifiers.
2. For currency: always flag hardcoded symbols and manual formatting, even in single-language projects.
3. When the project uses a framework with built-in i18n (Next.js, Nuxt, SvelteKit), check that the framework's i18n patterns are followed rather than flagging everything.
4. "Needs investigation" confidence for strings that might be user-facing but could also be internal.

### Out of scope

Backend-only formatting that never reaches end users (log timestamps, internal API serialization formats, database date storage). Also out of scope: translation quality (grammar, tone, cultural adaptation) — this pass checks for structural i18n issues, not translation accuracy.

### Severity calibration

| Severity | i18n Example |
|----------|-------------|
| **CRITICAL** | Currency displayed without specifying which currency (users charged wrong amount); ambiguous date format (`03/04/2026` — March 4 or April 3?) in financial/legal context |
| **HIGH** | Hardcoded currency symbol in payment flow; pluralization using simple if/else in a language with complex plural rules; new feature with all strings hardcoded (no i18n at all); string truncation splitting emoji/surrogate pairs |
| **MEDIUM** | Hardcoded date format in non-critical UI; missing translation keys for new strings; fixed-width container likely to break with longer translations; missing `<bdi>` for user-generated content in RTL |
| **LOW** | Minor formatting inconsistency; sort order not locale-aware in a low-traffic list; placeholder text not translated; missing non-breaking space in currency formatting |

### Per-finding fields

- **i18n category**: Hardcoded string / Currency / Date-time / Pluralization / BiDi / Encoding / Layout / etc.
- **Affected locales**: Which locales would break or display incorrectly (or "all" for currency/number issues)
- **Cross-ref** (optional): Other pass this overlaps with

---

## 4. Deduplication Rules

### Pass 6 (SEO) vs Pass 10 (a11y) overlap

Several checks exist in both passes (missing `alt`, heading hierarchy, generic link text, missing `lang`, missing landmark roles, missing image dimensions causing CLS). When deduping, the Pass 10 (a11y) finding takes precedence for the merged finding's primary framing since it carries the WCAG reference. Retain the Pass 6 per-finding fields (`SEO impact`, `Affected signal`) on the merged finding alongside the Pass 10 fields (`WCAG Reference`, `Level`, `Impact`). Add `Cross-ref: Pass 6` to the merged finding. Use the higher severity of the two.

### Pass 6 (SEO) vs Pass 11 (i18n) overlap

`hreflang` findings may appear in both passes. Pass 11 (i18n) takes precedence as it has broader locale context. Add `Cross-ref: Pass 6`. Include all per-finding fields from both passes.

### Pass 10 (a11y) vs Pass 11 (i18n) overlap

Missing `lang` attribute on language switches may appear in both passes. Pass 10 (a11y) takes precedence since it carries the WCAG reference (3.1.2). Add `Cross-ref: Pass 11`. Include all per-finding fields from both passes.

### Pass 9 (Docs) vs Pass 8 (GDPR) overlap

Privacy policy mismatches may generate findings in both passes. Pass 8 covers GDPR compliance of the code; Pass 9 covers whether the privacy policy matches the code. When merging:

- **Pass 8 takes precedence** for severity and primary pass designation, since GDPR violations carry regulatory risk.
- For privacy policies, terms of service, and DPAs: the legal document is the source of truth. Do NOT use "Unclear direction" — if code contradicts a published legal commitment, flag as "Code wrong, page right" unless the legal document itself is clearly outdated.
- Merged finding includes all per-finding fields from both passes (GDPR Article, Regulatory risk, Based on from Pass 8; Mismatch type, Content source, Suggested direction from Pass 9). Use higher severity.

### General rule

Follow the existing dedup pattern: merge into one finding, tag all applicable passes, include all per-finding fields from every contributing pass, use higher severity.

---

## 5. Structural Changes to SKILL.md

### Updates needed

- Overview: "up to eight expert perspectives" → "up to eleven expert perspectives"
- Overview list: add Documentation & Content, Accessibility, i18n & Localization entries
- Flow diagram: add three new conditional branches. Pass 10 (a11y) shares the existing "Frontend files?" node with Pass 6:
  ```dot
  "Frontend files?" -> "Pass 6: SEO" [label="yes"];
  "Frontend files?" -> "Pass 10: a11y" [label="yes"];
  "Pass 10: a11y" -> "Merge & Deduplicate";
  "Gather Context" -> "Docs triggers?" [style=dashed];
  "Docs triggers?" -> "Pass 9: Docs" [label="yes"];
  "Docs triggers?" -> "Skip" [label="no"];
  "Pass 9: Docs" -> "Merge & Deduplicate";
  "Gather Context" -> "i18n triggers?" [style=dashed];
  "i18n triggers?" -> "Pass 11: i18n" [label="yes"];
  "i18n triggers?" -> "Skip" [label="no"];
  "Pass 11: i18n" -> "Merge & Deduplicate";
  ```
- Finding format Pass field becomes: `Quality | Security | Performance | Tests | Design | SEO & AI Discoverability | SOC 2 Compliance | GDPR Compliance | Documentation & Content | Accessibility | i18n & Localization`
- Execution section: "up to eight" → "up to eleven"
- Execution section: extend small-diff threshold — "If the codebase is small (< 200 lines changed), run Passes 1-6 and 9-11 yourself without subagents. Exception: when Pass 7 or Pass 8 is triggered, always use subagents for those passes and their fetch agents, regardless of diff size."
- Execution section: add note — "For diffs that trigger 8+ passes, each subagent receives only its own checklist and the relevant subset of the diff. Pass 9 receives documentation files and their referenced code files. Pass 10 and Pass 11 receive only frontend files from the diff."
- Compliance disclaimer (Section 7): trigger condition becomes "when Pass 7, Pass 8, or Pass 10 produced findings" — WCAG compliance carries legal implications in many jurisdictions.
- Common Mistakes table: add entries for new passes

### New Common Mistakes entries

| Mistake | Fix |
|---------|-----|
| Assuming code is always the source of truth for docs mismatches | Sometimes the docs describe intended behavior and the code hasn't caught up. Flag the mismatch, suggest a direction, let the human decide. Exception: legal docs (ToS, privacy policy) are presumed authoritative. |
| Auditing entire docs tree when only one file changed | Scope to docs related to the diff — one hop only. Cap non-diff file reads at 10 files. |
| Flagging `alt=""` as an accessibility issue | Empty alt is correct for decorative images (WCAG 1.1.1). Only flag missing `alt` attribute. |
| Flagging ARIA on components using accessible framework patterns | Radix, Headless UI, MUI etc. have built-in accessibility. Don't add redundant ARIA. |
| Reporting contrast issues with unresolvable CSS variables | Use "Needs investigation" confidence when colors come from theme tokens. Compute ratios only for literal color values. |
| Flagging log messages as hardcoded strings | Only flag user-facing text. Log messages, error codes, CSS classes, enum values, and test fixtures are not i18n targets. |
| Flagging currency formatting only when i18n exists | Currency/number/date formatting issues apply to ALL projects, even single-language ones. |
| Flagging internal identifiers as untranslated strings | "Needs investigation" confidence for ambiguous strings. Only flag clearly user-facing text with "Certain" confidence. |
| Silently skipping when legal content is external | When ToS/privacy policy is referenced by URL only, flag as "Needs investigation — external content not verifiable from diff." |
