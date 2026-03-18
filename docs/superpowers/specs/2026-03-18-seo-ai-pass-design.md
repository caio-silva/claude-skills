# Design: Pass 6 — SEO & AI Discoverability

## Summary

Add a conditional 6th pass to the `deep-code-review` skill that reviews frontend code for search engine optimization and AI discoverability issues. The pass only runs when the diff contains frontend files; it is silently skipped for backend-only changes.

## Motivation

Traditional SEO and AI discoverability are converging. Google AI Overviews, ChatGPT search, and Perplexity all pull from web pages. Sites that rank well do the same things: clean semantic HTML, structured data, good meta tags, and machine-readable content. The deep-code-review skill currently has no coverage for this surface area.

## Approach

**Approach B (selected):** Add Pass 6 as a conditional parallel pass within the existing skill. It launches alongside the other 5 passes but includes a gate that skips execution when no frontend files are detected in the diff.

**Alternatives considered:**
- **A: Always run** — rejected because it produces noise on backend-only reviews.
- **C: Separate skill** — rejected because it fragments the review experience; users would need to remember to invoke a second command.

## Design

### Persona

**The Search Strategist** — optimizes for both traditional crawlers (Googlebot, Bingbot) and AI systems (ChatGPT, Perplexity, Google AI Overviews). Assumes every page needs to compete for visibility in both search results and AI-generated answers.

### Conditional Trigger

Pass 6 only runs when the diff contains files matching any of:

**By extension:** `.html`, `.htm`, `.jsx`, `.tsx`, `.vue`, `.svelte`, `.astro`, `.njk`, `.ejs`, `.hbs`, `.php`, `.erb`

**By filename:** `robots.txt`, `sitemap.xml`, `llms.txt`, `manifest.json`

The gate check happens **before** launching the subagent — if no matching files are found, the subagent is never launched. False activations on non-page component files (e.g., `Button.tsx`) are acceptable; the subagent will simply produce no findings for those files since they lack SEO-relevant markup.

If no matching files are present, the pass is skipped silently — no output, no "skipped" message.

### Check Categories

| Category | Look For |
|----------|----------|
| **Meta & head tags** | Missing/duplicate `<title>`, `<meta description>`, canonical URLs, `<meta robots>`, viewport, charset, lang attribute |
| **Open Graph & social** | Missing `og:title`, `og:description`, `og:image`, Twitter card tags, incomplete social preview data |
| **Structured data** | Missing or invalid schema.org (JSON-LD preferred), incorrect types, missing required properties |
| **Semantic HTML** | `<div>` soup instead of `<main>`, `<article>`, `<nav>`, `<header>`, `<section>`; heading hierarchy skips (h1 to h3); missing landmark roles |
| **Crawlability** | JavaScript-only content without SSR/SSG (use "Needs investigation" confidence if SSR/SSG status cannot be determined from the diff), missing `<noscript>` fallbacks, broken internal links, orphan pages, improper `robots.txt` or sitemap references |
| **AI discoverability** | Missing [`llms.txt`](https://llmstxt.org/) (a proposed standard providing an LLM-friendly markdown overview of a site), content not extractable without JS, no clear machine-readable structure, missing RSS/Atom feeds, poor content-to-markup ratio |
| **Performance signals** | Missing lazy loading on images, no `alt` text, render-blocking resources in markup (CSS/JS referenced in `<head>` without `async`/`defer`/media queries), large unoptimized assets referenced in HTML (Core Web Vitals impact) |
| **Internationalization** | Missing `hreflang` tags for multi-language content, missing `lang` attribute, locale-specific URL structure issues |

### Pass-Specific Finding Fields

Each finding includes:
- **SEO impact**: How this affects search ranking or AI discoverability (1-2 sentences)

### Severity Mapping for SEO Findings

SEO findings use the same severity levels as all other passes, mapped as follows:

| Severity | SEO Example |
|----------|-------------|
| **CRITICAL** | `<meta robots content="noindex">` on a page meant to be indexed; broken structured data that triggers Search Console errors |
| **HIGH** | Missing `<title>` on key pages; all images missing `alt` text; JavaScript-only content with no SSR |
| **MEDIUM** | Missing Open Graph tags; heading hierarchy skips; missing canonical URL |
| **LOW** | Missing `llms.txt`; minor structured data improvements; social preview optimization |

SEO findings feed into the verdict the same way as all other passes — a HIGH SEO finding triggers "NEEDS CHANGES" just like a HIGH finding from any other pass.

### Integration Points

1. **Flow diagram** — update from five-pass to six-pass; Pass 6 has a conditional gate
2. **Overview and references** — update to say "up to six passes" where the 6th is conditional on frontend files being in the diff
3. **README table** — new row for SEO & AI Discoverability pass with note that it's conditional
4. **Execution section** — note conditional trigger logic; when it runs, it launches as a 6th parallel subagent
5. **Finding format** — add `SEO & AI Discoverability` as a valid Pass tag

### What Does NOT Change

- Severity levels (CRITICAL / HIGH / MEDIUM / LOW)
- Confidence levels (Certain / High / Needs investigation)
- Verdict logic (BLOCK / NEEDS CHANGES / APPROVE WITH NOTES / APPROVE)
- Output structure (verdict, summary, findings by severity, what's good)
- Merge & deduplicate pipeline — Pass 6 findings feed into the same pipeline

## Files to Modify

1. `skills/deep-code-review/SKILL.md` — add Pass 6 section, update overview, flow diagram, execution notes, finding format
2. `README.md` — add row to the passes table, update references to note the conditional 6th pass
