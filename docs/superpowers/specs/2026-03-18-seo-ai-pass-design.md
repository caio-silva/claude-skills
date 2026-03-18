# Design: Pass 6 — SEO & AI Discoverability

## Summary

Add a conditional 6th pass to the `deep-code-review` skill. Reviews frontend code for SEO and AI discoverability issues. Skipped silently when no frontend files are in the diff.

## Design

### Persona

Review as **The Search Strategist** — optimizes for both traditional crawlers and AI systems (ChatGPT, Perplexity, Google AI Overviews).

### Conditional Trigger

The gate check happens **before** launching the subagent. If no matching files are found, the subagent is never created.

**Trigger files by extension:** `.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`, `.njk`, `.ejs`, `.hbs`, `.php`, `.erb`, `.mdx`, `.md`

**Trigger files by name:** `robots.txt`, `robots.ts`, `robots.js`, `sitemap.xml`, `sitemap.ts`, `sitemap.js`, `llms.txt`, `manifest.json`

**Scope:** The subagent examines only the matching frontend files from the diff, reading surrounding layout/route files for context as needed. Prefer findings related to lines actually changed. Flag pre-existing issues only at CRITICAL or HIGH severity.

**Exclusions:** Skip files clearly identifiable as email templates (e.g., in `email/` or `mailer/` directories). Files in route directories are never excluded.

### Page-Level vs. Leaf Component Classification

**Page-level** if any of:
- Lives in a route directory (`pages/`, `app/`, `routes/`, `src/routes/`, `src/pages/`)
- Named `page.*`, `layout.*`, `_document.*`, `_app.*`, or `index.*` in a route directory
- Renders `<html>`, `<head>`, or `<body>` tags
- Exports `metadata`, `generateMetadata`, `meta`, or calls `useHead`/`useSeoMeta`

**Leaf-level** — everything else. Only check: `alt` on images, link text quality, heading hierarchy within the component. When ambiguous, default to leaf-level.

### Check Categories

**Priority checks** (always evaluate):

| Category | Checks |
|----------|--------|
| **Metadata** | Missing/duplicate `<title>`, `<meta description>`, canonical URLs, `<meta robots>`, viewport, charset, lang, OG tags, Twitter cards. Check the framework's idiomatic API before flagging raw `<head>` elements |
| **Structured data** | Missing/invalid schema.org (JSON-LD preferred), incorrect types (including typos), missing required properties, `datePublished`/`dateModified`, `Person` schema when applicable. When populated from CMS/external sources, flag template issues (e.g., missing null fallbacks) but not missing fields that may come from runtime data |
| **Semantic HTML & links** | Heading hierarchy skips, missing landmark roles (page-level only). Generic link text (`click here`, `read more`, empty `<a>`), `href="#"` / `javascript:void(0)` |
| **Crawlability** | JS-only content without SSR/SSG, client-side-only routing (hash-based `/#/page`), `<noscript>` fallbacks (only when SSR/SSG absent), conflicting signals (canonical vs. `noindex`), `robots.txt` rules blocking AI crawlers |

**Secondary checks** (evaluate if context permits):

| Category | Checks |
|----------|--------|
| **AI discoverability** | Missing `llms.txt`/`llms-full.txt`, missing RSS/Atom feeds (content-heavy/docs sites only) |
| **Accessibility & performance** | Missing `alt` attribute (do not flag `alt=""`), images/iframes without `width`/`height` (CLS), iframes missing `title`, hero images with `loading="lazy"` (anti-pattern — identify by component name containing "hero"/"banner"/"cover" or first image in a page-level component), render-blocking external `<link>`/`<script>` without `async`/`defer` (do not flag inline `<style>`/`<script>`) |
| **Internationalization** | Missing `hreflang` (only when i18n evidence exists) |

### Security Cross-References

When a finding has security implications, add a `Cross-ref: Pass 2` field. The orchestrator uses this for dedup.

| Check | Security Risk |
|-------|--------------|
| Canonical URL pointing to external domain | Canonical hijacking |
| `og:image` from user input | SSRF, stored XSS via SVG |
| JSON-LD fields from unsanitized input | Script injection via `</script>` breakout (CWE-79) |
| Structured data exposing internal IDs/PII | Information disclosure |
| `robots.txt` `Disallow` revealing sensitive paths | Path enumeration |
| `llms.txt` referencing internal endpoints | Architecture disclosure |

