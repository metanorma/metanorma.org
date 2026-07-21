import { flavors } from './flavors'
import type { HomeData } from './types'

const allFlavorCount = flavors.length

export const homeData: HomeData = {
  hero: {
    titleLine1: 'Standards',
    titleLine2: 'beyond words',
    titleLine3: '',
    subtitle: `Delivering today's and tomorrow's standards with the award-winning, open-source, digital standards suite for authoring & publishing.`,
    primaryAction: { label: 'Get Started', href: '/get-started/' },
    secondaryAction: { label: 'View Flavors', href: '/flavors/' },
    codeSample: {
      label: 'Write AsciiDoc, compile to any flavor',
      code: `= My First Standard

== Scope

This document specifies ...`,
      command: 'metanorma compile -t iso -x html,pdf my-standard.adoc',
    },
  },

  pipelineSection: {
    eyebrow: 'How it works',
    title: 'From source to published standard',
  },

  pipeline: [
    { number: '01', title: 'Author', desc: 'Write standards in AsciiDoc with semantic markup — WYSIWYM editing that separates content from presentation.', link: '/author/' },
    { number: '02', title: 'Validate', desc: 'Automatic validation against organization-specific rules and formal document schemas.', link: '/author/topics/output/validation/' },
    { number: '03', title: 'Compile', desc: 'Generate HTML, PDF, DOCX and more — each styled to match the target organization\'s requirements.', link: '/author/topics/output/' },
    { number: '04', title: 'Publish', desc: 'Build static sites, set up per-document releases, and integrate with CI/CD for organization-scale publishing.', link: '/install/publication-setup/' },
  ],

  flavorsSection: {
    eyebrow: `${allFlavorCount} flavors`,
    title: 'Supported organizations',
    subtitle: 'Spanning international, regional, national, and industry standards bodies.',
  },

  orgSection: {
    eyebrow: 'For your organization',
    title: 'Build a custom flavor',
    subtitle: 'Tailor Metanorma to your SDO\'s specific formatting, validation, and output requirements.',
    action: { label: 'Create your flavor', href: '/develop/topics/adopting-toolchain/' },
  },

  blogSection: {
    eyebrow: 'Latest news',
    title: 'From the blog',
    allPostsAction: { label: 'All posts', href: '/blog/' },
  },

  ctaSection: {
    title: 'Start authoring standards with Metanorma',
    primaryAction: { label: 'Installation Guide', href: '/install/' },
    secondaryAction: { label: 'View Software', href: '/software/' },
  },
}
