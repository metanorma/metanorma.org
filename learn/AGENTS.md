# AGENTS.md — learn/

## OVERVIEW

Tutorial content for learning Metanorma. Structured as numbered lessons with matching exercises.

## STRUCTURE

```
learn/
├── lessons/           # Lesson pages (lesson-N-M.adoc, lesson-N.adoc)
├── exercises-code/    # Exercise answer files (exercise-N-M.adoc)
├── exercises.adoc     # Exercises index
├── learning-objectives.adoc
├── tutorial-complete.adoc
├── _nav.yml           # Sidebar tree for the /learn/ section
└── template.html      # Lesson page template
```

## CONVENTIONS

- **Lesson naming**: `lesson-<chapter>-<section>.adoc` (e.g., `lesson-2-3-1.adoc`)
- **Chapter landing**: `lesson-<chapter>.adoc` (e.g., `lesson-1.adoc`)
- **Exercise naming**: `exercise-<chapter>-<section>.adoc` matching lesson numbering
- Every new page must be declared in `learn/_nav.yml` — `npm run check:nav` fails on orphans

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add a new lesson section | `learn/lessons/lesson-N-M.adoc` |
| Add exercise answer | `learn/exercises-code/exercise-N-M.adoc` |
| Update learning objectives | `learn/learning-objectives.adoc` |

## ANTI-PATTERNS

- Do NOT put exercise answers in `lessons/` — they belong in `exercises-code/`
- Keep lesson and exercise numbering in sync
