export interface NavItem {
  text: string
  link?: string
  items?: NavItem[]
}

export const nav: NavItem[] = [
  { text: 'Get Started', link: '/get-started/' },
  {
    text: 'Author',
    items: [
      { text: 'Authoring Guide', link: '/author/' },
      { text: 'Basics', link: '/author/basics/' },
      { text: 'Topics', link: '/author/topics/' },
      { text: 'Editors Guide', link: '/author/editors-guide/' },
    ],
  },
  {
    text: 'Flavors',
    items: [
      { text: 'All Flavors', link: '/flavors/' },
      { text: 'ISO', link: '/flavors/iso/' },
      { text: 'IEC', link: '/flavors/iec/' },
      { text: 'IEEE', link: '/flavors/ieee/' },
      { text: 'IETF', link: '/flavors/ietf/' },
      { text: 'ITU', link: '/flavors/itu/' },
      { text: 'OGC', link: '/flavors/ogc/' },
      { text: 'BIPM', link: '/flavors/bipm/' },
      { text: 'BSI', link: '/flavors/bsi/' },
      { text: 'NIST', link: '/flavors/nist/' },
      { text: 'CalConnect', link: '/flavors/cc/' },
      { text: 'IHO', link: '/flavors/iho/' },
      { text: 'JIS', link: '/flavors/jis/' },
      { text: 'PLATEAU', link: '/flavors/plateau/' },
    ],
  },
  {
    text: 'Develop',
    items: [
      { text: 'Developer Docs', link: '/develop/' },
      { text: 'Adopting the Spec', link: '/develop/topics/adopting-spec/' },
      { text: 'Creating a Flavor', link: '/develop/topics/adopting-toolchain/' },
    ],
  },
  { text: 'Reference', link: '/reference/' },
  { text: 'Software', link: '/software/' },
  { text: 'Library', link: '/library/' },
  { text: 'Blog', link: '/blog/' },
  { text: 'About', link: '/about/' },
]

export interface SidebarItem {
  text: string
  link?: string
  items?: SidebarItem[]
}

// Auto-generated per-section sidebars (flavor subdirs under /author/).
// Produced by scripts/build-sidebars.mjs from pages/ structure.
// Hand-configured entries in `sidebar` below take precedence.
import generatedSidebars from './sidebars.generated.json'
import { SidebarRegistry } from './registry'

const typedGenerated = generatedSidebars as Record<string, SidebarItem[]>

