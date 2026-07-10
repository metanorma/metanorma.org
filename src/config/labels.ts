import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { load } from 'js-yaml'

const raw = load(readFileSync(join(process.cwd(), 'src/config/root-labels.yml'), 'utf-8')) as Record<string, string>
export const rootLabels: Record<string, string> = raw
