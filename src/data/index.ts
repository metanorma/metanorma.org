import { flavors } from './flavors'
import { gems } from './software'
import { posts, data as postsData } from './posts'
import { homeData, counts } from './home'
import './drift-check'
import type { Flavor, SoftwareEntry, HomeData } from './types'

export type { Flavor, SoftwareEntry, HomeData } from './types'
export { flavors, gems, posts, postsData, homeData, counts }
export { checkFlavorDrift } from './drift-check'

export const catalog = {
  flavors,
  gems,
  posts,
  postsData,
  homeData,
  counts,
} as const
