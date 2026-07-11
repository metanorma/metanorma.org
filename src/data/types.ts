export interface SiteFrontmatter {
  title?: string
  description?: string
  excerpt?: string
  subtitle?: string
  date?: string
  layout?: string
  author?: {
    name?: string
    use_picture?: string
    social_links?: string[]
  }
  card_image?: string
  redirect_from?: string[]
  [key: string]: unknown
}

export interface Flavor {
  id: string
  label: string
  fullName: string
  category: 'international' | 'regional' | 'national' | 'industry' | 'other'
  status: 'supported' | 'experimental' | 'private'
  gem: string
  repoUrl: string
  logo?: string
  logoVariant?: 'light' | 'dark'
  authoringGuide: boolean
  description: string
  deliverables?: string[]
  baseFlavor?: string
}

export interface SoftwareEntry {
  id: string
  name: string
  displayName: string
  repoUrl: string
  description: string
  category: 'core' | 'cli' | 'flavor' | 'tool'
  flavorId?: string
}

export interface ArchitectureStep {
  number: string
  title: string
  desc: string
  link: string
}

export interface HeroSection {
  titleLine1: string
  titleLine2: string
  titleLine3: string
  subtitle: string
  primaryAction: { label: string; href: string }
  secondaryAction: { label: string; href: string }
}

export interface HomeData {
  hero: HeroSection
  pipeline: ArchitectureStep[]
  flavorsSection: { title: string; subtitle: string }
  blogSection: { title: string }
  ctaSection: {
    title: string
    primaryAction: { label: string; href: string }
    secondaryAction: { label: string; href: string }
  }
}
