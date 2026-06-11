# AGENTS.md — learn/

## OVERVIEW

Tutorial content for learning Metanorma. Structured as numbered lessons with matching exercises.

## STRUCTURE

```
learn/
├── lessons/           # Lesson pages (lesson-N-M.adoc, lesson-N.adoc)
├── exercises_code/    # Exercise answer files (exercise-N-M.adoc)
├── exercises.adoc     # Exercises index
├── learning_objectives.adoc
├── tutorial_complete.adoc
└── template.html      # Lesson page template
```

## CONVENTIONS

- **Lesson naming**: `lesson-<chapter>-<section>.adoc` (e.g., `lesson-2-3-1.adoc`)
- **Chapter landing**: `lesson-<chapter>.adoc` (e.g., `lesson-1.adoc`)
- **Exercise naming**: `exercise-<chapter>-<section>.adoc` matching lesson numbering
- **Front-matter**: lessons use `layout: learn` layout

## WHERE TO LOOK

| Task | Location |
|------|----------|
| Add a new lesson section | `learn/lessons/lesson-N-M.adoc` |
| Add exercise answer | `learn/exercises_code/exercise-N-M.adoc` |
| Update learning objectives | `learn/learning_objectives.adoc` |

## ANTI-PATTERNS

- Do NOT put exercise answers in `lessons/` — they belong in `exercises_code/`
- Keep lesson and exercise numbering in sync
