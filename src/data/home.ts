import { flavors } from './flavors'
import type { HomeData } from './types'

const supportedFlavorCount = flavors.filter(f => f.status === 'supported').length
const allFlavorCount = flavors.length

export const counts = { supportedFlavorCount, allFlavorCount }

export const homeData: HomeData = {
  hero: {
    titleLine1: 'The Standard',
    titleLine2: 'of Standards',
    titleLine3: '',
    subtitle: `Author, validate, and publish standards documents with ${supportedFlavorCount}+ organization-specific flavors — from ISO to IETF, IEEE to ITU.`,
    primaryAction: { label: 'Get Started', href: '/get-started/' },
    secondaryAction: { label: 'View Flavors', href: '/flavors/' },
  },

  pipeline: [
    { number: '01', title: 'Author', desc: 'Write standards in AsciiDoc with semantic markup — WYSIWYM editing that separates content from presentation.', link: '/author/' },
    { number: '02', title: 'Validate', desc: 'Automatic validation against organization-specific rules and formal document schemas.', link: '/author/' },
    { number: '03', title: 'Compile', desc: 'Generate HTML, PDF, DOCX and more — each styled to match the target organization\'s requirements.', link: '/author/topics/output/' },
    { number: '04', title: 'Publish', desc: 'Build static sites, set up per-document releases, and integrate with CI/CD for organization-scale publishing.', link: '/install/publication-setup/' },
  ],

  flavorsSection: {
    title: 'Supported Standards Organizations',
    subtitle: `${allFlavorCount} flavors spanning international, regional, national, and industry standards bodies.`,
  },

  blogSection: {
    title: 'Latest News',
  },

  ctaSection: {
    title: 'Start authoring standards with Metanorma',
    primaryAction: { label: 'Installation Guide', href: '/install/' },
    secondaryAction: { label: 'View Software', href: '/software/' },
  },
}
