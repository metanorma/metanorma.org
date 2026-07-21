---
layout: ../layouts/MarkdownLayout.astro
title: Get Started with Metanorma
description: Install Metanorma and author your first standards document
---

# Get Started with Metanorma

> **Prefer a guided course?** The [Learn Metanorma tutorial](/learn/) walks
> through the same steps — and more — lesson by lesson.

## 1. Install Metanorma

The fastest way to get started is with Docker:

```bash
docker pull metanorma/metanorma
```

For native installation and other options, see the [Installation Guide](/install/).

## 2. Write your first document

Create a file called `my-standard.adoc`:

```asciidoc
= My First Standard
Author Name

== Introduction

This is my first Metanorma document.

== Scope

This document covers ...
```

## 3. Compile

Compile to HTML and PDF:

```bash
metanorma compile -t iso -x html,pdf my-standard.adoc
```

This produces `my-standard.html` and `my-standard.pdf`.

## 4. Choose your flavor

The `-t` flag selects the target standards organization (the "flavor"). Common flavors include:

- `iso` — ISO standards ([ISO quick-start sample](/flavors/iso/sample/))
- `iec` — IEC standards ([IEC quick-start sample](/flavors/iec/sample/))
- `ietf` — IETF RFCs and Internet-Drafts ([IETF quick-start sample](/flavors/ietf/sample/))
- `ieee` — IEEE standards ([IEEE quick-start sample](/flavors/ieee/sample/))
- `ogc` — Open Geospatial Consortium ([OGC quick-start sample](/flavors/ogc/sample/))

See the [flavors page](/flavors/) for the complete list.

## Next steps

- [Authoring Guide](/author/) — Learn the Metanorma authoring syntax
- [Installation Guide](/install/) — Detailed setup for all platforms
- [Developer Docs](/develop/) — Building on top of Metanorma