export const sidebar: Record<string, SidebarItem[]> = {
  '/author/': [
    { text: 'Getting Started', link: '/author/getting-started/' },
    {
      text: 'Basics',
      items: [
        { text: 'Approach', link: '/author/basics/approach/' },
        { text: 'What is Metanorma', link: '/author/basics/what/' },
        { text: 'Workflow', link: '/author/basics/workflow/' },
        { text: 'New Document', link: '/author/basics/new-document/' },
        { text: 'AsciiDoc Basics', link: '/author/basics/asciidoc/' },
        { text: 'WYSIWYM', link: '/author/basics/wysiwym/' },
        { text: 'Best Practices', link: '/author/basics/best-practices/' },
        { text: 'Numbering', link: '/author/basics/numbering/' },
        { text: 'Cross-references', link: '/author/basics/xrefs/' },
        { text: 'Reference Lookups', link: '/author/basics/reference-lookups/' },
        { text: 'Entering Bibliography', link: '/author/basics/entering-bib/' },
        { text: 'Entering Terms', link: '/author/basics/entering-terms/' },
      ],
    },
    {
      text: 'Topics',
      items: [
        { text: 'Blocks', link: '/author/topics/blocks/' },
        { text: 'Sections', link: '/author/topics/sections/' },
        { text: 'Inline Markup', link: '/author/topics/inline-markup/' },
        { text: 'Metadata', link: '/author/topics/metadata/' },
        { text: 'Output', link: '/author/topics/output/' },
        { text: 'Automation', link: '/author/topics/automation/' },
        { text: 'Collections', link: '/author/topics/collections/' },
        { text: 'Document Format', link: '/author/topics/document-format/' },
      ],
    },
    {
      text: 'Editors Guide',
      items: [
        { text: 'Best Practices', link: '/author/editors-guide/best-practices/' },
        { text: 'Edition Tips', link: '/author/editors-guide/edition-tips/' },
        { text: 'FAQ', link: '/author/editors-guide/faq/' },
      ],
    },
  ],
  '/install/': [
    { text: 'Installation Guide', link: '/install/' },
    { text: 'macOS', link: '/install/macos/' },
    { text: 'Windows', link: '/install/windows/' },
    { text: 'Linux', link: '/install/linux/' },
    { text: 'Docker', link: '/install/docker/' },
    { text: 'Development Install', link: '/install/develop/' },
    { text: 'Site Generation', link: '/install/site/' },
    { text: 'Publication Setup', link: '/install/publication-setup/' },
    { text: 'CI/CD', link: '/install/cicd/' },
    { text: 'GitHub Actions', link: '/install/cicd-github/' },
    { text: 'GitLab CI', link: '/install/cicd-gitlab/' },
    { text: 'Manual', link: '/install/man/' },
    { text: 'Usage', link: '/install/usage/' },
  ],
  '/learn/': [
    { text: 'Learn', link: '/learn/' },
    { text: 'Learning Objectives', link: '/learn/learning-objectives/' },
    { text: 'Tutorial (Complete)', link: '/learn/tutorial-complete/' },
    {
      text: 'Lesson 1: Introduction',
      items: [
        { text: 'Overview', link: '/learn/lessons/lesson-1/' },
        { text: '1.1 What is Metanorma?', link: '/learn/lessons/lesson-1-1/' },
        { text: '1.2 The Metanorma workflow', link: '/learn/lessons/lesson-1-2/' },
        { text: '1.3 Summary', link: '/learn/lessons/lesson-1-3/' },
      ],
    },
    {
      text: 'Lesson 2: Editing Documents',
      items: [
        { text: 'Overview', link: '/learn/lessons/lesson-2/' },
        { text: '2.1 Document Header', link: '/learn/lessons/lesson-2-1/' },
        { text: '2.2 Sections', link: '/learn/lessons/lesson-2-2/' },
        {
          text: '2.3 Blocks',
          items: [
            { text: '2.3.1 Lists', link: '/learn/lessons/lesson-2-3-1/' },
            { text: '2.3.2 Term definitions', link: '/learn/lessons/lesson-2-3-2/' },
            { text: '2.3.3 Tables', link: '/learn/lessons/lesson-2-3-3/' },
            { text: '2.3.4 Images', link: '/learn/lessons/lesson-2-3-4/' },
            { text: '2.3.5 Admonitions', link: '/learn/lessons/lesson-2-3-5/' },
            { text: '2.3.6 Code Samples', link: '/learn/lessons/lesson-2-3-6/' },
          ],
        },
        {
          text: '2.4 Inline Markup',
          items: [
            { text: '2.4.1 Text markup', link: '/learn/lessons/lesson-2-4-1/' },
            { text: '2.4.2 Index terms', link: '/learn/lessons/lesson-2-4-2/' },
            { text: '2.4.3 References', link: '/learn/lessons/lesson-2-4-3/' },
          ],
        },
        { text: '2.5 Summary', link: '/learn/lessons/lesson-2-5/' },
      ],
    },
    {
      text: 'Lesson 3: Reviewing',
      items: [
        { text: 'Overview', link: '/learn/lessons/lesson-3/' },
        { text: '3.1 Adding comments', link: '/learn/lessons/lesson-3-1/' },
        { text: '3.2 Rendering a draft', link: '/learn/lessons/lesson-3-2/' },
      ],
    },
    {
      text: 'Lesson 4: Publishing',
      items: [
        { text: 'Overview', link: '/learn/lessons/lesson-4/' },
        { text: '4.1 Compiling', link: '/learn/lessons/lesson-4-1/' },
        { text: '4.2 Troubleshooting', link: '/learn/lessons/lesson-4-2/' },
        { text: '4.3 Summary', link: '/learn/lessons/lesson-4-3/' },
      ],
    },
    { text: 'Exercises', link: '/learn/exercises/' },
  ],
  '/develop/': [
    { text: 'Developer Docs', link: '/develop/' },
    { text: 'Adopting the Spec', link: '/develop/topics/adopting-spec/' },
    { text: 'Adopting the Toolchain', link: '/develop/topics/adopting-toolchain/' },
    { text: 'Simple Adoption', link: '/develop/topics/simple-adoption/' },
    { text: 'Replacing AsciiDoc', link: '/develop/topics/replacing-asciidoc/' },
    { text: 'Date Formatting', link: '/develop/topics/date-formatting/' },
    { text: 'Localization', link: '/develop/topics/localization/' },
    { text: 'Metadata & Boilerplate', link: '/develop/topics/metadata-and-boilerplate/' },
    { text: 'Styling HTML Output', link: '/develop/topics/styling-output-html/' },
    { text: 'Styling Word Output', link: '/develop/topics/styling-output-msword/' },
  ],
  '/reference/': [
    { text: 'Reference', link: '/reference/' },
    { text: 'ISO Document Attributes', link: '/reference/iso-document-attributes/' },
    { text: 'Standard Document Attributes', link: '/reference/standoc-document-attributes/' },
  ],
  '/library/': [
    { text: 'Library', link: '/library/' },
    { text: 'Metanorma-BIPM', link: '/library/metanorma-bipm/' },
    { text: 'Metanorma-BSI', link: '/library/metanorma-bsi/' },
    { text: 'Metanorma-CC', link: '/library/metanorma-cc/' },
    { text: 'Metanorma-CSA', link: '/library/metanorma-csa/' },
    { text: 'Metanorma-GB', link: '/library/metanorma-gb/' },
    { text: 'Metanorma-IEC', link: '/library/metanorma-iec/' },
    { text: 'Metanorma-IEEE', link: '/library/metanorma-ieee/' },
    { text: 'Metanorma-IETF', link: '/library/metanorma-ietf/' },
    { text: 'Metanorma-IHO', link: '/library/metanorma-iho/' },
    { text: 'Metanorma-ISO', link: '/library/metanorma-iso/' },
    { text: 'Metanorma-ITU', link: '/library/metanorma-itu/' },
    { text: 'Metanorma-JIS', link: '/library/metanorma-jis/' },
    { text: 'Metanorma-M3AAWG', link: '/library/metanorma-m3aawg' },
    { text: 'Metanorma-NIST', link: '/library/metanorma-nist/' },
    { text: 'Metanorma-OGC', link: '/library/metanorma-ogc/' },
    { text: 'Metanorma-Plateau', link: '/library/metanorma-plateau/' },
    { text: 'Metanorma-Ribose', link: '/library/metanorma-ribose/' },
    { text: 'Metanorma-UN', link: '/library/metanorma-un/' },
  ],
}

export function sidebarFor(pathname: string): SidebarItem[] | null {
  return sidebarRegistry.resolve(pathname)
}

// SidebarRegistry absorbs the precedence rule (hand-authored wins over
// generated on both exact-key and sub-path conflicts). site.ts just
// hands it both sources — no filtering logic here.
export const sidebarRegistry = new SidebarRegistry({
  generated: typedGenerated,
  handAuthored: sidebar,
})
