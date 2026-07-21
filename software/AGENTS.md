# AGENTS.md — software/

## OVERVIEW

Software registry entries for Metanorma tools and flavors. Each `.adoc` file registers one project for display on the site's software listing (`/software/`).

## CONVENTIONS

- **Filename**: `metanorma-<name>.adoc` or `<tool>.adoc`
- **Required front-matter keys**: `title`, `description`, `repo_url`
- **Optional front-matter**: `external_links`, `docs`, `tags`, `feature_with_priority`
- **Tags**: use `Metanorma_flavor` for flavor gems; `writtenin:Ruby`, `interface:CLI` etc. for tooling
- **`docs.git_repo_subtree`**: set if docs live in a subdirectory of the repo — this frontmatter is what `bundle exec rake sync` uses to discover sync targets (docs pulled into `software/<gem>/docs/`, upstream clones cached in `_upstream/`)

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Register a new flavor | Create `software/metanorma-<flavor>.adoc` |
| Register a new tool | Create `software/<tool>.adoc` |
| Synced docs subtree config | `docs.git_repo_subtree` key in front-matter |
| Sync implementation | `Rakefile` (`bundle exec rake sync`) |

## ANTI-PATTERNS

- Do NOT commit `software/*/.git`, `software/*/docs`, or `software/_*_repo` — these are pulled by `rake sync` and gitignored
- Do NOT manually edit synced subtrees (`software/<gem>/docs/`) — they are overwritten on each sync
- Do NOT delete an entry (e.g. `metanorma-mpfa.adoc`) when a project is removed from the site — add it to the `SUPERSEDED` table in `scripts/convert/path_mapping.rb` instead
