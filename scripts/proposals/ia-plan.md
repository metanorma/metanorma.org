# Information Architecture Plan — metanorma.org

**Status:** Draft for review
**Date:** 2026-06-25
**Author:** Pair-authored during VitePress migration

## 1. Where we are now

### 1.1 Pipeline state

- **Source-of-truth content**: `_pages/`, `_posts/`, `author/`, `develop/`,
  `learn/`, `reference_docs/`, `_software/`, `_specs/`, `_samples/` (all
  `.adoc`).
- **Conversion**: `scripts/convert-adoc.rb` (coradoc) writes
  `pages/**/*.md`.
- **Site**: VitePress builds `.vitepress/dist/` from `pages/`.
- **Upstream sync**: new `rake sync` task (see `Rakefile`) pulls
  per-flavor library docs and model diagrams from GitHub based on
  frontmatter declarations.

### 1.2 Content inventory

| Bucket | Files | Notes |
|--------|------:|-------|
| `author/**/*.adoc` | 236 | 64 cross-flavor topics; 19 per-flavor topics; rest are per-flavor ref/basics |
| `_software/*.adoc` | 27 | Per-gem pages; some have `docs.git_repo_subtree` for upstream sync |
| `_specs/*.adoc` | 12 | Per-model pages; metadata + image references, no diagram embedding |
| `_samples/*.adoc` | 2 | Stub pages that point back to upstream GitHub |
| `_posts/*.adoc` | ~70 | Blog posts |
| `develop/**/*.adoc` | ~12 | Developer docs |
| `learn/**/*.adoc` | ~25 | Tutorials/lessons |

### 1.3 Top-level nav (current, from `.vitepress/config.ts`)

Get Started · Author · Flavors · Develop · Reference · Software · Blog · About

### 1.4 Pain points

1. **Per-flavor content is fragmented across four trees.** For "ISO" a
   user must visit `_software/metanorma-iso.adoc` (library),
   `author/iso/**` (flavor-specific authoring),
   `_specs/metanorma-model-iso.adoc` (model), and
   `_samples/*` (samples). No single page ties them together.

2. **Model spec pages render only metadata.** `_specs/metanorma-model-iso.adoc`
   mentions "ISO Standard Document", "ISO Blocks", "ISO Bibliographic
   Item" in its `navigation.items`, but the rendered page doesn't embed
   the actual PNG diagrams. The images exist locally now (synced);
   nothing surfaces them.

3. **Sample pages are stubs.** `_samples/vcard-format-specification.adoc`
   is 13 lines: metadata + "see the linked GitHub repository". Same for
   `draft-camelot-holy-grenade.adoc`. The "publish online" goal is not
   met.

4. **Per-flavor `topics/` duplicates cross-flavor `topics/`.** Files
   like `author/iso/topics/markup.adoc` overlap with
   `author/topics/document-format.adoc`. Hard to keep in sync; reader
   doesn't know which is authoritative.

5. **Library docs are stale when pulled manually.** `_software/metanorma-iso/docs/`
   was last synced by hand at an unknown date. No version pinning, no
   "last synced" marker.

6. **Library docs are not consistently located upstream.** Smoke test of
   `rake sync:libs` against the 5 flavors with `docs.git_repo_subtree: docs`
   found that **only `metanorma-cli` actually has a `docs/` directory**
   at the repo root. The other 4 (`metanorma-cc`, `metanorma-ieee`,
   `metanorma-ietf`, `metanorma-iso`) keep their library docs in the
   `README.adoc` and/or under `spec/examples/`. Frontmatter declarations
   need to be updated per-flavor to reflect reality before
   `rake sync:libs` is useful. Model repos, by contrast, all consistently
   have an `images/` directory — `rake sync:models` works out of the box
   (11/11 succeeded on first run; one transient network hang on a retry).

7. **Audit found 75 broken internal links**, now down to 4 — but the 4
   remaining are coradoc bugs (`image::` and `<<...>>` parsed inside
   verbatim contexts; see `BUG-xref-inside-monospace.md` and
   `BUG-image-macro-in-source-block.md` in the coradoc repo).

## 2. Target IA

### 2.1 Principles

1. **Audience-first navigation.** Top-level nav reflects *who is
   reading*: a new user (Get Started), an author (Author), a developer
   (Develop), a researcher (Reference). "Software", "Flavors", "Specs"
   are reference material, not primary journeys.