Note: These checks assess what is visible in the frontend template code. When data flow from backend sources cannot be determined from the diff, use "Needs investigation" confidence.

### Key Rules

1. **Check the layout/route chain** before flagging missing meta tags. Metadata may be inherited from parent layouts (Next.js App Router `generateMetadata`, Remix v2+ `meta`, Nuxt `useHead` in layouts).
2. **Use "Needs investigation" confidence** when a check cannot be fully verified from the diff:
   - SSR/SSG status without framework signals
   - Structured data vs. Google's rich result requirements
   - Broken links, orphan pages
   - `llms.txt` / RSS feed relevance
   - Image dimensions in Tailwind/CSS-in-JS projects
   - Ambiguous locale paths
   - Content extractability
   - Hero/LCP image identification — except when the heuristic matches (component name contains "hero"/"banner"/"cover", or first image in a page-level component), in which case use higher confidence
3. **Err on fewer, higher-confidence findings.** Zero findings is acceptable for well-maintained codebases.

### Pass-Specific Finding Fields

Each finding includes:
- **SEO impact**: How this affects search ranking or AI discoverability (1-2 sentences)
- **Affected signal**: Human-readable context — e.g., "Core Web Vitals: CLS", "Google Search: structured data"
- **Cross-ref** (optional): Which other pass this finding overlaps with

### Severity Mapping

| Severity | SEO Example |
|----------|-------------|
| **CRITICAL** | `noindex` on a page meant to be indexed; JSON-LD script injection |
| **HIGH** | Missing `<title>` (after checking inheritance); all images missing `alt`; JS-only content with no SSR; hash-based routing; AI crawlers blocked in `robots.txt` unintentionally |
| **MEDIUM** | Missing OG tags; heading hierarchy skips; missing canonical; CLS from missing dimensions; generic link text |
| **LOW** | Missing `llms.txt`; minor structured data gaps; missing iframe `title`; `href="#"` with onClick handler |

### Out of Scope

- Framework config files (`next.config.js`, `nuxt.config.ts`, `vercel.json`)
- Micro-frontend fragments (shell owns `<head>`, not fragments)
- CSS-only concerns (except inline `@font-face` in markup files)
- Runtime behavior, HTTP headers, CDN/caching, redirect rules, mobile UX beyond viewport

## Integration

### Files to Modify

1. `skills/deep-code-review/SKILL.md`
2. `README.md`

### Changes to SKILL.md

1. **Section heading and intro:** rename "The Five-Pass Review" to "The Review Passes" and update the "Run all passes in parallel using subagents" sentence to reflect the conditional 6th pass
2. **Overview:** update to "up to six expert perspectives" with note that Pass 6 is conditional on frontend files
3. **Flow diagram:** add Pass 6 with conditional gate node
4. **Pass 6 section:** add after Pass 5, following the same structure (persona, check table, pass-specific fields)
5. **Finding format:** add `SEO & AI Discoverability` as valid Pass tag. Add optional `Cross-ref` field. Include the Security Cross-References table in the Pass 6 section so the subagent knows when to apply cross-refs
6. **Execution section:** update "Launch five parallel subagents" to "Launch up to six parallel subagents" — the 6th is only launched when frontend files are in the diff. In inline mode (< 200 lines), apply the same conditional: skip SEO checks if no frontend files. For large diffs with > 10 frontend files, focus on page-level files first
7. **Dedup instruction:** add tiebreaker rule — when passes disagree on severity for the same finding, use the higher severity
8. **Common Mistakes table:** add:

| Mistake | Fix |
|---------|-----|
| Flagging missing meta tags in leaf components | Only flag at page/layout-level. Check framework inheritance first. |
| Flagging `alt=""` as missing alt text | Empty alt is correct for decorative images. Only flag missing `alt` attribute. |
| Flagging email templates for SEO issues | Exclude email template directories (unless also a route directory). |
| Lazy-loading the LCP/hero image | `loading="lazy"` on above-fold images delays LCP. Use `fetchpriority="high"` instead. |
| Laundry-listing pre-existing SEO issues | Focus on changes in the diff. Only flag pre-existing issues at CRITICAL/HIGH. |

### Changes to README.md

1. **Passes table:** add row for SEO & AI Discoverability with "(conditional — frontend files only)" note
2. **Opening paragraph:** update "five-pass" to reflect the conditional 6th pass
3. **Fix stale references:** "full three-pass review" → update to current pass count; "strip the other two" → "strip the other passes"
