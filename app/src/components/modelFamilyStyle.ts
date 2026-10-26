import { Network, Rows3 } from 'lucide-react'
import type { ModelFamily } from '@/services/types'

const familyStyle: Record<ModelFamily, { icon: typeof Rows3; text: string; dot: string; soft: string }> = {
  tabular: { icon: Rows3, text: 'text-deep-blue', dot: 'bg-deep-blue', soft: 'bg-mist-soft' },
  graph: { icon: Network, text: 'text-clay-ink', dot: 'bg-clay', soft: 'bg-clay-soft' },
}

export function modelFamilyStyle(family: ModelFamily) {
  return familyStyle[family]
}
