import type { MirrorFrontmatter } from '../lib/mirror-schema'

// The ONE frontmatter model lives in src/lib/mirror-schema.ts (zod,
// with .passthrough() for extra keys). Pages and layouts consume it via
// CollectionEntry<'mirror'>['data']; this alias keeps the historical
// name used by the layouts.
export type SiteFrontmatter = MirrorFrontmatter

export interface Flavor {
  id: string
  label: string
  fullName: string
  category: 'international' | 'regional' | 'national' | 'industry' | 'other'
  status: 'supported' | 'experimental' | 'private'
  gem: string
  repoUrl: string
  logo?: string
  logoLight?: string
  logoDark?: string
  logoVariant?: 'light' | 'dark'
  logoInvert?: boolean
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
  codeSample: { label: string; code: string; command: string }
}

export interface HomeSection {
  eyebrow: string
  title: string
  subtitle?: string
}

export interface HomeData {
  hero: HeroSection
  pipelineSection: HomeSection
  pipeline: ArchitectureStep[]
  flavorsSection: HomeSection
  orgSection: HomeSection & { action: { label: string; href: string } }
  blogSection: HomeSection & { allPostsAction: { label: string; href: string } }
  ctaSection: {
    title: string
    primaryAction: { label: string; href: string }
    secondaryAction: { label: string; href: string }
  }
}