2. **One entry point per flavor.** A single hub page per flavor links
   to all four sources (library, authoring, samples, model).
3. **Pull, don't link.** Per user directive: "we are to pull their
   content and publish it online". The site hosts the rendered content;
   upstream GitHub is the source of truth and is cited, but readers
   should not need to leave metanorma.org to read docs.
4. **MECE per concern.** Cross-flavor content lives once (in
   `author/topics/`); flavor-specific exceptions live once (in
   `author/{flavor}/`). No duplication.
5. **Preserve URLs.** Old paths get `redirect_from:` frontmatter;
   nothing moves without a redirect.

### 2.2 Top-level nav (proposed)

```
Get Started
Learn        (tutorials)
Author       (basics, topics, editors-guide)
Flavors      (per-flavor hubs: integrates library + authoring + samples + model)
Develop      (developer docs)
Reference    (attributes, models, schemas)
Blog
About
```

This is *structurally identical* to today's nav. The change is in the
**content under each section** — primarily the new per-flavor hub and
the actually-rendered model + samples content.

### 2.3 Per-flavor hub page

URL: `/flavors/{flavor}/` (new canonical home for the flavor).
Redirects: `redirect_from: /author/{flavor}/` and
`/software/metanorma-{flavor}/`.

Content sections:

1. **Overview** — what the flavor is, who uses it, processor name,
   gem link, repo link. (Sourced from current `_software/{flavor}.adoc`
   frontmatter body.)
2. **Install** — flavor-specific install notes (e.g.
   `gem install metanorma-iso`). Cross-links to `/install/`.
3. **Authoring** — links to cross-flavor basics, then a list of
   flavor-specific topics with one-line descriptions. (Sourced from
   `author/{flavor}/topics/*.adoc`.)
4. **Reference** — flavor-specific document attributes, output formats,
   sample configurations. (Sourced from `author/{flavor}/ref/*.adoc`.)
5. **Library docs** — rendered content pulled from
   `metanorma-{flavor}/docs/` by the rake task, displayed inline.
6. **Sample documents** — list with thumbnails, each link going to a
   real rendered sample page (not a stub).
7. **Document model** — embedded PNG diagrams from
   `_specs/metanorma-model-{flavor}/images/`, with a short description
   per diagram.
8. **Changelog / version pinning** — link to upstream releases, plus a
   "last synced" timestamp.

Implementation: a Vue component `<FlavorHub :flavor="iso" />` reads
from `.vitepress/data/flavors.ts` and renders the section list. Hub
pages themselves are auto-generated from a frontmatter declaration
on `_software/{flavor}.adoc`.

### 2.4 Model spec page changes

`_specs/{model}.adoc` becomes a real page:

- Frontmatter already declares `navigation.items` with diagram titles
  and paths.
- The converted `pages/specs/{model}.md` should embed each diagram with
  a heading per diagram and a short description.
- Source: parse the `navigation.items[].title` + `path` from frontmatter
  in the conversion script, emit `## {title}\n\n![{title}]({path}/{first-png})`.

### 2.5 Sample page changes

`_samples/{sample}.adoc`:

- Keep existing frontmatter (title, source_url, is_metanorma_sample).
- Body: render the upstream sample inline. Two options:
  - (a) Pull the upstream sample `.adoc`, convert it, embed as a
    sub-document.
  - (b) Pull the upstream rendered HTML and iframe it.
- The rake task gains a `:samples` namespace that pulls each sample's
  upstream source into `_samples/{slug}/source.adoc`.

The simpler first cut is (b) — iframe the rendered HTML. (a) is the
long-term goal but requires flavor-aware rendering.

## 3. Migration plan (phased)

### Phase 0 — Done

- [x] Audit broken internal links (75 → 4, 4 are coradoc bugs)
- [x] Custom Node.js clean-URL-aware link audit (`/tmp/audit/audit-links.mjs`)
- [x] Fix `kebab` helper bug in `convert-adoc.rb` (leading-hyphen in
  asset paths)
- [x] Remove `samples/**` and `specs/**` from `srcExclude`
- [x] Create stub software pages for missing flavors (BSI, IEC, JIS,
  NIST, Plateau)
- [x] coradoc bug reports (`BUG-xref-inside-monospace.md`,
  `BUG-image-macro-in-source-block.md`)
- [x] Rake task `rake sync` for library docs + model diagrams

