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
| **Unclear direction** | Feature listed on landing page, code exists but is behind a flag | Log in `decisions.md`, flag for human, do NOT block |

### Check for

| Category | Look For |
|----------|----------|
| **Feature claims vs code** | Landing page/marketing claims that don't match implemented functionality, features listed that don't exist or are disabled, capability descriptions that overstate what the code does |
| **Pricing/limits vs enforcement** | Pricing page limits not enforced in code, free tier claims without corresponding checks, quota descriptions that don't match config values |
| **Legal content vs implementation** | Terms of service promises not backed by code (data deletion timelines, data handling claims), privacy policy statements contradicted by actual data flows |
| **API docs vs implementation** | Endpoints documented but not implemented (or vice versa), request/response schemas that don't match actual types, documented error codes not returned by the code |
| **Runbook accuracy** | Runbook procedures referencing renamed/removed scripts, incorrect CLI commands, outdated configuration paths, missing steps for new dependencies |
| **Staleness signals** | Docs referencing removed features, deprecated APIs still documented as current, version numbers that don't match, screenshots/examples using old UI |
| **Internal consistency** | README contradicting CONTRIBUTING.md, getting-started guide inconsistent with actual setup steps, conflicting instructions across docs |

### Scope

Focus on documentation affected by or related to the diff. Don't audit the entire docs tree — check docs that reference code being changed, and code that is referenced by docs in the diff. Flag pre-existing staleness only at CRITICAL or HIGH severity.

### Severity calibration

| Severity | Example |
|----------|---------|
| **CRITICAL** | Terms of service promise contradicted by code (legal exposure); pricing page claims feature that doesn't exist |
| **HIGH** | Runbook procedure will fail (wrong commands/paths); API docs show endpoints that return different schemas |
| **MEDIUM** | README setup steps missing a new dependency; changelog doesn't mention a breaking change |
| **LOW** | Minor version mismatch in docs; formatting inconsistencies; outdated screenshot |

### Per-finding fields

- **Mismatch type**: Page wrong / Code wrong / Unclear — needs human
- **Content source**: Which document/page and which code disagree
- **Suggested direction**: Which side to fix (or "needs human decision")
- **Cross-ref** (optional): Other pass this overlaps with (e.g., Pass 8 for privacy policy vs GDPR)

---

## 2. Pass 10: Accessibility (WCAG 2.2 AA + Easy AAA Wins) — Conditional

### Trigger condition

Runs when the diff contains frontend files (`.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`, `.njk`, `.ejs`, `.hbs`, `.php`, `.erb`). Same file extensions as Pass 6 (SEO) minus content-only formats (`.md`, `.mdx`). Silently skipped otherwise.

### Perspective

Review as an accessibility auditor conducting a WCAG 2.2 AA compliance assessment.

### Scope

Examine only frontend files in the diff. Prefer findings related to lines actually changed. Flag pre-existing issues only at CRITICAL or HIGH severity. Same scope pattern as Pass 6 (SEO).

### Check for

