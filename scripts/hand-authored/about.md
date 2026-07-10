---
title: About Metanorma
description: About the Metanorma standards authoring platform — its mission, its logo, and its community
---

# About Metanorma

<div class="logo-hero">
  <img src="/metanorma-logo_full-light.svg" alt="Metanorma" class="hero-logo-light" />
  <img src="/metanorma-logo_full-dark.svg" alt="Metanorma" class="hero-logo-dark" />
</div>

Metanorma is an open-source toolchain for authoring, validating, and publishing
standards documents. It is developed by [Ribose](https://www.ribose.com) and the
Metanorma community.

## The Name &amp; Logo

The name **Metanorma** combines the Greek prefix *meta-* (meaning "beyond" or
"encompassing") with *norma*, the Latin word for a carpenter's square — the
instrument from which we get the word *standard*. Together, the name speaks to
the ambition of going beyond individual standards to encompass the entire
ecosystem of standards authoring.

The Metanorma logo brings together four layers of meaning:

- **The Lighthouse** — The logo echoes the **Pharos of Alexandria**, the great
  lighthouse that guided sailors safely to harbor through treacherous waters.
  Metanorma serves the same purpose for the standards world: it shines a
  guiding light, helping authors navigate the complex, often turbulent sea of
  formats, requirements, and publication workflows that surround each standards
  body.

- **The Library** — Alexandria was also home to the **Great Library**, a
  universal repository that sought to collect all human knowledge. Metanorma
  aspires to a similar ideal: a single, organized framework where standards
  from every organization — ISO, IEC, IEEE, ITU, IETF, and dozens more —
  converge into one coherent system. Amidst the sea of turbulence that is the
  standards publishing landscape, Metanorma provides a library of order.

- **The Pen** — The vertical silhouette of the logo resembles a **pen nib**.
  This is no accident: Metanorma's purpose is to help you put your requirements
  from pen to proverbial paper. Every standard begins as an idea, a requirement
  written down. Metanorma is the instrument that carries that writing through to
  a polished, published document.

- **The Foundation** — At the base of the logo sits a pattern of **Ribose
  hexagons**. The hexagon is nature's building block — the most efficient
  tessellation in the natural world, found in honeycombs, molecular structures,
  and the carbon rings of organic chemistry. These hexagonal foundation blocks
  represent the solid, modular architecture upon which Metanorma is built, and
  they connect the logo to its creator, Ribose.

<div class="logo-showcase">
  <div class="logo-card light-card">
    <div class="logo-card-header">Light Mode</div>
    <img src="/metanorma-logo_full-light.svg" alt="Metanorma Logo (Light)" class="logo-display" />
  </div>
  <div class="logo-card dark-card">
    <div class="logo-card-header">Dark Mode</div>
    <img src="/metanorma-logo_full-dark.svg" alt="Metanorma Logo (Dark)" class="logo-display" />
  </div>
</div>

In **light mode**, the logo's lighthouse form stands clear against a bright
canvas — the way a real lighthouse is most visible by day, a landmark you can
orient by at a glance.

In **dark mode**, the logo takes on the quality of a lighthouse at night: the
beacon itself becomes the focal point, glowing against the darkness, guiding
the way when the surroundings are hardest to see.

## What is Metanorma?

Metanorma is a standards authoring platform that lets you write technical
documents — including international standards — in AsciiDoc, then compile them
to multiple output formats (Word, PDF, HTML) through a single pipeline.

## How does it work?

The Metanorma pipeline has four stages:

1. **Author** — Write documents in AsciiDoc using Metanorma-flavored syntax
2. **Validate** — Ensure compliance with the target organization's rules
3. **Compile** — Generate output in multiple formats (HTML, PDF, DOC, etc.)
4. **Publish** — Distribute documents through automated channels

## Flavors

Metanorma supports standards organizations including ISO, IEC, ITU, IEEE, IETF,
OGC, BSI, and many others. Each organization has its own "flavor" that enforces
the correct formatting and structural rules.

See the [flavors page](/flavors/) for the full list.

## Open source

All Metanorma code is open source and hosted on the [Metanorma GitHub
organization](https://github.com/metanorma).

## Contact

- [GitHub Discussions](https://github.com/metanorma/discussions/discussions)
- Email: open.source@ribose.com

<style scoped>
.logo-hero {
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 24px 0 40px;
}
.logo-hero img {
  max-width: 360px;
  width: 100%;
  height: auto;
}
.hero-logo-dark { display: none; }
html.dark .hero-logo-light { display: none; }
html.dark .hero-logo-dark { display: block; }

.logo-showcase {
  display: flex;
  gap: 16px;
  margin: 32px 0 40px;
}
.logo-card {
  flex: 1;
  border-radius: 14px;
  border: 1px solid var(--vp-c-divider);
  overflow: hidden;
}
.logo-card-header {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 10px 16px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.light-card .logo-card-header {
  background: #f7f5f2;
  color: #4A4358;
}
.dark-card .logo-card-header {
  background: #14111c;
  color: #a8a0b8;
}
.logo-display {
  width: 100%;
  padding: 32px 24px;
  display: block;
}
.light-card .logo-display {
  background: #fdfcfa;
}
.dark-card .logo-display {
  background: #0c0a12;
}

@media (max-width: 640px) {
  .logo-showcase {
    flex-direction: column;
  }
}
</style>