### Phase 1 — Per-flavor hub scaffolding (1–2 days)

- [ ] Audit each flavor's actual upstream docs location (varies: `docs/`,
      `README.adoc`, `spec/examples/`). Update
      `docs.git_repo_subtree` in each `_software/{flavor}.adoc` to match
      reality. Some flavors will need multiple pulls (e.g. README +
      `spec/examples/`).
- [ ] Decide: keep URL `/author/{flavor}/` or move to `/flavors/{flavor}/`.
      Recommendation: **move** — "flavors" is already in the nav and
      more accurate than burying flavors under `author/`.
- [ ] Create `.vitepress/data/flavors.ts` entries with fields:
      `slug`, `name`, `gem`, `repo_url`, `topics_path`, `ref_path`,
      `library_docs_path`, `model_slug`, `samples`.
- [ ] Create `<FlavorHub>` Vue component.
- [ ] Generate one hub page per flavor at `/flavors/{flavor}/index.md`.
- [ ] Add `redirect_from: /author/{flavor}/` and
      `/software/metanorma-{flavor}/` to each hub.

### Phase 2 — Embed model diagrams (0.5 day)

- [ ] Update `convert-adoc.rb` to render `_specs/{model}.adoc`
      `navigation.items` as embedded image sections.
- [ ] Verify each model page shows its diagrams.
- [ ] Audit broken image links via `audit-links.mjs`.

### Phase 3 — Render samples inline (1–2 days)

- [ ] Extend rake task: `rake sync:samples` pulls each sample's source.
- [ ] Add a `<SampleDocument>` component that renders the upstream
      source as a sub-document (option a) or iframes the rendered
      HTML (option b — simpler).
- [ ] Replace stub `_samples/*.adoc` bodies with real content.

### Phase 4 — Pull library docs into hub pages (1 day)

- [ ] Update rake task to confirm `rake sync:libs` works (it's
      currently untested — model sync was the smoke test).
- [ ] Convert pulled `docs/**/*.adoc` into per-flavor sub-pages under
      `/flavors/{flavor}/library-docs/`.
- [ ] Wire the hub page to list and link to those sub-pages.

### Phase 5 — De-duplicate cross-flavor vs per-flavor topics (ongoing)

- [ ] Audit overlap between `author/topics/*` and `author/{flavor}/topics/*`.
- [ ] Where per-flavor content is *only* an exception, mark it as such
      and link back to the cross-flavor original.
- [ ] Where per-flavor content has drifted, decide which is canonical
      and add a redirect from the other.

### Phase 6 — Clean up redirects and dead links

- [ ] Run final audit after all phases land.
- [ ] Verify `redirect_from:` entries cover every old path.
- [ ] Remove `ignoreDeadLinks: true` from `.vitepress/config.ts` and
      fix any remaining 404s.

## 4. Redirect strategy

- Every moved page gets `redirect_from: <old-path>` in frontmatter.
- `scripts/build-redirects.mjs` already exists and processes
  `redirect_from` — verify it covers the moves above.
- For the flavor consolidation specifically:
  - `/author/{flavor}/` → `/flavors/{flavor}/`
  - `/software/metanorma-{flavor}/` → `/flavors/{flavor}/`
  - `/specs/metanorma-model-{flavor}/` stays (model pages remain
    separate, just embedded in the hub).

## 5. Open questions

1. **Hub URL**: `/flavors/{flavor}/` (new) vs `/author/{flavor}/`
   (existing). Affects SEO and inbound links.
2. **Sample rendering**: iframe vs sub-document. Iframe is simpler
   but breaks search indexing.
3. **Library docs structure**: do we mirror upstream's `docs/` tree
   under `/flavors/{flavor}/library-docs/`, or flatten?
4. **Model spec granularity**: one page per model, or one page per
   diagram (so diagrams can be deep-linked)?
5. **Version pinning**: should `rake sync` record the upstream commit
   SHA per repo, so we can reproduce a build exactly?

## 6. Success metrics

- Zero broken internal links (with `ignoreDeadLinks: false`).
- Every flavor has a hub page that links to library docs, authoring
  topics, samples, and the model spec — all hosted on metanorma.org.
- Sample pages render actual content, not stubs.
- Model spec pages embed all synced diagrams.
- `rake sync` is idempotent and reproducible (record upstream SHAs).
- Audit script (`/tmp/audit/audit-links.mjs`) runs clean on every PR.