| Category | WCAG Reference | Level | Look For |
|----------|---------------|-------|----------|
| **Text alternatives** | 1.1.1 | A | Missing `alt` on informational images (don't flag `alt=""`), missing text alternatives for icons/SVGs used as buttons, `<canvas>` without fallback |
| **Video/audio** | 1.2.1-1.2.5 | A/AA | Missing captions on video, no audio descriptions, no transcript for audio-only content |
| **Adaptable structure** | 1.3.1-1.3.6 | A/AA | Form inputs without labels (`<label>` or `aria-label`/`aria-labelledby`), using visual-only cues for meaning (color alone), missing landmark regions, tables without headers, incorrect `role` usage |
| **Distinguishable** | 1.4.1-1.4.13 | A/AA | Color as sole indicator, text contrast below 4.5:1 (normal) or 3:1 (large), text in images, no reflow support, content lost at 200% zoom |
| **Keyboard** | 2.1.1-2.1.4 | A/AA | Click handlers without keyboard equivalent, custom components not keyboard-navigable, keyboard traps (focus can't escape), missing `tabindex` management, non-interactive elements with `onClick` but no `role`/`tabIndex` |
| **Timing** | 2.2.1-2.2.2 | A | Auto-advancing content without pause/stop, session timeouts without warning/extension |
| **Seizures** | 2.3.1 | A | Flashing content > 3 times per second |
| **Navigation** | 2.4.1-2.4.11 | A/AA | Missing skip navigation link, unclear page titles, focus order doesn't match visual order, missing focus indicators (`:focus-visible`), heading hierarchy skips |
| **Input modalities** | 2.5.1-2.5.8 | A/AA | Gestures without single-pointer alternative, no way to undo accidental activation, visible labels don't match accessible names |
| **Readable** | 3.1.1-3.1.2 | A/AA | Missing `lang` attribute on `<html>`, language changes not marked with `lang` on containing element |
| **Predictable** | 3.2.1-3.2.6 | A/AA | Focus change triggers unexpected navigation, inconsistent navigation patterns across pages |
| **Input assistance** | 3.3.1-3.3.8 | A/AA | Form errors not described in text, missing error suggestions, no confirmation for legal/financial submissions |
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
| Keyboard traps in auth flows | Pass 2: Security (denial of service to keyboard users) |
| Missing labels on consent forms | Pass 8: GDPR (consent management) |

### Key rules

1. Don't flag `alt=""` — empty alt is correct for decorative images.
2. Don't flag ARIA attributes on components using a framework's built-in accessible patterns (e.g., Radix, Headless UI, MUI with proper props).
3. Contrast checks use "Needs investigation" confidence when colors come from CSS variables or theme tokens that can't be resolved from the diff.
4. When deduping with Pass 6 (SEO), the a11y finding takes precedence since it has the WCAG reference.

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
| **Currency formatting** | Hardcoded currency symbols (`$`, `€`), manual currency formatting instead of `Intl.NumberFormat`, assuming 2 decimal places (some currencies use 0 or 3), currency displayed without specifying which currency |
| **Number formatting** | Hardcoded decimal separators (`.` vs `,`), hardcoded thousands separators, manual number formatting instead of `Intl.NumberFormat` |
| **Date/time formatting** | Hardcoded date formats (`MM/DD/YYYY`), not using `Intl.DateTimeFormat` or equivalent, timezone-naive date display, assuming 12-hour or 24-hour clock |
| **Text in assets** | Text baked into images/SVGs/icons that can't be translated, hardcoded placeholder text in components |
| **Layout issues** | Fixed-width containers that will break with longer translations (German is ~30% longer than English), no RTL support when locale list includes RTL languages (Arabic, Hebrew), text truncation without `dir` awareness |
| **Locale-dependent logic** | Sorting/collation not locale-aware, address/phone formats assuming one country's pattern, name fields assuming "first name / last name" structure |
| **ICU/message format** | Invalid ICU message syntax, missing `select`/`selectordinal` for gendered or ordinal text |

### Key rules

1. Only flag hardcoded strings that are **user-facing** — don't flag log messages, error codes, CSS class names, enum values, test fixtures, or internal identifiers.
2. For currency: always flag hardcoded symbols and manual formatting, even in single-language projects.
3. When the project uses a framework with built-in i18n (Next.js, Nuxt, SvelteKit), check that the framework's i18n patterns are followed rather than flagging everything.
4. "Needs investigation" confidence for strings that might be user-facing but could also be internal.

### Severity calibration

| Severity | i18n Example |
|----------|-------------|
| **CRITICAL** | Currency displayed without specifying which currency (users charged wrong amount); date format causes incorrect date interpretation across locales |
| **HIGH** | Hardcoded currency symbol in payment flow; pluralization using simple if/else in a language with complex plural rules; new feature with all strings hardcoded (no i18n at all) |
| **MEDIUM** | Hardcoded date format in non-critical UI; missing translation keys for new strings; fixed-width container likely to break with longer translations |
| **LOW** | Minor formatting inconsistency; sort order not locale-aware in a low-traffic list; placeholder text not translated |

### Per-finding fields

- **i18n category**: Hardcoded string / Currency / Date-time / Pluralization / Layout / etc.
- **Affected locales**: Which locales would break or display incorrectly (or "all" for currency/number issues)
- **Cross-ref** (optional): Other pass this overlaps with

---

## 4. Deduplication Rules

### Pass 6 (SEO) vs Pass 10 (a11y) overlap

Several checks exist in both passes (missing `alt`, heading hierarchy, generic link text, missing `lang`). When deduping, the Pass 10 (a11y) finding takes precedence since it carries the WCAG reference. Add `Cross-ref: Pass 6` to the merged finding.

### Pass 9 (Docs) vs Pass 8 (GDPR) overlap

Privacy policy mismatches may generate findings in both passes. Pass 8 covers GDPR compliance of the code; Pass 9 covers whether the privacy policy matches the code. Merge into one finding with both GDPR Article and Mismatch type fields.

### General rule

Follow the existing dedup pattern: merge into one finding, tag all applicable passes, include all per-finding fields from every contributing pass, use higher severity.

---

## 5. Structural Changes to SKILL.md

### Updates needed

- Overview: "up to eight expert perspectives" → "up to eleven expert perspectives"
- Overview list: add Documentation & Content, Accessibility, i18n & Localization entries
- Flow diagram: add three new conditional branches
  ```dot
  "Gather Context" -> "Docs triggers?" [style=dashed];
  "Docs triggers?" -> "Pass 9: Docs" [label="yes"];
  "Docs triggers?" -> "Skip" [label="no"];
  "Pass 9: Docs" -> "Merge & Deduplicate";
  "Gather Context" -> "Frontend files?" [style=dashed];
  "Frontend files?" -> "Pass 10: a11y" [label="yes"];
  "Pass 10: a11y" -> "Merge & Deduplicate";
  "Gather Context" -> "i18n triggers?" [style=dashed];
  "i18n triggers?" -> "Pass 11: i18n" [label="yes"];
  "i18n triggers?" -> "Skip" [label="no"];
  "Pass 11: i18n" -> "Merge & Deduplicate";
  ```
- The existing "Frontend files?" node already feeds Pass 6. Pass 10 (a11y) shares the same trigger — it is launched alongside Pass 6 when frontend files are present. The diagram should show both Pass 6 and Pass 10 branching from the same "Frontend files?" decision.
- Finding format: update Pass field to include new passes
- Execution section: "up to eight" → "up to eleven"
- Execution section: note that Passes 9-11 have no fetch agents and follow the standard subagent rules (no special exception like Passes 7-8)
- Common Mistakes table: add entries for new passes

### New Common Mistakes entries

| Mistake | Fix |
|---------|-----|
| Assuming code is always the source of truth for docs mismatches | Sometimes the docs describe intended behavior and the code hasn't caught up. Flag the mismatch, suggest a direction, let the human decide. |
| Auditing entire docs tree when only one file changed | Scope to docs related to the diff. Check docs referencing changed code, and code referenced by changed docs. |
| Flagging `alt=""` as an accessibility issue | Empty alt is correct for decorative images (WCAG 1.1.1). Only flag missing `alt` attribute. |
| Flagging ARIA on components using accessible framework patterns | Radix, Headless UI, MUI etc. have built-in accessibility. Don't add redundant ARIA. |
| Reporting contrast issues with unresolvable CSS variables | Use "Needs investigation" confidence when colors come from theme tokens. |
| Flagging log messages as hardcoded strings | Only flag user-facing text. Log messages, error codes, CSS classes, enum values, and test fixtures are not i18n targets. |
| Flagging currency formatting only when i18n exists | Currency/number/date formatting issues apply to ALL projects, even single-language ones. |
| Flagging internal identifiers as untranslated strings | "Needs investigation" confidence for ambiguous strings. Only flag clearly user-facing text with "Certain" confidence. |
