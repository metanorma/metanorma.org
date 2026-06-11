# AGENTS.md — _software/

## OVERVIEW

Software registry entries for Metanorma tools and flavors. Each `.adoc` file registers one project for display on the site's software listing.

## CONVENTIONS

- **Filename**: `metanorma-<name>.adoc` or `<tool>.adoc`
- **Required front-matter keys**: `title`, `description`, `repo_url`
- **Optional front-matter**: `external_links`, `docs`, `tags`, `feature_with_priority`
- **Tags**: use `Metanorma_flavor` for flavor gems; `writtenin:Ruby`, `interface:CLI` etc. for tooling
- **`docs.git_repo_subtree`**: set if docs live in a subdirectory of the repo (cloned at build time)
- **`feature_with_priority`**: integer — lower = higher prominence on homepage

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Register a new flavor | Create `_software/metanorma-<flavor>.adoc` |
| Register a new tool | Create `_software/<tool>.adoc` |
| Cloned docs subtree config | `docs.git_repo_subtree` key in front-matter |

## ANTI-PATTERNS

- Do NOT commit `_software/*/.git`, `_software/*/docs`, or `_software/*/_*_repo` — these are cloned at build time and gitignored
- Do NOT manually edit cloned subtrees — they are overwritten on each build
